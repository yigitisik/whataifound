// Submitting a contribution from the UI, and seeing what happened to it.
//
// GET  /api/proposals   the caller's own submissions, newest first
// POST /api/proposals   {kind, entryId, payload} submits one
//
// A submission does NOT open a pull request. It writes a pending row, and a maintainer
// opens the pull request from /admin.
//
// That is a deliberate departure from the first sketch of this phase, which had the bot
// push a branch the moment a form was submitted. A Gmail address is free and unlimited,
// so an endpoint that creates branches on demand hands anyone with one the ability to
// write to the repository: branch clutter, CI minutes, and a notification per push, all
// before a human has looked at anything. Gating on a maintainer's click means the worst
// an unreviewed submission can do is sit in a queue, which is the failure mode this
// design was willing to accept. The queue is bounded per account below.
//
// Nothing here is published. A proposal becomes part of the registry when a maintainer
// merges the pull request it became, and not before.
import { db } from "./_lib/db.js";
import { sessionFrom } from "./_lib/session.js";
import { json, methodNotAllowed, readJson, sameOrigin } from "./_lib/http.js";
import { isEntryId, entryGrades } from "./_lib/registry.js";
import { validateProposal, PROPOSAL_KINDS } from "./_lib/proposals.js";

// How much unreviewed work one account may have waiting. Not a rate limit in the
// throughput sense: it is a cap on how much of a maintainer's attention one person can
// claim before any of it has been looked at. A contributor whose submissions are being
// accepted is never near it.
const MAX_PENDING = 10;
const MAX_PER_DAY = 20;

export default async function handler(req, res) {
  const id = sessionFrom(req);
  if (!id) return json(res, 401, { error: "signed_out" });
  if (req.method === "GET") return list(req, res, id);
  if (req.method === "POST") return create(req, res, id);
  return methodNotAllowed(res, ["GET", "POST"]);
}

/** The shape /account and /u/<handle> render. Never includes another account's rows. */
function publicRow(r) {
  return {
    id: r.id,
    kind: r.kind,
    entryId: r.entry_id,
    status: r.status,
    prNumber: r.pr_number,
    prUrl: r.pr_url,
    note: r.decided_note,
    date: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at))
      .slice(0, 10),
  };
}

async function list(req, res, id) {
  try {
    const rows = await db()`
      select id, kind, entry_id, status, pr_number, pr_url, decided_note, created_at
        from proposals where account_id = ${id}
       order by created_at desc, id
       limit 100`;
    json(res, 200, { proposals: rows.map(publicRow) });
  } catch (err) {
    console.error("proposals list", err);
    json(res, 503, { error: "unavailable" });
  }
}

async function create(req, res, id) {
  if (!sameOrigin(req)) return json(res, 403, { error: "cross_origin" });

  let body;
  try {
    // A new entry with detail, novelty check and twenty sources is the largest thing
    // this endpoint accepts, and it is nowhere near this.
    body = await readJson(req, 64 * 1024);
  } catch (err) {
    return json(res, 400, { error: err.message === "body_too_large" ? "too_large" : "bad_json" });
  }

  const kind = String(body.kind ?? "");
  if (!PROPOSAL_KINDS.includes(kind)) {
    return json(res, 400, { error: "kind_invalid", allowed: PROPOSAL_KINDS });
  }
  // Every kind but a new entry is about an entry that already exists.
  const entryId = kind === "entry" ? null : String(body.entryId ?? "");
  if (kind !== "entry" && !isEntryId(entryId)) {
    return json(res, 400, { error: "unknown_entry", message: "That entry is not in the registry." });
  }

  const sql = db();
  let account;
  try {
    const rows = await sql`
      select id, handle, display_name, orcid, github_login, role, banned_at
        from accounts where id = ${id} limit 1`;
    account = rows[0];
  } catch (err) {
    console.error("proposals account", err);
    return json(res, 503, { error: "unavailable" });
  }
  if (!account) return json(res, 401, { error: "signed_out" });
  if (account.banned_at) return json(res, 403, { error: "banned" });

  // A challenge is checked against the grades the entry currently carries, so that
  // proposing the grade already set is refused here rather than by a maintainer. The
  // grades come from the generated registry, which the same build wrote as the pages
  // the submitter was reading.
  const entry = kind === "challenge" ? entryGrades(entryId) : null;

  const checked = validateProposal(kind, body.payload, entry);
  if (checked.error) return json(res, 400, checked.error);

  try {
    const [pending] = await sql`
      select count(*) filter (where status in ('pending','needs_info'))::int as open,
             count(*) filter (where created_at > now() - interval '1 day')::int as today
        from proposals where account_id = ${id}`;
    if (pending.open >= MAX_PENDING) {
      return json(res, 429, {
        error: "too_many_pending",
        message: `You have ${pending.open} submissions waiting for review. `
          + "Please wait for those before sending more.",
      });
    }
    if (pending.today >= MAX_PER_DAY) {
      return json(res, 429, { error: "too_many_today", message: "That is enough for one day." });
    }

    const [row] = await sql`
      insert into proposals (account_id, kind, entry_id, payload)
      values (${id}, ${kind}, ${entryId}, ${sql.json(checked.value)})
      returning id, kind, entry_id, status, pr_number, pr_url, decided_note, created_at`;
    json(res, 201, { ok: true, proposal: publicRow(row) });
  } catch (err) {
    console.error("proposals create", err);
    json(res, 503, { error: "unavailable" });
  }
}
