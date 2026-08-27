begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

select has_table(
  'public',
  'organization_quotation_branding_versions',
  'Versioned quotation branding table exists'
);
select has_column(
  'public',
  'quotation_customer_documents',
  'branding_version_id',
  'Customer documents identify the captured branding version'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.organization_quotation_branding_versions'::regclass
  ),
  true,
  'Branding versions use RLS'
);
select ok(
  not has_table_privilege(
    'anon',
    'public.organization_quotation_branding_versions',
    'SELECT'
  ),
  'Anonymous users cannot read branding versions'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.organization_quotation_branding_versions',
    'INSERT'
  ),
  'Authenticated clients cannot bypass the admin-only server workflow'
);

insert into public.organizations (id, org_code, name)
values (
  'b1000000-0000-4000-8000-000000000001',
  'brandingtest',
  'Branding Test Organization'
);

insert into public.organization_quotation_branding_versions (
  id, org_id, company_name, effective_from
) values
  (
    'b2000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'Brand One',
    date '2026-01-01'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'Brand Three',
    date '2026-06-01'
  );

select is(
  (
    select effective_to
    from public.organization_quotation_branding_versions
    where id = 'b2000000-0000-4000-8000-000000000001'
  ),
  date '2026-05-31',
  'A later version automatically closes the earlier effective range'
);
select is(
  (
    select effective_to
    from public.organization_quotation_branding_versions
    where id = 'b2000000-0000-4000-8000-000000000002'
  ),
  null::date,
  'The newest version remains effective without an end date'
);

insert into public.organization_quotation_branding_versions (
  id, org_id, company_name, effective_from
) values (
  'b2000000-0000-4000-8000-000000000003',
  'b1000000-0000-4000-8000-000000000001',
  'Brand Two',
  date '2026-03-01'
);

select is(
  (
    select effective_to
    from public.organization_quotation_branding_versions
    where id = 'b2000000-0000-4000-8000-000000000001'
  ),
  date '2026-02-28',
  'Backdated insertion recalculates the preceding range'
);
select is(
  (
    select effective_to
    from public.organization_quotation_branding_versions
    where id = 'b2000000-0000-4000-8000-000000000003'
  ),
  date '2026-05-31',
  'Backdated insertion ends immediately before the next version'
);
select throws_ok(
  $$update public.organization_quotation_branding_versions
    set company_name = 'Overwritten Brand'
    where id = 'b2000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Quotation branding version content is immutable',
  'Existing branding content cannot be overwritten'
);
select throws_ok(
  $$delete from public.organization_quotation_branding_versions
    where id = 'b2000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Quotation branding versions are immutable',
  'Branding history cannot be deleted'
);

select * from finish();
rollback;
