// The maintainer's queue: what has been submitted, and what to do about it.
//
// GET  /api/admin/proposals   everything undecided, oldest first
// POST /api/admin/proposals   {id, decision, note}
//
// decision is one of:
//   approve    open the pull request. The proposal becomes pr_open; merging it is
//              still a separate, human act on GitHub.
//   reject     no pull request is ever opened. The note is shown to the submitter.
//   needs_info the submitter is asked for more. The row stays in the queue.
//
// Approving is the only place in this project where a click causes a write to the
// repository, and it is deliberately the narrowest one available: the branch that gets
// pushed contains a single changed file, computed by api/_lib/proposals.js from a
// payload that was validated when it was submitted and stored in its normalised form.
// The workflow on the other side refuses the push if that is not what arrived.
import { db } from "../_lib/db.js";
import { json, methodNotAllowed, readJson, sameOrigin, origin } from "../_lib/http.js";
import { requireAccount } from "../_lib/roles.js";
import { applyProposal, proposalBody } from "../_lib/proposals.js";
import { githubConfigured, openProposalPr, pullState, readEntries } from "../_lib/github.js";

const DECISIONS = ["approve", "reject", "needs_info"];

// How many open pull requests to re-check on a queue load. Bounded because each is a
// GitHub API call and the page should not get slower as the project gets busier.
const SYNC_LIMIT = 20;

export default async function handler(req, res) {
  const me = await requireAccount(req, res, "maintainer");
  if (!me) return;
  if (req.method === "GET") return queue(req, res);
  if (req.method === "POST") return decide(req, res, me);
  return methodNotAllowed(res, ["GET", "POST"]);
}

function adminRow(r) {
  return {
    id: r.id,
    kind: r.kind,
    entryId: r.entry_id,
    status: r.status,
    payload: r.payload,
    prNumber: r.pr_number,
    prUrl: r.pr_url,
    note: r.decided_note,
    createdAt: r.created_at,
    author: {
      handle: r.handle,
      displayName: r.display_name,
      orcid: r.orcid,
      githubLogin: r.github_login,
      role: r.role,
      // What the queue actually needs about a submitter: whether their previous work
      // has been accepted. A first submission and a tenth from someone with an eight
      // out of nine record deserve different amounts of scepticism.
      merged: Number(r.merged_total || 0),
      submitted: Number(r.submitted_total || 0),
    },
  };
}

async function queue(req, res) {
  const sql = db();
  let rows;
  try {
    rows = await sql`
      select p.id, p.kind, p.entry_id, p.status, p.payload, p.pr_number, p.pr_url,
             p.decided_note, p.created_at,
             a.handle, a.display_name, a.orcid, a.github_login, a.role,
             (select count(*) from proposals q
               where q.account_id = p.account_id and q.status = 'merged')::int as merged_total,
             (select count(*) from proposals q
               where q.account_id = p.account_id)::int as submitted_total
        from proposals p
        join accounts a on a.id = p.account_id
       where p.status in ('pending','needs_info','pr_open')
       order by p.created_at, p.id
       limit 200`;
  } catch (err) {
    console.error("admin queue", err);
    return json(res, 503, { error: "unavailable" });
  }

  // Merging happens on GitHub, so this is where the site finds out. A webhook would be
  // faster and would also be a second public endpoint to authenticate for a status that
  // changes a few times a week; polling on the one page a maintainer opens anyway is
  // the smaller thing to own.
  const open = rows.filter(r => r.status === "pr_open" && r.pr_number).slice(0, SYNC_LIMIT);
  if (open.length && githubConfigured()) {
    const seen = await Promise.all(open.map(async r => {
      try {
        return { id: r.id, state: await pullState(r.pr_number) };
      } catch {
        return null;   // a transient GitHub failure must not empty the queue
      }
    }));
    for (const s of seen) {
      if (!s || s.state === "pr_open") continue;
      try {
        await sql`
          update proposals
             set status = ${s.state}, decided_at = coalesce(decided_at, now()), updated_at = now()
           where id = ${s.id} and status = 'pr_open'`;
        const row = rows.find(r => r.id === s.id);
        if (row) row.status = s.state;
      } catch (err) {
        console.error("admin sync", err);
      }
    }
  }

  json(res, 200, {
    proposals: rows.map(adminRow),
    github: githubConfigured(),
  });
}

