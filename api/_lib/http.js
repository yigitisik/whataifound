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

/**
 * Where to send the browser after sign-in.
 *
 * Only a same-site path is ever accepted, and it must start with a single "/". A bare
 * "//evil.example" is a protocol-relative URL that a naive startsWith("/") check lets
 * through, which is the standard open-redirect bug, so it is rejected explicitly.
 */
export function safeReturnTo(value) {
  const v = String(value || "");
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
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
