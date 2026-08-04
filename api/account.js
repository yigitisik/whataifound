// Account settings: PATCH to change them, DELETE to erase the account.
//
// Every field here is user-controlled and most of them end up rendered next to a real
// person's name, so each is validated on the way in rather than trusted and escaped on
// the way out. `role` is absent on purpose: it mirrors the ladder in GOVERNANCE.md and
// only a maintainer can move someone along it.
import { db } from "./_lib/db.js";
import { sessionFrom, cookie, SESSION_COOKIE } from "./_lib/session.js";
import { json, methodNotAllowed, readJson, sameOrigin, origin } from "./_lib/http.js";
import { validateHandle, normaliseHandle, RENAME_COOLDOWN_DAYS } from "./_lib/handles.js";
import { validateDisplayName, normaliseDisplayName } from "./_lib/names.js";

const ORCID_RE = /^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$/;
// GitHub's own rule: alphanumeric or single hyphens, no leading or trailing hyphen,
// 39 characters maximum.
const GITHUB_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export default async function handler(req, res) {
  const id = sessionFrom(req);
  if (!id) return json(res, 401, { error: "signed_out" });
  if (!sameOrigin(req)) return json(res, 403, { error: "cross_origin" });

  if (req.method === "PATCH") return patch(req, res, id);
  if (req.method === "DELETE") return remove(req, res, id);
  return methodNotAllowed(res, ["PATCH", "DELETE"]);
}

async function patch(req, res, id) {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return json(res, 400, { error: err.message === "body_too_large" ? "too_large" : "bad_json" });
  }

  const sql = db();
  const rows = await sql`
    select handle, handle_changed_at from accounts where id = ${id} limit 1`;
  if (!rows.length) return json(res, 401, { error: "signed_out" });
  const current = rows[0];

  const patchFields = {};

  // ---- handle ------------------------------------------------------------
  if (body.handle !== undefined) {
    const next = normaliseHandle(body.handle);
    if (next !== current.handle) {
      const reason = validateHandle(next);
      if (reason) return json(res, 400, { error: "handle_invalid", message: reason });
      // One rename per cooldown. A handle is how other people refer to a contributor,
      // so it should not be a moving target.
      if (current.handle_changed_at) {
        const next_at = new Date(current.handle_changed_at).getTime()
          + RENAME_COOLDOWN_DAYS * 86400 * 1000;
        if (Date.now() < next_at) {
          return json(res, 429, {
            error: "handle_cooldown",
            message: `You can change your handle again after ${new Date(next_at).toISOString().slice(0, 10)}.`,
            canRenameAt: new Date(next_at).toISOString(),
          });
        }
      }
      patchFields.handle = next;
    }
  }

  // ---- display name ------------------------------------------------------
  // Same rules as the signup path, from the same module: see api/_lib/names.js for why
  // a display name is a security-relevant field rather than a cosmetic one.
  if (body.displayName !== undefined) {
    const reason = validateDisplayName(body.displayName);
    if (reason) {
      const error = reason.startsWith("At most") ? "display_too_long" : "display_invalid";
      return json(res, 400, { error, message: reason });
    }
    patchFields.display_name = normaliseDisplayName(body.displayName) || null;
  }

  // ---- ORCID -------------------------------------------------------------
  if (body.orcid !== undefined) {
    const v = String(body.orcid || "").trim();
    if (v && !ORCID_RE.test(v)) {
      return json(res, 400, { error: "orcid_invalid", message: "ORCID looks like 0000-0002-1825-0097." });
    }
    patchFields.orcid = v || null;
  }

  // ---- GitHub ------------------------------------------------------------
  if (body.githubLogin !== undefined) {
    const v = String(body.githubLogin || "").trim().replace(/^@/, "");
    if (v && !GITHUB_RE.test(v)) {
      return json(res, 400, { error: "github_invalid", message: "That is not a GitHub username." });
    }
    patchFields.github_login = v || null;
  }

  // ---- public profile ----------------------------------------------------
  if (body.isPublic !== undefined) patchFields.is_public = Boolean(body.isPublic);

  if (!Object.keys(patchFields).length) return json(res, 200, { ok: true, changed: [] });

  try {
    if (patchFields.handle) {
      await sql`
        update accounts
           set ${sql(patchFields)}, handle_changed_at = now()
         where id = ${id}`;
    } else {
      await sql`update accounts set ${sql(patchFields)} where id = ${id}`;
    }
  } catch (err) {
    // Someone took the handle between the check and the write. The unique index is the
    // arbiter, not the read above, which is why this is caught rather than prevented.
    if (err?.code === "23505") {
      return json(res, 409, { error: "handle_taken", message: "That handle is taken." });
    }
    console.error("account patch", err);
    return json(res, 503, { error: "unavailable" });
  }
  json(res, 200, { ok: true, changed: Object.keys(patchFields) });
}

/**
 * Delete the account.
 *
 * What goes: the row, and with it the email, the handle and the settings. What stays:
 * any contribution already merged into data/entries.json, because that file is public,
 * CC BY, mirrored by anyone who cloned it, and is the registry's audit trail. Credit
 * there is a statement about who did a piece of work, not personal data we can retract,
 * and the privacy page says so in those words.
 */
async function remove(req, res, id) {
  try {
    await db()`delete from accounts where id = ${id}`;
  } catch (err) {
    console.error("account delete", err);
    return json(res, 503, { error: "unavailable" });
  }
  const secure = origin(req).startsWith("https://");
  res.setHeader("Set-Cookie", cookie(SESSION_COOKIE, "", { maxAge: 0, secure }));
  json(res, 200, { ok: true });
}
