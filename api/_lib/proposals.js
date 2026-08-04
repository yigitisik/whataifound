// What a proposal may contain, and what it does to data/entries.json.
//
// This module is the whole of the bot's blast radius. Everything downstream of it is
// mechanical: api/_lib/github.js commits whatever `applyProposal` returns, and the
// workflow refuses a push that changed anything but data/entries.json. So the rule is
// that a hostile payload must not be able to produce a hostile diff, and the way that
// is enforced is by construction: applyProposal never copies a caller-supplied object
// into the tree. It reads named fields, one at a time, each already validated, and
// writes them into a shape this file spells out literally.
//
// Two consequences worth being explicit about.
//
// A maintainer still reviews and merges every one of these. Nothing here decides that a
// grade is right; it decides that a submission is well-formed enough to be worth a
// human's attention, which is exactly what the GitHub issue templates do for the other
// door. Both doors ask the same questions, field for field.
//
// And the diff has to survive CI. The build validates data/entries.json, the integrity
// check sweeps it for markup and em dashes, and the link checker resolves its URLs. A
// submission that would fail any of those is rejected here, with a sentence the
// submitter can act on, rather than half an hour later in a workflow log they cannot see.
import { ENTRY_IDS, VERIFICATION, AUTONOMY, SOURCE_KINDS, FIELDS } from "./registry.js";

export const PROPOSAL_KINDS = ["check", "challenge", "entry", "correction"];

// House style, enforced by scripts/check-integrity.py across every UTF-8 file in the
// repository, data/entries.json included. Catching it here turns a CI failure nobody
// outside the project can read into a sentence at the point of typing.
//
// Written as an escape rather than as the character, for the same reason the Python
// checker does: this file is swept like every other, and a literal here would make
// the check fail on itself.
const EM_DASH = "\u2014";
// The same control and bidi ranges api/_lib/names.js rejects, for the same reason:
// this text is rendered next to other people's names on a public page.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;

const err = (error, message) => ({ error, message });

/** Trim, collapse runs of whitespace, and normalise. Newlines survive in prose fields. */
function clean(v, { multiline = false } = {}) {
  let s = String(v ?? "").normalize("NFC");
  s = multiline ? s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ") : s.replace(/\s+/g, " ");
  return s.trim();
}

function text(v, field, { min = 1, max = 500, multiline = false } = {}) {
  const s = clean(v, { multiline });
  if (s.length < min) return { error: err(`${field}_missing`, `${field} is required.`) };
  if (s.length > max) {
    return { error: err(`${field}_too_long`, `${field} must be at most ${max} characters.`) };
  }
  if (UNSAFE.test(s)) {
    return { error: err(`${field}_invalid`, `${field} contains control or direction-override characters.`) };
  }
  if (s.includes(EM_DASH)) {
    return {
      error: err(`${field}_em_dash`,
        "House style has no em dashes. Use a colon, comma, semicolon or parentheses."),
    };
  }
  // Raw markup in the registry is escaped at render time, so it is not an injection.
  // It is a sign of a paste that wants reading before it is merged, and the integrity
  // check flags it on the way in, so it is refused here rather than merged and reverted.
  if (/<\s*(script|iframe|img|svg|object|embed)\b/i.test(s)) {
    return { error: err(`${field}_markup`, `${field} contains raw HTML. Send plain text.`) };
  }
  return { value: s };
}

/** An ordinary web link, and nothing else. javascript: and data: are the point. */
function url(v, field, { required = true } = {}) {
  const s = clean(v);
  if (!s) {
    return required ? { error: err(`${field}_missing`, `${field} is required.`) } : { value: null };
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    return { error: err(`${field}_invalid`, `${field} must be a full http(s) link.`) };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { error: err(`${field}_invalid`, `${field} must be a full http(s) link.`) };
  }
  if (s.length > 500) return { error: err(`${field}_too_long`, `${field} is too long.`) };
  return { value: u.href };
}

