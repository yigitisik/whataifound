// The bot that turns an accepted submission into a pull request.
//
// A GitHub App rather than a personal access token, because an App's permissions are
// scoped to this repository and its credential is a key that mints short-lived tokens
// rather than a long-lived secret that is itself the access. The App needs exactly two
// repository permissions: Contents (write, to push a branch) and Pull requests (write).
// It must not have Actions, Workflows, or Administration: the branch it pushes is
// rebuilt by a workflow, and an App that could edit workflows could rewrite the check
// that constrains it.
//
// What it is allowed to change is one file. Every commit this module makes carries a
// tree with a single entry, data/entries.json, laid over the base commit's tree. That
// is enforced again in .github/workflows/rebuild-bot.yml, which refuses a submission
// branch whose diff touches anything else. Two locks, because the first one is code in
// a serverless function and the second one is code a reviewer reads in the repository.
//
// Nothing here decides anything. A maintainer reviews and merges, exactly as they would
// a pull request opened by hand.
import crypto from "node:crypto";

const API = "https://api.github.com";
const UA = "whataifound.org-bot";

/** Where the data file lives. The one path this module is allowed to write. */
export const DATA_PATH = "data/entries.json";

export function githubConfigured() {
  return Boolean(process.env.GH_APP_ID && process.env.GH_APP_PRIVATE_KEY
    && process.env.GH_INSTALLATION_ID && process.env.GH_REPO);
}

function repo() {
  const [owner, name] = String(process.env.GH_REPO || "").split("/");
  if (!owner || !name) throw new Error("GH_REPO must be owner/name");
  return { owner, name };
}

const baseBranch = () => process.env.GH_BASE_BRANCH || "main";

/**
 * A JWT signed with the App's private key, good for ten minutes.
 *
 * Hand-rolled for the same reason api/_lib/session.js is: it is one signature over one
 * JSON object, there is exactly one algorithm, and the algorithm is not read from the
 * token. A JOSE library here would be a dependency on the path that holds the key that
 * can write to the repository.
 */
function appJwt() {
  const key = String(process.env.GH_APP_PRIVATE_KEY || "")
    // Vercel's environment variable editor stores a pasted PEM with real newlines, but
    // a value set through the CLI or copied out of a .env file often arrives with them
    // escaped. Accept both rather than fail with "invalid key" on a correct paste.
    .replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  // Backdated by a minute against clock skew between this function and GitHub, which
  // rejects a token issued in its future. Ten minutes is the documented maximum.
  const claims = { iat: now - 60, exp: now + 540, iss: process.env.GH_APP_ID };
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signing = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claims)}`;
  const sig = crypto.createSign("RSA-SHA256").update(signing).sign(key).toString("base64url");
  return `${signing}.${sig}`;
}

// One installation token per warm function instance. They last an hour; this drops it
// after fifty minutes so a request is never made with one that expires mid-flight.
let cached = { token: null, expires: 0 };

async function installationToken() {
  if (cached.token && Date.now() < cached.expires) return cached.token;
  const id = process.env.GH_INSTALLATION_ID;
  const r = await fetch(`${API}/app/installations/${encodeURIComponent(id)}/access_tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appJwt()}`,
      accept: "application/vnd.github+json",
      "user-agent": UA,
    },
  });
  if (!r.ok) throw new Error(`installation token: ${r.status} ${await r.text()}`);
  const out = await r.json();
  cached = { token: out.token, expires: Date.now() + 50 * 60 * 1000 };
  return out.token;
}

async function gh(path, { method = "GET", body, raw = false } = {}) {
  const token = await installationToken();
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
      "user-agent": UA,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    const e = new Error(`github ${method} ${path}: ${r.status}`);
    e.status = r.status;
    // Truncated: a GitHub error body can be long, and this ends up in a log line.
    e.detail = detail.slice(0, 500);
    throw e;
  }
  return raw ? r.text() : r.json();
}

/** The current data/entries.json on the base branch, parsed, with the commit it came from. */
export async function readEntries() {
  const { owner, name } = repo();
  const ref = await gh(`/repos/${owner}/${name}/git/ref/heads/${baseBranch()}`);
  const commitSha = ref.object.sha;
  const commit = await gh(`/repos/${owner}/${name}/git/commits/${commitSha}`);
  const text = await gh(
    `/repos/${owner}/${name}/contents/${DATA_PATH}?ref=${commitSha}`, { raw: true });
  return { entries: JSON.parse(text), commitSha, treeSha: commit.tree.sha };
}

/**
 * Serialise the registry the way the repository stores it.
 *
 * Two spaces, no ASCII escaping, one trailing newline: byte-identical to what
 * `json.dump(indent=2)` writes in Python, which is what every other tool in this
 * project produces. A mismatch here would not corrupt anything, but it would reformat
 * 3000 lines and bury the actual change in the diff a maintainer has to review.
 * api/_lib/proposals.test.js round-trips the committed file to prove it.
 */
export function serialiseEntries(entries) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

/**
 * Push a one-file branch and open a pull request for it.
 *
 * The tree is built explicitly rather than through the contents API so that the single
 * allowed path is written here, in one place, as a literal.
 *
 * `base` must be the readEntries() result the new contents were computed from, not a
 * fresh one. Reading the file and the commit to build on as two separate operations
 * would mean that if main moved in between, this would commit data read from the older
 * tree on top of the newer one, silently reverting whatever had landed. Threading one
 * base through makes the commit's parent exactly the state the transform saw, so a race
 * shows up as a merge conflict a maintainer can see instead of as a quiet revert.
 */
export async function openProposalPr({ base, branch, title, body, message, entries, labels = [] }) {
  const { owner, name } = repo();
  if (!base?.commitSha || !base?.treeSha) {
    throw new Error("openProposalPr needs the base from readEntries()");
  }

  const blob = await gh(`/repos/${owner}/${name}/git/blobs`, {
    method: "POST",
    body: { content: serialiseEntries(entries), encoding: "utf-8" },
  });

  const tree = await gh(`/repos/${owner}/${name}/git/trees`, {
    method: "POST",
    body: {
      base_tree: base.treeSha,
      tree: [{ path: DATA_PATH, mode: "100644", type: "blob", sha: blob.sha }],
    },
  });

  const commit = await gh(`/repos/${owner}/${name}/git/commits`, {
    method: "POST",
    body: { message, tree: tree.sha, parents: [base.commitSha] },
  });

  await gh(`/repos/${owner}/${name}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${branch}`, sha: commit.sha },
  });

  const pr = await gh(`/repos/${owner}/${name}/pulls`, {
    method: "POST",
    body: { title, body, head: branch, base: baseBranch(), maintainer_can_modify: true },
  });

  if (labels.length) {
    // Cosmetic. A repository that has not defined these labels should not turn a
    // successfully opened pull request into a failed submission.
    try {
      await gh(`/repos/${owner}/${name}/issues/${pr.number}/labels`,
        { method: "POST", body: { labels } });
    } catch { /* the pull request exists, which is what was asked for */ }
  }

  return { number: pr.number, url: pr.html_url, branch };
}

/**
 * Has this pull request been merged?
 *
 * Polled by /api/proposals so a contributor's page reflects reality without the project
 * having to run a webhook receiver, which would be a second public endpoint to secure
 * for a status that changes a handful of times a week.
 */
export async function pullState(number) {
  const { owner, name } = repo();
  const pr = await gh(`/repos/${owner}/${name}/pulls/${encodeURIComponent(number)}`);
  if (pr.merged_at) return "merged";
  if (pr.state === "closed") return "rejected";
  return "pr_open";
}
