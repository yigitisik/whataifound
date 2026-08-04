// Step one of sign-in: send the browser to Google.
//
// Google OpenID Connect is spoken directly rather than through an auth vendor's SDK.
// The exchange is about eighty lines of standard OIDC, all of it server-side, and doing
// it here is what keeps the site's CSP at `connect-src 'self'` with no third-party
// script origin: the browser only ever navigates to Google and comes back. An SDK would
// have to be fetched from somewhere and would put a token in localStorage.
//
// This is a GET that ends in a redirect, reached from a link or location.assign, never
// a <form method=post>: the CSP sets `form-action 'self'` and would block the post.
import crypto from "node:crypto";
import { cookie, seal } from "../_lib/session.js";
import { origin, safeReturnTo } from "../_lib/http.js";

export const STATE_COOKIE = "waf_oauth";
// Five minutes is a generous ceiling on "click the button, pick an account". Anything
// older is a stale tab or a replay. Exported because the callback enforces it server
// side as well: a cookie's Max-Age is a request to the browser, not a rule.
export const STATE_TTL = 300;

export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Sign-in is not configured on this deployment.");
    return;
  }

  const site = origin(req);
  const url = new URL(req.url, site);
  const returnTo = safeReturnTo(url.searchParams.get("return_to"));

  // CSRF for the OAuth round trip. `state` goes to Google and comes back; the copy in
  // the cookie is what proves the response belongs to a flow this browser started.
  const state = crypto.randomBytes(24).toString("base64url");
  // PKCE. Not strictly required for a confidential client that holds a secret, but it
  // costs three lines and removes authorization-code interception as a category.
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  // One short-lived cookie carries all three, signed with the same HMAC the session
  // uses. The state check alone already defeats the ordinary login-CSRF, because an
  // attacker cannot read this cookie to learn the value Google will echo back. Signing
  // closes the other direction: if a cookie could ever be *written* on this origin
  // (a sibling subdomain, a future cookie-setting endpoint), an attacker could pin a
  // state and verifier they know and complete a flow as themselves in the reader's
  // browser. seal() means a cookie we did not issue does not verify.
  //
  // seal() takes the account id as its first argument elsewhere; there is no account
  // yet, so the subject is the literal "oauth" and the flow rides in the extras.
  const payload = seal("oauth", { st: state, cv: verifier, rt: returnTo });

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", `${site}/api/auth/callback`);
  auth.searchParams.set("response_type", "code");
  // The minimum that identifies a person. No Drive, no Gmail, no contacts. `email` is
  // for account recovery and abuse handling; `profile` supplies a default display name.
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("state", state);
  auth.searchParams.set("code_challenge", challenge);
  auth.searchParams.set("code_challenge_method", "S256");
  // Ask for the account chooser every time. A shared machine that silently reuses the
  // last Google session is how someone contributes under someone else's name.
  auth.searchParams.set("prompt", "select_account");

  res.setHeader("Set-Cookie", cookie(STATE_COOKIE, payload, {
    maxAge: STATE_TTL,
    secure: site.startsWith("https://"),
  }));
  res.statusCode = 302;
  res.setHeader("Location", auth.toString());
  res.setHeader("Cache-Control", "no-store");
  res.end();
}
