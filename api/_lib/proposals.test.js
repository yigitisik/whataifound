// What a proposal is allowed to become.
//
// applyProposal() is the only thing in this project that computes a change to
// data/entries.json without a human typing it, so these tests are less about "does the
// feature work" and more about the boundary: a hostile payload must not be able to
// produce a hostile diff, and a well-formed one must produce a diff CI will accept.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateProposal, applyProposal, proposalBody, PROPOSAL_KINDS,
} from "./proposals.js";
import { serialiseEntries } from "./github.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RAW = fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8");
const ENTRIES = JSON.parse(RAW);
const REAL_ID = ENTRIES[0].id;

const AUTHOR = {
  handle: "patient-lemma", displayName: "Jane Okafor",
  orcid: "0000-0002-1825-0097", githubLogin: "jokafor",
};
const TODAY = "2026-08-04";

const goodCheck = {
  who: "Jane Okafor, University of Leeds",
  outcome: "confirmed, the bound is tight",
  evidence: "Recomputed the bound symbolically in SymPy and compared against table 2 of the paper.",
};

// ---------------------------------------------------------------------------
// The serialiser: the diff has to be a diff of the change, not of the formatting.
// ---------------------------------------------------------------------------

test("serialising the committed registry reproduces it byte for byte", () => {
  // If this drifts, every submission reformats 3000 lines and buries the actual change
  // in a diff a maintainer is supposed to review.
  assert.equal(serialiseEntries(ENTRIES), RAW);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test("an unknown kind is refused", () => {
  for (const k of ["", "delete", "admin", null, undefined, "__proto__"]) {
    assert.ok(validateProposal(k, {}).error, JSON.stringify(k));
  }
  assert.deepEqual(PROPOSAL_KINDS, ["check", "challenge", "entry", "correction"]);
});

test("a payload that is not an object is refused", () => {
  for (const p of [null, undefined, "string", 42, [], [{ who: "x" }]]) {
    assert.ok(validateProposal("check", p).error, JSON.stringify(p));
  }
});

test("a well-formed check is accepted and normalised", () => {
  const out = validateProposal("check", { ...goodCheck, who: "  Jane   Okafor  " });
  assert.equal(out.error, undefined);
  assert.equal(out.value.who, "Jane Okafor", "whitespace is collapsed");
  assert.equal(out.value.url, null, "an absent optional link is null, not undefined");
});

test("a check with no method behind it is refused", () => {
  // "confirmed" with nothing to read is not a check, and the entry would carry it as
  // though it were.
  const out = validateProposal("check", { ...goodCheck, evidence: "looks right" });
  assert.equal(out.error.error, "evidence_missing");
});

test("em dashes are refused, with a message rather than a CI failure", () => {
  const out = validateProposal("check", { ...goodCheck, outcome: "confirmed \u2014 tight" });
  assert.equal(out.error.error, "outcome_em_dash");
});

test("control and bidi characters are refused", () => {
  // The same rule api/_lib/names.js applies, for the same reason: this text renders on
  // a public page next to other people's names.
  for (const bad of ["a\u0000b", "alice‮bob", "x​y"]) {
    assert.equal(validateProposal("check", { ...goodCheck, who: bad }).error.error, "who_invalid", bad);
  }
});

test("raw markup is refused", () => {
  const out = validateProposal("check", { ...goodCheck, who: "<script>alert(1)</script>" });
  assert.equal(out.error.error, "who_markup");
});

test("only http(s) links are accepted", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd",
                     "not a url", "//evil.example"]) {
    const out = validateProposal("check", { ...goodCheck, url: bad });
    assert.ok(out.error, bad);
  }
  const ok = validateProposal("check", { ...goodCheck, url: "https://example.org/proof" });
  assert.equal(ok.error, undefined);
});

