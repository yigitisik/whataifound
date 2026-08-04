import test from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-that-is-comfortably-over-32-chars";
const { seal, unseal, parseCookies, cookie, SESSION_MAX_AGE } = await import("./session.js");

test("a sealed session round-trips", () => {
  const v = seal("abc-123");
  assert.equal(unseal(v).sub, "abc-123");
});

test("a tampered payload is rejected", () => {
  const v = seal("abc-123");
  const [body, mac] = v.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "someone-else", iat: Math.floor(Date.now() / 1000) }))
    .toString("base64url");
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
  const body = Buffer.from(JSON.stringify({ sub: "x", iat: old })).toString("base64url");
  // Sign it correctly, so the only thing wrong is the age.
  const crypto = await import("node:crypto");
  const mac = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(body).digest("base64url");
  assert.equal(unseal(`${body}.${mac}`), null);
});

test("a signature made with a different secret is rejected", async () => {
  const crypto = await import("node:crypto");
  const body = Buffer.from(JSON.stringify({ sub: "x", iat: Math.floor(Date.now() / 1000) }))
    .toString("base64url");
  const mac = crypto.createHmac("sha256", "a-completely-different-secret-value!!").update(body).digest("base64url");
  assert.equal(unseal(`${body}.${mac}`), null);
});

test("cookies parse, including values with = and spaces", () => {
  const c = parseCookies("a=1; waf_session=xy%3Dz; empty=");
  assert.equal(c.a, "1");
  assert.equal(c.waf_session, "xy=z");
  assert.equal(c.empty, "");
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
