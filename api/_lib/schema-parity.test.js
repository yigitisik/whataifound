// The API validates a handle and an ORCID; db/001_accounts.sql validates them again with
// CHECK constraints. Two copies of a rule is two chances for one to drift, and the failure
// mode is bad: a handle the API happily accepts is refused by the insert, so signing up or
// renaming dies with a constraint violation instead of a message anyone can act on.
//
// Same reason verify-parity.py diffs card() against its Python port. This is the cheap
// version of that for the two rules that exist in both places.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HANDLE_RE, HANDLE_MIN, HANDLE_MAX, generateHandle } from "./handles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SQL = fs.readFileSync(path.join(ROOT, "db/001_accounts.sql"), "utf8");
const ACCOUNT = fs.readFileSync(path.join(ROOT, "api/account.js"), "utf8");

test("the handle shape rule is identical in the API and the schema", () => {
  const m = SQL.match(/check \(handle ~ '([^']+)' and length\(handle\) between (\d+) and (\d+)\)/);
  assert.ok(m, "could not find the handle CHECK constraint in db/001_accounts.sql");
  assert.equal(m[1], HANDLE_RE.source, "handle regex differs between handles.js and the schema");
  assert.equal(Number(m[2]), HANDLE_MIN);
  assert.equal(Number(m[3]), HANDLE_MAX);
});

test("the ORCID shape rule is identical in the API and the schema", () => {
  const dbm = SQL.match(/check \(orcid is null or orcid ~ '([^']+)'\)/);
  const apim = ACCOUNT.match(/const ORCID_RE = \/(.+?)\/;/);
  assert.ok(dbm, "could not find the ORCID CHECK constraint");
  assert.ok(apim, "could not find ORCID_RE in api/account.js");
  assert.equal(dbm[1], apim[1], "ORCID regex differs between account.js and the schema");
});

test("every handle the generator can produce satisfies the schema constraint", () => {
  // The generator runs at signup, inside the insert. A handle it can emit that the CHECK
  // constraint rejects would make account creation fail for a real person.
  const dbRe = new RegExp(SQL.match(/check \(handle ~ '([^']+)'/)[1]);
  for (let i = 0; i < 2000; i++) {
    const h = generateHandle(Math.random, i % 12);
    assert.match(h, dbRe, h);
    assert.ok(h.length >= HANDLE_MIN && h.length <= HANDLE_MAX, `${h} is ${h.length} chars`);
  }
});

test("the schema keeps row level security on", () => {
  // No policy is created on purpose: every query runs from a Vercel function over the
  // pooler credentials, and authorization lives in the API next to the session. RLS being
  // enabled is the backstop if PostgREST is ever exposed to a browser.
  assert.match(SQL, /alter table accounts enable row level security;/);
});

test("the account table never gains a plaintext-secret-looking column", () => {
  // A tripwire, not a real defence: if a later phase adds a password or token column to
  // this table, that is a design decision worth a conversation rather than a diff nobody
  // reads. Sessions are signed cookies and there is nothing to store.
  for (const bad of ["password", "secret", "access_token", "refresh_token"]) {
    assert.doesNotMatch(SQL, new RegExp(`^\\s+${bad}\\s`, "mi"), `accounts gained a ${bad} column`);
  }
});
