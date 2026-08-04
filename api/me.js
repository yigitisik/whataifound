// The one request the whole UI hydrates from.
//
// Signed out it answers 200 with {signedIn:false} rather than 401: every page calls
// this on load, and a wall of 401s in the console makes a normal state look like a
// fault. The account control reads it to swap the pre-rendered signed-out header for a
// signed-in one, which is why it has to be cheap and never cached.
import { db } from "./_lib/db.js";
import { sessionFrom } from "./_lib/session.js";
import { json, methodNotAllowed } from "./_lib/http.js";
import { RENAME_COOLDOWN_DAYS } from "./_lib/handles.js";
import { entryTitle } from "./_lib/registry.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const id = sessionFrom(req);
  if (!id) return json(res, 200, { signedIn: false });

  let row;
  try {
    const rows = await db()`
      select id, handle, handle_changed_at, display_name, orcid, github_login,
             is_public, role, created_at, banned_at
        from accounts where id = ${id} limit 1`;
    row = rows[0];
  } catch (err) {
    console.error("me db", err);
    return json(res, 503, { error: "unavailable" });
  }

  // A cookie that outlived its row, or a banned account. Either way the caller is not
  // signed in; the cookie is left alone and simply stops resolving.
  if (!row || row.banned_at) return json(res, 200, { signedIn: false });

  // email is deliberately absent. Nothing in the UI needs it, and the surest way to
  // keep it unpublished is for the endpoint that feeds every page never to carry it.
  const cooldownMs = RENAME_COOLDOWN_DAYS * 86400 * 1000;
  const changed = row.handle_changed_at ? new Date(row.handle_changed_at).getTime() : 0;
  const renameAt = changed ? changed + cooldownMs : 0;

  // The stats and the contribution history. Read separately from the account row and
  // tolerated as empty: a database that has run 001 but not 003 still signs people in
  // and still shows them a profile, which is the difference between a partly applied
  // migration being a nuisance and being an outage.
  let stats = { checksAccepted: 0, checksSubmitted: 0, entriesMerged: 0, challengesUpheld: 0 };
  let contributions = [];
  let signals = 0;
  try {
    const sql = db();
    // account_stats is a view, defined once in db/003_proposals.sql. Counting here as
    // well would be a second definition of "accepted", and the one that is wrong is the
    // one a person reads about their own work.
    const [s] = await sql`
      select checks_submitted, checks_accepted, entries_merged, challenges_upheld
        from account_stats where account_id = ${id}`;
    if (s) {
      stats = {
        checksSubmitted: Number(s.checks_submitted),
        checksAccepted: Number(s.checks_accepted),
        entriesMerged: Number(s.entries_merged),
        challengesUpheld: Number(s.challenges_upheld),
      };
    }
    const rows = await sql`
      select id, kind, entry_id, status, pr_number, pr_url, decided_note, created_at,
             payload -> 'title' as payload_title
        from proposals where account_id = ${id}
       order by created_at desc, id
       limit 50`;
    contributions = rows.map(r => ({
      id: r.id,
      kind: r.kind,
      entryId: r.entry_id,
      // A proposal for a brand new entry has no entry to name yet, so it borrows the
      // title it proposed. An id that has since left the registry falls back to the id.
      title: (r.entry_id ? entryTitle(r.entry_id) : r.payload_title) || r.entry_id || "New entry",
      status: r.status,
      prNumber: r.pr_number,
      prUrl: r.pr_url,
      note: r.decided_note,
      date: (r.created_at instanceof Date ? r.created_at.toISOString()
        : String(r.created_at)).slice(0, 10),
    }));
    const [sig] = await sql`select count(*)::int as n from signals where account_id = ${id}`;
    signals = Number(sig?.n || 0);
  } catch (err) {
    // Deliberately not fatal, and deliberately logged: the header on every page depends
    // on this endpoint answering, and a missing contribution list is a worse page while
    // a failed one is no page at all.
    console.error("me stats", err);
  }

  json(res, 200, {
    signedIn: true,
    account: {
      handle: row.handle,
      displayName: row.display_name,
      orcid: row.orcid,
      githubLogin: row.github_login,
      isPublic: row.is_public,
      role: row.role,
      createdAt: row.created_at,
      // Absolute instant rather than a countdown: the client renders the wait, and a
      // duration computed here would be stale the moment it was cached anywhere.
      canRenameAt: renameAt > Date.now() ? new Date(renameAt).toISOString() : null,
    },
    stats: { ...stats, signals },
    contributions,
  });
}