const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""))
  && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

// ---------------------------------------------------------------------------
// Validation, per kind.
//
// Each returns either {error} or {value}, where value is the normalised payload that
// gets stored and later applied. Storing the normalised form rather than the raw one
// means the transform below never re-parses anything.
// ---------------------------------------------------------------------------

function validateCheck(p) {
  const who = text(p.who, "who", { max: 200 });
  if (who.error) return who;
  const outcome = text(p.outcome, "outcome", { max: 400 });
  if (outcome.error) return outcome;
  // What was actually done. This never enters data/entries.json: the schema records a
  // one-line outcome, and the reasoning belongs in the pull request where a reviewer
  // reads it. Required all the same, because "confirmed" with no method behind it is
  // not a check.
  const evidence = text(p.evidence, "evidence", { min: 40, max: 5000, multiline: true });
  if (evidence.error) return evidence;
  const link = url(p.url, "url", { required: false });
  if (link.error) return link;
  const coi = p.coi ? text(p.coi, "coi", { max: 1000, multiline: true }) : { value: "" };
  if (coi.error) return coi;
  return { value: { who: who.value, outcome: outcome.value, url: link.value,
                    evidence: evidence.value, coi: coi.value } };
}

function validateChallenge(p, entry) {
  const axis = String(p.axis ?? "");
  if (axis !== "verification" && axis !== "autonomy") {
    return { error: err("axis_invalid", "Say which grade is wrong: verification or autonomy.") };
  }
  const allowed = axis === "verification" ? VERIFICATION : AUTONOMY;
  const proposed = String(p.proposed ?? "");
  if (!allowed.includes(proposed)) {
    return { error: err("proposed_invalid", `That is not a ${axis} grade.`) };
  }
  if (entry && entry[axis] === proposed) {
    return { error: err("proposed_unchanged", `This entry is already graded ${proposed}.`) };
  }
  // A grade moves on evidence, never on opinion. That rule is the reason this field is
  // required rather than encouraged: without a citation there is nothing for a
  // maintainer to weigh, and the proposal is an opinion with a form around it.
  const citation = url(p.citation, "citation");
  if (citation.error) return citation;
  const label = text(p.citationLabel || "Grade challenge", "citationLabel", { max: 120 });
  if (label.error) return label;
  const why = text(p.why, "why", { min: 40, max: 3000, multiline: true });
  if (why.error) return why;
  return { value: { axis, proposed, citation: citation.value,
                    citationLabel: label.value, why: why.value } };
}

const CORRECTION_TARGETS = ["year_posed", "source", "discussion"];

function validateCorrection(p) {
  const target = String(p.target ?? "");
  if (!CORRECTION_TARGETS.includes(target)) {
    return { error: err("target_invalid", "Corrections cover the year posed, a source link, or a discussion link.") };
  }
  const note = text(p.note, "note", { min: 20, max: 1000, multiline: true });
  if (note.error) return note;
  const out = { target, note: note.value };

  if (target === "year_posed") {
    const year = Number(p.year);
    // Upper bound from the clock rather than a constant: a hardcoded year silently
    // becomes wrong, and this is the one place in the project that legitimately has a
    // clock, because the build deliberately does not.
    const max = new Date().getUTCFullYear() + 1;
    if (!Number.isInteger(year) || year < 1500 || year > max) {
      return { error: err("year_invalid", `The year posed should be between 1500 and ${max}.`) };
    }
    out.year = year;
  } else {
    const link = url(p.url, "url");
    if (link.error) return link;
    const label = text(p.label, "label", { max: 120 });
    if (label.error) return label;
    out.url = link.value;
    out.label = label.value;
    if (target === "source") {
      if (!SOURCE_KINDS.includes(String(p.sourceKind ?? ""))) {
        return { error: err("source_kind_invalid", "Say what the link is: " + SOURCE_KINDS.join(", ") + ".") };
      }
      out.sourceKind = String(p.sourceKind);
    }
  }
  return { value: out };
}

