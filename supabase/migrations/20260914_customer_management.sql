alter table public.companies
  add column if not exists active boolean not null default true;

alter table public.companies
  add column if not exists customer_group text not null default 'general_customer';

update public.companies
set customer_group = 'general_customer'
where customer_group not in ('contractor', 'consultant', 'general_customer');

alter table public.companies
  drop constraint if exists companies_customer_group_check;

alter table public.companies
  add constraint companies_customer_group_check
  check (customer_group in ('contractor', 'consultant', 'general_customer'));

drop policy if exists "Authenticated users can insert companies" on public.companies;
create policy "Authenticated users can insert companies"
on public.companies for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Authenticated users can update companies" on public.companies;
create policy "Authenticated users can update companies"
on public.companies for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);
