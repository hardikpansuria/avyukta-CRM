begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('d0000000-0000-4000-8000-000000000001', 'export-admin@test.local', '{}'::jsonb),
  ('d0000000-0000-4000-8000-000000000002', 'export-sales-x@test.local', '{}'::jsonb),
  ('d0000000-0000-4000-8000-000000000003', 'export-sales-y@test.local', '{}'::jsonb),
  ('d0000000-0000-4000-8000-000000000004', 'export-accountant@test.local', '{}'::jsonb);

insert into public.organizations (id, org_code, name)
values ('d1000000-0000-4000-8000-000000000001', 'exportorg', 'Export Test Org');

insert into public.org_members (user_id, org_id, role, status)
values
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('d0000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'sales', 'active'),
  ('d0000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 'sales', 'active'),
  ('d0000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', 'accountant', 'active');

select is(public.user_has_permission('d0000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','document_exports','view'), true, 'Admin can view document exports');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','document_exports','date_range_export'), true, 'Admin can run date-range exports');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','document_exports','full_backup'), true, 'Admin can run full backups');

select is(public.user_has_permission('d0000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','document_exports','view'), false, 'Sales cannot view exports by default');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','document_exports','date_range_export'), false, 'Sales cannot run date-range exports by default');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','document_exports','full_backup'), false, 'Sales cannot run full backups by default');

select is(public.user_has_permission('d0000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001','document_exports','view'), false, 'Accountant cannot view exports by default');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001','document_exports','date_range_export'), false, 'Accountant cannot run date-range exports by default');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001','document_exports','full_backup'), false, 'Accountant cannot run full backups by default');

insert into public.user_permission_overrides (org_id, user_id, permission_id, allowed, granted_by)
select 'd1000000-0000-4000-8000-000000000001', users.user_id, pd.id, true, 'd0000000-0000-4000-8000-000000000001'
from (values
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'view'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'full_backup'),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'view'),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'date_range_export')
) users(user_id, action_key)
join public.permission_modules pm on pm.module_key = 'document_exports'
join public.permission_definitions pd on pd.module_id = pm.id and pd.action_key = users.action_key;

select is(public.user_has_permission('d0000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','document_exports','view'), true, 'Sales X explicit view grant works');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','document_exports','full_backup'), true, 'Admin full backup remains granted');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','document_exports','full_backup'), true, 'Sales X explicit full backup grant works');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','document_exports','view'), false, 'Sales Y remains denied without an override');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001','document_exports','date_range_export'), true, 'Accountant explicit date-range grant works');
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001','document_exports','full_backup'), false, 'Accountant still cannot run full backups');

update public.user_permission_overrides upo
set allowed = false
from public.permission_definitions pd
join public.permission_modules pm on pm.id = pd.module_id
where upo.permission_id = pd.id
  and upo.user_id = 'd0000000-0000-4000-8000-000000000002'
  and pm.module_key = 'document_exports'
  and pd.action_key = 'full_backup';
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','document_exports','full_backup'), false, 'Explicit deny overrides the Sales X grant');

delete from public.user_permission_overrides
where org_id = 'd1000000-0000-4000-8000-000000000001'
  and user_id = 'd0000000-0000-4000-8000-000000000002';
select is(public.user_has_permission('d0000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','document_exports','view'), false, 'Reset restores the Sales role default');

select * from finish();
rollback;
