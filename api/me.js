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
    // Phases 2 and 3 fill these. Present and empty from the start so the account page
    // can render its shape without branching on their absence.
    stats: { checksAccepted: 0, checksSubmitted: 0, entriesMerged: 0, challengesUpheld: 0 },
    contributions: [],
  });
}
