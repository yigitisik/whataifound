import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo, origin, sameOrigin } from "./http.js";

test("a same-site path is kept", () => {
  assert.equal(safeReturnTo("/review"), "/review");
  assert.equal(safeReturnTo("/finding/2026-07-19-jacobian-conjecture"), "/finding/2026-07-19-jacobian-conjecture");
  assert.equal(safeReturnTo("/?q=lean&view=cards"), "/?q=lean&view=cards");
});

test("open redirects are refused", () => {
  // "//host" is protocol-relative: a naive startsWith("/") lets it through and the
  // browser navigates off-site. This is the bug this function exists to prevent.
  const hostile = [
    "//evil.example", "///evil.example", "/\\evil.example",
    "https://evil.example", "http://evil.example", "javascript:alert(1)",
    "", null, undefined, "evil.example",
  ];
  for (const v of hostile) {
    assert.equal(safeReturnTo(v), "/", `${JSON.stringify(v)} should fall back to /`);
  }
});

test("origin prefers SITE_ORIGIN over request headers", () => {
  const req = { headers: { host: "attacker.example", "x-forwarded-proto": "https" } };
  process.env.SITE_ORIGIN = "https://whataifound.org";
  assert.equal(origin(req), "https://whataifound.org");
  delete process.env.SITE_ORIGIN;
  // Without it, the request's own host is used, which is what makes local dev work.
  assert.equal(origin(req), "https://attacker.example");
});

test("a trailing slash on SITE_ORIGIN does not double up", () => {
  process.env.SITE_ORIGIN = "https://whataifound.org/";
  assert.equal(origin({ headers: {} }), "https://whataifound.org");
  delete process.env.SITE_ORIGIN;
});

test("cross-site requests are refused, same-origin and header-less allowed", () => {
  assert.equal(sameOrigin({ headers: { "sec-fetch-site": "same-origin" } }), true);
  assert.equal(sameOrigin({ headers: { "sec-fetch-site": "none" } }), true);
  assert.equal(sameOrigin({ headers: {} }), true);
  assert.equal(sameOrigin({ headers: { "sec-fetch-site": "cross-site" } }), false);
  assert.equal(sameOrigin({ headers: { "sec-fetch-site": "same-site" } }), false);
});
