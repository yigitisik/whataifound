// A public profile: /u/<handle>, rewritten to this function by vercel.json.
//
// Off by default. It exists only once the account holder has turned it on, and it 404s
// otherwise, which is the same answer a handle that was never registered gets. Somebody
// probing for whether a person has an account here learns nothing either way.
//
// Rendered as full HTML on the server rather than hydrated in the browser, because the
// point of this page is that a link to it previews properly when it is shared. Open
// Graph tags a crawler can read are the entire engagement mechanism, and no crawler
// runs the fetch that would fill in a client-rendered version.
//
// This page is NOT committed, so scripts/check-integrity.py never sees it. Every other
// page on the site is swept for smuggled markup before it deploys; this one is
// assembled at request time from database values. So everything interpolated below goes
// through esc(), and the two fields that could carry a person's own text (handle and
// display name) were constrained on the way in as well. There is deliberately no bio
// field: no free-form prose means nothing to moderate and nothing to sanitise.
import { db } from "../_lib/db.js";
import { entryTitle } from "../_lib/registry.js";
import { validateHandle, normaliseHandle } from "../_lib/handles.js";
import { HEADER, FOOTER } from "../_lib/shell.js";

const SITE = "https://whataifound.org";

const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ROLE_LABEL = {
  reader: "Reader", contributor: "Contributor",
  reviewer: "Reviewer", maintainer: "Maintainer",
};

const KIND_LABEL = {
  check: "Independent check", challenge: "Grade challenge",
  entry: "New entry", correction: "Correction",
};

