begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a2000000-0000-4000-8000-000000000001', 'last-admin@test.local', '{}'::jsonb),
  ('a2000000-0000-4000-8000-000000000002', 'successor@test.local', '{}'::jsonb);

insert into public.organizations (id, org_code, name)
values ('a2100000-0000-4000-8000-000000000001', 'adminsafe', 'Admin Safety Test');

insert into public.org_members (id, user_id, org_id, role, status)
values
  ('a2200000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a2100000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('a2200000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'a2100000-0000-4000-8000-000000000001', 'sales', 'active');

select throws_ok(
  $$update public.org_members set status = 'inactive' where id = 'a2200000-0000-4000-8000-000000000001'$$,
  '23514',
  'organization must retain at least one active administrator',
  'The last active administrator cannot be deactivated'
);

select throws_ok(
  $$update public.org_members set role = 'accountant' where id = 'a2200000-0000-4000-8000-000000000001'$$,
  '23514',
  'organization must retain at least one active administrator',
  'The last active administrator cannot be demoted'
);

select throws_ok(
  $$delete from public.org_members where id = 'a2200000-0000-4000-8000-000000000001'$$,
  '23514',
  'organization must retain at least one active administrator',
  'The last active administrator cannot be deleted'
);

update public.org_members
set role = 'admin'
where id = 'a2200000-0000-4000-8000-000000000002';

select lives_ok(
  $$update public.org_members set status = 'inactive' where id = 'a2200000-0000-4000-8000-000000000001'$$,
  'An administrator can be deactivated after another active admin exists'
);

select is(
  (
    select count(*)::integer
    from public.org_members
    where org_id = 'a2100000-0000-4000-8000-000000000001'
      and role = 'admin'
      and status = 'active'
  ),
  1,
  'The organization retains an active administrator after transfer'
);

update public.org_members
set status = 'active'
where id = 'a2200000-0000-4000-8000-000000000001';

update public.org_members
set role = 'sales'
where id = 'a2200000-0000-4000-8000-000000000002';

select lives_ok(
  $$select public.transfer_org_administrator(
    'a2100000-0000-4000-8000-000000000001',
    'a2200000-0000-4000-8000-000000000001',
    'a2200000-0000-4000-8000-000000000002',
    null,
    'inactive'
  )$$,
  'The transfer function promotes the successor and deactivates the former admin atomically'
);

select is(
  (
    select count(*)::integer
    from public.org_members
    where org_id = 'a2100000-0000-4000-8000-000000000001'
      and role = 'admin'
      and status = 'active'
      and id = 'a2200000-0000-4000-8000-000000000002'
  ),
  1,
  'The selected successor is the active administrator after the atomic transfer'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.transfer_org_administrator(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  false,
  'Authenticated clients cannot call the service-only transfer function directly'
);

select * from finish();
rollback;