test("a challenge must name a real axis and a real grade", () => {
  const base = { citation: "https://example.org/rebuttal", why: "x".repeat(50) };
  assert.equal(validateProposal("challenge", { ...base, axis: "vibes", proposed: "formal" }).error.error,
    "axis_invalid");
  assert.equal(validateProposal("challenge", { ...base, axis: "verification", proposed: "excellent" }).error.error,
    "proposed_invalid");
  assert.equal(
    validateProposal("challenge", { ...base, axis: "verification", proposed: "claimed" }).error,
    undefined);
});

test("a challenge proposing the grade already set is refused", () => {
  const out = validateProposal("challenge",
    { axis: "verification", proposed: "formal", citation: "https://example.org/r", why: "x".repeat(50) },
    { verification: "formal", autonomy: "collaborative" });
  assert.equal(out.error.error, "proposed_unchanged");
});

test("a challenge with no citation is refused", () => {
  // Grades move on evidence, never on opinion. Without a citation there is nothing for
  // a maintainer to weigh.
  const out = validateProposal("challenge",
    { axis: "autonomy", proposed: "ai-led", why: "x".repeat(50) });
  assert.equal(out.error.error, "citation_missing");
});

test("a correction is limited to the three things it covers", () => {
  for (const bad of ["verification", "title", "claim", "id", "__proto__", ""]) {
    assert.equal(validateProposal("correction", { target: bad, note: "x".repeat(30) }).error.error,
      "target_invalid", bad);
  }
});

test("a new entry above claimed needs a research source", () => {
  // Editorial rule 4, which the build enforces. Catching it here means the submitter
  // learns it while typing rather than from a workflow log they cannot see.
  const entry = {
    id: "2026-08-04-test-result", title: "A result", claim: "Something was shown.",
    field: "mathematics", date: "2026-08-04", lab: "Independent", model: "GPT-5",
    verification: "independent", autonomy: "ai-led",
    sources: [{ label: "Blog post", url: "https://example.org/a", kind: "announcement" }],
  };
  assert.equal(validateProposal("entry", entry).error.error, "needs_research_source");

  entry.verification = "claimed";
  assert.equal(validateProposal("entry", entry).error, undefined, "claimed needs no research source");
});

test("a new entry cannot take an id the registry already uses", () => {
  const out = validateProposal("entry", { id: REAL_ID, title: "x", claim: "y" });
  assert.equal(out.error.error, "id_taken");
});

test("a new entry id is constrained to the schema's own pattern", () => {
  for (const bad of ["../etc/passwd", "Has Capitals", "sp ace", "a", "/leading", "trailing/",
                     "x".repeat(81)]) {
    assert.equal(validateProposal("entry", { id: bad }).error.error, "id_invalid", bad);
  }
});

// ---------------------------------------------------------------------------
// The transform
// ---------------------------------------------------------------------------

test("applying a check appends the row and credits the reviewer", () => {
  const payload = validateProposal("check", goodCheck).value;
  const { entries } = applyProposal(ENTRIES, { kind: "check", entryId: REAL_ID, payload },
    AUTHOR, TODAY);
  const e = entries.find(x => x.id === REAL_ID);
  const row = e.independent_checks.at(-1);
  assert.equal(row.who, goodCheck.who);
  assert.equal(row.outcome, goodCheck.outcome);
  assert.deepEqual(Object.keys(row).sort(), ["outcome", "who"],
    "only the fields the schema has: evidence and coi stay in the pull request");
  assert.deepEqual(e.reviewers.at(-1),
    { name: "Jane Okafor", handle: "patient-lemma", orcid: "0000-0002-1825-0097", github: "jokafor" });
});

// ---------------------------------------------------------------------------
// Door parity: the same contribution must land identically whichever route it took.
//
// scripts/verify-doors.py checks that both doors ask the same questions. These check
// the other half, which is what a reader actually sees: that the answers produce the
// same row in data/entries.json. A maintainer applying a GitHub issue by hand writes
// exactly the fields the schema has, so that is what the bot has to write too, no more
// and no less.
// ---------------------------------------------------------------------------

