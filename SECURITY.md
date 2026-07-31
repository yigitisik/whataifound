# Security

## Reporting a vulnerability

Report privately through
[GitHub's advisory form](https://github.com/yigitisik/whataifound/security/advisories/new),
or by email to misik6@gatech.edu. Please do not open a public issue for anything exploitable.

Say what you found, how to reproduce it, and what it lets an attacker do. You will get an
acknowledgement within a few days, and credit in the fix unless you would rather not have it.

## What counts here

This is a static site with no server-side code, no database, and no user accounts, so the usual
categories mostly do not apply. There is nothing to authenticate as and nothing to log into.

The real threat model is **the contributed entry**. Anyone can open a pull request that adds text
and URLs to `data/entries.json`, and that content is rendered into HTML on the site. So the
interesting attacks are:

- Markup smuggled through an entry field into the built pages.
- A URL with an executable scheme (`javascript:`, `data:`) reaching an `href`, which matters
  because the CSP allows `'unsafe-inline'`.
- A payload placed in the hand-written regions of a generated file, where a rebuild would not
  overwrite it and the diff would look clean.
- Anything that gets a workflow to run contributor-supplied code with a write token.

If you find a way past the defences below, that is a report worth making.

## What defends against it

| Layer | Where |
|---|---|
| Entry text is escaped at render; URL schemes are validated at build | `validate()` and `check_urls()` in `scripts/build-site.py` |
| Deployed HTML is asserted to contain no unexpected inline scripts, off-allowlist script or frame origins, inline event handlers, executable URL schemes, or `<base>`/`<object>`/`<embed>`/`<form>` | `scripts/check-integrity.py` |
| The integrity check runs **before** the rebuild in CI, so tampering in a fully generated file cannot be overwritten and hidden | `.github/workflows/build.yml` |
| Committed output must reproduce exactly from `data/entries.json` | rebuild-and-diff step in `build.yml` |
| A strict CSP: no external API calls, no third-party frames except YouTube, no remote images, no forms | `vercel.json` |
| Workflows that check out PR code hold `contents: read` only. The one workflow with a write token never checks out or executes PR code | `build.yml`, `links.yml`, `comment.yml` |

## Out of scope

- Dead or redirected source links. Those are a data-quality issue; `scripts/check-links.py` covers
  them and a broken one is worth an ordinary issue.
- Disagreement with a grade. That is editorial, not security. Use the
  [grade challenge](https://github.com/yigitisik/whataifound/issues/new?template=grade-challenge.yml)
  form.
- Reports from automated scanners with no demonstrated impact on this site.
