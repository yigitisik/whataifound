import test from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-that-is-comfortably-over-32-chars";
const { seal, unseal, parseCookies, cookie, sessionOf, SESSION_MAX_AGE } = await import("./session.js");

test("a sealed session round-trips", () => {
  const v = seal("abc-123");
  assert.equal(unseal(v).sub, "abc-123");
});

test("a tampered payload is rejected", () => {
  const v = seal("abc-123");
  const [body, mac] = v.split(".");
  const forged = Buffer.from(JSON.stringify({
    sub: "someone-else", typ: "session", iat: Math.floor(Date.now() / 1000),
  })).toString("base64url");
  assert.equal(unseal(`${forged}.${mac}`), null);
  assert.equal(unseal(`${body}.${"a".repeat(mac.length)}`), null);
});

test("garbage is rejected rather than thrown on", () => {
  for (const v of ["", "no-dot", ".", "a.b", null, undefined, 42, "..."]) {
    assert.equal(unseal(v), null, `expected null for ${JSON.stringify(v)}`);
  }
});

test("a session older than the max age is rejected", async () => {
  const old = Math.floor(Date.now() / 1000) - SESSION_MAX_AGE - 60;
  const body = Buffer.from(JSON.stringify({ sub: "x", typ: "session", iat: old }))
    .toString("base64url");
  // Sign it correctly, so the only thing wrong is the age.
  const crypto = await import("node:crypto");
  const mac = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(body).digest("base64url");
  assert.equal(unseal(`${body}.${mac}`), null);
});

test("a signature made with a different secret is rejected", async () => {
  const crypto = await import("node:crypto");
  const body = Buffer.from(JSON.stringify({
    sub: "x", typ: "session", iat: Math.floor(Date.now() / 1000),
  })).toString("base64url");
  const mac = crypto.createHmac("sha256", "a-completely-different-secret-value!!").update(body).digest("base64url");
  assert.equal(unseal(`${body}.${mac}`), null);
});

test("cookies parse, including values with = and spaces", () => {
  const c = parseCookies("a=1; waf_session=xy%3Dz; empty=");
  assert.equal(c.a, "1");
  assert.equal(c.waf_session, "xy=z");
  assert.equal(c.empty, "");
});

test("a malformed percent-escape costs that cookie, not the whole header", () => {
  // Any sibling-domain site can set a cookie this server receives. decodeURIComponent
  // throws on "%E0%A4%A", and before this one such cookie made every API call from that
  // browser answer 500.
  let c;
  assert.doesNotThrow(() => { c = parseCookies("bad=%E0%A4%A; waf_session=ok%3D"); });
  assert.equal(c.bad, "%E0%A4%A");
  assert.equal(c.waf_session, "ok=");
});

test("sessionOf returns the id and the version it was issued under", () => {
  const v = seal("abc-123", { v: 4 });
  const req = { headers: { cookie: `other=1; waf_session=${encodeURIComponent(v)}` } };
  assert.deepEqual(sessionOf(req), { id: "abc-123", v: 4 });
});

test("a session with no version does not resolve", () => {
  // Without a version the database check cannot run, so the cookie could not be
  // revoked. Refusing it is what makes sign-out mean something.
  const v = seal("abc-123");
  assert.equal(sessionOf({ headers: { cookie: `waf_session=${encodeURIComponent(v)}` } }), null);
  assert.equal(sessionOf({ headers: {} }), null);
});

test("the cookie is HttpOnly, Lax and Secure by default", () => {
  const c = cookie("waf_session", "v");
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Secure/);
  assert.match(c, /Path=\//);
});

test("secure can be turned off for local http dev", () => {
  assert.doesNotMatch(cookie("x", "v", { secure: false }), /Secure/);
});
