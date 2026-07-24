# Contributing

Two kinds of change, both via pull request. No direct pushes to `main`.

- **Entries**: add, correct, or challenge a finding in `data/entries.json`.
- **Code**: site markup, styles, behaviour.

## Setup

Requires Python 3.

```bash
git clone https://github.com/yigitisik/whataifound.git
cd whataifound
python3 serve.py          # http://localhost:8000
python3 serve.py --lan    # for phone testing on the same network
```

`serve.py` adds clean URLs and the 404 page that Vercel serves in production. Note that
`index.html` fetches `data/entries.json`, so it needs a server; a `file://` URL won't load.

## Adding an entry

Read [SCHEMA.md](SCHEMA.md) first for the field definitions and grade scales.

1. Branch: `git checkout -b entry/short-name`
2. Add one object to [data/entries.json](data/entries.json), matching the existing format. Set
   `id` to `YYYY-MM-DD-short-name`; never reuse an id.
3. Run locally and check the entry renders, filters, and expands.
4. Open a PR. Leave `feed.xml` and `feed.json` alone; they regenerate on merge.

Requirements:

- At least one primary source (paper, proof artifact, dataset, or repository). A news article
  doesn't count.
- Both grades (`verification`, `autonomy`) set to the weaker reading when arguable, with the
  tension noted in `caveats`.
- A `novelty_check` recording what you searched, even when nothing turned up. State the searches:
  "MathSciNet + arXiv, dimension-3 constructions; nearest is Wang 1980 (degree 2 only)", not
  "appears novel".

Negative results (`known`, `disputed`, `refuted`) are in scope.

### Correcting or challenging

Don't delete entries. Downgrade `verification`, add the objection to `caveats`, cite the source.
To challenge novelty, submit a PR downgrading the entry to `known` with the specific prior-work
citation.

## Code

Static files at the root: [index.html](index.html), [methodology.html](methodology.html),
[404.html](404.html), [styles.css](styles.css), [app.js](app.js). Constraints:

- No runtime external requests. A new external resource also needs its CSP directive in
  [vercel.json](vercel.json) widened.
- WCAG 2.1 AA: keep focus rings, heading order, chart labels, `prefers-reduced-motion`.
- Works in both light and dark themes.
- Layout holds at 320, 560, 720px.

## PRs

Branch from `main`, push, open a PR. Vercel posts a preview URL. A maintainer reviews the diff and
preview; merging deploys to production and regenerates the feeds. One entry or one code change per
PR.

## Editorial rules

1. Lab announcements enter at `claimed`.
2. Never delete an entry; downgrade and add `caveats`.
3. Every entry has a `novelty_check`, including when clean.
4. No reproducible artifact caps verification at `claimed`.
5. `autonomy` uses the strictest defensible reading.
6. No hype verbs in titles.

