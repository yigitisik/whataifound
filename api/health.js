// What this deployment was actually given, as booleans.
//
// Written because "Sign-in is not configured on this deployment" is a true statement
// that answers the wrong question. It says GOOGLE_CLIENT_ID was falsy at the moment the
// request ran, which is not the same as "you did not set it": on Vercel, environment
// variables are captured when a deployment is built, so a variable added afterwards is
// correctly configured in the dashboard and still absent from the deployment serving the
// domain until the next deploy. There is no way to tell those two apart from the outside,
// which is what this endpoint fixes.
//
// It reports presence, never values. A boolean saying GOOGLE_CLIENT_ID is set discloses
// nothing an attacker did not already learn from /api/auth/start answering 503 rather
// than redirecting, and the alternative is diagnosing a blank page by guesswork.
//
// The two strings it does return are public by nature: SITE_ORIGIN is the site's own
// domain, and the redirect URI is the value that has to be registered in Google's console
// character for character, which is the single most common thing to get wrong after this.
import { origin } from "./_lib/http.js";
import { githubConfigured } from "./_lib/github.js";

// Everything sign-in needs, in the order the flow would hit them. `SITE_ORIGIN` is last
// because it has a working fallback: unset, the request's own origin is used, which is
// right locally and on previews and wrong only if a Host header is ever forged.
const REQUIRED = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "SESSION_SECRET",
];

export default function handler(req, res) {
  const present = {};
  for (const key of REQUIRED) present[key] = Boolean(process.env[key]);

  // api/_lib/session.js throws below 32 characters rather than signing weakly. That
  // failure surfaces at the callback, long after the one people are looking at, so it
  // is worth reporting separately from mere presence.
  const secret = process.env.SESSION_SECRET || "";
  const sessionSecretLongEnough = secret.length >= 32;

  const ready = REQUIRED.every(k => present[k]) && sessionSecretLongEnough;

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({
    signInReady: ready,
    present,
    sessionSecretLongEnough,
    // Unset is legal and common; say so rather than reporting a bare false.
    siteOrigin: process.env.SITE_ORIGIN || "(unset: falls back to the request origin)",
    // Paste this into Google Cloud Console under Authorised redirect URIs. It is built
    // the same way api/auth/start.js builds it, so if the two ever disagree this is the
    // one that is right.
    redirectUri: `${origin(req)}/api/auth/callback`,
    githubApp: githubConfigured(),
    hint: ready
      ? "Sign-in should work. If Google rejects it, the redirect URI above is not registered."
      : "A required variable is missing from THIS deployment. Adding one in the dashboard "
        + "does not update a deployment that already exists: redeploy after setting it.",
  }, null, 2));
}
