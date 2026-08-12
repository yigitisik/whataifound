// The registry as a queryable JSON contract.
//
// GET /api/dataset                     every entry, newest first
// GET /api/dataset?field=mathematics   one field
// GET /api/dataset?verification=formal one grade
// GET /api/dataset?since=2026-08-01    entries added on or after a date
// GET /api/dataset?limit=10&offset=20  a window into the above
//
// data/entries.json has always been downloadable, and still is: it is the source of
// truth and the thing to take if you want everything. This endpoint answers the other
// question, which the file cannot. It promises a *named, stable set of fields*, so a
// consumer is not reading whatever shape the registry happens to have this month, and it
// filters server-side, so asking for eight formally verified entries does not mean
// fetching 150 KB and discarding most of it.
//
// Deliberately has no database and reads no environment. The static site works with the
// API absent, and this endpoint has to keep working when Postgres is gone: it serves
// generated data, not account data. Nothing here is per-session, which is why it is the
// one endpoint that overrides the blanket no-store (see the header block in vercel.json,
// which must stay ahead of the /api/(.*) rule or that rule wins).
import { json, methodNotAllowed } from "./_lib/http.js";
import { ENTRIES, FIELDS_SERVED, GENERATED } from "./_lib/dataset.js";
import { AUTONOMY, FIELDS, VERIFICATION } from "./_lib/registry.js";

// The contract version. Bumped only when a field is removed or its meaning changes;
// adding a field is backwards compatible and does not move it.
const VERSION = 1;

const MAX_LIMIT = 500;

// Filters that match one exact value, mapped to the entry field and the allowlist that
// value has to come from. Validating against the same vocabulary the build enforces is
// what makes a typo an error rather than a silently empty result.
const EXACT = {
  field: { key: "field", allowed: FIELDS },
  verification: { key: "verification", allowed: VERIFICATION },
  autonomy: { key: "autonomy", allowed: AUTONOMY },
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 400 with the accepted values named. An error that does not say what would have worked
 *  just moves the guessing to the caller. */
function badRequest(res, parameter, message, accepted) {
  return json(res, 400, {
    error: "bad_request",
    parameter,
    message,
    ...(accepted ? { accepted } : {}),
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return methodNotAllowed(res, ["GET", "HEAD"]);
  }

  const params = new URL(req.url, "http://x").searchParams;

  let rows = ENTRIES;

  for (const [name, { key, allowed }] of Object.entries(EXACT)) {
    const want = params.get(name);
    if (want === null || want === "") continue;
    if (!allowed.includes(want)) {
      return badRequest(res, name, `Unknown ${name} '${want}'.`, [...allowed].sort());
    }
    rows = rows.filter((e) => e[key] === want);
  }

  // Lab and tag are open vocabularies: the registry gains both without a code change, so
  // there is no allowlist to check them against and an unmatched value is a legitimate
  // empty result rather than a mistake. Lab matches exactly, because the filter on the
  // site does too and a substring match would make "Google" and "Google DeepMind" the
  // same query.
  const lab = params.get("lab");
  if (lab) rows = rows.filter((e) => e.lab === lab);

  const tag = params.get("tag");
  if (tag) rows = rows.filter((e) => (e.tags || []).includes(tag));

  // `since` filters on `added`, when the entry entered this registry, not on `date`,
  // when the result became public. "What is new here" is the question a polling consumer
  // is asking. Both fields are ISO dates, so a string compare is a date compare, and no
  // clock is involved on this side: the caller supplies the boundary.
  const since = params.get("since");
  if (since) {
    if (!ISO_DATE.test(since)) {
      return badRequest(res, "since", `Expected YYYY-MM-DD, got '${since}'.`);
    }
    rows = rows.filter((e) => (e.added || "") >= since);
  }

  // Newest first, matching the site. The generated module is sorted by id so that it
  // diffs cleanly; the reading order is applied here.
  rows = [...rows].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  const total = rows.length;

  const limit = params.get("limit");
  const offset = params.get("offset");

  let from = 0;
  if (offset !== null && offset !== "") {
    from = Number(offset);
    if (!Number.isInteger(from) || from < 0) {
      return badRequest(res, "offset", `Expected a non-negative integer, got '${offset}'.`);
    }
  }

  let count = rows.length;
  if (limit !== null && limit !== "") {
    count = Number(limit);
    if (!Number.isInteger(count) || count < 0 || count > MAX_LIMIT) {
      return badRequest(res, "limit", `Expected an integer from 0 to ${MAX_LIMIT}, got '${limit}'.`);
    }
  }

  rows = rows.slice(from, from + count);

  // Cacheable, unlike every other endpoint here: this is generated data that changes
  // only when the site is rebuilt, so the shared no-store default in json() is wrong for
  // it. Passed as an override rather than by changing that default, which is correct for
  // the per-session endpoints it was written for.
  return json(
    res,
    200,
    {
      version: VERSION,
      generated: GENERATED,
      license: "CC BY 4.0",
      fields: FIELDS_SERVED,
      total,
      count: rows.length,
      offset: from,
      entries: rows,
    },
    { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  );
}