function validateEntry(p) {
  const id = clean(p.id).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id) || id.length < 3 || id.length > 80) {
    return { error: err("id_invalid", "The id is lowercase letters, digits, dots, dashes and underscores. Convention is YYYY-MM-DD-short-name.") };
  }
  // Ids are permanent and never reused, so a collision is not something to resolve by
  // appending a suffix on the submitter's behalf.
  if (ENTRY_IDS.has(id)) {
    return { error: err("id_taken", "The registry already has an entry with that id.") };
  }

  const out = { id };
  for (const [field, max] of [["title", 200], ["claim", 600], ["lab", 120], ["model", 120]]) {
    const v = text(p[field], field, { max });
    if (v.error) return v;
    out[field] = v.value;
  }
  for (const [field, max] of [["detail", 6000], ["novelty_check", 3000], ["caveats", 3000]]) {
    if (!p[field]) continue;
    const v = text(p[field], field, { min: 1, max, multiline: true });
    if (v.error) return v;
    out[field] = v.value;
  }

  if (!FIELDS.includes(String(p.field ?? ""))) {
    return { error: err("field_invalid", "Pick a field from the list.") };
  }
  out.field = String(p.field);

  for (const d of ["date", "added"]) {
    const v = d === "added" ? (p.added || p.date) : p.date;
    if (!isoDate(v)) return { error: err(`${d}_invalid`, `${d} must be a real date, as YYYY-MM-DD.`) };
    out[d] = String(v);
  }

  if (!VERIFICATION.includes(String(p.verification ?? ""))) {
    return { error: err("verification_invalid", "Pick a verification grade from the list.") };
  }
  if (!AUTONOMY.includes(String(p.autonomy ?? ""))) {
    return { error: err("autonomy_invalid", "Pick an autonomy grade from the list.") };
  }
  out.verification = String(p.verification);
  out.autonomy = String(p.autonomy);

  const sources = Array.isArray(p.sources) ? p.sources : [];
  if (!sources.length) return { error: err("sources_missing", "An entry needs at least one source.") };
  if (sources.length > 20) return { error: err("sources_too_many", "That is more sources than an entry needs.") };
  out.sources = [];
  for (const s of sources) {
    const link = url(s?.url, "source url");
    if (link.error) return link;
    const label = text(s?.label, "source label", { max: 160 });
    if (label.error) return label;
    if (!SOURCE_KINDS.includes(String(s?.kind ?? ""))) {
      return { error: err("source_kind_invalid", "Every source needs a kind: " + SOURCE_KINDS.join(", ") + ".") };
    }
    out.sources.push({ label: label.value, url: link.value, kind: String(s.kind) });
  }

  // Editorial rule 4, the one the build enforces and the one submitters most often trip:
  // anything above "claimed" rests on a primary artifact, not on an announcement.
  if (out.verification !== "claimed" && !out.sources.some(s => s.kind === "research")) {
    return {
      error: err("needs_research_source",
        `A grade of "${out.verification}" needs a research source: a paper, a preprint, a `
        + "proof, or a repository. With only an announcement to go on, the grade is \"claimed\"."),
    };
  }

  if (p.year_posed !== undefined && p.year_posed !== null && p.year_posed !== "") {
    const y = Number(p.year_posed);
    const max = new Date().getUTCFullYear() + 1;
    if (!Number.isInteger(y) || y < 1500 || y > max) {
      return { error: err("year_invalid", `The year posed should be between 1500 and ${max}.`) };
    }
    out.year_posed = y;
  }

  if (Array.isArray(p.humans) && p.humans.length) {
    if (p.humans.length > 30) return { error: err("humans_too_many", "That is a lot of collaborators.") };
    out.humans = [];
    for (const h of p.humans) {
      const v = text(h, "collaborator", { max: 120 });
      if (v.error) return v;
      out.humans.push(v.value);
    }
  }

  if (Array.isArray(p.tags) && p.tags.length) {
    if (p.tags.length > 12) return { error: err("tags_too_many", "Up to twelve tags.") };
    out.tags = [];
    for (const t of p.tags) {
      const s = clean(t).toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(s)) {
        return { error: err("tag_invalid", `"${s}" is not a tag: lowercase words joined by hyphens.`) };
      }
      out.tags.push(s);
    }
  }
  return { value: out };
}

