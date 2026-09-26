# Setting up accounts

The static site needs none of this. Without it the header keeps showing the Google door
and it returns a plain "not configured" message. Everything below is only for
turning accounts on, and all of it needs someone with the project's accounts.

## 1. Google OAuth client

[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → **Create credentials** → **OAuth client ID**.

- Application type: **Web application**
- Authorised redirect URIs, all three:
  - `https://whataifound.org/api/auth/callback`
  - `http://localhost:3000/api/auth/callback` (for `vercel dev`)
  - your Vercel preview domain, if you want sign-in on previews. Use a **second OAuth
    client** for that rather than this one: a preview runs the branch's own code, and
    its secret should not be the one production signs in with.

On the OAuth consent screen, request only `openid`, `email` and `profile`. Those three
need no Google verification review. Anything more does, and the site does not use it.

Keep the **client ID** and **client secret**.

## 2. Supabase project

[supabase.com](https://supabase.com) → New project. Then:

**a. Create the tables.** SQL Editor → paste each file in [`db/`](../db/) in number order
and run it. All of them are idempotent, so re-running one is safe.

| File | What it adds |
|---|---|
| `001_accounts.sql` | Accounts. Sign-in needs this and nothing else. |
| `002_signals.sql` | The three triage signals on a finding page. |
| `003_proposals.sql` | Submissions, and the `account_stats` view the profile reads. |
| `004_hardening.sql` | Revocable sessions, permanently retired credited handles, and no access through Supabase's Data API. |

Running only 001 gives you a working sign-in; the signal buttons and the contribution
list stay empty rather than erroring, because the endpoints that read those tables
degrade instead of failing.

**004 is the exception, and has a deploy order.** The functions read
`accounts.session_version` on every signed-in request, so run `004_hardening.sql` before
deploying code that expects it; the other way round, signed-in requests answer 503 until
you do. Everyone already signed in is signed out once when that code ships, because
session cookies now carry a type and a version that older ones lack.

**Leave the Data API unused.** Nothing in this project talks to Supabase's REST or GraphQL
endpoints; every query runs from a function over `DATABASE_URL`. `004` revokes the `anon`
and `authenticated` roles' access to every table and view, and it is worth also turning
the Data API off (Project Settings → Data API), since the anon key Supabase generates is
treated as public.

**b. Get the connection string.** Project Settings → Database → Connection string →
**Transaction pooler** (port 6543).

> Use the pooler, not the direct connection. A serverless function opens a new connection
> on every cold start, and a direct Postgres runs out of them long before the traffic
> becomes interesting. `api/_lib/db.js` also sets `prepare: false`, which the transaction
> pooler requires.

## 3. Session secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Rotating this signs every existing session out, which is the intended emergency lever.
Signing out also retires every session that one account holds, on every device, by bumping
`accounts.session_version`; to do that for someone else, run
`update accounts set session_version = session_version + 1 where handle = '...'`.

Generate a **separate** secret for Preview (see below). Anyone who holds this value can
mint a session for any account, maintainers included.

## 4. GitHub App, for the submission bot

**Optional.** Skip it and everything still works except one thing: approving a submission
in `/admin` cannot open a pull request, and the page says so at the top rather than
failing at the click. Signing in, signals, submitting and rejecting all work without it.

[github.com/settings/apps](https://github.com/settings/apps) → **New GitHub App**.

- Homepage URL: `https://whataifound.org`
- Webhook: **uncheck Active**. The site polls pull request state when a maintainer opens
  the queue; a webhook would be a second public endpoint to authenticate for a status
  that changes a few times a week.
- Repository permissions, and only these two:

| Permission | Access | Why |
|---|---|---|
| Contents | Read and write | Push the `submission/<id>` branch |
| Pull requests | Read and write | Open the pull request, read whether it merged |

> Do **not** grant Actions, Workflows or Administration. The branch this App pushes is
> rebuilt by [`.github/workflows/rebuild-bot.yml`](../.github/workflows/rebuild-bot.yml),
> which refuses a submission branch that touches anything but `data/entries.json`. An App
> that could edit workflows could rewrite the check that constrains it.

Then: **Generate a private key** (downloads a `.pem`), and **Install App** on this
repository only. The installation id is the number at the end of the URL you land on.

**Protect `main` from the App.** Contents write lets it push to any branch, and
`rebuild-bot.yml` only guards `submission/**`. Settings → Rules → Rulesets → new branch
ruleset targeting the default branch: require a pull request before merging, require the
`verify` status check, block force pushes, and leave the App **off** the bypass list. A
submission then reaches `main` only the way any other change does, through a reviewed
merge.

## Wiring it up

Locally, copy `.env.example` to `.env.local` and fill it in. `.env*` is gitignored apart
from the example.

```bash
npm install
npm run dev          # vercel dev: static site plus /api on one origin
npm test             # the pure logic: session signing, handles, payload rules, redirect safety
```

On Vercel, Project Settings → Environment Variables. **Production and Preview get
different values, and some get none on Preview at all.** A preview deployment runs the
branch's own `api/` code, and that includes a fork's pull request once someone authorises
its deployment. Whatever Preview is given, a hostile branch can read. With production's
values it could mint a session for any account, read and write every row including
people's email addresses, and push to the repository as the App.

| Name | From | Production | Preview |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | step 1 | yes | only a second OAuth client's, if you want sign-in on previews |
| `GOOGLE_CLIENT_SECRET` | step 1 | yes | as above |
| `DATABASE_URL` | step 2b, the pooler URL | yes | only a **separate** Supabase project's |
| `SESSION_SECRET` | step 3 | yes | only a **different** value |
| `SITE_ORIGIN` | `https://whataifound.org` | yes | never: previews use their own origin |
| `GH_APP_ID` | step 4 | optional | **never** |
| `GH_APP_PRIVATE_KEY` | step 4, the whole `.pem` | optional | **never** |
| `GH_INSTALLATION_ID` | step 4 | optional | **never** |
| `GH_REPO` | `yigitisik/whataifound` | optional | **never** |

With nothing set on Preview, a preview is the static site with the header reporting that
accounts are not configured, which is all a reviewer needs from it.

Also keep **Git Fork Protection** on (Project Settings → Git). It is what stops a fork's
pull request from deploying before someone has read it. Authorise a fork's preview only
after reading its changes to `api/`, and not at all for a first-time contributor's.

## Making yourself a maintainer

`/admin` is maintainer-only, and nothing user-facing writes `accounts.role`: there is no
API to grant a role, deliberately. Sign in once so the row exists, then in the SQL editor:

```sql
update accounts set role = 'maintainer' where handle = 'your-handle';
```

The same statement promotes anyone else, which is what GOVERNANCE.md's ladder describes.
A `reader` who guesses the `/admin` URL gets a 404, not a 403, so the page cannot be used to
find out who holds which role.

## "Sign-in is not configured on this deployment."

The first thing most people hit. `/api/auth/start` returns this 503 when
`GOOGLE_CLIENT_ID` is not set **in the deployment currently serving the domain**, which is
not the same question as whether it is set in the project settings.

**Vercel injects environment variables at deploy time. Adding one does not redeploy.** The
domain keeps serving the deployment built before you added it, so a correctly-set variable
reads as absent until you redeploy:

```bash
vercel env ls        # confirm the name, and the Environment column
vercel --prod        # redeploy so the running deployment picks it up
```

If it persists, work down this list:

| Check | How |
|---|---|
| Set for **Production** | the Environment column in `vercel env ls` |
| Named exactly `GOOGLE_CLIENT_ID` | no `NEXT_PUBLIC_` prefix, no trailing space |
| The redirect URI is registered with Google | must be exactly `https://<your-domain>/api/auth/callback` |

**The check is ordered, so one missing variable can mask another.** `api/auth/start.js`
tests `GOOGLE_CLIENT_ID` before signing the flow cookie, so while that 503 shows you cannot
tell whether `SESSION_SECRET` is set. Confirm all five together, not one at a time.

**`/api/health` answers this directly.** On production it gives only the verdict, because
an itemised list of which secrets a deployment holds is a map of what to attack:

```bash
curl -s https://<your-domain>/api/health
```

```json
{
  "signInReady": false,
  "hint": "A required variable is missing from THIS deployment. ..."
}
```

`false` after you set everything is the redeploy case above. For the itemised version,
ask a preview or `vercel dev`, which add which variables the deployment received, as
booleans, never values, and the redirect URI to register with Google:

```json
{
  "signInReady": false,
  "present": {
    "GOOGLE_CLIENT_ID": false,
    "GOOGLE_CLIENT_SECRET": true,
    "DATABASE_URL": true,
    "SESSION_SECRET": true
  },
  "sessionSecretLongEnough": true,
  "redirectUri": "https://whataifound.org/api/auth/callback"
}
```

On production, `vercel env ls` answers the same question, and the redirect URI is
`https://<your-domain>/api/auth/callback`, character for character.

**Other endpoints narrow it further**, without exposing any value:

```bash
curl -s https://<your-domain>/api/me        # {"signedIn":false}  -> functions run at all
curl -s https://<your-domain>/api/signals   # no "degraded" flag  -> DATABASE_URL works
curl -so /dev/null -w '%{http_code}\n' \
     "https://<your-domain>/api/auth/start" # 302 -> fixed;  503 -> still missing
```

`/api/signals` answering with `"degraded": true` means the database is unreachable.

## Checking it works

1. Load any page. The masthead carries one bordered segment holding two marks: GitHub,
   then the Google G.
2. Click the G. You should land on Google's account chooser, then come back to the page
   you started on, with your identicon in place of the G, in the same cell.
3. Open `/account`. Your generated handle is two words, something like `patient-lemma`.
4. In the browser console, `document.cookie` must **not** contain `waf_session` or
   `waf_oauth`: both are `HttpOnly`, and if you can see either, something is wrong.
5. In the network tab, confirm the only origins contacted are this site and Vercel's
   analytics. There should be no request to Google or Supabase from the browser: the whole
   OAuth exchange happens server-side, which is what keeps the CSP at `connect-src 'self'`.
6. Change your handle, save, reload. Change it again: it should be refused with a date,
   because renames are limited to one per 30 days.
7. Sign in from a second browser, then sign out in the first. Reload the second: it should
   be signed out too.
8. Delete the account. The row goes; you are signed out and returned to the registry.

## Checking the contribution path

With the GitHub App configured, end to end:

1. Sign in as a non-maintainer and open `/contribute?kind=check&entry=<any entry id>`.
   Submit a check. `/account` shows it as **Pending**.
2. As a maintainer, open `/admin`. The submission is there with the submitter's track
   record beside it. Approve it.
3. A pull request opens on a `submission/<uuid>` branch. Confirm its diff touches
   **only** `data/entries.json`, and that `rebuild-bot.yml` then commits the regenerated
   files onto the same branch.
4. Merge it. Reopen `/admin`; the row flips to **Merged**, and the contributor appears on
   `/contributors` and on the entry.

The guard that makes the bot path safe, worth testing once by hand:

```bash
git checkout -b submission/test-guard
echo "// not allowed" >> js/app.js
git commit -am "should be refused" && git push origin submission/test-guard
```

The workflow must **fail** with "A submission branch may only change data/entries.json".
Delete the branch afterwards.

## Turning parts off

Every external dependency degrades rather than breaking the site:

| Missing | What happens |
|---|---|
| Everything | The static site is exactly what it was. The Google door in the header reports that accounts are not configured. |
| `db/002` | Signal buttons stay hidden. The review queue is its ordinary evidence-ordered list. |
| `db/003` | `/account` shows zeroes and no contributions. Submitting reports the queue is unavailable. |
| `db/004` | Not optional once the code expecting it is deployed: signed-in requests answer 503. |
| GitHub App | `/admin` works, and says approving cannot open a pull request. |
