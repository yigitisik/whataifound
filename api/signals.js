// Triage signals: three one-click ways to say an entry needs attention.
//
// GET  /api/signals            counts for every entry, for the review queue
// GET  /api/signals?entry=<id> counts for one entry, for its finding page
// POST /api/signals            {entryId, kind} toggles one signal
//
// The counts are public and carry no identities: who flagged what is not shown
// anywhere, including to maintainers, because a page that credits people for finding
// problems is a page that rewards flagging. `mine` is the caller's own signals, and is
// present only when there is a session.
//
// Read GET as unauthenticated by design rather than by omission. The queue is the
// registry's open task list and it is public on /review; hiding the ordering behind a
// sign-in would make the page worse for the reader most likely to fix something.
import { db } from "./_lib/db.js";
import { sessionFrom } from "./_lib/session.js";
import { json, methodNotAllowed, readJson, sameOrigin } from "./_lib/http.js";
import { isEntryId, isSignalKind, SIGNAL_KINDS } from "./_lib/registry.js";

export default async function handler(req, res) {
  if (req.method === "GET") return read(req, res);
  if (req.method === "POST") return toggle(req, res);
  return methodNotAllowed(res, ["GET", "POST"]);
}

/** Rows of {entry_id, kind, n} into {entryId: {kind: n}}. */
function shape(rows) {
  const out = {};
  for (const r of rows) {
    (out[r.entry_id] ||= {})[r.kind] = Number(r.n);
  }
  return out;
}

async function read(req, res) {
  const url = new URL(req.url, "http://x");
  const entry = url.searchParams.get("entry");

  // An unknown id is answered with empty counts rather than 404. The caller is a page
  // that already rendered the entry, so a 404 here would mean the two disagree, and the
  // useful reply to "how many signals does this have" is "none".
  if (entry !== null && !isEntryId(entry)) {
    return json(res, 200, { counts: {}, mine: {} });
  }

  const id = sessionFrom(req);
  const sql = db();

  try {
    const counts = entry === null
      ? await sql`select entry_id, kind, count(*)::int as n from signals group by 1, 2`
      : await sql`select entry_id, kind, count(*)::int as n
                    from signals where entry_id = ${entry} group by 1, 2`;

    let mine = {};
    if (id) {
      const rows = entry === null
        ? await sql`select entry_id, kind from signals where account_id = ${id}`
        : await sql`select entry_id, kind from signals
                     where account_id = ${id} and entry_id = ${entry}`;
      for (const r of rows) (mine[r.entry_id] ||= []).push(r.kind);
    }
    json(res, 200, { counts: shape(counts), mine });
  } catch (err) {
    console.error("signals read", err);
    // Degrade to empty rather than to an error. The queue and the finding page are
    // fully readable without signals, and a 503 here would put a red console error on
    // a page that is working.
    json(res, 200, { counts: {}, mine: {}, degraded: true });
  }
}

async function toggle(req, res) {
  const id = sessionFrom(req);
  if (!id) return json(res, 401, { error: "signed_out" });
  if (!sameOrigin(req)) return json(res, 403, { error: "cross_origin" });

  let body;
  try {
    body = await readJson(req, 2 * 1024);
  } catch (err) {
    return json(res, 400, { error: err.message === "body_too_large" ? "too_large" : "bad_json" });
  }

  const entryId = body.entryId;
  const kind = body.kind;
  if (!isEntryId(entryId)) return json(res, 400, { error: "unknown_entry" });
  if (!isSignalKind(kind)) {
    return json(res, 400, { error: "unknown_kind", allowed: SIGNAL_KINDS });
  }

  const sql = db();
  try {
    // A banned account keeps its session working everywhere else and is simply inert
    // here, which is the quietest way to handle it: nothing tells the holder which
    // action tripped a ban, so nothing helps them work around it.
    const who = await sql`select banned_at from accounts where id = ${id} limit 1`;
    if (!who.length) return json(res, 401, { error: "signed_out" });
    if (who[0].banned_at) return json(res, 403, { error: "banned" });

    // Toggle, resolved by the primary key rather than by reading first and then
    // writing. Two clicks racing each other cannot both insert, and the delete is
    // exact, so the count is right without a transaction.
    const del = await sql`
      delete from signals
       where account_id = ${id} and entry_id = ${entryId} and kind = ${kind}
      returning 1`;
    let on = false;
    if (!del.length) {
      await sql`
        insert into signals (account_id, entry_id, kind)
        values (${id}, ${entryId}, ${kind})
        on conflict do nothing`;
      on = true;
    }

    const counts = await sql`
      select entry_id, kind, count(*)::int as n
        from signals where entry_id = ${entryId} group by 1, 2`;
    json(res, 200, { ok: true, on, entryId, kind, counts: shape(counts)[entryId] || {} });
  } catch (err) {
    console.error("signals toggle", err);
    json(res, 503, { error: "unavailable" });
  }
}
