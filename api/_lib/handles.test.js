import test from "node:test";
import assert from "node:assert/strict";
import {
  generateHandle, validateHandle, normaliseHandle, HANDLE_RE, HANDLE_SPACE,
  RESERVED_HANDLES,
} from "./handles.js";

// A fixed sequence stands in for Math.random so a generated handle is checkable.
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test("a fresh handle is two words and carries no digits", () => {
  for (let i = 0; i < 500; i++) {
    const h = generateHandle();
    assert.match(h, HANDLE_RE, h);
    assert.equal(h.split("-").length, 2, h);
    assert.doesNotMatch(h, /[0-9]/, h);
    assert.equal(validateHandle(h), null, `${h} should be valid`);
  }
});

test("the first word is the adjective and the second the noun", () => {
  assert.equal(generateHandle(seq(0, 0)), "amber-axiom");
});

test("collisions add a suffix and stay valid", () => {
  assert.equal(generateHandle(seq(0, 0), 1), "amber-axiom-2");
  assert.equal(generateHandle(seq(0, 0), 7), "amber-axiom-8");
  const late = generateHandle(seq(0, 0, 0.5), 8);
  assert.match(late, HANDLE_RE, late);
  assert.equal(validateHandle(late), null);
});

test("the bare handle space is large enough that collisions stay rare", () => {
  // Not a hard requirement, but if this ever drops the retry loop in the callback
  // starts doing real work on every signup.
  assert.ok(HANDLE_SPACE > 2000, `only ${HANDLE_SPACE} bare handles`);
});

test("valid handles are accepted", () => {
  for (const h of ["patient-lemma", "abc", "a1-b2", "quiet-axiom-2", "a".repeat(30)]) {
    assert.equal(validateHandle(h), null, h);
  }
});

test("mixed case is accepted and normalised, not rejected", () => {
  // validateHandle lowercases before checking, and account.js stores the normalised
  // form, so someone typing Patient-Lemma gets patient-lemma rather than an error.
  assert.equal(validateHandle("Patient-Lemma"), null);
  assert.equal(normaliseHandle("Patient-Lemma"), "patient-lemma");
});

test("malformed handles are rejected with a reason", () => {
  const bad = [
    "", "ab", "a".repeat(31), "-lead", "trail-", "double--hyphen",
    "has space", "has_underscore", "emoji-\u{1F389}", "123", "with.dot", "slash/es",
  ];
  for (const h of bad) {
    const reason = validateHandle(h);
    assert.ok(reason, `${JSON.stringify(h)} should be rejected`);
    assert.equal(typeof reason, "string");
  }
});

test("reserved handles are refused, in any case", () => {
  for (const h of ["admin", "ADMIN", "Api", "review", "maintainer", "account"]) {
    assert.equal(validateHandle(h), "That handle is reserved.", h);
  }
});

test("short reserved words are still unreachable", () => {
  // "u" and "me" are reserved but under the length floor, so they are rejected by the
  // length rule first. Either way they cannot be claimed, which is what matters.
  for (const h of ["u", "me"]) assert.ok(validateHandle(h), h);
});

test("no reserved word could be produced by the generator", () => {
  // Otherwise a signup could be handed a name the validator would refuse to keep.
  for (let i = 0; i < 3000; i++) {
    assert.ok(!RESERVED_HANDLES.has(generateHandle()), "generator produced a reserved handle");
  }
});

test("normalisation lowercases and trims", () => {
  assert.equal(normaliseHandle("  Patient-Lemma  "), "patient-lemma");
  assert.equal(normaliseHandle(null), "");
});

test("every generated handle matches the database check constraint", () => {
  // The same shape rule is enforced in db/001_accounts.sql; if these diverge, signup
  // fails at the insert with a constraint violation rather than at validation.
  const dbShape = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (let i = 0; i < 1000; i++) {
    const h = generateHandle(Math.random, i % 12);
    assert.match(h, dbShape, h);
    assert.ok(h.length >= 3 && h.length <= 30, `${h} is ${h.length} chars`);
  }
});
