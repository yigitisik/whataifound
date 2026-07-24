# whataifound.org

**The record of what AI has actually discovered.**

A curated registry of scientific and mathematical results produced by or with AI systems, graded
on two axes: how the result was verified, and how much the AI actually did. Results that turned
out to already exist in the literature stay on the record. That is the point.

[Live site](https://whataifound.org) · [Methodology](https://whataifound.org/methodology) ·
[Schema](SCHEMA.md) · [Contributing](CONTRIBUTING.md) · [RSS](https://whataifound.org/feed.xml) ·
[JSON Feed](https://whataifound.org/feed.json)

## Quick start

Requires Python 3. Nothing else: no Node, no install, no build step.

```bash
git clone https://github.com/yigitisik/whataifound.git
cd whataifound
python3 serve.py          # http://localhost:8000
python3 serve.py --lan    # bind all interfaces, for phone testing on the same Wi-Fi
```

`serve.py` wraps Python's stock server and adds the two things Vercel does that it doesn't:
clean URLs (`/methodology` resolves to `methodology.html`) and the styled 404. If you have the
Vercel CLI, `vercel dev` runs the real platform locally on port 3000 and additionally applies
the production headers.

Opening `index.html` as a `file://` URL will not work. The page fetches `data/entries.json`,
which needs a server.

## How it works

The registry is a single JSON file. Everything else is a rendering of it.

`data/entries.json` is the product. The site reads it client-side, filters and charts it in the
browser, and `build-feed.py` turns it into RSS and JSON feeds. There is no database, no CMS, and
no server-side code. Adding a finding means adding one object to one file.

Each entry carries two independent grades, which is the editorial core of the project:

- **`verification`**: how solid the result is, from `formal` (machine-checked) down through
  `peer-reviewed`, `claimed`, `disputed`, `known`, to `refuted`.
- **`autonomy`**: how much the AI actually did, from `autonomous` down through `collaborative`
  and `ai-assisted` to `retrieval`.

Most breathless claims collapse on the second axis. Full definitions live in [SCHEMA.md](SCHEMA.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. In short: fork, branch, change one
thing, open a pull request. Every PR gets its own Vercel preview URL for review. Feeds regenerate
on merge, so do not hand-edit `feed.xml` or `feed.json`.

## Project structure

```
whataifound/
├── index.html              # registry page: markup, SEO/social head, JSON-LD
├── methodology.html        # styled grading reference
├── 404.html                # self-contained styled not-found page
├── styles.css              # all styles: theme tokens, layout, components, responsive
├── app.js                  # all behaviour: render, filter, charts, theme, permalinks
├── data/entries.json       # the registry. The only file that matters long term
├── feed.xml                # RSS 2.0, generated
├── feed.json               # JSON Feed 1.1, generated
├── build-feed.py           # regenerates both feeds from data/entries.json
├── serve.py                # local preview server: clean URLs + styled 404
├── vercel.json             # deploy config: clean URLs, cache and security headers
├── robots.txt              # allows general and AI crawlers
├── sitemap.xml             # the two indexable URLs
├── assets/brand/           # favicon, og.png social card, og.svg source
├── assets/fonts/           # self-hosted Newsreader, 4 weights, OFL-licensed
├── assets/external-logos/  # lab marks from Wikimedia Commons, not ours
├── SCHEMA.md               # field definitions and editorial rules
├── CONTRIBUTING.md         # contributor guide
└── LICENSE                 # CC BY 4.0 for data and content, MIT for code
```

## Design and front end

**No build, no external requests.** `index.html` links `styles.css` and `app.js` as plain static
files. The only inline script is a two-line theme initialiser in the `<head>` that runs before
first paint to avoid a flash.

**Type** is one family, Newsreader: a classic news serif in the AP/NYT/WSJ vein, deliberately too
old-school to read as tech. Reading text uses old-style figures; numeric chrome (stats, dates,
chart values) switches to lining tabular figures, and labels lean on uppercase with letter-spacing
for a newspaper small-caps feel. Four weights are served from `assets/fonts/` rather than a CDN,
so the page renders identically offline. The SIL OFL 1.1 licence travels with the files.

**Theme** defaults to dark for a first-time visitor. The toggle offers Light / System / Dark and
persists the choice in `localStorage`, where System follows `prefers-color-scheme`. Switching
wipes the new theme in from the top of the viewport using the View Transitions API, falling back
to an instant swap where that API is absent or `prefers-reduced-motion` is set.

**Charts** are revealed by the Visuals disclosure toggle in the header: four bar charts computed
live from the entries (per year, by verification grade, by lab, by topic). Plain HTML/CSS/SVG,
no chart library, always reflecting the whole registry rather than the active filter. Magnitude
uses a single accent hue and identity rides on text labels, because the eight verification colours
fail as a categorical set (author-verified and disputed are too close to distinguish reliably).

**Responsive** from 320px phones through desktop. Breakpoints at 720px (entry rail moves above the
body) and 560px (compact, non-sticky filter bar). A `pointer: coarse` block enlarges tap targets
and forces 16px inputs so iOS does not zoom on focus. Safe-area insets keep content clear of
notches.

**Accessibility** targets WCAG 2.1 AA. Skip link, `role="search"` on the filter bar, a polite live
region announcing result counts as you filter, and `role="img"` labels summarising each chart for
screen readers. Visible `:focus-visible` rings throughout; `prefers-contrast: more` and
`prefers-reduced-motion` both honoured. Muted text measures 5.4:1, white-on-pill 4.9:1 or better.

## Deployment

Static deploy on Vercel, no build command. Files sit at the repo root and are served directly.
Push to `main` deploys production; every pull request gets its own preview deployment.

**Caching.** Fonts get a one-year immutable header. `data/entries.json` is `must-revalidate` so
registry edits go live immediately. Feeds cache 30 minutes at the edge.

**Security headers** apply to every response: a Content-Security-Policy scoped to what the site
actually loads, plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Strict-Transport-Security`, and `Permissions-Policy`. Adding a new external resource means
widening the matching CSP directive in `vercel.json`, or it will be blocked.

**Dashboard toggles.** Web Analytics and Speed Insights need enabling on the Vercel project. The
loader snippets are already in both pages; they are cookieless and no-op until enabled.

## Discovery and SEO

Built to be found and cited by both classic search and AI answer engines.

- **Canonical URLs** on both pages, pointing at the clean-URL form, so ranking never splits
  across `/methodology` and `/methodology.html`.
- **Structured data (JSON-LD):** `WebSite` + `SearchAction`, a `Dataset` node pointing at
  `data/entries.json`, and an `FAQPage` on the home page; `TechArticle` on methodology. This is
  the main lever for accurate AI-engine citation.
- **Open Graph and Twitter cards** with a 1200×630 `assets/brand/og.png`. It must be PNG; those
  platforms silently drop SVG. Regenerate after editing `og.svg`:

  ```bash
  npm i @resvg/resvg-js
  node -e "const{Resvg}=require('@resvg/resvg-js');const fs=require('fs');\
  const r=new Resvg(fs.readFileSync('assets/brand/og.svg','utf8'),{fitTo:{mode:'width',value:1200},\
  font:{fontFiles:['assets/fonts/news-600.woff2','assets/fonts/news-400.woff2'],loadSystemFonts:true,\
  defaultFontFamily:'Newsreader'}});fs.writeFileSync('assets/brand/og.png',r.render().asPng())"
  ```
- **`robots.txt`** explicitly welcomes AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot,
  PerplexityBot, Google-Extended, Applebot-Extended, CCBot) and points to `sitemap.xml`.

**Canonical domain:** `https://whataifound.org`. The string is not free-floating. It appears in
`index.html`, `methodology.html`, `robots.txt`, `sitemap.xml`, and the `SITE` constant in
`build-feed.py`, plus the wordmark in `assets/brand/og.svg`. Changing it means changing all of
those, re-running `build-feed.py`, and re-rendering `og.png`.

## Permalinks, feeds, and reuse

**Per-entry permalinks.** Every entry renders with a stable `id="e-<entry-id>"` and a copy-link
affordance beside its title. Opening a `#e-…` link scrolls to that entry, opens its disclosure,
and briefly highlights it. The list is rendered client-side, so `app.js` handles this
(`revealFromHash`) rather than the browser's native anchor jump, which fires before the entries
exist.

**Feeds.** `feed.xml` and `feed.json` are generated from `data/entries.json` by `build-feed.py`,
sorted newest-added first, and advertised via `<link rel="alternate">` in both pages.

```bash
python3 build-feed.py     # rewrites feed.xml + feed.json
```

**License and citation.** Registry data and editorial content are **CC BY 4.0**; site code is
**MIT**. The footer carries a "Use the data" block and a "How to cite" block whose retrieval date
is filled at runtime. The `Dataset` JSON-LD points at `data/entries.json` as a `DataDownload`.

## Current state

21 entries spanning July 2021 (AlphaFold2) to July 2026 (Jacobian conjecture counterexample),
graded conservatively.

Four are deliberately negative results: two graded `known` (the GPT-5 convex-optimization claim
and the GPT-5 "10 Erdős problems" episode) and two `disputed` (the GNoME materials predictions and
the A-Lab autonomous-synthesis claims). Showing the failure modes is what makes the rest credible.

Thirteen entries carry a `discussion` field linking to threads where the result was argued over.
The future-dated 2026 entries deliberately have none: no verifiable thread exists yet, and
inventing one would defeat the purpose.

Three entries carry `videos`: click-to-load YouTube explainers whose IDs and channels were verified
against YouTube's oEmbed endpoint before inclusion. Nothing loads from YouTube until the visitor
presses play, which keeps the no-external-requests default intact.

## Roadmap

Roughly in order of value:

1. **Company pages.** `/lab/anthropic`, `/lab/openai`, `/lab/deepmind`: a neutral scoreboard of
   verified contributions rather than benchmark scores. Nobody else publishes this.
2. **Automated feed generation on merge**, so contributors never touch `feed.xml` or `feed.json`.
3. **Move to a static site generator** (Astro or Eleventy) once entry count passes ~40, with
   per-entry markdown files. Per-entry files make git history far more readable, which matters
   because the history is the credibility mechanism.
4. **Dedicated entry pages** with their own OG images, so sharing a specific finding unfurls with
   that finding's card.
5. **Challenge mechanism.** A structured way to contest an entry's novelty by citing prior work.
   This is where crowdsourcing genuinely works: refutation is objective and self-motivating,
   unlike voting on truth.
6. **Backfill deeper.** Still to add: AlphaFold-adjacent results, the remaining verified Erdős
   contributions on Tao's wiki, and the First Proof challenge results.

## Editorial rules that do not drift

- Lab announcements enter at `claimed` no matter how confident the blog post is.
- Never delete an entry; downgrade `verification` and add to `caveats`. Quiet edits destroy trust.
- A novelty check gets written for every entry, including when it comes back clean.
- `autonomy` is graded on the strictest defensible reading of what the AI did.
- No hype verbs in titles.

See [SCHEMA.md](SCHEMA.md) for full field definitions.

## License

Dual-licensed. Registry data and editorial content under [CC BY 4.0](LICENSE); site code under
MIT. See [LICENSE](LICENSE).
