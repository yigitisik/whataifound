-- Phase 2: triage signals.
--
-- Run after 001_accounts.sql. Idempotent, like the others.
--
-- What a signal is: one reader saying "this entry needs attention", in one of three
-- fixed ways. What a signal is NOT, and this is the whole design:
--
--   * It never enters data/entries.json. Nothing here is published.
--   * It never renders as a score on an entry, and never moves a grade. GOVERNANCE.md
--     says grades move on evidence and never on opinion, and a click is an opinion.
--   * It orders the review queue. That is the entire effect.
--
-- Two things follow from that. A sybil attack buys nothing but a reordered task list,
-- which is why signals can be cheap and open while proposals are reviewed. And a click
-- does not rebuild the site, because the committed HTML does not depend on this table.

create table if not exists signals (
  account_id uuid not null references accounts(id) on delete cascade,

  -- The entry id from data/entries.json. Deliberately not a foreign key: entries live
  -- in git, not here, and a database that could constrain them would be a database the
  -- registry depends on. The API validates against the generated allowlist in
  -- api/_lib/registry.js instead, so an id that is not in the registry never arrives.
  entry_id   text not null,

  kind       text not null check (kind in ('needs-check','looks-wrong','dead-link')),
  created_at timestamptz not null default now(),

  -- The no-double-voting rule, written as a constraint rather than as code. The toggle
  -- endpoint is therefore idempotent by construction: a duplicate POST cannot inflate a
  -- count even if it races with itself.
  primary key (account_id, entry_id, kind)
);

-- The read path is "counts for one entry" and "counts for every entry", both grouped by
-- entry then kind.
create index if not exists signals_entry_idx on signals (entry_id, kind);

-- Shape check, mirroring the id pattern in docs/entry.schema.json. The allowlist in the
-- API is the real gate; this stops a malformed id arriving by any other route.
alter table signals drop constraint if exists signals_entry_shape;
alter table signals add constraint signals_entry_shape
  check (entry_id ~ '^[a-z0-9][a-z0-9._-]*$' and length(entry_id) between 3 and 80);

-- Deleting an account deletes its signals, which the cascade above already does. Worth
-- stating explicitly because it is a privacy commitment on /privacy, not just a
-- referential-integrity convenience.

-- Same reasoning as accounts: on, with no policy, because there is no browser client.
-- See db/001_accounts.sql for the full argument.
alter table signals enable row level security;