test("a check lands as the schema's fields and nothing else, whichever door it came through", () => {
  // The four questions both doors ask, with the two that are for the reviewer only.
  const payload = validateProposal("check", {
    who: "Jane Okafor, University of Leeds",
    outcome: "confirmed; the Lean proof compiles in under five minutes",
    evidence: "Compiled the development at commit a1b2c3d on a clean checkout; lake build succeeds.",
    url: "https://gist.github.com/example/1",
    coi: "I work at the announcing lab.",
  }).value;
  const { entries } = applyProposal(ENTRIES, { kind: "check", entryId: REAL_ID, payload },
    AUTHOR, TODAY);
  const row = entries.find(x => x.id === REAL_ID).independent_checks.at(-1);

  // Exactly the shape a maintainer hand-writes from an issue: who, outcome, url.
  assert.deepEqual(Object.keys(row).sort(), ["outcome", "url", "who"]);
  assert.equal(row.url, "https://gist.github.com/example/1");
  // The reviewer-only answers must not reach the published registry by either route.
  assert.ok(!JSON.stringify(row).includes("lake build"), "evidence stays in the pull request");
  assert.ok(!JSON.stringify(row).includes("announcing lab"), "coi stays in the pull request");
});

test("an outcome is stored verbatim, so both doors record the submitter's words", () => {
  // The registry's real outcomes are prose ("28/42, silver-medal standard"), which is
  // why the GitHub template's four-option dropdown was replaced with a free line: a
  // dropdown made the two doors produce values that could not be compared.
  for (const outcome of [
    "28/42, silver-medal standard",
    "reviewed and merged into the standard sort library",
    "disputed the novelty of the synthesised compound",
  ]) {
    const payload = validateProposal("check", { ...goodCheck, outcome }).value;
    const { entries } = applyProposal(ENTRIES, { kind: "check", entryId: REAL_ID, payload },
      AUTHOR, TODAY);
    assert.equal(entries.find(x => x.id === REAL_ID).independent_checks.at(-1).outcome,
      outcome, "no rewriting, no normalising, no verdict prefix");
  }
});

test("a challenge accepts conflicts of interest and keeps them out of the registry", () => {
  // The GitHub template has always asked this under "Anything else"; the web form did
  // not, which meant the same disclosure was possible on one door only.
  const out = validateProposal("challenge", {
    axis: "verification", proposed: "claimed",
    citation: "https://example.org/rebuttal",
    why: "The primary source is a chat transcript, not a proof, so nothing supports the grade.",
    coi: "I am an author of the cited rebuttal.",
  });
  assert.equal(out.error, undefined);
  assert.equal(out.value.coi, "I am an author of the cited rebuttal.");

  const target = ENTRIES.find(e => e.verification !== "claimed");
  const { entries } = applyProposal(ENTRIES,
    { kind: "challenge", entryId: target.id, payload: out.value }, AUTHOR, TODAY);
  const e = entries.find(x => x.id === target.id);
  assert.ok(!JSON.stringify(e).includes("author of the cited rebuttal"),
    "a declared conflict is context for the maintainer, not registry content");

  // But the maintainer deciding on it has to see it.
  const body = proposalBody({ kind: "challenge", entryId: target.id, payload: out.value },
    AUTHOR, "https://whataifound.org");
  assert.match(body, /Conflicts of interest/);
  assert.match(body, /author of the cited rebuttal/);
});

test("both doors credit a contributor the same way", () => {
  // A GitHub contributor is credited by name plus optional github handle; a web
  // contributor by name plus handle, and orcid when they gave one. `{name}` alone is
  // valid in entry.schema.json, so neither route needs a schema change and the
  // credit block renders both.
  const payload = validateProposal("check", goodCheck).value;
  const viaWeb = applyProposal(ENTRIES, { kind: "check", entryId: REAL_ID, payload },
    AUTHOR, TODAY).entries.find(e => e.id === REAL_ID).reviewers.at(-1);
  const viaGithub = applyProposal(ENTRIES, { kind: "check", entryId: REAL_ID, payload },
    { displayName: "Jane Okafor", githubLogin: "jokafor" }, TODAY)
    .entries.find(e => e.id === REAL_ID).reviewers.at(-1);

  assert.equal(viaWeb.name, viaGithub.name, "the credited name does not depend on the route");
  assert.equal(viaGithub.github, "jokafor");
  assert.equal(viaGithub.handle, undefined, "no site handle when there is no site account");
});

