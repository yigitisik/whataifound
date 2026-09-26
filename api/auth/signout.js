// Sign out: retire every session this account holds, clear the cookie, and go back.
//
// POST only. A GET would be reachable from an <img src> on any page on the internet,
// which is a real, if petty, cross-site nuisance. sameOrigin() plus SameSite=Lax cover
// the rest.
//
// Clearing the cookie alone only deletes this browser's copy. A signed cookie stays
// valid for its whole thirty days wherever else it has been copied to, so the account's
// session_version is bumped as well, and every cookie issued under the old value stops
// resolving (see sessionOf() in api/_lib/session.js). That signs the account out on
// every device, which is the point: the one moment a person asks to be signed out is
// the only signal the server gets that a session should end.
import { db } from "../_lib/db.js";
import { cookie, sessionOf, SESSION_COOKIE } from "../_lib/session.js";
import { origin, json, methodNotAllowed, sameOrigin } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!sameOrigin(req)) return json(res, 403, { error: "cross_origin" });

  const s = sessionOf(req);
  if (s) {
    try {
      // Matched on the version as well as the id, so a cookie that is already retired
      // cannot be used to sign out the session that replaced it.
      await db()`
        update accounts set session_version = session_version + 1
         where id = ${s.id} and session_version = ${s.v}`;
    } catch (err) {
      // Still clear the cookie. Failing the sign-out would leave the reader signed in
      // on the one device they are looking at, which is the worse of the two outcomes.
      console.error("auth/signout db", err);
    }
  }

  const secure = origin(req).startsWith("https://");
  res.setHeader("Set-Cookie", cookie(SESSION_COOKIE, "", { maxAge: 0, secure }));
  json(res, 200, { ok: true });
}
