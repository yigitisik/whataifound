# Contributing

Two kinds of change, both via pull request. No direct pushes to `main`.

- **Entries**: add, correct, or challenge a finding in `data/entries.json`.
- **Code**: site markup, styles, behaviour, build scripts.

There is now also a third route that is not a pull request: **[/contribute](https://whataifound.org/contribute)**,
after signing in with Google. It asks the same questions as the issue templates, and it
ends at the same place: a maintainer approves it, a bot opens a pull request against
`data/entries.json`, and a maintainer reviews and merges that pull request. Nothing is
published without one.

Which route to use:

| You want to | Use |
|---|---|
| Submit a check, challenge a grade, fix a link, propose an entry | [/contribute](https://whataifound.org/contribute). No GitHub account, no fork. |
| Change several entries at once, or shape a diff yourself | A pull request, as below. |
| Change code, styles, scripts, docs or CI | A pull request. The in-UI route cannot touch these, by design. |

The two doors ask the same questions field for field, so neither is the "real" one. The
bot path is deliberately the narrower of the two: the branch it pushes may contain a
change to `data/entries.json` and nothing else, and
[`.github/workflows/rebuild-bot.yml`](../.github/workflows/rebuild-bot.yml) fails the
build if that is not what arrived. Everything below is the pull request path, which
remains the only way to change code, docs or the build.

## Setup

Requires Python 3. Node is needed only for `verify-parity.py`, which is skipped without it.

```bash
git clone https://github.com/yigitisik/whataifound.git
cd whataifound
python3 scripts/build.py          # regenerate the site
python3 scripts/serve.py          # http://localhost:8000  (--lan for phone testing)
```

`serve.py` reproduces the clean URLs and 404 page Vercel serves in production. The entries are
pre-rendered into `index.html`, so the page has content without a server, but search, filtering
and the charts read `data/entries.json` over fetch, so use the server rather than a `file://` URL.

## Adding an entry

Read [SCHEMA.md](SCHEMA.md) first for field definitions and grade scales.

1. Branch: `git checkout -b entry/short-name`
2. Add one object to [data/entries.json](../data/entries.json), matching the existing format. Set
   `id` to `YYYY-MM-DD-short-name`; never reuse an id.
3. Run `python3 scripts/build.py`. **Required**: the site is pre-rendered, so an entry that isn't
   built isn't on the site. The build validates first and stops with a specific message on a bad
   grade, date, id, or URL.
4. Check locally that the entry renders, filters, and expands, and that `/finding/<id>` looks right.
5. Commit `data/entries.json` **and** everything the build regenerated. Open a PR.

Requirements:

- At least one primary source (paper, proof artifact, dataset, or repository) tagged
  `"kind": "research"`. A news article doesn't count, and the build now enforces it: any grade
  above `claimed` without a `research` source fails validation.
- Every source needs a `kind`; see [classifying sources](#classifying-sources).
- Source URLs must be `http(s)`. Other schemes are rejected by the build.
- Both grades set to the weaker reading when arguable, with the tension noted in `caveats`.
- A `novelty_check` recording what you searched, even when nothing turned up. State the searches:
  "MathSciNet + arXiv, dimension-3 constructions; nearest is Wang 1980 (degree 2 only)", not
  "appears novel".

Negative results (`known`, `disputed`, `refuted`) are in scope and welcome.

If your entry opens a **new `field` value**, add its display name to the `fields` map in
[data/vocab.json](../data/vocab.json); the build will stop and tell you. This is the one edit
outside `data/entries.json` an entry can require. Thirteen fields are pre-registered. A new *lab*
needs nothing; it falls back to a generated monogram.

### Classifying sources

Each source is tagged `research`, `announcement`, `coverage`, `commentary` or `challenge`
([definitions](SCHEMA.md#sources-what-each-link-is)). The whole registry rests on keeping the result
apart from the claim made about it, so two calls are worth getting right:

**First-party or not?** `announcement` means the people behind the result said it, whoever they are:
a company press release and a lone researcher's X post are the same kind. The test is not whether an
organisation published it, but whether the author appears in the entry's `humans` or works for its
`lab`. Three author blogs in the registry look like independent commentary and are not: Scott
Aaronson, Terence Tao and Kevin Buzzard are each listed in `humans` on the entry their post
accompanies.

**Commentary or challenge?** `commentary` is an independent write-up that may support or complicate
the claim; `challenge` argues it is wrong, unoriginal, or unsupported. The domain cannot tell you:
the same outlet publishes both, and the registry cites TechCrunch as `coverage` on one entry and
`challenge` on another. Read the piece.

When a source is arguable, prefer the reading that makes the entry look weaker, the same way grades
work: `coverage` over `research`, `challenge` over `commentary`.

### Submitting an independent check

The most useful thing anyone can contribute. A grade of `independent` means qualified people
unaffiliated with the announcing lab confirmed the result, and most entries have no check at all.
[The open review queue](https://whataifound.org/review) lists every one of them, weakest evidence
first, with a one-click prefilled issue on each.

You do not have to reproduce a whole result. Reading the primary source closely enough to say
whether it supports the claim is a check, and saying it does not is as valuable as saying it does.
Accepted checks land in `independent_checks` and your name in `reviewers`, which is what the
[contributors page](https://whataifound.org/contributors) is built from.

Sustained review is also the route to a maintainer role. See [GOVERNANCE.md](../GOVERNANCE.md).

### Correcting or challenging

Don't delete entries. Downgrade `verification`, add the objection to `caveats`, cite the source. To
challenge novelty, submit a PR downgrading the entry to `known` with the specific prior-work
citation.

Every finding page carries a **Challenge the grade** link that opens the
[grade challenge](../.github/ISSUE_TEMPLATE/grade-challenge.yml) issue form with the entry id and
its current grades already filled in. It exists so that contesting a grade doesn't require forking
the repo: the reporter supplies the citation, nothing else.

An issue is triage, not the fix. A grade changes when someone opens a PR editing
`data/entries.json`, and the rules above still apply: new evidence, cited, and the weaker grade
wins when it's arguable. A challenge without a specific citation gets closed.

### Never hand-edit generated files

`finding/`, `llms.txt`, `sitemap.xml`, `feed.xml`, `feed.json`, `entry.schema.json`, and anything
between `<!--…:START-->` / `<!--…:END-->` markers in `index.html`, `review.html`,
`contributors.html`, `methodology.html` or `visuals.html`, including the shared `HEADER` and
`FOOTER` blocks, which are written into every page from one place. The same two functions
(`site_header()` and `site_footer()`) are called directly by `entry_page()`, so the 52 finding pages
carry the identical masthead and footer without a marker. On `index.html` both list layouts are generated
(`ENTRIES` for the cards, `TABLE` for the table), as are the filter dropdowns: `FIELDOPTS`,
`LABOPTS`, `VEROPTS` and `AUTOPTS` are each filled from the registry, so a new autonomy value or lab
appears in the controls without anyone editing the markup. Your change will be overwritten on the
next build, and CI will fail. Edit `data/entries.json` instead.

## Code

Static files at the root: [index.html](../index.html), [methodology.html](../methodology.html),
[review.html](../review.html), [contributors.html](../contributors.html),
[visuals.html](../visuals.html), [account.html](../account.html),
[privacy.html](../privacy.html), [404.html](../404.html), [styles.css](../styles.css),
[chrome.js](../chrome.js), [app.js](../app.js), [account.js](../account.js),
[entry.js](../entry.js). Server-side code lives under [api/](../api/) and is never sent to
a browser. Constraints:

- **No em dashes**, anywhere: prose, code comments, UI copy, commit messages. `check-integrity.py`
  fails the build and names the file and line. Use a colon, comma, semicolon or parentheses,
  whichever the sentence wants. En dashes are fine and are used correctly throughout the registry
  (`Navier-Stokes`, `2000-2022`, `protein-ligand`), so do not sweep those.
- No runtime external requests. A new external resource also needs its CSP directive in
  [vercel.json](../vercel.json) widened.
- No inline event handlers (`onclick=` and friends). CSP sets `script-src-attr 'none'`, and
  `check-integrity.py` rejects them. Attach listeners in `app.js`.
- **A `<form>` may not carry an `action` attribute.** Forms were rejected outright until the
  account page needed one, which is why the shortcuts dialog still closes via a button
  rather than the usual dialog-closing method. Forms here submit through `fetch` to `/api/`
  on the same origin; an `action=` would be a way to post a reader's input to another
  origin from a page that looks like ours. `check-integrity.py` enforces this, and the
  CSP's `form-action 'self'` is the second lock.
- **Untrusted values are checked where they are used, not where they arrive.** Two rules
  the code follows, both of which had to be learned the hard way in review: a name from
  Google is as untrusted as a name typed into a form (`api/_lib/names.js` owns both, so
  they cannot drift), and `esc()` is not enough for a URL going into an `href`, because
  an escaped `javascript:` still runs on click. Anything becoming an `href` is checked
  against an allowed prefix after parsing, never with `startsWith` on the raw string.
- **The browser talks only to `/api/*` on its own origin.** No third-party SDK, no token in
  `localStorage`. The Google OAuth exchange is server-side precisely so `connect-src` can
  stay `'self'`; see [SETUP.md](SETUP.md). A change that needs a new origin is a change to
  the site's security posture, not a detail.
- WCAG 2.1 AA: keep focus rings, heading order, chart labels, `prefers-reduced-motion`.
- Works in both light and dark themes. A new colour needs `color-scheme` to stay correct in all three
  colour blocks of [styles.css](../styles.css).
- Layout holds at 320, 560, 720 and 1180px. The sticky filter bar is the tight one: it holds six
  controls in 1056px of container with no slack, so anything added to it has to take room from
  something else.

`chrome.js` (~7 KB) runs on every page and owns the shared masthead: the theme switcher, the
account control and its identicon, and the retrieval date in the footer. It exists because that switcher used to live in `app.js`, which loads
on two of the seven page types, so the other five shipped a stored theme with no control to change
it. Anything that has to work on a finding page and on the home page belongs here.

`app.js` runs on the registry and visuals pages. `entry.js` (~2 KB) runs on finding pages and does
one thing: the citation copy buttons. It is separate so a leaf page does not download 47 KB of
filtering and chart code, and it is purely an enhancement, since `build-site.py` renders the citation
text into the page and it stays selectable with JavaScript off.

`app.js` is split into `bootStatic()`, which runs immediately and needs no data, and `bootData()`,
which runs when `data/entries.json` arrives. The fetch is deliberately off the critical path: the
52 entries are already pre-rendered, so the JSON is loaded on idle, on the first interaction with a
control, or immediately when the URL carries a filter. **If you add something to `bootStatic()` that
needs the registry, it will silently do nothing on a cold load.** `render()` returns early while
`ALL` is empty, which is what stops the list being blanked in the meantime.

`card()` exists twice: in [app.js](../app.js) and ported to
[scripts/build-site.py](../scripts/build-site.py). **Change one, change the other, in the same PR.**
`verify-parity.py` runs the real `card()` under Node and diffs it against the pre-rendered markup,
so drift fails the build; the markup would otherwise visibly change the first time a visitor
filters. The same applies to the `DOMAIN_NAME` table and to the `receipts()` / `grouped_refs()`
renderers, which are ported alongside it.

`tableView()` is the third pair, added when the table became the default view. Both layouts are
pre-rendered into `#list` and CSS shows one, because rendering the default client-side would mean
either a visible cards-to-table swap on every load or the 143 KB of registry JSON back on the
critical path to avoid one. Pre-rendering both costs about 18 KB and avoids both. Search
highlighting deliberately stays *outside* `card()`, walking the rendered DOM afterwards, because
`build-site.py` has no query to highlight and putting it in the template would put the two renderers
permanently out of step.

Inside `card()`, note that a tag is an `<a href="/?tag=…">`, not a label: the URL is real, so tags
work with JavaScript off and give the registry 187 internal links across 118 distinct filtered views.
`app.js` intercepts the click only to save the page load.

Which layout shows is decided before first paint by the inline script in `index.html`, which sets
`data-view` on `<html>` from `?view=`, then the stored preference, then the default. With no
JavaScript at all the attribute is never set and the cards show, which is the richer fallback. A
permalink (`#e-<id>`) points at a card, so `revealFromHash()` switches to cards when the target is
hidden or absent; it records that in the URL but deliberately does not change the stored preference,
because following someone else's link is not a preference.

Adding an entry whose source is on a host the registry hasn't cited before means adding that host to
`DOMAIN_NAME` in both files. The labelled rows on a card show the publisher name instead of the link
title, so an unmapped host shows up as a bare domain like `pubs.rsc.org` where every neighbour reads
`Nature` or `The Register`.

### The grading vocabulary

Grade labels and definitions live in [data/vocab.json](../data/vocab.json) and nowhere else.
`build.py` writes them into `app.js`'s label tables, the lists on `methodology.html`, the
scales in `llms.txt`, and the ClaimReview ratings on every finding page. Edit the JSON and rebuild;
never edit those copies by hand.

`source_kinds` lives in the same file and works the same way, but is not a grade: it classifies a
link, and nothing scores or ranks an entry by it. Each kind carries both a `label` (the group
heading) and a `chip` (the short form for the card row, where the column is narrow); the build
fails if either is missing.

Adding or removing a value in any of the three vocabularies is a code change: it also needs a colour
rule in [styles.css](../styles.css), and the build fails until it has one: `.v-<slug>` for a
verification grade, `.a-<slug>` for an autonomy level, `.k-<slug>` for a source kind. The three are
rendered with one palette at three weights: a filled pill for verification, a tinted pill for
autonomy (the same hues the hero chart uses), and a coloured dot for source kinds.

A new lab also needs a line in `LAB_HUB` in [scripts/build-site.py](../scripts/build-site.py): the
`#sources` hub is generated from the registry, but the URL where an organisation posts its own
results cannot be. The build prints a note naming any organisation that is missing one; it does not
fail, so an entry is never blocked on it.

### Brand assets

`assets/brand/` holds the sources and their generated rasters.

| File | Role |
|---|---|
| `favicon.svg` | The mark on its rounded dark plate. Source for every raster icon |
| `mark.svg` | The mark alone, no plate |
| `mark-mono.svg` | Single-colour mark via `currentColor`, for stamps and dark/light inversion |
| `lockup.svg` | Mark + wordmark |
| `og.svg` → `og.png` | 1200×630 social card |
| `icon-48.png`, `icon-512.png` | Generated. With `favicon.ico` and `apple-touch-icon.png` at the root |

The mark is a diamond crossed by a bar, forming an `A` over a serif `I`. Both carry the same
blue→violet→amber gradient, the `A` at 75% opacity so the `I` stays the focal point. That gradient
is the brand's one accent: it also fills the `ai` in the wordmark, in the lockup, the OG card, and
the site header.

Editing `favicon.svg` or `og.svg` means re-running `python3 scripts/build-icons.py` and committing
the regenerated rasters. It is not part of `build.py`. The script prefers Node with Playwright
(`PLAYWRIGHT_DIR=/path/to/node_modules/..` if it lives elsewhere) and falls back to macOS Quick
Look, which needs no install.

Four icon files, not ten: browsers scale a 48px icon down for tabs, and one 512px PNG covers the
manifest, PWA install and the `Organization` JSON-LD logo. The PNGs are not redundant with the SVG:
Google's favicon crawler documents `.ico`/`.png`/`.jpg`/`.gif` and does not list SVG, so an
SVG-only site tends to show a generic globe in search results. `og.png` is a PNG for the same class
of reason: several platforms don't render SVG previews.

The header mark is inlined in `index.html`, `methodology.html`, `review.html`, `contributors.html`
and `visuals.html` (so it inherits `currentColor` and animates) and again, larger and static, in
`404.html`. Change the shape and all six need the same edit, plus `assets/brand/` for the
standalone files. Each inline copy needs its own gradient `id`; duplicates across a page collide.

### Changing the domain

`https://whataifound.org` is hard-coded in `index.html`, `methodology.html`, `review.html`,
`contributors.html`, `visuals.html`, `robots.txt`, the `SITE` constant in `build-site.py`,
`build-feed.py`, and the `og.svg` wordmark. Changing it means editing all
of those, then re-running `build.py` and `build-icons.py`.

## PRs

Branch from `main`, push, open a PR. Vercel posts a preview URL. One entry or one code change per
PR. Generated files are committed rather than built on deploy, so an entry PR carries its
regenerated output with it.

CI runs on every PR:

| Check | Fails when |
|---|---|
| `check-integrity.py` | The committed HTML contains unexpected inline scripts, off-allowlist script or frame origins, inline event handlers, `javascript:`/`data:` URLs, or `<base>`/`<object>`/`<embed>`/`<form>` |
| `build.py` | The data is invalid, an entry graded above `claimed` links no `research` source, or `card()` has drifted between `app.js` and `build-site.py` |
| rebuild-and-diff | The committed output doesn't match what `data/entries.json` produces (a forgotten rebuild, or a hand-edit inside the markers) |
| `check-links.py` | A URL your branch added returns 404 or 410. Runs as its own `links` workflow so a publisher outage never blocks a merge; paywalls, rate limits and 5xx are reported but do not fail |

The integrity check runs *before* the rebuild, because a rebuild would overwrite tampering in a
fully generated file and hide it.

`pr-report.py` also summarises the entry changes in your PR, and the `comment` workflow posts that
summary on the PR and updates it in place on each push. It reports what changed, never whether the
change is right: reviewers open the primary sources themselves.

## Editorial rules

1. Lab announcements enter at `claimed`.
2. Never delete an entry; downgrade and add `caveats`.
3. Every entry has a `novelty_check`, including when clean.
4. No reproducible artifact caps verification at `claimed`.
5. `autonomy` uses the strictest defensible reading.
6. No hype verbs in titles.

## Reviewing a PR

The registry's only asset is that its grades can be trusted. Automation covers the mechanical part
(see the table above); none of it can tell whether a *claim* is true. What a reviewer does by hand:

- **Open the primary sources.** CI confirms they *resolve*; only you can confirm they *say what the
  entry says they say*. A plausible-looking URL to a real paper that doesn't contain the result is
  the likeliest bad entry, and no check catches it.
- **Check the grades against the evidence**, not the contributor's summary. `formal` needs a
  machine-checked artifact you can point at. `independent` needs someone who isn't an author. When
  the evidence is arguable, the weaker grade wins.
- **Check the source kinds, especially `research` and `announcement`.** The build only checks that a
  `research` source exists, not that it deserves the label; tagging a press release `research` would
  satisfy the rule and defeat it. The other trap is a first-party post that reads as independent:
  check whether the author appears in `humans` or works for the `lab` before accepting `commentary`.
- **Read the `novelty_check` as a claim about search, not a conclusion.** "Appears novel" isn't
  reviewable; a named database and query is.
- **Be suspicious of upgrades.** A PR raising an entry's `verification` or softening `caveats` is
  the shape a promotional edit takes. Requires new evidence, cited.
- **Treat the diff's scope as a signal.** An entry PR should touch `data/entries.json` plus
  generated files and nothing else. CI warns when one also touches `scripts/`, `.github/`, `app.js`
  or `vercel.json`. Read those as code changes, and never merge them on the strength of the entry.
- **Watch for conflicts of interest.** Contributors submitting their own result are welcome and
  common, but it goes in at the grade the evidence supports, and saying so in the PR is expected.

Generated files make diffs large. Review `data/entries.json` and any hand-written file; the rest is
reproduced by CI and doesn't need reading line by line.
