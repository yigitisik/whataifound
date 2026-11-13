# Contributing

There are two main ways:

- **No GitHub needed:** use [whataifound.org/contribute](https://whataifound.org/contribute) to
  propose an entry, submit a check, challenge a grade or fix a link.
- **Pull request:** for several entries at once, or any change to code, styles or docs.

Either way, nothing goes live until a maintainer merges a pull request.

## Add or fix an entry

```bash
git clone https://github.com/yigitisik/whataifound.git && cd whataifound
npm ci                         # needed so the build can minify scripts
# edit data/entries.json (field definitions: docs/SCHEMA.md)
python3 scripts/build.py       # validates, then regenerates the site
python3 scripts/serve.py       # preview at http://localhost:8000
```

Commit `data/entries.json` and everything the build regenerated, then open a PR. If the build
stops, its message says what to fix.

Every entry needs:

- at least one `research` source (the paper, preprint, proof or code) for any grade above `claimed`;
- a `novelty_check` naming the database and query you searched, even when nothing turned up;
- the weaker grade whenever the evidence is arguable, with the reason in `caveats`.

Never delete an entry. If it turns out wrong or already known, downgrade it and explain why in
`caveats`.

## Change code

Edit the source files (`js/*.src.js`, `styles.src.css`, `scripts/`), run `python3 scripts/build.py`,
and run `npm test` if you touched `api/`. Never hand-edit generated files; the list is in the
[README](../README.md). The build enforces the rest, including:

- no em dashes anywhere, commit messages included;
- no requests to outside servers, no inline event handlers, no `action` on a form;
- changes to `card()` and the other renderers made in both `js/app.src.js` and `scripts/build-site.py`.

Do not commit AI-tool working files (configs, transcripts, caches).

## Review a PR

CI checks the format. A reviewer checks the truth:

- Open every primary source and confirm it says what the entry says.
- Check the grades against the evidence, not the summary. When in doubt, the weaker grade wins.
- Check that a `research` source really is the work itself, not a press release.
- Be suspicious of any upgrade or softened caveat that cites no new evidence.
- An entry PR should touch only `data/entries.json` and generated files.
- Confirm a self-reported ORCID or GitHub username before merging a credit that carries it.

More detail: [SCHEMA.md](SCHEMA.md) for fields and grades, [ARCHITECTURE.md](ARCHITECTURE.md)
for how the code fits together, [GOVERNANCE.md](../GOVERNANCE.md) for roles.
