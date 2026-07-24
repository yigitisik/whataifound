# whataifound.org

A registry of scientific and mathematical results produced by or with AI systems, graded on how
each result was verified and how much the AI did. Results that turned out to already exist in the
literature stay on the record.

[Live site](https://whataifound.org) · [Methodology](https://whataifound.org/methodology) ·
[Schema](SCHEMA.md) · [Contributing](CONTRIBUTING.md) · [RSS](https://whataifound.org/feed.xml) ·
[JSON Feed](https://whataifound.org/feed.json)

## Quick start

Requires Python 3.

```bash
git clone https://github.com/yigitisik/whataifound.git
cd whataifound
python3 serve.py          # http://localhost:8000
python3 serve.py --lan    # phone testing on the same network
```

`serve.py` reproduces the clean URLs and 404 page Vercel serves in production. `vercel dev` (with
the CLI) also applies the production headers. `index.html` fetches `data/entries.json`, so it
needs a server; a `file://` URL won't load.

## How it works

The registry is one JSON file, `data/entries.json`. The site reads it client-side; `build-feed.py`
generates the RSS and JSON feeds from it. No database, no server-side code. Adding a finding means
adding one object to the file.

Each entry has two grades:

- `verification`: how solid the result is, from `formal` to `refuted`.
- `autonomy`: how much the AI did, from `autonomous` to `retrieval`.

Full definitions and editorial rules are in [SCHEMA.md](SCHEMA.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Fork, branch, open a PR; each PR gets a Vercel preview URL.
Feeds regenerate on merge, so don't hand-edit `feed.xml` or `feed.json`.

## Structure

```
whataifound/
├── index.html              # registry page: markup, SEO head, JSON-LD
├── methodology.html        # grading reference
├── 404.html                # styled not-found page
├── styles.css              # all styles
├── app.js                  # render, filter, charts, theme, permalinks
├── data/entries.json       # the registry
├── feed.xml / feed.json    # RSS 2.0 + JSON Feed 1.1, generated
├── build-feed.py           # regenerates the feeds from data/entries.json
├── serve.py                # local preview server
├── vercel.json             # clean URLs, cache + security headers
├── robots.txt / sitemap.xml
├── assets/brand/           # favicon, og.png card, og.svg source
├── assets/fonts/           # self-hosted Newsreader (OFL)
├── assets/external-logos/  # lab marks from Wikimedia Commons
├── SCHEMA.md               # field definitions + editorial rules
└── CONTRIBUTING.md
```

## Front end

No build step, no runtime external requests. One inline script (a theme initialiser that runs
before first paint); everything else is static `styles.css` and `app.js`.

- Type: self-hosted Newsreader, 4 weights, no CDN.
- Theme: dark by default; Light / System / Dark toggle stored in `localStorage`. Switches via the
  View Transitions API, with an instant fallback under `prefers-reduced-motion`.
- Charts: four bar charts built from the entries in plain HTML/CSS/SVG, no library.
- Responsive from 320px; breakpoints at 560 and 720. `pointer: coarse` enlarges tap targets and
  forces 16px inputs to stop iOS zoom-on-focus.
- WCAG 2.1 AA: skip link, `role="search"`, live result count, `role="img"` chart labels, focus
  rings, `prefers-contrast` and `prefers-reduced-motion` honoured.

## Deployment (Vercel)

Static, no build command. Push to `main` deploys production; each PR gets a preview.

- Caching: fonts immutable for a year; `data/entries.json` `must-revalidate`; feeds 30 min.
- Security headers on every response (CSP, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`). A new external resource
  needs its CSP directive in `vercel.json` widened, or it's blocked.
- Enable Web Analytics and Speed Insights on the project; the snippets are already in both pages
  and no-op until then.

## Discovery

- Canonical URLs on both pages (clean-URL form).
- JSON-LD: `WebSite` + `SearchAction`, a `Dataset` node for `data/entries.json`, `FAQPage` on home,
  `TechArticle` on methodology.
- Open Graph / Twitter cards use `assets/brand/og.png` (PNG, not SVG). Regenerate after editing
  `og.svg`:

  ```bash
  npm i @resvg/resvg-js
  node -e "const{Resvg}=require('@resvg/resvg-js');const fs=require('fs');\
  const r=new Resvg(fs.readFileSync('assets/brand/og.svg','utf8'),{fitTo:{mode:'width',value:1200},\
  font:{fontFiles:['assets/fonts/news-600.woff2','assets/fonts/news-400.woff2'],loadSystemFonts:true,\
  defaultFontFamily:'Newsreader'}});fs.writeFileSync('assets/brand/og.png',r.render().asPng())"
  ```
- `robots.txt` allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, others) and
  points to `sitemap.xml`.

The domain `https://whataifound.org` is hard-coded in `index.html`, `methodology.html`,
`robots.txt`, `sitemap.xml`, the `SITE` constant in `build-feed.py`, and the `og.svg` wordmark.
Changing it means editing all six, re-running `build-feed.py`, and re-rendering `og.png`.

## Feeds and reuse

`feed.xml` and `feed.json` are generated by `build-feed.py`, newest-added first, and linked via
`<link rel="alternate">` on both pages.

```bash
python3 build-feed.py
```

Data and content are CC BY 4.0; code is MIT ([LICENSE](LICENSE)). The `Dataset` JSON-LD exposes
`data/entries.json` as a `DataDownload`.

## Current state

21 entries, July 2021 (AlphaFold2) to July 2026 (Jacobian conjecture counterexample). Four are
negative results (two `known`, two `disputed`). Thirteen carry `discussion` threads; three carry
YouTube `videos` verified against oEmbed. The 2026 entries carry neither, since no verifiable
thread exists yet.

## Roadmap

1. Company pages (`/lab/anthropic`, etc.): a scoreboard of verified contributions per lab.
2. Automated feed generation on merge, so contributors never touch the feeds.
3. Static site generator (Astro/Eleventy) past ~40 entries, with per-entry markdown for readable
   git history.
4. Per-finding OG images on dedicated entry pages.
5. A structured mechanism to challenge an entry's novelty with prior-work citations.
6. Backfill: AlphaFold-adjacent results, remaining Erdős contributions, First Proof.
