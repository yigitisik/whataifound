// The session cookie: a signed, HttpOnly bearer of one account id.
//
// Hand-rolled rather than pulled from a library because it is 40 lines of standard
// HMAC and the alternative is a dependency on the one code path where a supply-chain
// problem would be worst. The format is deliberately boring:
//
//     base64url(JSON payload) "." base64url(HMAC-SHA256(payload, SESSION_SECRET))
//
// This is a JWS in spirit without the JOSE header, algorithm negotiation, or the
// alg:none family of bugs that come with parsing one. There is exactly one algorithm
// and it is not read from the token.
//
// The browser never reads this. It is HttpOnly, so `document.cookie` cannot see it and
// an XSS bug cannot exfiltrate it. That is the reason the whole auth flow is
// server-side: the alternative puts a token in localStorage where any script can read
// it, and widens the CSP to a third-party origin to fetch the SDK that put it there.
import crypto from "node:crypto";

const COOKIE = "waf_session";
// Thirty days. Long enough that a reader who checks in monthly stays signed in, short
// enough that a stolen laptop stops being a problem within a billing cycle.
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  // Fail loudly. A missing secret must never silently degrade to an unsigned cookie.
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  }
  return s;
}

const b64url = buf => Buffer.from(buf).toString("base64url");

function sign(payloadB64) {
  return crypto.createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

// What a sealed value is for. The session and the OAuth flow cookie are signed with the
// same key, so without this a value minted for one would verify as the other, and the
// only thing keeping them apart would be what each caller happened to check next.
export const TYP_SESSION = "session";
export const TYP_OAUTH = "oauth";

/**
 * Serialise a payload into a cookie value. `sub` is the accounts.id for a session.
 *
 * `typ` goes inside the signed body and unseal() refuses any other, so a value cannot be
 * replayed into a slot it was not issued for. It is written after `extra` so a caller
 * cannot override it by accident.
 */
export function seal(sub, extra = {}, typ = TYP_SESSION) {
  const payload = { sub, iat: Math.floor(Date.now() / 1000), ...extra, typ };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** The reverse. Returns the payload, or null for anything that does not verify. */
export function unseal(value, typ = TYP_SESSION) {
  if (typeof value !== "string") return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = sign(body);
  // Constant time: a plain === leaks how many leading bytes matched, which is enough to
  // forge a signature one byte at a time given enough requests.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.sub !== "string" || payload.typ !== typ) return null;
  // Expiry is enforced here as well as by the cookie's Max-Age, because a cookie's
  // lifetime is a request from the server that the client is free to ignore.
  if (typeof payload.iat !== "number" || Date.now() / 1000 - payload.iat > MAX_AGE) {
    return null;
  }
  return payload;
}

/** Parse a Cookie header into a plain object. */
export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (!k) continue;
    const v = part.slice(eq + 1).trim();
    // Any site on a sibling domain, or a browser extension, can set a cookie this
    // server then receives. One malformed percent-escape must cost that cookie, not
    // every API call from the browser carrying it.
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Build a Set-Cookie value.
 *
 * SameSite=Lax rather than Strict: the OAuth callback is a top-level navigation from
 * accounts.google.com, and Strict would withhold the cookie on exactly that request,
 * so a just-signed-in user would land back on the site signed out. Lax still blocks
 * the cross-site POST that CSRF needs.
 */
export function cookie(name, value, { maxAge = MAX_AGE, secure = true } = {}) {
  const bits = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) bits.push("Secure");
  return bits.join("; ");
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE;

/**
 * The session on a request, as {id, v}, or null. Does not touch the database.
 *
 * `v` is the accounts.session_version the cookie was issued under. A signature alone
 * cannot be taken back: it stays valid for thirty days whatever the server thinks of
 * it. So every query that trusts a session also requires the row's session_version to
 * equal `v`, and signing out bumps the column, which retires every cookie issued before
 * it, including a copy taken off the machine. A caller that reads `id` and skips the
 * version check has turned sign-out back into "delete your own copy".
 */
export function sessionOf(req) {
  const raw = parseCookies(req.headers?.cookie)[COOKIE];
  const payload = unseal(raw, TYP_SESSION);
  if (!payload || !Number.isInteger(payload.v)) return null;
  return { id: payload.sub, v: payload.v };
}
