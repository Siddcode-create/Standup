-- Run in Supabase SQL Editor if history save fails.
-- Ensures standups table, user_id, RLS, and raw_notes exist.

create table if not exists public.standups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw_notes text,
  summary text,
  yesterday text,
  today text,
  blockers text
);

alter table public.standups
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.standups
  add column if not exists raw_notes text;

alter table public.standups
  add column if not exists summary text;

alter table public.standups
  add column if not exists yesterday text;

alter table public.standups
  add column if not exists today text;

alter table public.standups
  add column if not exists blockers text;

create index if not exists standups_user_id_idx on public.standups (user_id);
create index if not exists standups_created_at_idx on public.standups (created_at desc);

alter table public.standups enable row level security;

drop policy if exists standups_select_own on public.standups;
drop policy if exists standups_insert_own on public.standups;

create policy standups_select_own
  on public.standups for select to authenticated
  using (auth.uid() = user_id);

create policy standups_insert_own
  on public.standups for insert to authenticated
  with check (auth.uid() = user_id);
