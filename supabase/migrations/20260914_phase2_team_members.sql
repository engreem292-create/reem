alter table public.follow_ups
add column if not exists assigned_to uuid;

alter table public.follow_ups
drop constraint if exists follow_ups_assigned_to_fkey;

alter table public.follow_ups
add constraint follow_ups_assigned_to_fkey
foreign key (assigned_to)
references public.team_members(id)
on delete set null;

update public.follow_ups fu
set assigned_to = p.assigned_to
from public.projects p
where p.id = fu.project_id
  and fu.assigned_to is null;

create index if not exists follow_ups_assigned_to_idx
on public.follow_ups(assigned_to);

create or replace function public.set_follow_up_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as '
begin
  if new.assigned_to is null then
    new.assigned_to := (
      select p.assigned_to
      from public.projects p
      where p.id = new.project_id
    );
  end if;

  return new;
end;
';

drop trigger if exists set_follow_up_default_assignee
on public.follow_ups;

create trigger set_follow_up_default_assignee
before insert or update of project_id
on public.follow_ups
for each row
execute function public.set_follow_up_default_assignee();

create or replace function public.crm_current_team_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as '
  select id
  from public.team_members
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
';

create or replace function public.crm_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as '
  select coalesce(
    (
      select lower(role) = ''admin''
      from public.team_members
      where auth_user_id = auth.uid()
        and active = true
      limit 1
    ),
    false
  );
';

create or replace function public.crm_project_assigned_to_user(
  target_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as '
  select exists (
    select 1
    from public.projects
    where id = target_project_id
      and assigned_to = public.crm_current_team_member_id()
  );
';

create or replace function public.crm_has_assigned_follow_up(
  target_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as '
  select exists (
    select 1
    from public.follow_ups
    where project_id = target_project_id
      and assigned_to = public.crm_current_team_member_id()
  );
';

revoke all on function public.crm_current_team_member_id() from public;
revoke all on function public.crm_is_admin() from public;
revoke all on function public.crm_project_assigned_to_user(uuid) from public;
revoke all on function public.crm_has_assigned_follow_up(uuid) from public;

grant execute on function public.crm_current_team_member_id()
to authenticated;
grant execute on function public.crm_is_admin()
to authenticated;
grant execute on function public.crm_project_assigned_to_user(uuid)
to authenticated;
grant execute on function public.crm_has_assigned_follow_up(uuid)
to authenticated;

grant insert, update on table public.team_members
to authenticated;

drop policy if exists "Admin team member insert"
on public.team_members;

create policy "Admin team member insert"
on public.team_members
for insert
to authenticated
with check (public.crm_is_admin());

drop policy if exists "Admin team member update"
on public.team_members;

create policy "Admin team member update"
on public.team_members
for update
to authenticated
using (public.crm_is_admin())
with check (public.crm_is_admin());

drop policy if exists "Account project access"
on public.projects;

create policy "Account project access"
on public.projects
for select
to authenticated
using (
  public.crm_is_admin()
  or assigned_to = public.crm_current_team_member_id()
  or public.crm_has_assigned_follow_up(id)
);

drop policy if exists "Account follow up access"
on public.follow_ups;

create policy "Account follow up access"
on public.follow_ups
for select
to authenticated
using (
  public.crm_is_admin()
  or assigned_to = public.crm_current_team_member_id()
  or public.crm_project_assigned_to_user(project_id)
);

drop policy if exists "Account follow up insert"
on public.follow_ups;

create policy "Account follow up insert"
on public.follow_ups
for insert
to authenticated
with check (
  public.crm_is_admin()
  or public.crm_project_assigned_to_user(project_id)
);

drop policy if exists "Account follow up update"
on public.follow_ups;

create policy "Account follow up update"
on public.follow_ups
for update
to authenticated
using (
  public.crm_is_admin()
  or assigned_to = public.crm_current_team_member_id()
  or public.crm_project_assigned_to_user(project_id)
)
with check (
  public.crm_is_admin()
  or assigned_to = public.crm_current_team_member_id()
  or public.crm_project_assigned_to_user(project_id)
);

notify pgrst, 'reload schema';
