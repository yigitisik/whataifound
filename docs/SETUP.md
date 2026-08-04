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

**a. Create the table.** SQL Editor → paste [`db/001_accounts.sql`](../db/001_accounts.sql)
→ Run. It is idempotent, so re-running it is safe.

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

## Wiring it up

Locally, copy `.env.example` to `.env.local` and fill in the four values. `.env*` is
gitignored apart from the example.

```bash
npm install
npm run dev          # vercel dev: static site plus /api on one origin
npm test             # the pure logic: session signing, handles, redirect safety
```

On Vercel, Project Settings → Environment Variables, the same four names, set for
Production and Preview:

| Name | From |
|---|---|
| `GOOGLE_CLIENT_ID` | step 1 |
| `GOOGLE_CLIENT_SECRET` | step 1 |
| `DATABASE_URL` | step 2b, the pooler URL |
| `SESSION_SECRET` | step 3 |
| `SITE_ORIGIN` | `https://whataifound.org` (omit on preview to use the preview's own origin) |

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

## What is not built yet

`/account` renders its stats and contributions from `/api/me`, which returns zeroes and an
empty list until Phases 2 and 3 land (signals, and proposals that become pull requests).
The shape is there so the page does not have to be rebuilt when the data arrives.
`/u/<handle>` is Phase 5; the `is_public` switch on the settings form stores the reader's
choice now so that nobody has to be asked twice later.
