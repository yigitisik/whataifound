# Setting up accounts

The static site needs none of this. It builds, deploys and serves exactly as it did
before; the account control in the header simply stays on "Sign in" and the sign-in link
returns a plain "not configured" message. Everything below is only for turning accounts on.

Three external things have to exist, and all three need someone with the project's
accounts to create them. There is no way to script this.

---

## 1. Google OAuth client

[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → **Create credentials** → **OAuth client ID**.

- Application type: **Web application**
- Authorised redirect URIs, all three:
  - `https://whataifound.org/api/auth/callback`
  - `http://localhost:3000/api/auth/callback` (for `vercel dev`)
  - your Vercel preview domain, if you want sign-in on previews

On the OAuth consent screen, request only `openid`, `email` and `profile`. Those three
need no Google verification review. Anything more does, and the site does not use it.

Keep the **client ID** and **client secret**.

---

## 2. Supabase project

[supabase.com](https://supabase.com) → New project. Then:

**a. Create the tables.** SQL Editor → paste each file in [`db/`](../db/) in number order
and run it. All of them are idempotent, so re-running one is safe.

| File | What it adds |
|---|---|
| `001_accounts.sql` | Accounts. Sign-in needs this and nothing else. |
| `002_signals.sql` | The three triage signals on a finding page. |
| `003_proposals.sql` | Submissions, and the `account_stats` view the profile reads. |

Running only 001 gives you a working sign-in; the signal buttons and the contribution
list stay empty rather than erroring, because the endpoints that read those tables
degrade instead of failing.

**b. Get the connection string.** Project Settings → Database → Connection string →
**Transaction pooler** (port 6543).

> Use the pooler, not the direct connection. A serverless function opens a new connection
> on every cold start, and a direct Postgres runs out of them long before the traffic
> becomes interesting. `api/_lib/db.js` also sets `prepare: false`, which the transaction
> pooler requires.

---

## 3. Session secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Rotating this signs every existing session out, which is the intended emergency lever.

---

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

---

## Wiring it up

Locally, copy `.env.example` to `.env.local` and fill it in. `.env*` is gitignored apart
from the example.

```bash
npm install
npm run dev          # vercel dev: static site plus /api on one origin
npm test             # the pure logic: session signing, handles, payload rules, redirect safety
```

On Vercel, Project Settings → Environment Variables, set for Production and Preview:

| Name | From | Required |
|---|---|---|
| `GOOGLE_CLIENT_ID` | step 1 | yes |
| `GOOGLE_CLIENT_SECRET` | step 1 | yes |
| `DATABASE_URL` | step 2b, the pooler URL | yes |
| `SESSION_SECRET` | step 3 | yes |
| `SITE_ORIGIN` | `https://whataifound.org` (omit on preview to use the preview's own origin) | yes |
| `GH_APP_ID` | step 4 | no |
| `GH_APP_PRIVATE_KEY` | step 4, the whole `.pem` | no |
| `GH_INSTALLATION_ID` | step 4 | no |
| `GH_REPO` | `yigitisik/whataifound` | no |

## Making yourself a maintainer

`/admin` is maintainer-only, and nothing user-facing writes `accounts.role`: there is no
API to grant a role, deliberately. Sign in once so the row exists, then in the SQL editor:

```sql
update accounts set role = 'maintainer' where handle = 'your-handle';
```

The same statement is how anyone else is promoted, which is what GOVERNANCE.md's ladder
describes. A `reader` who guesses the `/admin` URL gets a 404, not a 403, so the page
cannot be used to find out who holds which role.

---

## "Sign-in is not configured on this deployment."

The first thing most people hit. `/api/auth/start` returns this 503 when
`GOOGLE_CLIENT_ID` is not set **in the deployment that is currently serving the domain**,
which is not the same question as whether it is set in the project settings.

**Vercel injects environment variables at deploy time. Adding one does not redeploy.**
The production domain keeps serving the deployment built before you added it, so a
correctly-set variable still reads as absent until you redeploy:

```bash
vercel env ls        # confirm the name, and the Environment column
vercel --prod        # redeploy so the running deployment picks it up
```

If it persists, work down this list:

| Check | How |
|---|---|
| Set for **Production**, not only Preview or Development | the Environment column in `vercel env ls` |
| Named exactly `GOOGLE_CLIENT_ID` | no `NEXT_PUBLIC_` prefix, no trailing space |
| The redirect URI is registered with Google | must be exactly `https://<your-domain>/api/auth/callback` |

Two things worth knowing while you debug.

**The check is ordered, so one missing variable can mask another.** `api/auth/start.js`
tests `GOOGLE_CLIENT_ID` before it signs the flow cookie, so while that 503 is showing you
cannot tell whether `SESSION_SECRET` is set. If it is missing or shorter than 32
characters, `api/_lib/session.js` throws and sign-in fails with a 500 at the callback
instead. Confirm all five together rather than one at a time.

**Other endpoints tell you which variables did arrive**, without exposing any of them:

```bash
curl -s https://<your-domain>/api/me        # {"signedIn":false}  -> functions run at all
curl -s https://<your-domain>/api/signals   # no "degraded" flag  -> DATABASE_URL works
curl -so /dev/null -w '%{http_code}\n' \
     "https://<your-domain>/api/auth/start" # 302 -> fixed;  503 -> still missing
```

`/api/signals` answering with `"degraded": true` means the database is unreachable;
answering without it means the query succeeded.

---

## Checking it works

1. Load any page. The header shows a person icon at the far right of the masthead.
2. Click it. You should land on Google's account chooser, then come back to the page you
   started on, with an identicon in place of the icon.
3. Open `/account`. Your generated handle is two words, something like `patient-lemma`.
4. In the browser console, `document.cookie` must **not** contain `waf_session` or
   `waf_oauth`: both are `HttpOnly`, and if you can see either, something is wrong.
5. In the network tab, confirm the only origins contacted are this site and Vercel's
   analytics. There should be no request to Google or Supabase from the browser: the whole
   OAuth exchange happens server-side, which is what keeps the CSP at `connect-src 'self'`.
6. Change your handle, save, reload. Change it again: it should be refused with a date,
   because renames are limited to one per 30 days.
7. Delete the account. The row goes; you are signed out and returned to the registry.

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

And the guard that makes the bot path safe, which is worth testing once by hand:

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
| Everything | The static site is exactly what it was. The header shows "Sign in", which reports that accounts are not configured. |
| `db/002` | Signal buttons stay hidden. The review queue is its ordinary evidence-ordered list. |
| `db/003` | `/account` shows zeroes and no contributions. Submitting reports the queue is unavailable. |
| GitHub App | `/admin` works, and says approving cannot open a pull request. |
