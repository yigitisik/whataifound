-- Phase 3: proposals, and the pull requests they become.
--
-- Run after 002_signals.sql. Idempotent, like the others.
--
-- A proposal is a contribution submitted through the UI instead of through a fork. It
-- is NOT a second way to change the registry: it opens a pull request against
-- data/entries.json and a maintainer reviews and merges it exactly as they would one
-- that arrived from GitHub. Both doors ask the same questions, and both end at the same
-- review. Git stays the source of truth and the audit trail.
--
-- What this table is for, then, is the part git cannot hold: who submitted a thing
-- before it was accepted, and what happened to it. A rejected proposal never reaches
-- the repository, so without this row the submitter would watch their work vanish.

create table if not exists proposals (
  id           uuid primary key default gen_random_uuid(),

  -- Deleting an account deletes its proposals, matching the promise on /privacy. Credit
  -- for anything already merged survives in data/entries.json, which is public, CC BY
  -- and mirrored by anyone who cloned it: that is a statement about who did a piece of
  -- work, not personal data the registry can retract.
  account_id   uuid not null references accounts(id) on delete cascade,

  kind         text not null
               check (kind in ('check','challenge','entry','correction')),

  -- Null only for kind='entry', which proposes an id rather than referring to one.
  -- Not a foreign key, for the same reason signals.entry_id is not: entries live in git.
  entry_id     text,

  -- The submission itself, shaped per kind by api/_lib/proposals.js. Stored whole so a
  -- maintainer reviewing a rejection months later sees what was actually submitted,
  -- not a summary of it.
  payload      jsonb not null,

  status       text not null default 'pending'
               check (status in ('pending','pr_open','merged','rejected','needs_info')),

  -- Filled once the bot has opened the pull request. Null while pending, and null
  -- forever on a proposal rejected before it ever became one.
  pr_number    integer,
  pr_url       text,

  -- Who decided, and what they said. The note is shown back to the submitter on
  -- /account: a rejection with no reason is the fastest way to lose a contributor.
  decided_by   uuid references accounts(id) on delete set null,
  decided_note text,
  decided_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The two read paths: one contributor's history, newest first, and the maintainer queue.
create index if not exists proposals_account_idx on proposals (account_id, created_at desc);
create index if not exists proposals_pending_idx on proposals (created_at)
  where status in ('pending','needs_info');
create index if not exists proposals_entry_idx on proposals (entry_id)
  where entry_id is not null;

alter table proposals drop constraint if exists proposals_entry_shape;
alter table proposals add constraint proposals_entry_shape
  check (entry_id is null
         or (entry_id ~ '^[a-z0-9][a-z0-9._-]*$' and length(entry_id) between 3 and 80));

-- An entry proposal carries its subject inside the payload; every other kind is about an
-- entry that already exists and is meaningless without one.
alter table proposals drop constraint if exists proposals_entry_required;
alter table proposals add constraint proposals_entry_required
  check (kind = 'entry' or entry_id is not null);

-- A decision has to say who made it. Guards against a status moved by a stray update
-- rather than through the admin path, which is the only thing that sets these together.
alter table proposals drop constraint if exists proposals_decided_shape;
alter table proposals add constraint proposals_decided_shape
  check (status in ('pending','pr_open') or decided_at is not null);

-- ---------------------------------------------------------------------------
-- Contribution stats, derived rather than counted.
--
-- /account shows "3 of 4 checks accepted". Storing those numbers on accounts would mean
-- two places that can disagree, and the one that is wrong is the one a person reads
-- about their own work. This view is the single definition, and GOVERNANCE.md's
-- reviewer bar is computed from it.
--
-- Note what counts as accepted: merged, and nothing else. A pull request that is open
-- is not a contribution yet, which is the same standard the project applies to itself.
create or replace view account_stats as
select a.id as account_id,
       count(*) filter (where p.kind = 'check')                          as checks_submitted,
       count(*) filter (where p.kind = 'check' and p.status = 'merged')  as checks_accepted,
       count(*) filter (where p.kind = 'entry' and p.status = 'merged')  as entries_merged,
       count(*) filter (where p.kind = 'challenge' and p.status = 'merged') as challenges_upheld,
       count(*) filter (where p.status = 'merged')                       as merged_total
  from accounts a
  left join proposals p on p.account_id = a.id
 group by a.id;

-- Same reasoning as the other two tables: on, with no policy, because there is no
-- browser client. See db/001_accounts.sql.
alter table proposals enable row level security;