async function decide(req, res, me) {
  if (!sameOrigin(req)) return json(res, 403, { error: "cross_origin" });

  let body;
  try {
    body = await readJson(req, 8 * 1024);
  } catch (err) {
    return json(res, 400, { error: err.message === "body_too_large" ? "too_large" : "bad_json" });
  }

  const decision = String(body.decision ?? "");
  if (!DECISIONS.includes(decision)) {
    return json(res, 400, { error: "decision_invalid", allowed: DECISIONS });
  }
  // Trimmed and capped, and it is shown to the submitter as text rather than markup:
  // account.js escapes it. A rejection with no reason is the fastest way to lose a
  // contributor, so it is required for the two decisions that ask something of them.
  const note = String(body.note ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 2000);
  if ((decision === "reject" || decision === "needs_info") && note.length < 10) {
    return json(res, 400, {
      error: "note_required",
      message: "Say why. The submitter sees this, and a decision with no reason reads as a shrug.",
    });
  }

  const sql = db();
  let row;
  try {
    const rows = await sql`
      select p.id, p.kind, p.entry_id, p.payload, p.status,
             a.handle, a.display_name, a.orcid, a.github_login
        from proposals p
        join accounts a on a.id = p.account_id
       where p.id = ${String(body.id ?? "")} limit 1`;
    row = rows[0];
  } catch (err) {
    // An id that is not a uuid reaches Postgres as a cast error rather than as no rows.
    console.error("admin decide lookup", err);
    return json(res, 400, { error: "not_found" });
  }
  if (!row) return json(res, 404, { error: "not_found" });

  if (decision !== "approve") {
    const status = decision === "reject" ? "rejected" : "needs_info";
    try {
      await sql`
        update proposals
           set status = ${status}, decided_by = ${me.id}, decided_note = ${note},
               decided_at = now(), updated_at = now()
         where id = ${row.id}`;
    } catch (err) {
      console.error("admin decide", err);
      return json(res, 503, { error: "unavailable" });
    }
    return json(res, 200, { ok: true, status });
  }

  // ---- approve: open the pull request -------------------------------------
  if (row.status === "pr_open") {
    return json(res, 409, { error: "already_open", message: "That already has a pull request." });
  }
  if (!githubConfigured()) {
    return json(res, 503, {
      error: "github_unconfigured",
      message: "The GitHub App is not set up on this deployment, so no pull request can be opened.",
    });
  }

  const author = {
    handle: row.handle, displayName: row.display_name,
    orcid: row.orcid, githubLogin: row.github_login,
  };

  let pr;
  try {
    // Read, transform, push. The read is deliberately here rather than at submission
    // time: the registry may have moved in between, and the pull request has to be
    // against what main says now or it will not apply. `base` carries the commit that
    // read came from, so the commit is built on exactly that state.
    const base = await readEntries();
    const today = new Date().toISOString().slice(0, 10);
    const { entries: next, summary } = applyProposal(base.entries, {
      kind: row.kind, entryId: row.entry_id, payload: row.payload,
    }, author, today);

    pr = await openProposalPr({
      base,
      // The workflow triggers on submission/**, and the proposal id is a uuid, so the
      // branch name carries nothing a submitter chose.
      branch: `submission/${row.id}`,
      title: summary,
      body: proposalBody(
        { kind: row.kind, entryId: row.entry_id, payload: row.payload }, author, origin(req)),
      message: `${summary}\n\nSubmitted through the site by @${row.handle || "a contributor"}.`,
      entries: next,
      labels: ["submission", row.kind],
    });
  } catch (err) {
    console.error("admin approve", err?.message, err?.detail || "");
    return json(res, 502, {
      error: "github_failed",
      message: "The pull request could not be opened. The submission is untouched; try again.",
    });
  }

  try {
    await sql`
      update proposals
         set status = 'pr_open', pr_number = ${pr.number}, pr_url = ${pr.url},
             decided_by = ${me.id}, decided_note = ${note || null}, updated_at = now()
       where id = ${row.id}`;
  } catch (err) {
    // The pull request exists. Losing the row's link to it is recoverable by hand and
    // far better than a second pull request on a retry.
    console.error("admin approve save", err, "pr", pr.number);
  }
  json(res, 200, { ok: true, status: "pr_open", prNumber: pr.number, prUrl: pr.url });
}
