alter table public.standups
  add column if not exists summary text;
