# Contributing

Thanks for helping build the registry. There are two kinds of contribution and they follow
different paths:

- **Entries** (a finding to add, correct, or challenge). Most contributions. Touches one file.
- **Code** (site markup, styles, behaviour). Standard pull request.

Both land through a pull request. Nothing is pushed straight to `main`.

## Before you start

You need Python 3 (any 3.x, already on macOS and most Linux). Nothing else. No Node, no
package install, no build step.

```bash
git clone https://github.com/yigitisik/whataifound.git
cd whataifound
python3 serve.py          # http://localhost:8000
```

`serve.py` is a thin wrapper on Python's stock server that adds the two things Vercel does
and it doesn't: clean URLs (`/methodology` resolves to `methodology.html`) and the styled 404.
That keeps local preview honest against production.

Opening `index.html` directly as a `file://` URL will not work. The page fetches
`data/entries.json`, which needs a real server, and you will get the fallback message instead
of the registry.

Add `--lan` to bind all interfaces and test from a phone on the same Wi-Fi:

```bash
python3 serve.py --lan
```

## Contributing an entry

### What gets in

The bar is evidence, not importance. An entry needs at least one primary source: a paper,
a formal proof artifact, a lab publication, or a verifiable repository. A press article about
a result is a secondary source, useful as context but not sufficient on its own.

Negative results belong here. A claim that turned out to be already known, or that was
disputed or refuted, is not a failure of the registry. It is the reason the registry is
trustworthy. Entries graded `known`, `disputed`, and `refuted` are as welcome as `formal` ones.

### The two grades

Every entry carries two independent grades, defined in full in [SCHEMA.md](SCHEMA.md):

- **`verification`**: how solid is the result. `formal` down to `refuted`.
- **`autonomy`**: how much the AI actually did. `autonomous` down to `retrieval`.

Grade both conservatively. When a grade is arguable, take the weaker reading and explain the
tension in `caveats`. A registry that overstates once is harder to trust than one that
understates routinely.

### The novelty check is mandatory

Every entry needs a `novelty_check` describing what you searched and what came back, **including
when it comes back clean**. This is the single field that separates the registry from a
press-release aggregator. An entry without one will be sent back.

Record the actual searches. "Searched MathSciNet and arXiv for prior constructions in dimension
3; nearest prior work is Wang 1980, which handles the degree-2 case only" is a novelty check.
"Appears novel" is not.

### Steps

1. Read [SCHEMA.md](SCHEMA.md) in full. It defines every field and both grade scales.
2. Fork the repo and branch: `git checkout -b entry/short-name`
3. Add one object to [data/entries.json](data/entries.json). Match the surrounding formatting.
   Use `YYYY-MM-DD-short-name` for `id`, and never reuse an `id`.
4. Run the site locally and confirm your entry renders, filters, and expands correctly.
5. Commit and open a pull request.

You do **not** need to regenerate the feeds. `feed.xml` and `feed.json` are rebuilt
automatically when your PR merges. Leave them alone in your diff; a PR that hand-edits them
will conflict.

### Correcting or challenging an existing entry

**Never delete an entry.** If a result is overturned or was overstated, downgrade its
`verification`, add the objection to `caveats`, and cite the source that changed the picture.
The git history is the credibility mechanism, and quiet edits destroy it.

To contest an entry's novelty, open a pull request that downgrades it to `known` and cites the
prior work. Include the specific reference, not a general claim that it existed. Refutation is
objective and reviewable, which is exactly the kind of contribution that scales well.

## Contributing code

The site is deliberately plain: static files at the repo root, no framework, no build step, no
external requests at runtime.

- [index.html](index.html), [methodology.html](methodology.html), [404.html](404.html): markup.
- [styles.css](styles.css): all styles.
- [app.js](app.js): all behaviour.

Things to preserve when changing code:

- **No external requests.** Fonts are self-hosted, charts are hand-built HTML/CSS/SVG, and there
  is no chart library or CDN. If you add an external resource you must also widen the matching
  Content-Security-Policy directive in [vercel.json](vercel.json), and you should expect to be
  asked why it is worth the dependency.
- **Accessibility.** The site targets WCAG 2.1 AA. Keep focus rings visible, keep heading order
  intact, keep charts labelled, and honour `prefers-reduced-motion` and `prefers-contrast`.
- **Both themes.** Every visual change must work in light and dark.
- **Responsive down to 320px.** Check 320, 560, and 720 widths.

## Pull request flow

1. Branch from `main`. Never commit to `main` directly.
2. Push your branch and open a PR.
3. **Vercel builds a preview deployment for every PR** and posts the URL as a comment. Use it to
   check your change live, and expect reviewers to do the same.
4. A maintainer reviews the diff and the preview.
5. On merge, production deploys automatically and the feeds regenerate.

Keep pull requests focused. One entry, or one code change, per PR. A PR that adds an entry and
also restyles the header is harder to review than two PRs, and it will be slower to land.

Write commit messages that say what changed and why. The history is a public record of how the
registry evolved, and it is read.

## Editorial rules that do not drift

These are not negotiable in review:

1. Lab announcements enter at `claimed`, no matter how confident the blog post is.
2. Never delete an entry. Downgrade `verification` and add `caveats`.
3. A novelty check gets written for every entry, including when it comes back clean.
4. A claim with no reproducible artifact caps at `claimed`. No exceptions for well-known labs.
5. `autonomy` is graded on the strictest defensible reading of what the AI did.
6. No hype verbs in titles.

## Licensing

Contributions are accepted under the project's dual license: registry data and editorial content
under **CC BY 4.0**, site code under **MIT**. See [LICENSE](LICENSE). By opening a pull request you
agree your contribution ships under those terms.
