begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', 'admin-a@test.local', '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', 'sales-a@test.local', '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000003', 'accountant-a@test.local', '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000004', 'admin-b@test.local', '{}'::jsonb);

insert into public.organizations (id, org_code, name)
values
  ('10000000-0000-4000-8000-000000000001', 'rbacorga', 'RBAC Org A'),
  ('10000000-0000-4000-8000-000000000002', 'rbacorgb', 'RBAC Org B');

insert into public.org_members (user_id, org_id, role, status)
values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'sales', 'active'),
  ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'accountant', 'active'),
  ('00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'admin', 'active');

select ok(
  (select bool_and(public.user_has_permission(
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    pm.module_key,
    pd.action_key
  )) from public.permission_definitions pd join public.permission_modules pm on pm.id = pd.module_id),
  'Admin has every defined permission'
);

select is(public.user_has_permission('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','customers','delete'), false, 'Sales cannot delete customers');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','quotations','revise'), true, 'Sales can revise quotations');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','invoices','create'), false, 'Sales cannot create invoices');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','jobs','update_status'), true, 'Sales can update job status');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','settings','manage'), false, 'Sales cannot manage settings');

select is(public.user_has_permission('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','quotations','edit'), false, 'Accountant cannot edit quotations');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','invoices','create'), true, 'Accountant can create invoices');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','invoices','delete'), true, 'Accountant can delete invoices');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','jobs','update_status'), false, 'Accountant cannot update job status');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','settings','manage'), false, 'Accountant cannot manage settings');

select is(public.user_has_permission('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','employees','create'), false, 'Accountant inherits employee create denial');
insert into public.user_permission_overrides (org_id, user_id, permission_id, allowed, granted_by)
select '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', pd.id, true, '00000000-0000-4000-8000-000000000001'
from public.permission_definitions pd join public.permission_modules pm on pm.id = pd.module_id
where pm.module_key = 'employees' and pd.action_key = 'create';
select is(public.user_has_permission('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','employees','create'), true, 'Explicit grant overrides accountant denial');

select is(public.user_has_permission('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','quotations','delete'), true, 'Sales inherits quotation delete grant');
insert into public.user_permission_overrides (org_id, user_id, permission_id, allowed, granted_by)
select '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', pd.id, false, '00000000-0000-4000-8000-000000000001'
from public.permission_definitions pd join public.permission_modules pm on pm.id = pd.module_id
where pm.module_key = 'quotations' and pd.action_key = 'delete';
select is(public.user_has_permission('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','quotations','delete'), false, 'Explicit denial overrides sales grant');
delete from public.user_permission_overrides
where org_id = '10000000-0000-4000-8000-000000000001'
  and user_id = '00000000-0000-4000-8000-000000000002'
  and permission_id = (select pd.id from public.permission_definitions pd join public.permission_modules pm on pm.id = pd.module_id where pm.module_key = 'quotations' and pd.action_key = 'delete');
select is(public.user_has_permission('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','quotations','delete'), true, 'Deleting override restores role inheritance');

select throws_ok(
  $$insert into public.user_permission_overrides (org_id, user_id, permission_id, allowed, granted_by)
    select '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', pd.id, true, '00000000-0000-4000-8000-000000000001'
    from public.permission_definitions pd join public.permission_modules pm on pm.id = pd.module_id
    where pm.module_key = 'customers' and pd.action_key = 'view'$$,
  '23503',
  null,
  'An Org A override cannot target an Org B member'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.user_permission_overrides (org_id, user_id, permission_id, allowed, granted_by)
    select '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', pd.id, false, '00000000-0000-4000-8000-000000000001'
    from public.permission_definitions pd join public.permission_modules pm on pm.id = pd.module_id
    where pm.module_key = 'customers' and pd.action_key = 'view'$$,
  'An Org A Settings manager may create an Org A override through RLS'
);
select throws_ok(
  $$insert into public.user_permission_overrides (org_id, user_id, permission_id, allowed, granted_by)
    select '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', pd.id, true, '00000000-0000-4000-8000-000000000001'
    from public.permission_definitions pd join public.permission_modules pm on pm.id = pd.module_id
    where pm.module_key = 'customers' and pd.action_key = 'view'$$,
  '42501',
  null,
  'An Org A Settings manager cannot create an Org B override through RLS'
);
reset role;

update public.org_members set status = 'inactive'
where user_id = '00000000-0000-4000-8000-000000000003' and org_id = '10000000-0000-4000-8000-000000000001';
select is(public.user_has_permission('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','employees','create'), false, 'Inactive members have no organization permissions');

select throws_ok(
  $$insert into public.user_permission_overrides (org_id, user_id, permission_id, allowed, granted_by)
    select '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', pd.id, false, '00000000-0000-4000-8000-000000000001'
    from public.permission_definitions pd join public.permission_modules pm on pm.id = pd.module_id
    where pm.module_key = 'settings' and pd.action_key = 'manage'$$,
  '23514',
  'Organization must retain at least one active Settings manager.',
  'The last active Settings manager cannot be denied access'
);

select * from finish();
rollback;
