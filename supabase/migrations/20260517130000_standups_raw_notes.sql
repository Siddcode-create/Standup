alter table public.standups
  add column if not exists raw_notes text;

comment on column public.standups.raw_notes is 'Original user notes submitted before AI generation.';
