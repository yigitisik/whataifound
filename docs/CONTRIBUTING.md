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
pre-rendered into `index.html`, so the page has content without a server — but search, filtering
and the charts read `data/entries.json` over fetch, so use the server rather than a `file://` URL.

## Adding an entry

Read [SCHEMA.md](SCHEMA.md) first for field definitions and grade scales.

1. Branch: `git checkout -b entry/short-name`
2. Add one object to [data/entries.json](../data/entries.json), matching the existing format. Set
   `id` to `YYYY-MM-DD-short-name`; never reuse an id.
3. Run `python3 scripts/build.py`. **Required** — the site is pre-rendered, so an entry that isn't
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

If your entry opens a **new `field` value**, add its display name to `FIELD_LABEL` in
`scripts/build-site.py`; the build will stop and tell you. A new lab needs nothing.

### Correcting or challenging

Don't delete entries. Downgrade `verification`, add the objection to `caveats`, cite the source. To
challenge novelty, submit a PR downgrading the entry to `known` with the specific prior-work
citation.

### Never hand-edit generated files

`finding/`, `llms.txt`, `sitemap.xml`, `feed.xml`, `feed.json`, and anything between
`<!--…:START-->` / `<!--…:END-->` markers in `index.html`. Your change will be overwritten on the
next build, and CI will fail. Edit `data/entries.json` instead.

## Code

Static files at the root: [index.html](../index.html), [methodology.html](../methodology.html),
[visuals.html](../visuals.html), [404.html](../404.html), [styles.css](../styles.css),
[app.js](../app.js). Constraints:

- No runtime external requests. A new external resource also needs its CSP directive in
  [vercel.json](../vercel.json) widened.
- No inline event handlers (`onclick=` and friends) — CSP sets `script-src-attr 'none'`, and
  `check-integrity.py` rejects them. Attach listeners in `app.js`.
- WCAG 2.1 AA: keep focus rings, heading order, chart labels, `prefers-reduced-motion`.
- Works in both light and dark themes.
- Layout holds at 320, 560, 720px.

`card()` exists twice: in [app.js](../app.js) and ported to
[scripts/build-site.py](../scripts/build-site.py). **Change one, change the other, in the same PR.**
`verify-parity.py` runs the real `card()` under Node and diffs it against the pre-rendered markup,
so drift fails the build — the markup would otherwise visibly change the first time a visitor
filters.

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

The integrity check runs *before* the rebuild, because a rebuild would overwrite tampering in a
fully generated file and hide it.

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

- **Open the primary sources.** Confirm they resolve and say what the entry says they say. A
  plausible-looking URL to a paper that doesn't contain the result is the likeliest bad entry, and
  no check catches it.
- **Check the grades against the evidence**, not the contributor's summary. `formal` needs a
  machine-checked artifact you can point at. `independent` needs someone who isn't an author. When
  the evidence is arguable, the weaker grade wins.
- **Read the `novelty_check` as a claim about search, not a conclusion.** "Appears novel" isn't
  reviewable; a named database and query is.
- **Be suspicious of upgrades.** A PR raising an entry's `verification` or softening `caveats` is
  the shape a promotional edit takes. Requires new evidence, cited.
- **Treat the diff's scope as a signal.** An entry PR should touch `data/entries.json` plus
  generated files and nothing else. CI warns when one also touches `scripts/`, `.github/`, `app.js`
  or `vercel.json` — read those as code changes, and never merge them on the strength of the entry.
- **Watch for conflicts of interest.** Contributors submitting their own result are welcome and
  common, but it goes in at the grade the evidence supports, and saying so in the PR is expected.

Generated files make diffs large. Review `data/entries.json` and any hand-written file; the rest is
reproduced by CI and doesn't need reading line by line.
