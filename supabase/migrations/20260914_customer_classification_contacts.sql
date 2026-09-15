alter table public.companies
  add column if not exists general_customer_type text;

alter table public.companies
  drop constraint if exists companies_customer_group_check;

update public.companies
set customer_group = 'contracting_company'
where customer_group = 'contractor';

update public.companies
set customer_group = 'consultant_company'
where customer_group = 'consultant';

update public.companies
set customer_group = 'general_customer'
where customer_group is null
   or customer_group not in ('contracting_company', 'consultant_company', 'general_customer');

update public.companies
set general_customer_type = 'company'
where customer_group = 'general_customer'
  and general_customer_type is null;

update public.companies
set general_customer_type = null
where customer_group <> 'general_customer';

alter table public.companies
  add constraint companies_customer_group_check
  check (customer_group in ('contracting_company', 'consultant_company', 'general_customer'));

alter table public.companies
  drop constraint if exists companies_general_customer_type_check;

alter table public.companies
  add constraint companies_general_customer_type_check
  check (general_customer_type is null or general_customer_type in ('company', 'person'));

create table if not exists public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_contacts_company_id_idx
  on public.company_contacts(company_id);

alter table public.company_contacts enable row level security;

drop policy if exists "Authenticated users can view company contacts" on public.company_contacts;
create policy "Authenticated users can view company contacts"
on public.company_contacts for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can insert company contacts" on public.company_contacts;
create policy "Authenticated users can insert company contacts"
on public.company_contacts for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Authenticated users can update company contacts" on public.company_contacts;
create policy "Authenticated users can update company contacts"
on public.company_contacts for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Authenticated users can delete company contacts" on public.company_contacts;
create policy "Authenticated users can delete company contacts"
on public.company_contacts for delete
to authenticated
using (auth.uid() is not null);
