# Contributing

Two kinds of change, both via pull request. No direct pushes to `main`.

- **Entries**: add, correct, or challenge a finding in `data/entries.json`.
- **Code**: site markup, styles, behaviour, build scripts.

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

- At least one primary source (paper, proof artifact, dataset, or repository). A news article
  doesn't count.
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

If your entry has a `wikipedia` title, run `python3 scripts/build-notability.py` to measure
`notability` from the live Wikipedia API. It hits the network and edits `data/entries.json`, so it
is not part of `build.py`; run it deliberately. `--check` reports drift.

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
`contributors.html`, `methodology.html` or `visuals.html` — including the shared `NAV` block, which
is written into every page from one place. Your change will be overwritten on the next build, and
CI will fail. Edit `data/entries.json` instead.

## Code

Static files at the root: [index.html](../index.html), [methodology.html](../methodology.html),
[review.html](../review.html), [contributors.html](../contributors.html),
[visuals.html](../visuals.html), [404.html](../404.html), [styles.css](../styles.css),
[app.js](../app.js). Constraints:

- No runtime external requests. A new external resource also needs its CSP directive in
  [vercel.json](../vercel.json) widened.
- No inline event handlers (`onclick=` and friends). CSP sets `script-src-attr 'none'`, and
  `check-integrity.py` rejects them. Attach listeners in `app.js`.
- WCAG 2.1 AA: keep focus rings, heading order, chart labels, `prefers-reduced-motion`.
- Works in both light and dark themes.
- Layout holds at 320, 560, 720px.

`card()` exists twice: in [app.js](../app.js) and ported to
[scripts/build-site.py](../scripts/build-site.py). **Change one, change the other, in the same PR.**
`verify-parity.py` runs the real `card()` under Node and diffs it against the pre-rendered markup,
so drift fails the build; the markup would otherwise visibly change the first time a visitor
filters.

### The grading vocabulary

Grade labels and definitions live in [data/vocab.json](../data/vocab.json) and nowhere else.
`build.py` writes them into `app.js`'s label tables, the two lists on `methodology.html`, the
scales in `llms.txt`, and the ClaimReview ratings on every finding page. Edit the JSON and rebuild;
never edit those copies by hand.

Adding or removing a grade is a code change: a new `verification` slug also needs a `.v-<slug>`
pill colour in [styles.css](../styles.css), and the build fails until it has one.

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
`build-feed.py` and `build-notability.py`, and the `og.svg` wordmark. Changing it means editing all
of those, then re-running `build.py` and `build-icons.py`.

## PRs

Branch from `main`, push, open a PR. Vercel posts a preview URL. One entry or one code change per
PR. Generated files are committed rather than built on deploy, so an entry PR carries its
regenerated output with it.

CI runs on every PR:

| Check | Fails when |
|---|---|
| `check-integrity.py` | The committed HTML contains unexpected inline scripts, off-allowlist script or frame origins, inline event handlers, `javascript:`/`data:` URLs, or `<base>`/`<object>`/`<embed>`/`<form>` |
| `build.py` | The data is invalid, or `card()` has drifted between `app.js` and `build-site.py` |
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
