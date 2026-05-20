-- Optional baseline: run only if public.standups does not exist yet.
-- Skip this file if you already created the standups table in Supabase.

create table if not exists public.standups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  yesterday text,
  today text,
  blockers text
);

comment on table public.standups is 'Daily standup entries per user.';

-- Keep updated_at in sync
create or replace function public.set_standups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists standups_updated_at on public.standups;

create trigger standups_updated_at
  before update on public.standups
  for each row
  execute function public.set_standups_updated_at();