test("the input entries are never mutated", () => {
  // The caller holds the file it fetched from GitHub. A partially applied transform on
  // that object would be very hard to see and would be committed.
  const before = JSON.stringify(ENTRIES);
  const payload = validateProposal("check", goodCheck).value;
  applyProposal(ENTRIES, { kind: "check", entryId: REAL_ID, payload }, AUTHOR, TODAY);
  assert.equal(JSON.stringify(ENTRIES), before);
});

test("applying a challenge moves the grade, records the revision, and cites it", () => {
  const target = ENTRIES.find(e => e.verification !== "claimed");
  const payload = validateProposal("challenge", {
    axis: "verification", proposed: "claimed",
    citation: "https://example.org/rebuttal", citationLabel: "Rebuttal",
    why: "The primary source is a chat transcript, not a proof, so nothing supports the grade.",
  }).value;
  const { entries } = applyProposal(ENTRIES, { kind: "challenge", entryId: target.id, payload },
    AUTHOR, TODAY);
  const e = entries.find(x => x.id === target.id);

  assert.equal(e.verification, "claimed");
  const rev = e.revisions.at(-1);
  assert.equal(rev.date, TODAY);
  assert.equal(rev.kind, "regraded");
  assert.match(rev.note, new RegExp(`from ${target.verification} to claimed`),
    "the record says what moved, which is editorial rule 2");
  assert.equal(e.sources.at(-1).kind, "challenge", "the citation lands as a challenge source");
});

test("a contributor is credited once, not once per contribution", () => {
  const payload = validateProposal("check", goodCheck).value;
  let entries = ENTRIES;
  for (let i = 0; i < 3; i++) {
    ({ entries } = applyProposal(entries, { kind: "check", entryId: REAL_ID, payload }, AUTHOR, TODAY));
  }
  const e = entries.find(x => x.id === REAL_ID);
  assert.equal(e.reviewers.filter(p => p.handle === AUTHOR.handle).length, 1);
});

test("an author with no display name is credited by handle", () => {
  const payload = validateProposal("check", goodCheck).value;
  const { entries } = applyProposal(ENTRIES, { kind: "check", entryId: REAL_ID, payload },
    { handle: "quiet-axiom" }, TODAY);
  const p = entries.find(x => x.id === REAL_ID).reviewers.at(-1);
  assert.equal(p.name, "quiet-axiom");
  assert.equal(p.orcid, undefined, "absent fields are omitted rather than written as null");
  assert.equal(p.github, undefined);
});

test("a proposal against an entry that has gone throws rather than writing", () => {
  const payload = validateProposal("check", goodCheck).value;
  assert.throws(() => applyProposal(ENTRIES, { kind: "check", entryId: "gone", payload }, AUTHOR, TODAY),
    /not in the registry/);
});

test("the transform never copies an unvalidated object into the tree", () => {
  // The property the whole bot path rests on. Extra keys on a payload must not reach
  // data/entries.json, whatever they are called.
  const payload = {
    ...validateProposal("check", goodCheck).value,
    evil: "<script>alert(1)</script>",
    __proto__: { polluted: true },
    id: "overwritten",
  };
  const { entries } = applyProposal(ENTRIES, { kind: "check", entryId: REAL_ID, payload },
    AUTHOR, TODAY);
  const e = entries.find(x => x.id === REAL_ID);
  const row = e.independent_checks.at(-1);
  assert.equal(row.evil, undefined);
  assert.equal(row.id, undefined);
  assert.equal(e.id, REAL_ID, "the entry id is untouched");
  assert.equal({}.polluted, undefined, "no prototype pollution");
});

