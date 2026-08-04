// Step two: Google sends the browser back here with a code. Exchange it server-side,
// find or create the account, set the session cookie, and return the reader to where
// they were.
//
// The id_token is verified by fetching it over TLS from Google's token endpoint using
// the client secret, which is the "code flow with a confidential client" case: the
// token arrives on a channel only we and Google can see, so its signature does not have
// to be re-checked against Google's JWKS. The claims are still validated (issuer,
// audience, expiry, email_verified) because a token that is authentic but for the wrong
// audience is still the wrong token.
import crypto from "node:crypto";
import { db } from "../_lib/db.js";
import { cookie, seal, unseal, parseCookies, SESSION_COOKIE } from "../_lib/session.js";
import { origin, safeReturnTo } from "../_lib/http.js";
import { generateHandle } from "../_lib/handles.js";
import { sanitiseDisplayName } from "../_lib/names.js";
import { STATE_COOKIE, STATE_TTL } from "./start.js";

const GOOGLE_ISS = ["https://accounts.google.com", "accounts.google.com"];

/** Constant-time string compare for the OAuth state parameter. */
function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}


function fail(res, site, reason) {
  // Never render the reason into HTML: it would be an unescaped sink for a query
  // parameter. Send the reader to a page that explains sign-in failed, with the reason
  // only as a short opaque code.
  res.statusCode = 302;
  res.setHeader("Location", `/account?error=${encodeURIComponent(reason)}`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", cookie(STATE_COOKIE, "", {
    maxAge: 0, secure: site.startsWith("https://"),
  }));
  res.end();
}

export default async function handler(req, res) {
  const site = origin(req);
  const secure = site.startsWith("https://");
  const url = new URL(req.url, site);

  // The reader pressed "cancel" on Google's account chooser. Not an error worth a code.
  if (url.searchParams.get("error")) return fail(res, site, "cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const raw = parseCookies(req.headers.cookie)[STATE_COOKIE];
  if (!code || !state || !raw) return fail(res, site, "state");

  // unseal() verifies the HMAC and the age before we look at anything inside, so a
  // cookie this server did not issue is indistinguishable from no cookie at all.
  const flow = unseal(raw);
  if (!flow || flow.sub !== "oauth") return fail(res, site, "state");
  // unseal() enforces the *session* lifetime, which is thirty days. A half-finished
  // sign-in has no business living that long, and the cookie's own Max-Age is a request
  // to the browser rather than a rule, so the five-minute window is enforced here.
  if (Math.floor(Date.now() / 1000) - flow.iat > STATE_TTL) return fail(res, site, "state");
  // The whole point of `state`: this response has to belong to a flow this browser
  // started, not one an attacker started and stitched onto the reader's session
  // (the login-CSRF attack). Compared in constant time for the same reason the session
  // MAC is: a plain !== leaks how many leading bytes matched.
  if (!flow.st || !sameSecret(flow.st, state)) return fail(res, site, "state");

  // ---- Exchange the code for tokens -------------------------------------
  let tokens;
  try {
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${site}/api/auth/callback`,
      grant_type: "authorization_code",
      code_verifier: flow.cv,
    });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) return fail(res, site, "exchange");
    tokens = await r.json();
  } catch {
    return fail(res, site, "exchange");
  }

  // ---- Read and validate the claims -------------------------------------
  const idToken = tokens?.id_token;
  if (typeof idToken !== "string") return fail(res, site, "exchange");
  let claims;
  try {
    claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return fail(res, site, "claims");
  }
  const now = Math.floor(Date.now() / 1000);
  const audOk = claims.aud === process.env.GOOGLE_CLIENT_ID;
  const issOk = GOOGLE_ISS.includes(claims.iss);
  const freshOk = typeof claims.exp === "number" && claims.exp > now;
  if (!audOk || !issOk || !freshOk || !claims.sub) return fail(res, site, "claims");
  // An unverified Google address is not evidence of anything, and this site credits
  // people by name. Require the positive assertion rather than merely the absence of a
  // negative one: a token with the claim missing entirely should fail closed.
  if (claims.email_verified !== true) return fail(res, site, "unverified");

  // ---- Find or create the account ---------------------------------------
  const sql = db();
  let account;
  try {
    const found = await sql`
      select id, banned_at from accounts where google_sub = ${claims.sub} limit 1`;
    if (found.length) {
      if (found[0].banned_at) return fail(res, site, "banned");
      // Keep the email current: a person who changes their Google address should not
      // lose the recovery path. Nothing else is overwritten, because display_name and
      // handle may have been edited deliberately.
      const [row] = await sql`
        update accounts
           set email = ${claims.email || ""}, last_seen_at = now()
         where id = ${found[0].id}
        returning id`;
      account = row;
    } else {
      account = await createAccount(sql, claims);
    }
  } catch (err) {
    console.error("auth/callback db", err);
    return fail(res, site, "server");
  }
  if (!account) return fail(res, site, "server");

  res.statusCode = 302;
  res.setHeader("Location", safeReturnTo(flow.rt));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", [
    cookie(SESSION_COOKIE, seal(account.id), { secure }),
    cookie(STATE_COOKIE, "", { maxAge: 0, secure }),
  ]);
  res.end();
}

/**
 * Insert a new account, retrying on handle collision.
 *
 * `claims.name` is not trusted. It is a string the account holder sets on their own
 * Google profile, and it lands in a column that credits people for checking proofs, so
 * it goes through the same rules as a name typed into the settings form. Sanitised
 * rather than rejected: a sign-in must not fail because of somebody's Google name, and
 * an account with no usable name is simply known by its handle.
 *
 * The collision is resolved by the database, not by a read-then-write: two signups in
 * the same second would both see a handle as free and one would fail. The unique index
 * on lower(handle) is the arbiter, and 23505 is Postgres for "you lost that race".
 */
async function createAccount(sql, claims) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const handle = generateHandle(Math.random, attempt);
    try {
      const [row] = await sql`
        insert into accounts (google_sub, email, handle, display_name)
        values (${claims.sub}, ${claims.email || ""}, ${handle},
                ${sanitiseDisplayName(claims.name)})
        returning id`;
      return row;
    } catch (err) {
      if (err?.code === "23505") continue;
      throw err;
    }
  }
  // 47 adjectives x 62 nouns is 2914 bare handles, and the suffix space is far larger,
  // so twelve consecutive collisions means something is wrong rather than unlucky.
  throw new Error("could not allocate a handle after 12 attempts");
}
