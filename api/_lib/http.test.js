import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
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

// Values a prefix check lets through and a browser then resolves off-site. Each was
// confirmed against the WHATWG parser: tab, newline and carriage return are stripped
// anywhere in a URL, a backslash reads as "/", and dot segments collapse before the
// path is used.
const PARSER_BYPASSES = [
  "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\t\t/evil.example",
  "/\u0000/evil.example", "/\u007f/evil.example",
  "/\\/evil.example", "/a\\b",
  "/.//evil.example", "/%2e//evil.example", "/a/../..//evil.example",
];

test("parser-level open redirects are refused", () => {
  for (const v of PARSER_BYPASSES) {
    assert.equal(safeReturnTo(v), "/", `${JSON.stringify(v)} should fall back to /`);
  }
});

test("an escaped tab stays a literal path segment and is kept", () => {
  // "%09" is three characters in the Location header, not a tab, so the browser keeps
  // it as part of the path on this origin. Only the decoded tab is dangerous, and the
  // query-string decoding in start.js is what would produce one.
  assert.equal(safeReturnTo("/%09/evil.example"), "/%09/evil.example");
  assert.equal(safeReturnTo("/finding/x?y=1#z"), "/finding/x?y=1#z");
});

/** Run the real js/signin.js against a stub page and report the href it leaves. */
function signinHref(returnTo) {
  const src = fs.readFileSync(new URL("../../js/signin.js", import.meta.url), "utf8");
  const btn = { href: "/api/auth/start" };
  const search = returnTo === null ? "" : "?return_to=" + encodeURIComponent(returnTo);
  vm.runInNewContext(src, {
    document: { querySelector: () => btn },
    location: { search, origin: "https://whataifound.org" },
    URL, URLSearchParams,
  });
  return btn.href;
}

test("js/signin.js applies the same rule as safeReturnTo", () => {
  // The browser copy only decides what the button points at; the server re-checks. A
  // drift between the two is still worth failing on, because the button is what a
  // reader sees and trusts before any redirect happens.
  const cases = ["/review", "/?q=lean&view=cards", "/%09/evil.example",
                 "//evil.example", "/\\evil.example", "https://evil.example",
                 ...PARSER_BYPASSES];
  for (const v of cases) {
    const accepted = safeReturnTo(v) !== "/";
    const expected = accepted
      ? "/api/auth/start?return_to=" + encodeURIComponent(v) : "/api/auth/start";
    assert.equal(signinHref(v), expected, `signin.js disagrees on ${JSON.stringify(v)}`);
  }
  assert.equal(signinHref(null), "/api/auth/start");
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
