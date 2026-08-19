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

Requires Python 3 (Node only for the parity check and the `api/` tests).

```bash
git clone https://github.com/yigitisik/whataifound.git
cd whataifound
python3 scripts/build.py          # regenerate the site from data/entries.json
python3 scripts/serve.py          # http://localhost:8000  (--lan for phone testing)
npm ci && npm test                # the api/ unit tests
```

`serve.py` reproduces the clean URLs and 404 page Vercel serves in production. The static site has
no tests, because it has no build to get wrong: `build.py` regenerates it and CI fails on any
difference. The tested code is the server side under `api/`.

## How it works

`data/entries.json` is the registry and the single source of truth; `data/vocab.json` holds the
grading vocabulary. Everything else is generated from them: the entry pages, the topic and lab
hubs, the review queue, the contributor roll, the feeds, `llms.txt`, `sitemap.xml`, the submission
forms, and the JSON schema.

**Adding, correcting or removing a finding is: edit `data/entries.json`, run `build.py`, commit.**
No HTML is ever edited by hand.

Each entry carries two grades: `verification` (how solid the result is, `formal` to `refuted`) and
`autonomy` (how much the AI did, `autonomous` to `retrieval`). Every source also carries a `kind`
(`research`, `announcement`, `coverage`, `commentary`, `challenge`), so the registry keeps the
result apart from the claim made about it. Field definitions and editorial rules are in
[docs/SCHEMA.md](docs/SCHEMA.md).

Derived pages keep no list by hand: `/review` is every entry with no `independent_checks`, the
contributor roll comes from the `reviewers` and `contributors` fields plus `CITATION.cff`, and a
lab needs `HUB_MIN_ENTRIES` (3) entries before it gets a hub.

`build.py` runs three generators (`build-site.py`, `build-feed.py`, `build-schema.py`) and then
four verifiers (`verify-parity.py`, `verify-doors.py`, `check-integrity.py`, `check-mobile.py`). A
failing step stops the run, so a bad entry never reaches a commit. Validation rejects a missing
required field, an unknown grade or source `kind`, a malformed date, a duplicate or non-URL-safe
`id`, a bad `youtube_id`, a non-`http(s)` URL, or an entry graded above `claimed` with no
`research` source.

Three scripts run outside every build, because they hit the network or need a renderer:
`check-links.py` (CI runs it on PRs touching the data, and weekly), `check-registries.py`
(suggests cross-links to Palomar, MathDB, vibemathed and ProofAtlas; it prints candidates and
never writes one) and `build-icons.py` (run deliberately; outputs are committed).

Entries can cite the record another project keeps for the same result, through `registrations`.
Each cited project states what its record establishes, which is not the same thing in each case:
Palomar machine-checks a Lean proof, MathDB tracks a problem's standing in the literature, and
vibemathed is a parallel list. [/registries](https://whataifound.org/registries) sets out what
each one does and what none of them do.

Why the site is pre-rendered, why `card()` exists twice, what the integrity check guards, and how
accounts and UI contributions stay off git's critical path: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

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
├── *.html                  # methodology · review · contributors · visuals · account
│                           # contribute · admin · privacy · 404 (self-contained)
├── styles.css              # all styles
├── js/                     # every browser script; nothing bundled or minified
├── api/                    # Vercel functions. Server-side only, never sent to a browser
│   ├── _lib/               #   session, handles, db, http, roles, github, proposal rules
│   │                       #   registry.js and shell.js in here are GENERATED
│   ├── auth/               #   Google OIDC: start, callback, signout
│   └── u|me|signals|proposals|account|admin
├── db/                     # run in number order against Postgres; each is idempotent
├── data/                   # entries.json (the registry) + vocab.json (the grades)
├── finding/ topic/ lab/    # one page each, generated
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

No bundler, no framework, no runtime external requests. `styles.css` plus one script per page role:
`chrome.js` (every page: theme switcher, account control, shared helpers), `app.js` (`/` and
`/visuals`: URL state, search, filters, sort, charts), `entry.js` (finding pages), `signals.js`
(finding pages + `/review`), and `account.js` / `contribute.js` / `admin.js` on their own pages.
The split is by what a page actually needs: the theme switcher used to live in `app.js`, which
loads on two of the seven page types, so five of them shipped a stored theme with no way to change
it. That is why `chrome.js` exists.

- **Every view is a URL.** `q`, `field`, `lab`, `ver`, `aut`, `tag`, `sort` and `view` round-trip
  through the query string, so any view can be linked, bookmarked and stepped through with the back
  button. This is also what makes the `SearchAction` in the JSON-LD true rather than advertised.
- **Search** runs over named fields, not `JSON.stringify(entry)`. Matches are wrapped in `<mark>`
  after render, deliberately outside the parity-checked `card()`.
- **Two layouts, table by default.** Both are pre-rendered and CSS shows one, chosen before first
  paint, so neither flashes. With JavaScript off the cards show, which is the richer fallback.
- **Keyboard and export.** <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> <kbd>K</kbd> or <kbd>k</kbd> opens the
  command palette, <kbd>/</kbd> focuses search, <kbd>Esc</kbd> clears it, <kbd>v</kbd> switches
  layout, <kbd>t</kbd> cycles the theme, <kbd>?</kbd> lists the bindings. The CSV button writes the
  filtered view client-side; finding pages carry BibTeX and plain-text citations. The palette is
  deliberately not on finding pages: it searches the registry, and a finding page would have to
  download the whole of it to answer.
- **Theme** is dark by default: Light / System / Dark in `localStorage`, switchable from every page,
  via the View Transitions API with an instant fallback under `prefers-reduced-motion`.
- **Charts** are plain HTML/CSS/SVG, no library, pre-rendered so a crawler sees them. Type is
  self-hosted Newsreader, 4 weights, no CDN.
- **Responsive from 320px**, breaking at 560, 640, 720, 860 and 1180. `pointer: coarse` enlarges tap
  targets and forces 16px inputs to stop iOS zoom-on-focus. Print drops every control and forces
  disclosures open, so a finding page saves to PDF as a citable document.
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
  `cleanup-deployments.yml` prunes both environments weekly, keeping the newest record in each and
  dropping the rest after 90 days. Nothing it deletes is unrecoverable.

## Discovery

- Canonical URLs on every page, clean-URL form.
- JSON-LD: `WebSite` + `SearchAction`, `Dataset` for `data/entries.json`, an eight-question
  `FAQPage` and a generated `CollectionPage` on the home page; `TechArticle` on methodology;
  `CollectionPage` + `BreadcrumbList` on each topic and lab hub; `ScholarlyArticle` + `ClaimReview`
  + `BreadcrumbList` on every finding page. `ClaimReview` maps the verification grade to a 1-5
  rating, so an answer engine reads the verdict rather than parsing prose.
- `robots.txt` allows AI crawlers, points at `sitemap.xml` and `llms.txt`, and excludes
  query-string URLs from the general crawl. Tag chips and prefilled contribute links are real URLs
  by design, but the filtering is client-side, so `/?tag=lean` serves the same page as `/`; every
  one already carries a canonical, so this is a crawl budget question rather than a duplicate
  content one. The `SearchAction` target `/?q=` is allowed back in by a longer, and therefore
  winning, rule.
- `llms.txt` gives LLM crawlers a markdown map: what the registry is, both grading scales, the data
  files, and every finding with its grades.

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
