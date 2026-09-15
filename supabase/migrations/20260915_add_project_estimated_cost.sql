alter table public.projects
  add column if not exists estimated_cost_jd numeric(14, 2);

alter table public.projects
  drop constraint if exists projects_estimated_cost_jd_check;

alter table public.projects
  add constraint projects_estimated_cost_jd_check
  check (estimated_cost_jd is null or estimated_cost_jd >= 0);
