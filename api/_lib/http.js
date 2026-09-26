// Small helpers shared by every function: JSON replies, the site origin, and the
// safe-redirect rule.

/**
 * The origin to build redirect URIs against.
 *
 * SITE_ORIGIN wins so production cannot be talked into pointing its OAuth redirect
 * somewhere else by a forged Host header. Locally it is unset and we fall back to the
 * request's own origin, which is what makes `vercel dev` work without configuration.
 */
export function origin(req) {
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

/** JSON out. No-store on everything: these responses are per-session by definition. */
export function json(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  json(res, 405, { error: "method_not_allowed" });
}

// Resolved against, never fetched. Any origin works; .invalid is reserved and so can
// never be a real host a return address might legitimately name.
const RETURN_BASE = "https://return-to.invalid";

/**
 * Where to send the browser after sign-in.
 *
 * Only a same-site path is ever accepted. Prefix checks on the raw string are not
 * enough, because the browser does not read the Location header as a string: it parses
 * it, and the parser strips tab, newline and carriage return anywhere in the value and
 * reads a backslash as "/". So "/\t/evil.example" passes a startsWith("//") test and then
 * lands on https://evil.example/. The rule is therefore:
 *
 *   1. No control characters and no backslash at all. A real path on this site never
 *      contains either, so there is nothing to normalise, only something to refuse.
 *   2. Parsed with the same WHATWG parser the browser uses, the value must stay on the
 *      base origin, and its path must not begin with "//" once dot segments resolve.
 *
 * The raw value is returned, not the parser's normalised one: "/.//evil.example"
 * normalises to "//evil.example", which is exactly the protocol-relative URL this
 * exists to refuse. Step 2 rejects that case outright rather than relying on it.
 *
 * js/signin.js applies the same rule in the browser; http.test.js pins both cases.
 */
export function safeReturnTo(value) {
  const v = String(value || "");
  if (!v.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(v)) return "/";
  let u;
  try {
    u = new URL(v, RETURN_BASE);
  } catch {
    return "/";
  }
  if (u.origin !== RETURN_BASE || u.pathname.startsWith("//")) return "/";
  return v;
}

/** Read and parse a JSON request body, with a size cap. */
export async function readJson(req, limitBytes = 16 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  if (!total) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("bad_json");
  }
}

/**
 * Reject cross-site state-changing requests.
 *
 * The session cookie is SameSite=Lax, which already blocks a cross-site POST from
 * carrying it. This is the second lock: browsers send Sec-Fetch-Site on every modern
 * request, and anything that is not same-origin has no business calling a write
 * endpoint here. Requests with no Sec-Fetch-Site header at all (older clients, curl)
 * are allowed, because Lax is still doing its job for them.
 */
export function sameOrigin(req) {
  const site = req.headers["sec-fetch-site"];
  return !site || site === "same-origin" || site === "none";
}