test("a new entry is appended with the submitter as its contributor", () => {
  const payload = validateProposal("entry", {
    id: "2026-08-04-a-new-result", title: "A new result",
    claim: "Something was shown for the first time.",
    field: "mathematics", date: "2026-08-04", lab: "Independent", model: "GPT-5.6",
    verification: "claimed", autonomy: "ai-led",
    sources: [{ label: "Transcript", url: "https://example.org/t", kind: "announcement" }],
    tags: ["number-theory"],
  }).value;
  const { entries } = applyProposal(ENTRIES, { kind: "entry", entryId: null, payload },
    AUTHOR, TODAY);
  assert.equal(entries.length, ENTRIES.length + 1);
  const e = entries.at(-1);
  assert.equal(e.id, "2026-08-04-a-new-result");
  assert.equal(e.added, "2026-08-04", "added defaults to the date when not given");
  assert.deepEqual(e.contributors, [
    { name: "Jane Okafor", handle: "patient-lemma", orcid: "0000-0002-1825-0097", github: "jokafor" }]);
});

test("the result of every kind still serialises to valid JSON", () => {
  const cases = [
    ["check", REAL_ID, validateProposal("check", goodCheck).value],
    ["correction", REAL_ID, validateProposal("correction",
      { target: "year_posed", year: 1901, note: "The problem was posed in 1901, not 1910." }).value],
  ];
  for (const [kind, entryId, payload] of cases) {
    const { entries } = applyProposal(ENTRIES, { kind, entryId, payload }, AUTHOR, TODAY);
    const text = serialiseEntries(entries);
    assert.doesNotThrow(() => JSON.parse(text), kind);
    assert.ok(text.endsWith("\n"), "one trailing newline, as the repository stores it");
    assert.ok(!text.includes("\u2014"), "no em dash reaches the registry");
  }
});

test("the pull request body never claims the submission was verified", () => {
  const payload = validateProposal("check", goodCheck).value;
  const body = proposalBody({ kind: "check", entryId: REAL_ID, payload }, AUTHOR,
    "https://whataifound.org");
  assert.match(body, /site account `+ patient-lemma `+/);
  assert.doesNotMatch(body, /@patient-lemma/,
    "a site handle is not a GitHub account; @ would notify whoever owns that name there");
  assert.match(body, /self-reported, not verified/);
  assert.match(body, /has been verified/, "it says so in as many words");
  assert.match(body, /0000-0002-1825-0097/);
  assert.ok(!body.includes(String(AUTHOR.email)), "no email, ever");
});

test("submitted text in the pull request body is inert", () => {
  // Each of these does something on GitHub when it appears in a PR body as markdown:
  // notifies a stranger from the bot's account, closes an issue on merge, hides text
  // from the reviewer, or breaks out of the quoting meant to contain it.
  const hostile = "Looks fine. @octocat Fixes #1 <!-- hidden --> ```` # Heading";
  const checked = validateProposal("check", {
    ...goodCheck,
    who: "Mallory `@octocat` Fixes #1",
    evidence: goodCheck.evidence + " " + hostile,
    coi: "none ``` @octocat",
  });
  assert.ok(checked.value, JSON.stringify(checked.error));
  const payload = checked.value;
  const body = proposalBody({ kind: "check", entryId: REAL_ID, payload }, AUTHOR,
    "https://whataifound.org");

  // Every occurrence of the payload sits inside code: strip the fenced blocks and the
  // inline spans, and none of the dangerous text is left in rendered markdown.
  const outside = body
    .replace(/^(`{3,})text\n[\s\S]*?\n\1$/gm, "")
    .replace(/(`+) .*? \1/g, "");
  for (const bad of ["@octocat", "Fixes #1", "<!--", "# Heading"]) {
    assert.ok(!outside.includes(bad), `${JSON.stringify(bad)} escaped the quoting`);
  }
  // The fence is longer than any run of backticks the submitter typed, so their own
  // four-backtick line cannot close it.
  assert.match(body, /^`{5}text$/m);
});
