# Contributing

| You want to | Use |
|---|---|
| Submit a check, challenge a grade, fix a link, propose an entry | [/contribute](https://whataifound.org/contribute). No GitHub account, no fork. |
| Change several entries at once, or shape a diff yourself | A pull request, as below. |
| Change code, styles, scripts, docs or CI | A pull request. The in-UI route cannot touch these, by design. |

Nothing is published without a maintainer merging a pull request. `/contribute` ends in the
same place: a maintainer approves, a bot opens a PR against `data/entries.json`, and a
maintainer reviews and merges it.

The two doors ask the same questions field for field, so neither is the "real" one. All four
kinds of contribution exist on both: an
[independent check](../.github/ISSUE_TEMPLATE/independent-check.yml), a
[grade challenge](../.github/ISSUE_TEMPLATE/grade-challenge.yml), a
[correction](../.github/ISSUE_TEMPLATE/correction.yml) and a
[new entry](../.github/ISSUE_TEMPLATE/new-entry.yml). `verify-doors.py` fails the build if any
of them stops matching, and the vocabulary lists in the issue forms are generated from
`data/vocab.json`, so a vocabulary change cannot reach one door and not the other.

## Setup

Requires Python 3. Node is needed only for `verify-parity.py`, which is skipped without it.

```bash
git clone https://github.com/yigitisik/whataifound.git
cd whataifound
python3 scripts/build.py          # regenerate the site
python3 scripts/serve.py          # http://localhost:8000  (--lan for phone testing)
```

Entries are pre-rendered into `index.html`, so the page has content without a server, but
search, filtering and charts read `data/entries.json` over fetch. Use the server, not `file://`.

## Adding an entry

Read [SCHEMA.md](SCHEMA.md) first for field definitions and grade scales.

1. Branch: `git checkout -b entry/short-name`
2. Add one object to [data/entries.json](../data/entries.json). Set `id` to
   `YYYY-MM-DD-short-name`; never reuse an id.
3. Run `python3 scripts/build.py`. **Required**: the site is pre-rendered, so an entry that is
   not built is not on the site. The build validates first and stops with a specific message.
4. Check locally that the entry renders, filters and expands, and that `/finding/<id>` is right.
5. Commit `data/entries.json` **and** everything the build regenerated. Open a PR.

Requirements:

- At least one primary source tagged `"kind": "research"`. A news article does not count, and
  the build enforces it: any grade above `claimed` without a `research` source fails.
- Every source needs a `kind`; see [classifying sources](#classifying-sources).
- Source URLs must be `http(s)`.
- Both grades set to the weaker reading when arguable, with the tension noted in `caveats`.
- A `novelty_check` recording what you searched, even when nothing turned up. State the
  searches: "MathSciNet + arXiv, dimension-3 constructions; nearest is Wang 1980 (degree 2
  only)", not "appears novel".

Negative results (`known`, `disputed`, `refuted`) are in scope and welcome.

A new `field` value needs its display name in the `fields` map in
[data/vocab.json](../data/vocab.json); the build will stop and tell you. That is the one edit
outside `data/entries.json` an entry can require. A new *lab* needs nothing.

### Classifying sources

Each source is tagged `research`, `announcement`, `coverage`, `commentary` or `challenge`
([definitions](SCHEMA.md#sources-what-each-link-is)). The registry rests on keeping the result
apart from the claim made about it, so two calls are worth getting right:

**First-party or not?** `announcement` means the people behind the result said it, whoever they
are: a company press release and a lone researcher's post are the same kind. The test is not
whether an organisation published it, but whether the author appears in the entry's `humans` or
works for its `lab`. Three author blogs in the registry look like independent commentary and are
not.

**Commentary or challenge?** `commentary` is an independent write-up that may support or
complicate the claim; `challenge` argues it is wrong, unoriginal or unsupported. The domain
cannot tell you: the same outlet publishes both. Read the piece.

When a source is arguable, prefer the reading that makes the entry look weaker: `coverage` over
`research`, `challenge` over `commentary`.

### Submitting an independent check

The most useful thing anyone can contribute. A grade of `independent` means qualified people
unaffiliated with the announcing lab confirmed the result, and most entries have no check at
all. [The open review queue](https://whataifound.org/review) lists every one of them, weakest
evidence first, with a one-click prefilled issue on each.

You do not have to reproduce a whole result. Reading the primary source closely enough to say
whether it supports the claim is a check, and saying it does not is as valuable as saying it
does. Accepted checks land in `independent_checks` and your name in `reviewers`. Sustained
review is the route to a maintainer role: see [GOVERNANCE.md](../GOVERNANCE.md).

### Correcting or challenging

Do not delete entries. Downgrade `verification`, add the objection to `caveats`, cite the
source. To challenge novelty, submit a PR downgrading the entry to `known` with the specific
prior-work citation.

Every finding page carries a **Challenge the grade** link that opens the issue form with the
entry id and its current grades filled in. An issue is triage, not the fix: a grade changes when
someone opens a PR editing `data/entries.json`. A challenge without a specific citation gets
closed.

### Never hand-edit generated files

See the list in the [README](../README.md#generated-files-never-hand-edit). Your change will be
overwritten on the next build, and CI will fail. Edit `data/entries.json` instead.

## Code

Pages are static files at the root; browser scripts live in [js/](../js/) (`chrome.js`,
`app.js`, `entry.js`, `signals.js`, `account.js`, `contribute.js`, `admin.js`).
Server-side code lives under [api/](../api/) and is never sent to a browser. How the pieces fit
together is in [ARCHITECTURE.md](ARCHITECTURE.md). Constraints:

- **No em dashes**, anywhere: prose, code comments, UI copy, commit messages.
  `check-integrity.py` fails the build and names the file and line. Use a colon, comma,
  semicolon or parentheses. En dashes are fine and are used correctly throughout the registry
  (`Navier-Stokes`, `2000-2022`, `protein-ligand`), so do not sweep those.
- **No literal control characters** in a source file. Write them as escapes (`\u0000`), which
  behaves identically and stays readable. A real NUL byte runs fine but makes `grep` classify
  the whole file as binary and print nothing, so a search for a symbol in it silently returns no
  hits.
- **No runtime external requests.** A new external resource also needs its CSP directive in
  [vercel.json](../vercel.json) widened.
- **No inline event handlers** (`onclick=` and friends). CSP sets `script-src-attr 'none'`.
  Attach listeners in JavaScript.
- **A `<form>` may not carry an `action` attribute.** Forms here submit through `fetch` to
  `/api/` on the same origin; an `action=` would be a way to post a reader's input to another
  origin from a page that looks like ours. The CSP's `form-action 'self'` is the second lock.
- **Untrusted values are checked where they are used, not where they arrive.** A name from
  Google is as untrusted as a name typed into a form (`api/_lib/names.js` owns both, so they
  cannot drift), and `esc()` is not enough for a URL going into an `href`, because an escaped
  `javascript:` still runs on click. Anything becoming an `href` is checked against an allowed
  prefix after parsing, never with `startsWith` on the raw string.
- **The browser talks only to `/api/*` on its own origin.** No third-party SDK, no token in
  `localStorage`. A change that needs a new origin is a change to the site's security posture.
- WCAG 2.1 AA: keep focus rings, heading order, chart labels, `prefers-reduced-motion`.
- Works in both light and dark themes. A new colour needs adding to all three colour blocks of
  [styles.css](../styles.css).
- Layout holds at 320, 560, 640, 720, 860 and 1180px. The sticky filter bar is the tight one: it
  holds six controls in 1056px with no slack, so anything added has to take room from something
  else.

**`card()` exists twice**, in [app.js](../js/app.js) and ported to
[build-site.py](../scripts/build-site.py). **Change one, change the other, in the same PR.**
`verify-parity.py` fails the build on drift. The same applies to `tableView()`, the four chart
cards, the `DOMAIN_NAME` and `FIELD_SHORT` tables, and the `receipts()` / `grouped_refs()`
renderers. Search highlighting deliberately stays *outside* `card()`, walking the rendered DOM
afterwards, because `build-site.py` has no query to highlight.

`app.js` splits into `bootStatic()`, which runs immediately and needs no data, and `bootData()`,
which runs when `data/entries.json` arrives. **If you add something to `bootStatic()` that needs
the registry, it will silently do nothing on a cold load.**

Adding an entry whose source is on a host the registry has not cited before means adding that
host to `DOMAIN_NAME` in both files, or it renders as a bare domain like `pubs.rsc.org` where
every neighbour reads `Nature`.

### The grading vocabulary

Grade labels and definitions live in [data/vocab.json](../data/vocab.json) and nowhere else.
`build.py` writes them into `app.js`'s label tables, the lists on `methodology.html`, the scales
in `llms.txt`, and the ClaimReview ratings on every finding page. Edit the JSON and rebuild.

`source_kinds` lives in the same file and works the same way, but is not a grade: it classifies
a link, and nothing scores or ranks an entry by it. Each kind carries a `label` (group heading)
and a `chip` (the short form for the narrow card row); the build fails if either is missing.

Adding or removing a value in any vocabulary is a code change: it also needs a colour rule in
[styles.css](../styles.css) and the build fails until it has one (`.v-`, `.a-`, `.k-`, `.r-`).
The families are rendered with one palette at three weights: a filled pill for verification, a
tinted pill for autonomy, a coloured dot for source kinds.

A new lab also needs a line in `LAB_HUB` in [build-site.py](../scripts/build-site.py). The build
prints a note naming any organisation missing one; it does not fail.

### Brand assets

`assets/brand/` holds the sources and their generated rasters: `favicon.svg` (the mark on its
plate, source for every raster), `mark.svg`, `mark-mono.svg`, `lockup.svg`, `og.svg` → `og.png`
(1200x630 social card), and the generated `icon-48.png` / `icon-512.png` alongside root-level
`favicon.ico` and `apple-touch-icon.png`.

Editing `favicon.svg` or `og.svg` means re-running `python3 scripts/build-icons.py` and
committing the regenerated rasters. It is not part of `build.py`.

Four icon files, not ten: browsers scale a 48px icon down for tabs, and one 512px PNG covers the
manifest, PWA install and the `Organization` JSON-LD logo. The PNGs are not redundant with the
SVG: Google's favicon crawler documents `.ico`/`.png`/`.jpg`/`.gif` and does not list SVG, so an
SVG-only site tends to show a generic globe in search results. **Do not replace `icon-48.png`
with anything smaller**; 16x16 is the size Google's documentation rejects outright.

The header mark is inlined in five pages plus `404.html`. Change the shape and all six need the
same edit. Each inline copy needs its own gradient `id`; duplicates across a page collide.

### Changing the domain

`https://whataifound.org` is hard-coded in the five root pages that inline it, `robots.txt`, the
`SITE` constant in `build-site.py`, `build-feed.py`, and the `og.svg` wordmark. Change all of
them, then re-run `build.py` and `build-icons.py`.

## PRs

Branch from `main`, push, open a PR. Vercel posts a preview URL. One entry or one code change
per PR. Generated files are committed rather than built on deploy, so an entry PR carries its
regenerated output with it.

CI runs on every PR:

| Check | Fails when |
|---|---|
| `verify-doors.py` | An issue template and the matching `/contribute` form stopped asking the same questions |
| `check-integrity.py` | The committed HTML contains unexpected inline scripts, off-allowlist origins, inline event handlers, `javascript:`/`data:` URLs, `<base>`/`<object>`/`<embed>`/`<form action>`, an em dash, or a literal control character |
| `build.py` | The data is invalid, an entry graded above `claimed` links no `research` source, or a renderer has drifted between `app.js` and `build-site.py` |
| rebuild-and-diff | The committed output does not match what `data/entries.json` produces |
| `check-links.py` | A URL your branch added returns 404 or 410. Its own workflow, so a publisher outage never blocks a merge; paywalls and 5xx are reported but do not fail |

The integrity check runs *before* the rebuild, because a rebuild would overwrite tampering in a
fully generated file and hide it.

`pr-report.py` summarises the entry changes in your PR and the `comment` workflow posts it. It
reports what changed, never whether the change is right.

## Editorial rules

1. Lab announcements enter at `claimed`.
2. Never delete an entry; downgrade and add `caveats`.
3. Every entry has a `novelty_check`, including when clean.
4. No reproducible artifact caps verification at `claimed`.
5. `autonomy` uses the strictest defensible reading.
6. No hype verbs in titles.

## Reviewing a PR

The registry's only asset is that its grades can be trusted. Automation covers the mechanical
part; none of it can tell whether a *claim* is true. What a reviewer does by hand:

- **Open the primary sources.** CI confirms they *resolve*; only you can confirm they *say what
  the entry says they say*. A plausible-looking URL to a real paper that does not contain the
  result is the likeliest bad entry, and no check catches it.
- **Check the grades against the evidence**, not the contributor's summary. `formal` needs a
  machine-checked artifact you can point at. `independent` needs someone who is not an author.
  When the evidence is arguable, the weaker grade wins.
- **Check the source kinds, especially `research` and `announcement`.** The build only checks
  that a `research` source exists, not that it deserves the label; tagging a press release
  `research` would satisfy the rule and defeat it. The other trap is a first-party post that
  reads as independent: check whether the author appears in `humans` or works for the `lab`.
- **Read the `novelty_check` as a claim about search, not a conclusion.** "Appears novel" is not
  reviewable; a named database and query is.
- **Be suspicious of upgrades.** A PR raising an entry's `verification` or softening `caveats` is
  the shape a promotional edit takes. Requires new evidence, cited.
- **Treat the diff's scope as a signal.** An entry PR should touch `data/entries.json` plus
  generated files and nothing else. CI warns when one also touches `scripts/`, `.github/`,
  `app.js` or `vercel.json`. Read those as code changes.
- **Watch for conflicts of interest.** Contributors submitting their own result are welcome and
  common, but it goes in at the grade the evidence supports, and saying so in the PR is expected.

Generated files make diffs large. Review `data/entries.json` and any hand-written file; the rest
is reproduced by CI.
