# Security

## Reporting a vulnerability

Report privately through
[GitHub's advisory form](https://github.com/yigitisik/whataifound/security/advisories/new),
or by email to misik6@gatech.edu. Please do not open a public issue for anything exploitable.

Say what you found, how to reproduce it, and what it lets an attacker do. You will get an
acknowledgement within a few days, and credit in the fix unless you would rather not have it.

## What there is to attack

The registry itself is static: pre-rendered HTML generated from `data/entries.json`, which
is the single source of truth and lives in git. Beside it runs a small server side, and
that is where most of the interesting surface is:

- **Sign-in.** Google OpenID Connect, spoken directly by the functions under `api/auth/`.
  The session is a signed `HttpOnly` cookie; nothing is kept in the browser's storage.
- **A Postgres database** holding accounts (including email addresses, never published),
  triage signals and pending submissions. None of it is load-bearing for what a reader
  sees: delete it and the site is what it was, minus sign-in.
- **`/admin`**, where maintainers review submissions made through the site. It renders
  other people's text in a maintainer's session.
- **A GitHub App** that, on a maintainer's approval, pushes a `submission/<uuid>` branch
  changing `data/entries.json` and opens a pull request. Its credential can write to this
  repository.
- **CI**, which builds contributors' pull requests and posts a summary on them with a
  write-scoped token.

So the attacks worth reporting include:

- Getting a session you should not have: forging, replaying or fixing one, or keeping one
  alive after sign-out.
- Reading another account's data, or anyone's email address.
- Reaching `/admin` or its actions without the maintainer role.
- Script execution on the site: markup smuggled through an entry field or a submission
  into a built page, the admin queue or a profile; an executable URL reaching an `href`;
  a payload in a hand-written region of a page that a rebuild would not overwrite.
- An open redirect, especially through the sign-in round trip.
- Using the GitHub App to change anything other than `data/entries.json`, or to reach
  `main` without a reviewed merge.
- Anything that gets a workflow to run contributor-supplied code with a write token, or
  lets one pull request change what the bot says on another.

## What defends against it

| Layer | Where |
|---|---|
| Entry text is escaped at render; URL schemes are validated at build | `validate()` and `check_urls()` in `scripts/build-site.py` |
| Every root page and every generated page is asserted to contain no inline script the CSP does not list by hash, no off-allowlist script or frame origin, no inline event handler, no executable URL scheme, and no `<base>`/`<object>`/`<embed>` or `<form action>` | `scripts/check-integrity.py` |
| The integrity check runs **before** the rebuild in CI, so tampering in a fully generated file cannot be overwritten and hidden | `.github/workflows/build.yml` |
| Committed output must reproduce exactly from `data/entries.json` | rebuild-and-diff step in `build.yml` |
| CSP: inline scripts by sha256 only (no `'unsafe-inline'`), no inline handlers, no external API calls, no third-party frames except YouTube, no remote images, forms post only to this origin | `vercel.json` |
| Session cookies are HMAC-signed, typed (a sign-in state cookie cannot stand in for a session), expire server side, and are revoked on sign-out through a per-account version | `api/_lib/session.js`, `db/004_hardening.sql` |
| Sign-in uses state and PKCE and requires a verified email; the return address must parse to a same-origin path | `api/auth/`, `safeReturnTo()` in `api/_lib/http.js` |
| Roles are read from the database on every admin request; banned accounts are refused on every write | `api/_lib/roles.js` |
| Every query is parameterised; row level security is on with no policies, and the database's own API roles hold no grants | `api/`, `db/` |
| Submitted text reaches a pull request only as quoted code, so it cannot mention anyone, link an issue or hide markup | `proposalBody()` in `api/_lib/proposals.js` |
| A handle that appears on a pull request or a merged credit is retired and cannot be claimed by anyone else | `db/004_hardening.sql` |
| A submission branch that changes any file but `data/entries.json` is refused; the App cannot edit workflows | `.github/workflows/rebuild-bot.yml`, `docs/SETUP.md` |
| Workflows that check out PR code hold `contents: read` only. The one that comments holds a write token, runs from the base branch, executes no PR code, finds the PR through the API rather than trusting the build's artifact, and says above its report when the PR changes code | `build.yml`, `links.yml`, `comment.yml` |
| Third-party actions are pinned to commit SHAs | `.github/workflows/` |

Some of the defences are settings rather than code, and are documented in
[`docs/SETUP.md`](docs/SETUP.md): previews get no production credentials, fork pull
requests do not deploy until a maintainer authorises them, and `main` accepts changes only
through a reviewed merge, from the App as from anyone.

If you find a way past any of these, that is a report worth making.

## Out of scope

- Dead or redirected source links. Those are a data-quality issue; `scripts/check-links.py`
  covers them and a broken one is worth an ordinary issue.
- Disagreement with a grade. That is editorial, not security. Use the
  [grade challenge](https://github.com/yigitisik/whataifound/issues/new?template=grade-challenge.yml)
  form.
- Self-reported ORCID iDs and GitHub usernames on accounts. They are labelled as such
  wherever they appear, and confirmed by a maintainer before a credit carrying one merges.
- Reports from automated scanners with no demonstrated impact on this site.
