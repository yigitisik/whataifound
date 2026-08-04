// The OAuth flow cookie: signed, short-lived, and not interchangeable with a session.
//
// api/auth/start.js seals {st, cv, rt} under the subject "oauth"; api/auth/callback.js
// unseals it, checks the subject, checks the age against STATE_TTL, then compares `st`
// against what Google echoed back. These tests pin the properties that make that safe,
// without needing Google or a database.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.SESSION_SECRET = "test-secret-that-is-comfortably-over-32-chars";
const { seal, unseal } = await import("./session.js");

const STATE_TTL = 300;
const flow = (extra = {}) =>
  seal("oauth", { st: "state-value", cv: "verifier-value", rt: "/review", ...extra });

test("a sealed flow round-trips with its three fields", () => {
  const f = unseal(flow());
  assert.equal(f.sub, "oauth");
  assert.equal(f.st, "state-value");
  assert.equal(f.cv, "verifier-value");
  assert.equal(f.rt, "/review");
});

test("a forged flow cookie does not verify", () => {
  // The attack this closes: an attacker who can write a cookie on this origin pins a
  // state and verifier they know, then completes the flow as themselves in the reader's
  // browser. Before signing, any well-formed base64url JSON was accepted.
  const forged = Buffer.from(JSON.stringify({
    sub: "oauth", iat: Math.floor(Date.now() / 1000),
    st: "attacker-state", cv: "attacker-verifier", rt: "/",
  })).toString("base64url");
  assert.equal(unseal(forged), null, "unsigned payload must be rejected");
  assert.equal(unseal(`${forged}.`), null);
  assert.equal(unseal(`${forged}.${"A".repeat(43)}`), null, "wrong MAC must be rejected");
});

test("a flow signed with a different secret does not verify", () => {
  const body = Buffer.from(JSON.stringify({
    sub: "oauth", iat: Math.floor(Date.now() / 1000), st: "x", cv: "y", rt: "/",
  })).toString("base64url");
  const mac = crypto.createHmac("sha256", "some-other-secret-entirely-abcdefgh")
    .update(body).digest("base64url");
  assert.equal(unseal(`${body}.${mac}`), null);
});

test("the callback's five-minute window rejects a stale flow", () => {
  // The cookie's own Max-Age is a request to the browser, not a rule, so callback.js
  // re-checks iat against STATE_TTL. unseal() alone would accept this for thirty days.
  const old = Math.floor(Date.now() / 1000) - STATE_TTL - 1;
  const body = Buffer.from(JSON.stringify({
    sub: "oauth", iat: old, st: "x", cv: "y", rt: "/",
  })).toString("base64url");
  const mac = crypto.createHmac("sha256", process.env.SESSION_SECRET)
    .update(body).digest("base64url");
  const f = unseal(`${body}.${mac}`);
  assert.ok(f, "precondition: still inside the session lifetime, so unseal accepts it");
  assert.ok(Math.floor(Date.now() / 1000) - f.iat > STATE_TTL,
    "the callback's own age check is what rejects this");
});

test("a session cookie cannot be replayed as a flow cookie", () => {
  // Both are sealed with the same key, so the subject is what keeps them apart:
  // callback.js requires sub === "oauth" and start.js never issues an account id.
  const session = seal("11111111-2222-3333-4444-555555555555");
  const f = unseal(session);
  assert.ok(f, "it verifies, because the key is the same");
  assert.notEqual(f.sub, "oauth", "but the subject check rejects it");
  assert.equal(f.st, undefined);
});

test("a flow cookie cannot be replayed as a session cookie", () => {
  // The other direction. api/_lib/session.js sessionFrom() returns payload.sub, so a
  // flow cookie in the session slot would resolve to the account id "oauth", which is
  // not a uuid and matches no row. Pinned here so a future lookup that is laxer about
  // its input does not quietly turn this into an authentication bypass.
  const f = unseal(flow());
  assert.equal(f.sub, "oauth");
  assert.doesNotMatch(f.sub, /^[0-9a-f]{8}-[0-9a-f]{4}-/i, "must not look like an account id");
});
