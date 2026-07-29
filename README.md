# whataifound.org

A registry of scientific and mathematical results produced by or with AI systems, graded on how
each result was verified and how much the AI did. Refuted and already-known results stay on the
record, marked as such.

[Live site](https://whataifound.org) · [Methodology](https://whataifound.org/methodology) ·
[Schema](docs/SCHEMA.md) · [Contributing](docs/CONTRIBUTING.md) · [RSS](https://whataifound.org/feed.xml) ·
[JSON Feed](https://whataifound.org/feed.json)

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
data/entries.json ──► build.py ──► index.html (entries, stats, filters, FAQ tallies)
                                   finding/<id>.html   one page per entry
                                   llms.txt  sitemap.xml  feed.xml  feed.json

data/vocab.json   ──► build.py ──► app.js label tables
                                   methodology.html    the two grade lists
                                   llms.txt            the grading scales
                                   ClaimReview ratings on every finding page
```

`data/vocab.json` holds the grading vocabulary: the slug, label, short description, full
definition and schema.org rating for every `verification` and `autonomy` grade, plus the `field`
display names. It used to be restated in six places by hand; now a label or definition is edited
once and the build propagates it.

Each entry carries two grades: `verification` (how solid the result is, `formal` to `refuted`) and
`autonomy` (how much the AI did, `autonomous` to `retrieval`). Field definitions and editorial
rules are in [docs/SCHEMA.md](docs/SCHEMA.md).

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
| `build-site.py` | Validates the data, then writes `index.html`, `finding/`, `llms.txt`, `sitemap.xml` |
| `build-feed.py` | Regenerates `feed.xml` and `feed.json` |
| `verify-parity.py` | Runs `app.js`'s real `card()` under Node and diffs it against the pre-rendered markup |
| `check-integrity.py` | Asserts the deployed HTML contains nothing smuggled |

Validation stops the build rather than emitting a broken page: a missing required field, an unknown
grade, a malformed date, a duplicate or non-URL-safe `id`, a bad `youtube_id`, or a non-`http(s)`
URL. `javascript:` and `data:` links are rejected outright: entry URLs become `href`s on the page,
and the CSP allows `'unsafe-inline'`, so they would be live.

`check-integrity.py` looks for unexpected inline scripts, script or frame origins outside the CSP,
inline event handlers, executable URL schemes, and `<base>`/`<object>`/`<embed>`/`<form>`. It exists
because part of `index.html` (the `<head>`, JSON-LD, nav, footer, script tags) sits outside the
`<!--…:START/END-->` markers and is *not* regenerated, so a payload placed there would survive a
rebuild and leave a clean diff. In CI it runs **before** the rebuild, which would otherwise
overwrite tampering in a fully generated file and hide it.

`card()` exists twice: in `app.js` and ported to `build-site.py`. They must stay in step or the
markup visibly changes the first time a visitor filters; `verify-parity.py` is what enforces that.

Two scripts are deliberately *not* part of every build, because they hit the network or need a
renderer the rest of the toolchain does not:

- **`check-links.py`** resolves every external URL in the registry and fails only on 404/410.
  Paywalls, rate limits and 5xx are reported but do not fail, because a check that cries wolf gets
  ignored. CI runs it on PRs that touch `data/entries.json` and sweeps the whole registry weekly, in
  its own workflow so a publisher outage never blocks a correct entry from merging.
- **`build-notability.py`** measures `notability` (Wikipedia language editions covering the problem)
  from the live Wikipedia API, following redirects and writing a `notability_meta` audit trail.
- **`build-icons.py`** rasterises the brand icons and the OG card. Outputs are committed.

### Generated files: never hand-edit

`finding/`, `llms.txt`, `sitemap.xml`, `feed.xml`, `feed.json`, and anything between
`<!--…:START-->` / `<!--…:END-->` markers in `index.html`. Edit `data/entries.json` and rebuild.

## Structure

```
whataifound/
├── index.html              # registry: SEO head, JSON-LD, pre-rendered entries
├── methodology.html        # grading reference (grade lists generated from vocab.json)
├── visuals.html            # charts page (renders data/entries.json via app.js)
├── 404.html                # styled not-found page (self-contained; own inline CSS)
├── styles.css              # all styles
├── app.js                  # render, filter, charts, theme (label tables generated)
├── data/entries.json       # the registry, the only file you edit by hand
├── data/vocab.json         # the grading vocabulary; both scales are generated from it
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
├── .github/workflows/      # CI: integrity, rebuild, drift, link rot
├── scripts/                # authoring toolchain (not deployed)
│   ├── build.py            #   ← run this; validates + regenerates everything
│   ├── build-site.py       #   pre-renders index.html; writes finding/, llms.txt, sitemap.xml
│   ├── build-feed.py       #   regenerates the feeds
│   ├── build-notability.py #   measures notability from the Wikipedia API (run deliberately)
│   ├── build-icons.py      #   rasterises the icons + og.png (run deliberately)
│   ├── check-links.py      #   resolves every external URL (CI: PRs + weekly)
│   ├── verify-parity.py    #   asserts pre-rendered cards == app.js card()
│   ├── check-integrity.py  #   asserts no smuggled markup in deployed HTML
│   └── serve.py            #   local preview server
└── docs/
    ├── SCHEMA.md           #   field definitions + editorial rules
    └── CONTRIBUTING.md     #   how to add an entry, and how to review one
```

## Front end

No bundler, no runtime external requests. Three inline scripts in `index.html` (a theme initialiser
that runs before first paint, plus the two Vercel analytics shims); everything else is static
`styles.css` and `app.js`.

- Type: self-hosted Newsreader, 4 weights, no CDN.
- Theme: dark by default; Light / System / Dark stored in `localStorage`. Switches via the View
  Transitions API, with an instant fallback under `prefers-reduced-motion`.
- Charts: built from the entries in plain HTML/CSS/SVG, no library.
- Responsive from 320px; breakpoints at 560 and 720. `pointer: coarse` enlarges tap targets and
  forces 16px inputs to stop iOS zoom-on-focus.
- WCAG 2.1 AA: skip link, `role="search"`, live result count, `role="img"` chart labels, focus
  rings, `prefers-contrast` and `prefers-reduced-motion` honoured.

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

## Licensing

Data and content are CC BY 4.0; code is MIT ([LICENSE](LICENSE)). The `Dataset` JSON-LD exposes
`data/entries.json` as a `DataDownload`.