/**
 * Validate a submission.
 *
 * `entry` is the current entry from data/entries.json for the kinds that refer to one,
 * so a challenge can be refused for proposing the grade the entry already carries.
 */
export function validateProposal(kind, payload, entry) {
  if (!PROPOSAL_KINDS.includes(kind)) {
    return { error: err("kind_invalid", "Unknown kind of proposal.") };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: err("payload_invalid", "Nothing was submitted.") };
  }
  if (kind === "check") return validateCheck(payload);
  if (kind === "challenge") return validateChallenge(payload, entry);
  if (kind === "correction") return validateCorrection(payload);
  return validateEntry(payload);
}

// ---------------------------------------------------------------------------
// The transform.
// ---------------------------------------------------------------------------

/**
 * How a contributor is credited on an entry.
 *
 * `{name}` alone is already a valid person in docs/entry.schema.json, so a
 * Google-authenticated contributor needs no schema change to be credited. `handle`
 * links the credit on /contributors to a profile, and `orcid` is the identifier that
 * actually carries weight in a science registry; both are omitted when absent rather
 * than written as null, so the diff stays as small as the contribution.
 */
function personOf(author) {
  const p = { name: author.displayName || author.handle };
  if (author.handle) p.handle = author.handle;
  if (author.orcid) p.orcid = author.orcid;
  if (author.githubLogin) p.github = author.githubLogin;
  return p;
}

/** Append to an array field, creating it if absent, without mutating the input entry. */
function push(entry, field, item) {
  entry[field] = [...(entry[field] || []), item];
}

/** Credit a person once. Matching on handle first, then on name. */
function credit(entry, field, person) {
  const already = (entry[field] || []).some(
    p => (person.handle && p.handle === person.handle) || p.name === person.name);
  if (!already) push(entry, field, person);
}

/**
 * Produce the new data/entries.json contents for an accepted proposal.
 *
 * Returns {entries, summary}. Throws only on a proposal that refers to an entry that no
 * longer exists, which happens when an id changed between submission and merge.
 *
 * The input array is never mutated: the caller holds the file it fetched from GitHub,
 * and a partially applied transform on that object would be very hard to see.
 */
