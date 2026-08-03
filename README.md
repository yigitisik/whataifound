# whataifound.org

A registry of scientific and mathematical results produced by or with AI systems, graded on how
each result was verified and how much the AI did. Refuted and already-known results stay on the
record, marked as such.

[Live site](https://whataifound.org) · [Methodology](https://whataifound.org/methodology) ·
[Review queue](https://whataifound.org/review) · [Contributors](https://whataifound.org/contributors) ·
[Schema](docs/SCHEMA.md) · [Contributing](docs/CONTRIBUTING.md) · [Governance](GOVERNANCE.md) ·
[RSS](https://whataifound.org/feed.xml) · [JSON Feed](https://whataifound.org/feed.json)

## Quick start

Requires Python 3 (Node only for the parity check).

```bash
git clone https://github.com/yigitisik/whataifound.git
cd whataifound
python3 scripts/build.py          # regenerate the site from data/entries.json
python3 scripts/serve.py          # http://localhost:8000  (--lan for phone testing)
```

`serve.py` reproduces the clean URLs and 404 page Vercel serves in production.

## How it works

`data/entries.json` is the registry and the single source of truth. Everything else is generated
from it. No database, no server-side code, no framework.

**Adding, correcting or removing a finding is: edit that file, run `build.py`, commit.** No HTML is
ever edited by hand.

```
data/entries.json ──► build.py ──► index.html (entries, activity feed, reports, filters,
                                               stats, FAQ tallies)
                                   finding/<id>.html   one page per entry
                                   review.html         the open review queue
                                   contributors.html   the contributor roll
                                   llms.txt  sitemap.xml  feed.xml  feed.json

data/vocab.json   ──► build.py ──► app.js label tables
                                   methodology.html    the two grade lists + source kinds
                                   llms.txt            the grading scales
                                   docs/entry.schema.json
                                   ClaimReview ratings on every finding page
```

`/review` and `/contributors` are derived, not curated. The queue is every entry with no
`independent_checks`, so an entry leaves it the moment a check lands; the roll is built from the
`reviewers` and `contributors` fields plus the authors in `CITATION.cff`. Neither has a list to
keep in step by hand.

`data/vocab.json` holds the grading vocabulary: the slug, label, short description, full
definition and schema.org rating for every `verification` and `autonomy` grade, the `field`
display names, and the `source_kinds` and `revision_kinds` classifications. It used to be restated
in six places by hand; now a label or definition is edited once and the build propagates it. Adding
a value to any of the four vocabularies is a code change, not an entry change: each also needs a
colour rule in `styles.css` (`.v-`, `.a-`, `.k-`, `.r-`), and the build names the missing one.

Each entry carries two grades: `verification` (how solid the result is, `formal` to `refuted`) and
`autonomy` (how much the AI did, `autonomous` to `retrieval`). Field definitions and editorial
rules are in [docs/SCHEMA.md](docs/SCHEMA.md).

Every source also carries a `kind`, so the registry keeps the result apart from the claim made
about it: `research` (the paper, proof, code or data), `announcement` (the claim as first made
public, by whoever made it), `coverage` (press reporting), `commentary` (an independent write-up)
and `challenge` (the case against). The kind describes what a link *does*, never who published
it: a lone researcher announcing their own result is an `announcement` exactly as a corporate
press release is. Each card shows these as labelled rows, so the distance between a result and a
headline is visible without opening anything, and an entry nobody has argued against says
`Challenge: none linked` rather than staying silent about it.

This is also what makes editorial rule 4 checkable. **An entry graded above `claimed` must link at
least one `research` source, and the build fails if it does not.** The rule predates the check; when
the check first ran, nine entries turned out to be resting on a press release or a magazine feature.

### The hero: what the registry holds, and what has moved in it

The home page opens on two things side by side. The chart is the corpus: both grading axes
plotted against each other. Beside it, **Latest activity** is what has changed, newest
first.

That feed exists because of editorial rule 2. The registry never deletes an entry, it
downgrades and annotates it, and until now that promise was only observable by reading
commit messages. Each entry may carry a `revisions` array (`{date, kind, note, url?}`)
recording a regrade, a landed check, a challenge or a correction; the build merges those
with one synthesised `Added` row per entry and shows the most recent seven. The kinds live
in `data/vocab.json` like every other vocabulary, and `added` is reserved for the build, so
an entry cannot backdate its own arrival.

**Dates in the feed are absolute, never relative.** `build-site.py` imports no clock on
purpose: the generated files are committed and CI rebuilds them and diffs the bytes, so
"3 days ago" would rot the moment nobody touched the registry for a week. For the same
reason the feed's sort carries an explicit tiebreak (date, then the entry's own date, then
id): 25 entries share a single `added` date, and an unstable order would fail CI on an
unrelated pull request. "Last updated" is the latest date the data carries, counting
revisions as well as additions.

Under the hero sits a strip of four small cards. **Evidence chain** counts how many entries
link each kind of source, which is the site's own thesis made visible: 48 of 52 rest on
original work, and only 8 link a counterargument. **Open longest before falling** ranks the
problems by how long they stood. The other two, findings per year and by topic area, are
the same charts `/visuals` shows, pre-rendered here from the same functions.

Every finding page carries two prefilled issue links: **Submit a check** and **Challenge the
grade**. An entry nobody has checked leads with the check, since the open question is whether
anyone has looked; once a check exists it leads with the challenge. Neither requires forking the
repo, only a citation. The fix is still a pull request; the issue is where it starts.

### Why the site is pre-rendered

The AI crawlers `robots.txt` invites (GPTBot, ClaudeBot, PerplexityBot, CCBot) largely do not
execute JavaScript. When the page fetched its entries client-side, those crawlers got a registry of
AI discoveries containing no AI discoveries: an empty `<main>`. The entries are now in the markup,
and each finding also has its own URL for citation.

`app.js` still owns search and filtering. It adopts the server-rendered list on first paint (via
`data-prerendered` on `#list`) rather than rewriting it, so the DOM never churns on load.

### What `build.py` runs

| Step | Does |
|---|---|
| `build-site.py` | Validates the data, then writes `index.html`, `finding/`, `review.html`, `contributors.html`, the shared header and footer, `llms.txt`, `sitemap.xml` |
| `build-feed.py` | Regenerates `feed.xml` and `feed.json` |
| `build-schema.py` | Regenerates `docs/entry.schema.json` from `data/vocab.json`, so the editor schema cannot fall behind the grades |
| `verify-parity.py` | Runs `app.js`'s real `card()`, `matrixCard()`, `tableView()`, `yearCard()` and `topicCard()` under Node and diffs each against the pre-rendered markup |
| `check-integrity.py` | Asserts the deployed HTML contains nothing smuggled |

Validation stops the build rather than emitting a broken page: a missing required field, an unknown
grade, an unknown source `kind`, a malformed date, a duplicate or non-URL-safe `id`, a bad
`youtube_id`, or a non-`http(s)` URL. A `revisions` entry is held to the same standard: a known
`kind` that is not the build-owned `added`, a real date that does not precede the entry's own
`added`, and a non-empty `note`. `javascript:` and `data:` links are rejected outright: entry
URLs become `href`s on the page, and the CSP allows `'unsafe-inline'`, so they would be live. One
editorial rule is enforced here too, rather than left to review: a grade above `claimed` with no
`research` source fails, naming the entry and both remedies (link the artifact, or downgrade).

`check-integrity.py` looks for unexpected inline scripts, script or frame origins outside the CSP,
inline event handlers, executable URL schemes, `<base>`/`<object>`/`<embed>`/form elements, and one
house-style rule: **no em dashes anywhere in the repository**, in prose, code comments or generated
output. En dashes are untouched, because the registry is full of legitimate ones (`Navier-Stokes`,
`2000-2022`, `protein-ligand` all use them correctly and a blanket sweep would corrupt content). It
exists
because part of `index.html` (the `<head>`, JSON-LD, nav, footer, script tags) sits outside the
`<!--…:START/END-->` markers and is *not* regenerated, so a payload placed there would survive a
rebuild and leave a clean diff. In CI it runs **before** the rebuild, which would otherwise
overwrite tampering in a fully generated file and hide it.

`card()` exists twice: in `app.js` and ported to `build-site.py`. They must stay in step or the
markup visibly changes the first time a visitor filters; `verify-parity.py` is what enforces that.
`matrixCard()`, `tableView()`, `yearCard()` and `topicCard()` are ported the same way, so all five
pre-rendered surfaces are diffed byte for byte against the real functions on every build. The last
two are the charts the home page's reports strip shares with `/visuals`; they were hoisted out of
`renderCharts()` into module scope precisely so a parity check could call them, since a closure
inside a function that writes to the DOM cannot be called from one. `topicCard()` takes a row cap,
and both call sites are checked: `/visuals` shows every topic, the home page rolls the tail into one
labelled row so the column still sums to the registry.
The `DOMAIN_NAME` and `FIELD_SHORT` tables are duplicated the same way and for the same reason: the
labelled source rows on a card show a publisher name rather than a link title, so a source from a
host with no entry in that table renders as a bare domain, and a chart label column 86px wide cannot
hold "Materials science". Adding one means adding it to both files.

Two scripts are deliberately *not* part of every build, because they hit the network or need a
renderer the rest of the toolchain does not:

- **`check-links.py`** resolves every external URL in the registry and fails only on 404/410.
  Paywalls, rate limits and 5xx are reported but do not fail, because a check that cries wolf gets
  ignored. CI runs it on PRs that touch `data/entries.json` and sweeps the whole registry weekly, in
  its own workflow so a publisher outage never blocks a correct entry from merging.
- **`build-icons.py`** rasterises the brand icons and the OG card. Outputs are committed.

### Generated files: never hand-edit

`finding/`, `llms.txt`, `sitemap.xml`, `feed.xml`, `feed.json`, `docs/entry.schema.json`, and
anything between `<!--…:START-->` / `<!--…:END-->` markers in `index.html`, `review.html`,
`contributors.html`, `methodology.html` or `visuals.html`. Edit `data/entries.json` and rebuild.

That now includes the whole masthead and footer: `HEADER` and `FOOTER` are written into all
five pages from `site_header()` and `site_footer()` in `build-site.py`, and the same two
functions are called directly by `entry_page()` for the 52 finding pages. Change the chrome
in one place, not fifty-seven.

## Structure

```
whataifound/
├── index.html              # registry: SEO head, JSON-LD, pre-rendered hero feed, reports, entries
├── methodology.html        # grading reference (grade lists + source kinds from vocab.json)
├── review.html             # open review queue (generated from entries with no checks)
├── contributors.html       # contributor roll (generated from reviewers/contributors + CITATION.cff)
├── visuals.html            # charts page (renders data/entries.json via app.js)
├── 404.html                # styled not-found page (self-contained; own inline CSS)
├── styles.css              # all styles
├── chrome.js               # every page (~4 KB): the theme switcher and the shared footer's date
├── app.js                  # registry page: URL state, search, filters, sort, table view, charts
├── entry.js                # finding pages only (~2 KB): the citation copy buttons
├── data/entries.json       # the registry, the only file you edit by hand
├── data/vocab.json         # grading vocabulary + source kinds; all generated from it
├── finding/                # one page per entry, generated (ClaimReview JSON-LD)
├── llms.txt                # markdown map of the registry for LLM crawlers, generated
├── sitemap.xml             # generated
├── feed.xml / feed.json    # RSS 2.0 + JSON Feed 1.1, generated
├── robots.txt              # allows AI crawlers; points at sitemap + llms.txt
├── vercel.json             # clean URLs, cache + security headers
├── favicon.ico             # 48x48, generated; the path Google probes
├── apple-touch-icon.png    # 180x180, generated; iOS home screen
├── site.webmanifest        # PWA/Android icon declarations
├── assets/brand/           # brand sources + generated raster icons and og.png
├── assets/fonts/           # self-hosted Newsreader (OFL)
├── assets/external-logos/  # lab marks from Wikimedia Commons
├── GOVERNANCE.md           # roles, what needs a second maintainer, operational access
├── CITATION.cff            # maintainer roster; what GitHub cites, and the contributors page reads
├── CODE_OF_CONDUCT.md      # participation rules
├── SECURITY.md             # how to report a vulnerability
├── .github/workflows/      # CI: integrity, rebuild, drift, link rot, PR entry report
├── .github/ISSUE_TEMPLATE/ # prefilled forms: independent check, grade challenge
├── scripts/                # authoring toolchain (not deployed)
│   ├── build.py            #   ← run this; validates + regenerates everything
│   ├── build-site.py       #   pre-renders index.html; writes finding/, /review, /contributors, llms.txt, sitemap.xml
│   ├── build-feed.py       #   regenerates the feeds
│   ├── build-schema.py     #   regenerates docs/entry.schema.json from vocab.json
│   ├── build-icons.py      #   rasterises the icons + og.png (run deliberately)
│   ├── check-links.py      #   resolves every external URL (CI: PRs + weekly)
│   ├── verify-parity.py    #   asserts pre-rendered cards == app.js card()
│   ├── check-integrity.py  #   asserts no smuggled markup in deployed HTML
│   ├── pr-report.py        #   summarises a PR's entry changes for the CI comment
│   └── serve.py            #   local preview server
└── docs/
    ├── SCHEMA.md           #   field definitions + editorial rules
    ├── entry.schema.json   #   generated JSON Schema for editor autocomplete
    └── CONTRIBUTING.md     #   how to add an entry, and how to review one
```

## Front end

No bundler, no runtime external requests. Three inline scripts in `index.html` (a theme initialiser
that runs before first paint, plus the two Vercel analytics shims); everything else is static
`styles.css`, `chrome.js` on every page, `app.js` on the registry and visuals pages, and `entry.js`
on finding pages.

The split is by what a page actually needs. `chrome.js` is about 4 KB and owns the parts of the
masthead and footer that have to work everywhere, which is why it exists at all: the theme switcher
used to live in `app.js`, and `app.js` loads on two of the seven page types, so five of them shipped
a stored theme with no way to change it. `app.js` is 62 KB of filtering, sorting and chart drawing
that only two pages need, and a leaf page should not download it to run a theme button.

- **Every view is a URL.** `q`, `field`, `lab`, `ver`, `aut`, `tag`, `sort` and `view` are read from
  the query string on load and written back on every change, so a filtered registry can be linked,
  bookmarked and stepped through with the back button. Typing replaces the history entry; a
  dropdown, a tag or Clear all pushes one. This is also what makes the `SearchAction` in the page's
  JSON-LD (`/?q={search_term_string}`) true rather than advertised.
- **Search** runs over named fields (title, claim, detail, lab, model, humans, tags, novelty check,
  caveats), not over `JSON.stringify(entry)`, so a common word no longer matches every entry through
  a key or a URL. Matches are wrapped in `<mark>` by a DOM pass *after* render, deliberately outside
  `card()`, which is parity-checked. Typing switches the sort to best-match unless one was chosen
  deliberately.
- **Two layouts, table by default.** A registry is for scanning, so the default view is a sortable
  table of all 52 entries; cards are one click away. The choice is stored in `localStorage` beside
  the theme and mirrored to `?view=`, and an explicit `?view=` in a shared link wins for that visit
  without overwriting the reader's own preference. **Both layouts are pre-rendered** and CSS shows
  one, selected before first paint, so neither flashes and neither needs the registry JSON to
  appear. With JavaScript off the cards show, which is the richer fallback.
- Keyboard: `/` focuses search, `Esc` clears it, `?` opens a shortcut sheet (a native `<dialog>`).
- Export: the CSV button writes the *current filtered view* client-side via a `Blob`, verified to
  work under the production CSP. Finding pages carry BibTeX and plain-text citations, each with a
  copy button that falls back to selecting the text where the clipboard API is unavailable.
- Type: self-hosted Newsreader, 4 weights, no CDN.
- Theme: dark by default; Light / System / Dark stored in `localStorage`, and switchable from
  every page rather than only the home page. Switches via the View
  Transitions API, with an instant fallback under `prefers-reduced-motion`. `color-scheme` is
  declared per resolved theme, so native scrollbars and `<select>` dropdowns match the page.
- Charts: built from the entries in plain HTML/CSS/SVG, no library. The four in the home page's
  reports strip and the activity feed above them are pre-rendered by `build-site.py`, so they are
  in the markup for a crawler and for a visitor with JavaScript off.
- Responsive from 320px; breakpoints at 560, 720 and 1180. The last one collapses the sticky filter
  bar from two rows to one, which is worth a breakpoint because the bar is sticky. `pointer: coarse`
  enlarges tap targets and forces 16px inputs to stop iOS zoom-on-focus.
- Performance: `index.html` already contains all 52 entries, so `data/entries.json` is fetched on
  idle (or on the first interaction, or immediately if the URL carries a filter) rather than on the
  critical path. `content-visibility` skips layout for off-screen cards.
- Print: a stylesheet that drops every control, forces disclosures open and prints link targets, so a
  finding page saves to PDF as a citable document.
- WCAG 2.1 AA: skip link, `role="search"`, live result count, `role="img"` chart labels, `aria-sort`
  on table headers, focus rings, `prefers-contrast` and `prefers-reduced-motion` honoured.

## Deployment (Vercel)

Static, no build command: the generated files are committed, so a deploy just serves them. Push to
`main` deploys production; each PR gets a preview.

- Caching: fonts immutable for a year; `data/entries.json` and `finding/` `must-revalidate`; feeds
  and `llms.txt` 30 min.
- Security headers on every response: CSP (including `script-src-attr 'none'` and `object-src
  'none'`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Strict-Transport-Security`, `Permissions-Policy`. A new external resource needs its CSP directive
  in `vercel.json` widened, or it is blocked.

## Discovery

- Canonical URLs on every page, clean-URL form.
- JSON-LD: `WebSite` + `SearchAction`, `Dataset` for `data/entries.json`, and an eight-question
  `FAQPage` on the home page (its tallies are regenerated, so they cannot go stale);
  `TechArticle` on methodology; `ScholarlyArticle` + `ClaimReview` + `BreadcrumbList` on every
  finding page. `ClaimReview` maps the verification grade to a 1–5 rating, so an answer engine
  reads the verdict rather than parsing prose.
- `llms.txt` gives LLM crawlers a markdown map: what the registry is, both grading scales, the data
  files, and every finding with its grades.
- `robots.txt` allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, others) and
  points at `sitemap.xml` and `llms.txt`.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Fork, branch, run `python3 scripts/build.py`,
commit the regenerated files alongside your entry, open a PR. Each PR gets a Vercel preview URL and
the CI checks above.

The lowest-friction contribution is an independent check: the
[review queue](https://whataifound.org/review) lists every entry nobody outside the announcing lab
has confirmed, and each row opens a prefilled issue. Roles and the route to maintainer are in
[GOVERNANCE.md](GOVERNANCE.md).

## Licensing

Data and content are CC BY 4.0; code is MIT ([LICENSE](LICENSE)). The `Dataset` JSON-LD exposes
`data/entries.json` as a `DataDownload`.
