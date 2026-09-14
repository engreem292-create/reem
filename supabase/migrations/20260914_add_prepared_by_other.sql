alter table public.projects
add column if not exists prepared_by_other text;

comment on column public.projects.prepared_by_other is
  'Free-text preparer name used when Prepared By is set to Other.';