export function applyProposal(entries, { kind, entryId, payload }, author, today) {
  const out = entries.map(e => ({ ...e }));
  const person = personOf(author);
  const date = isoDate(today) ? today : new Date().toISOString().slice(0, 10);

  if (kind === "entry") {
    if (out.some(e => e.id === payload.id)) {
      throw new Error(`entry ${payload.id} already exists`);
    }
    // Appended rather than inserted by date. build-site.py sorts on read, so position
    // in the file is cosmetic, and appending keeps the diff to the lines that are new
    // instead of moving every entry down by one.
    const entry = { ...payload, contributors: [person] };
    out.push(entry);
    return { entries: out, summary: `Add entry ${payload.id}` };
  }

  const i = out.findIndex(e => e.id === entryId);
  if (i < 0) throw new Error(`entry ${entryId} is not in the registry`);
  const entry = out[i];

  if (kind === "check") {
    // Only the three fields the schema has. `evidence` and `coi` stay in the pull
    // request, where a reviewer reads them; the entry records the outcome.
    const row = { who: payload.who, outcome: payload.outcome };
    if (payload.url) row.url = payload.url;
    push(entry, "independent_checks", row);
    credit(entry, "reviewers", person);
    return { entries: out, summary: `Independent check on ${entryId}` };
  }

  if (kind === "challenge") {
    const from = entry[payload.axis];
    entry[payload.axis] = payload.proposed;
    // Editorial rule 2: an entry is never deleted, it is downgraded and annotated. This
    // row is what makes that visible on the site rather than only in the git log, and
    // it is why the grade change and the record of it are one commit.
    const rev = {
      date,
      kind: "regraded",
      note: `${payload.axis === "verification" ? "Verification" : "Autonomy"} moved from `
        + `${from} to ${payload.proposed}: ${payload.why}`,
      url: payload.citation,
    };
    push(entry, "revisions", rev);
    push(entry, "sources", {
      label: payload.citationLabel, url: payload.citation, kind: "challenge",
    });
    credit(entry, "contributors", person);
    return { entries: out, summary: `Regrade ${entryId}: ${payload.axis} ${from} to ${payload.proposed}` };
  }

  // correction
  if (payload.target === "year_posed") {
    entry.year_posed = payload.year;
  } else if (payload.target === "source") {
    push(entry, "sources", { label: payload.label, url: payload.url, kind: payload.sourceKind });
  } else {
    push(entry, "discussion", { label: payload.label, url: payload.url });
  }
  push(entry, "revisions", { date, kind: "correction", note: payload.note });
  credit(entry, "contributors", person);
  return { entries: out, summary: `Correction to ${entryId}` };
}

/**
 * The pull request body.
 *
 * Written for the maintainer who has to decide, so it leads with what changed and what
 * the submitter says they did, and states plainly that none of it is verified. The
 * submitter is identified by handle rather than by email, which is never published.
 */
export function proposalBody({ kind, entryId, payload }, author, siteOrigin) {
  const who = author.handle ? `@${author.handle}` : "a contributor";
  const lines = [
    `Submitted through the site by ${who}`
    + (author.orcid ? ` (ORCID ${author.orcid})` : "") + ".",
    "",
  ];

  if (kind === "check") {
    lines.push(`**Independent check on \`${entryId}\`**`, "",
      `**Checked by:** ${payload.who}`, `**Outcome:** ${payload.outcome}`,
      payload.url ? `**Link:** ${payload.url}` : "", "",
      "**What they checked, and how**", "", payload.evidence, "",
      `**Conflicts of interest:** ${payload.coi || "none stated"}`);
  } else if (kind === "challenge") {
    lines.push(`**Grade challenge on \`${entryId}\`**`, "",
      `**Axis:** ${payload.axis}`, `**Proposed:** ${payload.proposed}`,
      `**Citation:** ${payload.citation}`, "", "**Argument**", "", payload.why);
  } else if (kind === "correction") {
    lines.push(`**Correction to \`${entryId}\`**`, "",
      `**What:** ${payload.target}`,
      payload.url ? `**Link:** ${payload.url}` : `**Year posed:** ${payload.year}`,
      "", payload.note);
  } else {
    lines.push(`**New entry: \`${payload.id}\`**`, "",
      `**Title:** ${payload.title}`,
      `**Graded:** ${payload.verification} / ${payload.autonomy}`,
      `**Lab:** ${payload.lab}  **Model:** ${payload.model}`, "",
      payload.claim, "",
      "**Sources**", "",
      ...payload.sources.map(s => `- \`${s.kind}\` [${s.label}](${s.url})`));
  }

  lines.push("",
    "---",
    "",
    "Nothing above has been verified. This is a submission, and merging it is the "
    + "editorial decision: the same one a pull request opened by hand asks for.",
    "",
    entryId ? `Entry: ${siteOrigin}/finding/${entryId}` : "",
    "",
    "The build regenerates every derived file from `data/entries.json` on push, so this "
    + "branch carries the data change only. Do not hand-edit the generated output on it.");
  return lines.filter(l => l !== null && l !== undefined).join("\n");
}
