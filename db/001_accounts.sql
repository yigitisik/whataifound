-- Phase 1: accounts.
--
-- Run once against the Supabase project (SQL editor, or psql against DATABASE_URL).
-- Numbered so later phases (signals, proposals, audit) append rather than edit.
--
-- What this database is NOT: it is not the registry. data/entries.json remains the
-- single source of truth for everything the site publishes, and git remains the audit
-- trail. Postgres holds accounts, and later the pending work and the triage signals.
-- Nothing in here is load-bearing for what a reader sees on a finding page.

create table if not exists accounts (
  id               uuid primary key default gen_random_uuid(),

  -- Google's subject claim: stable for the life of the Google account, and the only
  -- identifier we trust for "is this the same person". Email is deliberately NOT the
  -- key: a Google Workspace address can be reassigned to a different human.
  google_sub       text not null unique,

  -- Kept for account recovery and abuse handling. Never published, never returned by
  -- any endpoint a signed-out reader can call, and deleted with the account.
  email            text not null,

  -- The public identifier. Generated on signup from a curated wordlist (see
  -- api/_lib/handles.js) so a new account is never unnamed, and never leaks the
  -- person's real name by default.
  handle           text not null unique,
  handle_changed_at timestamptz,

  -- Seeded from Google's `name` claim, editable, and shown only where the reader has
  -- opted in. A handle is always safe to show; this may be a real name.
  display_name     text,

  -- The credential that actually carries weight in a science registry. Optional,
  -- self-asserted at this stage, and stored in the canonical 0000-0000-0000-0000 form.
  orcid            text,
  github_login     text,

  -- Off by default. Phase 1 stores it; /u/<handle> in a later phase reads it.
  is_public        boolean not null default false,

  -- Mirrors the ladder in GOVERNANCE.md. Only a maintainer can change it, and only
  -- through the admin path; nothing user-facing writes this column.
  role             text not null default 'reader'
                   check (role in ('reader','contributor','reviewer','maintainer')),

  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  -- Set rather than deleted, so a banned account cannot simply sign up again into the
  -- same google_sub and find its history gone.
  banned_at        timestamptz
);

-- Handles are compared case-insensitively: patient-lemma and Patient-Lemma are the same
-- name, and letting both exist is a phishing surface on a page that credits people.
create unique index if not exists accounts_handle_lower_idx on accounts (lower(handle));
create index if not exists accounts_role_idx on accounts (role) where role <> 'reader';

-- Handle shape, enforced here as well as in the API: lowercase, digits and single
-- hyphens, 3 to 30 characters, no leading or trailing hyphen. The API owns the
-- reserved-word list; this owns the shape, so a bad handle cannot arrive by any route.
alter table accounts drop constraint if exists accounts_handle_shape;
alter table accounts add constraint accounts_handle_shape
  check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(handle) between 3 and 30);

-- ORCID is 16 digits in four groups; the final character may be an X checksum.
alter table accounts drop constraint if exists accounts_orcid_shape;
alter table accounts add constraint accounts_orcid_shape
  check (orcid is null or orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$');

-- Row level security is on, and no policy is created on purpose. Every query runs from
-- a Vercel function using the pooler credentials, which bypass RLS; there is no browser
-- client and no anon key, so an accidental policy would be the only way a row could be
-- read directly. Authorization lives in the API, next to the session that proves who is
-- asking. If a later phase ever exposes PostgREST to a browser, policies go here first.
alter table accounts enable row level security;
