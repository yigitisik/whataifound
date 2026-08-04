// Who is asking, and whether they are allowed.
//
// The ladder is GOVERNANCE.md's, not a second one invented for the code: a reader signs
// in, a contributor has had something merged, a reviewer has met the bar in that
// document, and a maintainer can merge. Only a maintainer can move anyone along it, and
// only through a direct database statement: nothing user-facing writes accounts.role,
// which is why there is no API to grant a role at all.
import { db } from "./db.js";
import { sessionFrom } from "./session.js";
import { json } from "./http.js";

export const ROLES = ["reader", "contributor", "reviewer", "maintainer"];

/**
 * Resolve the caller, or answer and return null.
 *
 * Returns the account row, or null having already written the response. Callers read as
 * `const me = await require(req, res, "maintainer"); if (!me) return;` so a missing
 * check is a missing early return, which is visible, rather than a permissive default.
 */
export async function requireAccount(req, res, role = null) {
  const id = sessionFrom(req);
  if (!id) {
    json(res, 401, { error: "signed_out" });
    return null;
  }
  let row;
  try {
    const rows = await db()`
      select id, handle, display_name, orcid, github_login, role, banned_at
        from accounts where id = ${id} limit 1`;
    row = rows[0];
  } catch (err) {
    console.error("roles lookup", err);
    json(res, 503, { error: "unavailable" });
    return null;
  }
  if (!row || row.banned_at) {
    json(res, 401, { error: "signed_out" });
    return null;
  }
  if (role && !atLeast(row.role, role)) {
    // 404 rather than 403. A signed-in reader who guesses the admin URL learns nothing
    // about whether it exists, and the page they get is the one they would get for any
    // other address that is not theirs.
    json(res, 404, { error: "not_found" });
    return null;
  }
  return row;
}

/** Roles are ordered, so "at least reviewer" includes maintainer. */
export function atLeast(have, needed) {
  const h = ROLES.indexOf(have);
  const n = ROLES.indexOf(needed);
  return h >= 0 && n >= 0 && h >= n;
}
