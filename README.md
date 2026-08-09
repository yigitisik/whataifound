# whataifound.org

[![build](https://github.com/yigitisik/whataifound/actions/workflows/build.yml/badge.svg)](https://github.com/yigitisik/whataifound/actions/workflows/build.yml)

A registry of scientific and mathematical results produced by or with AI systems, graded on how
each result was verified and how much the AI did. Refuted and already-known results stay on the
record, marked as such.

[Live site](https://whataifound.org) · [Methodology](https://whataifound.org/methodology) ·
[Review queue](https://whataifound.org/review) · [Contributors](https://whataifound.org/contributors) ·
[Schema](docs/SCHEMA.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Contributing](docs/CONTRIBUTING.md) · [Setup](docs/SETUP.md) · [Governance](GOVERNANCE.md) ·
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

The site itself has no tests, because it has no build to get wrong: `build.py` regenerates it and
CI fails on any difference. The tested code is the server side, the functions under `api/` that
hold the session, the handle rules and the schema the registry block is checked against.

```bash
npm ci && npm test                # the api/ unit tests; needs Node 20
```

## How it works

`data/entries.json` is the registry and the single source of truth. Everything else is generated
from it. No database, no server-side code, no framework.

**Adding, correcting or removing a finding is: edit that file, run `build.py`, commit.** No HTML is
ever edited by hand.

```
data/entries.json ──► build.py ──► index.html (entries, activity feed, reports, filters,
                                               stats, FAQ tallies)
                                   finding/<id>.html   one page per entry
                                   topic/<field>.html  one page per topic area
                                   lab/<slug>.html     one page per lab, above a threshold
                                   review.html         the open review queue
                                   contributors.html   the contributor roll
                                   llms.txt  sitemap.xml  feed.xml  feed.json

data/vocab.json   ──► build.py ──► app.js label tables
                                   methodology.html    the two grade lists + source kinds
                                   contribute.html     the four submission forms
                                   .github/ISSUE_TEMPLATE/*.yml   the same four, on GitHub
                                   llms.txt            the grading scales
                                   docs/entry.schema.json
                                   ClaimReview ratings on every finding page
```

Each entry carries two grades: `verification` (how solid the result is, `formal` to `refuted`) and
`autonomy` (how much the AI did, `autonomous` to `retrieval`). Every source also carries a `kind`
(`research`, `announcement`, `coverage`, `commentary`, `challenge`), so the registry keeps the
result apart from the claim made about it. Field definitions and editorial rules are in
[docs/SCHEMA.md](docs/SCHEMA.md).

`/topic/<field>` and `/lab/<slug>` are derived index pages; a lab needs `HUB_MIN_ENTRIES` (3)
entries before it gets one. `/review` and `/contributors` are derived too: the queue is every entry
with no `independent_checks`, and the roll is built from the `reviewers` and `contributors` fields
plus `CITATION.cff`. None of them has a list to keep in step by hand.

Adding a value to any of the four vocabularies in `data/vocab.json` is a code change, not an entry
change: each also needs a colour rule in `styles.css` (`.v-`, `.a-`, `.k-`, `.r-`), and the build
names the missing one.

Why the site is pre-rendered, why `card()` exists twice, what the integrity check guards, and how
accounts and UI contributions stay off git's critical path: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### What `build.py` runs

| Step | Does |
|---|---|
| `build-site.py` | Validates the data, then writes `index.html`, `finding/`, `review.html`, `contributors.html`, the shared header and footer, `llms.txt`, `sitemap.xml` |
| `build-feed.py` | Regenerates `feed.xml` and `feed.json` |
| `build-schema.py` | Regenerates `docs/entry.schema.json` from `data/vocab.json` |
| `verify-parity.py` | Runs `app.js`'s real render functions under Node and diffs each against the pre-rendered markup |
| `verify-doors.py` | Diffs the GitHub issue templates against the matching `/contribute` form |
| `check-integrity.py` | Asserts the deployed HTML contains nothing smuggled |
| `check-mobile.py` | Asserts hover states do not stick to a tap, named controls reach 44px at a coarse pointer, safe areas are respected, and nothing overflows 375px |

Validation stops the build rather than emitting a broken page: a missing required field, an unknown
grade or source `kind`, a malformed date, a duplicate or non-URL-safe `id`, a bad `youtube_id`, a
non-`http(s)` URL, or an entry graded above `claimed` with no `research` source.

Two scripts run outside every build, because they hit the network or need a renderer:
`check-links.py` (CI runs it on PRs touching the data, and weekly) and `build-icons.py` (run
deliberately; outputs are committed).

### Generated files: never hand-edit

`finding/`, `topic/`, `lab/`, `llms.txt`, `sitemap.xml`, `feed.xml`, `feed.json`,
`docs/entry.schema.json`, `api/_lib/registry.js`, `api/_lib/shell.js`, and anything between
`<!--…:START-->` / `<!--…:END-->` markers in `index.html`, `review.html`, `contributors.html`,
`methodology.html`, `visuals.html`, `contribute.html` or the GitHub issue templates. That includes
the masthead and footer on every page: change the chrome in `site_header()` / `site_footer()`, not
in every generated file. Edit `data/entries.json` and rebuild.

## Structure

```
whataifound/
├── index.html              # registry: SEO head, JSON-LD, pre-rendered hero, reports, entries
├── methodology.html        # grading reference (generated from vocab.json)
├── review.html             # open review queue (generated)
├── contributors.html       # contributor roll (generated)
├── visuals.html            # charts page
├── account.html            # your profile: handle, stats, settings
├── contribute.html         # submit a check, a challenge, a correction or an entry
├── admin.html              # maintainer queue (404s for everyone else)
├── privacy.html            # what is stored when you sign in, and how to delete it
├── 404.html                # self-contained; own inline CSS, loads no styles.css
├── styles.css              # all styles
├── js/                     # every browser script; nothing here is bundled or minified
│   ├── chrome.js           #   every page: theme switcher, account control, shared helpers
│   ├── app.js              #   / and /visuals: URL state, search, filters, sort, charts
│   ├── entry.js            #   finding pages: citation copy buttons
│   ├── signals.js          #   finding pages + /review: triage buttons, queue counts
│   └── account|contribute|admin.js
├── api/                    # Vercel functions. Server-side only, never sent to a browser
│   ├── _lib/               #   session, handles, db, http, roles, github, proposal rules
│   │                       #   registry.js and shell.js in here are GENERATED
│   ├── auth/               #   Google OIDC: start, callback, signout
│   └── u|me|signals|proposals|account|admin
├── db/                     # run in number order against Postgres; each is idempotent
├── data/                   # entries.json (the registry) + vocab.json (the grades)
├── finding/ topic/ lab/    # one page each, generated (ClaimReview / CollectionPage JSON-LD)
├── assets/                 # brand/ · fonts/ · external-logos/
├── scripts/                # authoring toolchain, not deployed. build.py runs the rest
├── docs/                   # SCHEMA · ARCHITECTURE · CONTRIBUTING · SETUP · entry.schema.json
├── .github/                # workflows (integrity, rebuild, drift, link rot) + issue templates
├── vercel.json             # clean URLs, cache + security headers
├── robots.txt              # allows AI crawlers; points at sitemap + llms.txt
└── generated at the root   # llms.txt · sitemap.xml · feed.xml · feed.json · favicon.ico
                            # · apple-touch-icon.png · site.webmanifest
```

## Front end

No bundler, no runtime external requests. `styles.css` plus one script per page role:

| Script | Loads on | Owns |
|---|---|---|
| `chrome.js` | every page | theme switcher, account control, shared `esc`/`show`/label helpers |
| `app.js` | `/` and `/visuals` | URL state, search, filters, sort, table view, charts |
| `entry.js` | finding pages | citation copy buttons |
| `signals.js` | finding pages, `/review` | triage buttons, queue counts |
| `account.js` `contribute.js` `admin.js` | their own page | forms and dashboards |

The split is by what a page actually needs. The theme switcher used to live in `app.js`, which
loads on two of the seven page types, so five of them shipped a stored theme with no way to change
it. That is why `chrome.js` exists.

- **Every view is a URL.** `q`, `field`, `lab`, `ver`, `aut`, `tag`, `sort` and `view` round-trip
  through the query string, so any view of the registry can be linked, bookmarked and stepped
  through with the back button. This is also what makes the `SearchAction` in the JSON-LD true
  rather than advertised.
- **Search** runs over named fields, not `JSON.stringify(entry)`, so a common word no longer matches
  every entry through a key or a URL. Matches are wrapped in `<mark>` after render, deliberately
  outside the parity-checked `card()`.
- **Two layouts, table by default.** Both are pre-rendered and CSS shows one, chosen before first
  paint, so neither flashes and neither needs the registry JSON to appear. With JavaScript off the
  cards show, which is the richer fallback.
- **Keyboard and export.** The registry is drivable from the keyboard; `?` opens the sheet listing
  the bindings. The CSV button writes the current filtered view client-side via a `Blob`, and the
  share button copies the view's own URL; finding pages carry BibTeX and plain-text citations with
  copy buttons.
- **Theme** is dark by default: Light / System / Dark in `localStorage`, switchable from every page,
  via the View Transitions API with an instant fallback under `prefers-reduced-motion`.
- **Charts** are plain HTML/CSS/SVG, no library, pre-rendered so a crawler sees them. Type is
  self-hosted Newsreader, 4 weights, no CDN.
- **Responsive from 320px**, breaking at 560, 640, 720, 860 and 1180. `pointer: coarse` enlarges tap
  targets and forces 16px inputs to stop iOS zoom-on-focus. Print drops every control and forces
  disclosures open, so a finding page saves to PDF as a citable document.

Shortcuts, on the registry page:

| Key | Does |
|---|---|
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> <kbd>K</kbd>, or <kbd>k</kbd> | Command palette: entries, filters, sorts and pages |
| <kbd>/</kbd> | Focus the search box |
| <kbd>Esc</kbd> | Clear the search and leave the box |
| <kbd>v</kbd> | Switch between cards and table |
| <kbd>t</kbd> | Cycle the theme |
| <kbd>?</kbd> | Open the shortcut sheet |

The palette is deliberately not on finding pages: it searches the registry, and a finding page
would have to download the whole of it to answer.
- **Performance:** `index.html` already contains every entry, so `data/entries.json` is fetched on
  idle rather than on the critical path. `content-visibility` skips layout for off-screen cards.
- **WCAG 2.1 AA:** skip link, `role="search"`, live result count, `role="img"` chart labels,
  `aria-sort` on table headers, focus rings, `prefers-contrast` and `prefers-reduced-motion` honoured.

## Deployment (Vercel)

Static, no build command: the generated files are committed, so a deploy just serves them. Push to
`main` deploys production; each PR gets a preview.

- Caching: fonts immutable for a year; brand assets a day; the root pages, `data/entries.json`
  and `finding/` `must-revalidate`; feeds and `llms.txt` 30 min.
- Security headers on every response: CSP (including `script-src-attr 'none'` and `object-src
  'none'`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Strict-Transport-Security`, `Permissions-Policy`. A new external resource needs its CSP directive
  in `vercel.json` widened, or it is blocked.
- Deployment records: the Vercel integration opens one per push and never closes them, so
  `cleanup-deployments.yml` prunes both environments weekly. It keeps the newest record in each
  (for Production that is the live site) and drops the rest after 90 days. Nothing it deletes is
  unrecoverable: the record holds a sha that is already in git, and the deploy log and rollback
  live in Vercel.

## Discovery

- Canonical URLs on every page, clean-URL form.
- JSON-LD: `WebSite` + `SearchAction`, `Dataset` for `data/entries.json`, an eight-question
  `FAQPage` on the home page, plus a generated `CollectionPage` listing every entry (its tallies and
  that list are regenerated, so neither can go stale); `TechArticle` on methodology;
  `CollectionPage` (listing its own entries) + `BreadcrumbList` on each topic and lab hub;
  `ScholarlyArticle` + `ClaimReview` + `BreadcrumbList` on every finding page. `ClaimReview` maps
  the verification grade to a 1-5 rating, so an answer engine reads the verdict rather than
  parsing prose.
- `robots.txt` excludes query-string URLs from the general crawl. Tag chips and prefilled
  contribute links are real URLs by design, but the filtering is client-side, so `/?tag=lean`
  serves the same page as `/`. They outnumber the real pages several times over and grow with the
  registry; every one already carries a canonical, so this is a crawl budget question rather than a
  duplicate content one. The `SearchAction` target `/?q=` is allowed back in by a longer, and
  therefore winning, rule. The AI crawler groups are deliberately left unrestricted.
- `llms.txt` gives LLM crawlers a markdown map: what the registry is, both grading scales, the data
  files, and every finding with its grades.
- `robots.txt` allows AI crawlers and points at `sitemap.xml` and `llms.txt`.

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
