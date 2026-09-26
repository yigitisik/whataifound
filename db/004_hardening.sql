-- Phase 4: hardening. Revocable sessions, credited handles that cannot change hands,
-- and nothing readable through Supabase's own API.
--
-- Run after 003_proposals.sql. Idempotent, like the others.
--
-- DEPLOY ORDER MATTERS FOR THIS ONE. The functions from the same commit read
-- accounts.session_version on every signed-in request, so run this file before the
-- deployment that carries them goes live. The other way round, every signed-in request
-- answers 503 until it is run. Either way every existing session is signed out once,
-- because session cookies now carry a type and a version that older ones lack.

-- ---------------------------------------------------------------------------
-- Revocable sessions.
--
-- A session cookie is a signature, and a signature cannot be taken back: a copied
-- cookie stays valid for its whole thirty days whatever happens to the original. So the
-- cookie carries the value of this column at the moment it was issued, every query that
-- trusts a session requires the two to match (sessionOf() in api/_lib/session.js), and
-- signing out adds one. That retires every cookie issued before it, on every device.
alter table accounts add column if not exists session_version integer not null default 0;

-- ---------------------------------------------------------------------------
-- Credited handles are permanent.
--
-- A merged credit in data/entries.json links to /u/<handle>, and that file is public,
-- mirrored, and never rewritten. If the handle were later released, by a rename or by
-- deleting the account, the next person to claim it would inherit a link that credits
-- them for someone else's work. So a handle is retired the moment it is on a pull
-- request (status pr_open, since the credit is already written into the branch) and
-- stays retired after it merges.
--
-- The retired row remembers whose it was, so the owner can rename back to it. Nobody
-- else can take it, by rename or by the handle generator at signup. Which handle a given
-- credit was written under is not recorded here, so every handle such an account moves
-- away from is retired. That can retire a name no credit uses, which costs a name; the
-- other way round would cost someone their credit. Enforced by trigger
-- rather than in the API for the same reason the handle shape is: no route around it.
create table if not exists retired_handles (
  handle      text primary key,           -- stored lower-cased
  -- Null once the owning account is deleted: from then on nobody can reclaim it.
  account_id  uuid references accounts(id) on delete set null,
  retired_at  timestamptz not null default now()
);

create or replace function retire_credited_handle() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.handle is not distinct from old.handle then
    return new;
  end if;
  -- Before the delete, so the proposals that ON DELETE CASCADE is about to remove are
  -- still here to be counted.
  if exists (select 1 from proposals
              where account_id = old.id and status in ('pr_open', 'merged')) then
    insert into retired_handles (handle, account_id)
    values (lower(old.handle), old.id)
    on conflict (handle) do nothing;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create or replace function refuse_retired_handle() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.handle is not distinct from old.handle then
    return new;
  end if;
  if exists (select 1 from retired_handles r
              where r.handle = lower(new.handle)
                and (r.account_id is null or r.account_id <> new.id)) then
    -- unique_violation, deliberately. Both callers already treat 23505 as "taken":
    -- signup retries with another generated handle, and a rename answers 409.
    raise exception 'handle % is retired', new.handle using errcode = 'unique_violation';
  end if;
  return new;
end $$;

drop trigger if exists accounts_retire_handle on accounts;
create trigger accounts_retire_handle
  before update of handle or delete on accounts
  for each row execute function retire_credited_handle();

drop trigger if exists accounts_refuse_retired_handle on accounts;
create trigger accounts_refuse_retired_handle
  before insert or update of handle on accounts
  for each row execute function refuse_retired_handle();

-- Handles already on a pull request before this file existed.
insert into retired_handles (handle, account_id)
select distinct lower(a.handle), a.id
  from accounts a join proposals p on p.account_id = a.id
 where p.status in ('pr_open', 'merged')
on conflict (handle) do nothing;

alter table retired_handles enable row level security;

-- ---------------------------------------------------------------------------
-- Nothing is readable through Supabase's Data API.
--
-- Every table has row level security on and no policy, which already hides its rows
-- from the anon and authenticated roles. A view is different: by default it runs with
-- its owner's rights, and the owner here bypasses RLS. Supabase grants anon select on
-- new objects in `public`, and treats the anon key as public, so without this anyone
-- holding that key could list every account id with its contribution counts through
-- account_stats. security_invoker makes the view check RLS as the caller (Postgres 15
-- and later, which every Supabase project runs). 003 now creates the view with it; this
-- line is for a database that ran 003 before it did.
alter view account_stats set (security_invoker = on);

-- And the grants themselves, since no browser client exists for any of these to serve.
-- Guarded because anon and authenticated are Supabase's roles; a plain Postgres used
-- for local development does not have them.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format(
        'revoke all on accounts, signals, proposals, retired_handles, account_stats from %I',
        r);
    end if;
  end loop;
end $$;
