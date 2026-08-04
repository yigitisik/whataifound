// Sign out: clear the cookie and go back.
//
// POST only. A GET would be reachable from an <img src> on any page on the internet,
// which is a real, if petty, cross-site nuisance. sameOrigin() plus SameSite=Lax cover
// the rest.
import { cookie, SESSION_COOKIE } from "../_lib/session.js";
import { origin, json, methodNotAllowed, sameOrigin } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!sameOrigin(req)) return json(res, 403, { error: "cross_origin" });

  const secure = origin(req).startsWith("https://");
  res.setHeader("Set-Cookie", cookie(SESSION_COOKIE, "", { maxAge: 0, secure }));
  json(res, 200, { ok: true });
}
