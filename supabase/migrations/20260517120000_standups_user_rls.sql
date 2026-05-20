-- Link standups to authenticated users and restrict access with RLS.
-- Apply in Supabase Dashboard → SQL Editor, or: supabase db push

-- ---------------------------------------------------------------------------
-- 1. user_id column (FK → auth.users)
-- ---------------------------------------------------------------------------
alter table public.standups
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

comment on column public.standups.user_id is
  'Owner of this standup; must match auth.uid() for all client access.';

create index if not exists standups_user_id_idx on public.standups (user_id);

-- Remove rows with no owner before enforcing NOT NULL (safe for empty / dev DBs).
delete from public.standups
where user_id is null;

alter table public.standups
  alter column user_id set not null;

-- ---------------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.standups enable row level security;

alter table public.standups force row level security;

-- ---------------------------------------------------------------------------
-- 3. Policies: users may only read and insert their own standups
-- ---------------------------------------------------------------------------
drop policy if exists standups_select_own on public.standups;
drop policy if exists standups_insert_own on public.standups;

create policy standups_select_own
  on public.standups
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy standups_insert_own
  on public.standups
  for insert
  to authenticated
  with check (auth.uid() = user_id);