function notFound(res) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Not cached: a profile that is switched on should appear without waiting out a TTL
  // on the 404 that preceded it.
  res.setHeader("Cache-Control", "no-store");
  res.end(page({
    title: "Not found",
    body: '<h1 class="meth-title">No such profile</h1>'
      + '<p class="lede">Either nobody has that handle, or they have not made their '
      + 'profile public.</p>'
      + '<p class="finding-back"><a href="/">Back to the registry</a></p>',
    robots: "noindex, follow",
  }));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end();
  }

  // The rewrite gives us the path segment. Normalised and validated before it reaches a
  // query, so a handle that could not have been registered never becomes one.
  const raw = req.query?.handle ?? new URL(req.url, SITE).pathname.split("/").pop();
  const handle = normaliseHandle(raw);
  if (validateHandle(handle)) return notFound(res);

  let account;
  let rows = [];
  try {
    const sql = db();
    const found = await sql`
      select id, handle, display_name, orcid, github_login, role, created_at
        from accounts
       where lower(handle) = ${handle} and is_public = true and banned_at is null
       limit 1`;
    account = found[0];
    if (!account) return notFound(res);

    // Merged only. An open pull request is not a contribution yet, and a rejected one
    // is nobody else's business: publishing what somebody tried and had turned down
    // would make submitting a risk, which is the opposite of the point.
    rows = await sql`
      select kind, entry_id, pr_number, pr_url, updated_at
        from proposals
       where account_id = ${account.id} and status = 'merged'
       order by updated_at desc
       limit 50`;
  } catch (err) {
    console.error("profile", err);
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(page({
      title: "Unavailable",
      body: '<h1 class="meth-title">Not available right now</h1>'
        + '<p class="lede">Profiles are temporarily unavailable. The registry itself is fine.</p>'
        + '<p class="finding-back"><a href="/">Back to the registry</a></p>',
      robots: "noindex, nofollow",
    }));
  }

  const name = account.display_name || account.handle;
  const url = `${SITE}/u/${account.handle}`;
  const joined = account.created_at
    ? new Date(account.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long" })
    : "";

  const counts = { check: 0, challenge: 0, entry: 0, correction: 0 };
  for (const r of rows) if (counts[r.kind] !== undefined) counts[r.kind]++;

  const tiles = [
    ["Checks accepted", counts.check],
    ["Entries merged", counts.entry],
    ["Grades changed", counts.challenge],
    ["Corrections", counts.correction],
  ].filter(([, n]) => n > 0);

  const stat = ([label, n]) =>
    `<div class="stat"><b>${n}</b><span>${esc(label)}</span></div>`;

  const row = r => {
    const title = r.entry_id ? entryTitle(r.entry_id) : null;
    const when = r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : "";
    // A merged proposal whose entry has since been removed still counts, but it has
    // nothing to link to. The id is shown so the row is not a mystery.
    const label = title || r.entry_id || "New entry";
    const linked = r.entry_id && title
      ? `<a class="feed-title" href="/finding/${esc(r.entry_id)}">${esc(label)}</a>`
      : `<span class="feed-title">${esc(label)}</span>`;
    return `<li class="feed-row">`
      + `<span class="feed-meta"><time class="feed-date" datetime="${esc(when)}">${esc(when)}</time>`
      + `<span class="pill r r-merged">${esc(KIND_LABEL[r.kind] || "Contribution")}</span></span>`
      + linked + `</li>`;
  };

  const contributions = rows.length
    ? `<ul class="feed">${rows.map(row).join("")}</ul>`
    : '<p class="c-empty">Nothing merged yet.</p>';

  const marks = [];
  if (account.orcid) {
    marks.push(`<a href="https://orcid.org/${esc(account.orcid)}" target="_blank" `
      + `rel="noopener me">ORCID ${esc(account.orcid)}</a>`);
  }
  if (account.github_login) {
    marks.push(`<a href="https://github.com/${esc(account.github_login)}" target="_blank" `
      + `rel="noopener me">GitHub</a>`);
  }

  const desc = rows.length
    ? `${name} has ${rows.length} merged contribution${rows.length === 1 ? "" : "s"} `
      + "to the whataifound.org registry of AI scientific and mathematical discoveries."
    : `${name} on whataifound.org, the registry of AI scientific and mathematical discoveries.`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Short, and shared: a profile changes when something merges, which is rare, and a
  // crawler fetching it twice in a minute should not hit the database twice.
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  res.end(page({
    title: `${name} (@${account.handle})`,
    description: desc,
    canonical: url,
    body: `
<div class="prof-head">
  <div class="prof-avatar" data-identicon="${esc(account.handle)}"></div>
  <div class="prof-who">
    <h1 class="meth-title">${esc(name)}</h1>
    <p class="prof-sub"><span class="prof-handle">@${esc(account.handle)}</span>
      ${joined ? `<span class="prof-joined">joined ${esc(joined)}</span>` : ""}
      <span class="pill r r-added">${esc(ROLE_LABEL[account.role] || "Reader")}</span></p>
    ${marks.length ? `<p class="prof-marks">${marks.join("")}</p>` : ""}
  </div>
</div>

${tiles.length ? `<div class="stats prof-stats">${tiles.map(stat).join("")}</div>` : ""}

<h2 class="lbl">Merged contributions</h2>
${contributions}

<p class="prof-note">Only merged work appears here. Every contribution to this registry
is reviewed and merged by a maintainer, and the record of it lives in
<a href="https://github.com/yigitisik/whataifound/blob/main/data/entries.json">data/entries.json</a>,
which is public and permanently mirrorable.</p>

<p class="finding-back"><a href="/contributors">Everyone who has contributed</a></p>`,
  }));
}

/**
 * The page shell.
 *
 * Deliberately a trimmed copy of what build-site.py emits rather than a call into it:
 * that is Python, and this runs in a Vercel function. The pieces that matter for
 * consistency are the pre-paint theme initialiser (without it this page flashes light
 * on a dark browser) and /chrome.js, which gives it the same header controls and the
 * same footer as every other page.
 */
function page({ title, description = "", canonical = "", body, robots = "index, follow" }) {
  const full = `${title} | whataifound.org`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#111310">
<meta name="color-scheme" content="dark light">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${esc(robots)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:type" content="profile">
<meta property="og:site_name" content="whataifound.org">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
<meta property="og:image" content="${SITE}/assets/brand/og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(full)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/assets/brand/og.png">
<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/brand/icon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
<script>try{var tm=localStorage.getItem('theme'),el=document.documentElement;if(tm==='light'||tm==='dark')el.setAttribute('data-theme',tm);else if(tm!=='system')el.setAttribute('data-theme','dark');
var lt=tm==='light'||(tm==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);
if(lt){var m=document.querySelector('meta[name=theme-color]');if(m)m.content='#faf9f6';}}catch(e){}</script>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="spectrum" aria-hidden="true"></div>
<div class="wrap">
<header>${HEADER}</header>
<main id="main" class="meth prof">
${body}
</main>
${FOOTER}
</div>
<script src="/chrome.js" defer></script>
</body>
</html>
`;
}
