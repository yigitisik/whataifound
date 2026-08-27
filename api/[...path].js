// Every /api/* path that no other function claims.
//
// Vercel's fallback for an unmatched function path is a text/plain body reading "The page
// could not be found NOT_FOUND". A caller that asked for JSON and parses the reply gets a
// syntax error rather than a status it can branch on, which is the one failure an API 404
// exists to prevent. An agent reading this API has no HTML renderer to fall back on.
//
// RFC 9457 (application/problem+json), carrying the same `error` slug the rest of the API
// already uses, so a client that switches on `error` keeps working and one that understands
// problem+json gets the standard fields too. `resolution` names what would have worked,
// matching the rule badRequest() follows in dataset.js: an error that does not say that just
// moves the guessing to the caller.
//
// Deliberately reads no database and no environment. It has to answer when Postgres is gone.
import { json } from "./_lib/http.js";

// A stable identifier for the problem type, not a fetch target. Absolute and hard-coded for
// the same reason the canonical domain is hard-coded everywhere else in the build.
const TYPE = "https://whataifound.org/developers#errors";

export default async function handler(req, res) {
  // Path only: the query string is the caller's, and echoing it back adds nothing an agent
  // can act on. Capped because the reflected value is unbounded input.
  const path = (req.url || "/").split("?")[0].slice(0, 200);

  return json(
    res,
    404,
    {
      type: TYPE,
      title: "No such endpoint",
      status: 404,
      detail: `No API endpoint is served at ${path}.`,
      instance: path,
      error: "not_found",
      resolution:
        "The public endpoints are GET /api/dataset (the registry, filterable) and " +
        "GET /api/health. Both are described in /openapi.json. The complete registry is " +
        "also downloadable as /data/entries.json.",
    },
    { "Content-Type": "application/problem+json; charset=utf-8" },
  );
}
