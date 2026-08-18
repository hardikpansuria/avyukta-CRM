begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data)
values ('e0000000-0000-4000-8000-000000000001', 'completion-admin@test.local', '{"full_name":"Completion Admin"}'::jsonb);

insert into public.organizations (id, org_code, name)
values ('e1000000-0000-4000-8000-000000000001', 'completionorg', 'Completion Test Org');

insert into public.org_members (user_id, org_id, role, status)
values ('e0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'admin', 'active');

insert into public.customers (id, org_id, company_name, customer_code)
values ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Completion Customer', 'COMP-1');

insert into public.quotations (
  id, org_id, customer_id, quotation_number, quote_year, quote_sequence,
  quotation_series_id, status
) values (
  'e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001', 'QT-260001', 2026, 1,
  'e4000000-0000-4000-8000-000000000001', 'accepted'
);

insert into public.quotation_scopes (id, org_id, quotation_id, scope_title, scope_description, sort_order)
values
  ('e5000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'Fabricate Tank', 'Fabrication only', 1),
  ('e5000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'Install Tank', 'Installation only', 2);

insert into public.jobs (
  id, org_id, quotation_series_id, original_accepted_quotation_id,
  latest_accepted_quotation_id, customer_id, job_number, job_year,
  job_sequence, job_status, created_by, updated_by
) values (
  'e6000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
  'JOB-001', 2026, 1, 'work_in_process', 'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001'
);

insert into public.employee_directory (id, org_id, employee_name, employee_status, created_by)
values ('e7000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Taylor Technician', 'active', 'e0000000-0000-4000-8000-000000000001');

delete from public.job_scope_assignments where job_id = 'e6000000-0000-4000-8000-000000000001';
insert into public.job_scope_assignments (org_id, job_id, quotation_id, scope_id, assigned_by)
values (
  'e1000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001'
);

select is((select work_order_number from public.jobs where id = 'e6000000-0000-4000-8000-000000000001'), 'JOB-001', 'Work Order number defaults to Job number');
select is(public.user_has_permission('e0000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','jobs','reopen'), true, 'Admin can reopen completed jobs');
select is((select allowed from public.role_default_permissions rdp join public.permission_definitions pd on pd.id = rdp.permission_id join public.permission_modules pm on pm.id = pd.module_id where rdp.role_key = 'sales' and pm.module_key = 'jobs' and pd.action_key = 'reopen'), false, 'Sales cannot reopen by default');

create temporary table completion_result as
select public.create_job_work_completion_draft(
  'e1000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001', current_date, 'completed', 'Finished cleanly', null,
  array['e7000000-0000-4000-8000-000000000001'::uuid]
) as payload;

select matches(
  (select payload->>'certificate_number' from completion_result),
  '^WC-' || right(extract(year from current_date)::text, 2) || '[0-9]{4,}$',
  'Certificate uses the annual WC number format'
);
select is((select count(*) from public.job_work_completion_technicians), 1::bigint, 'Selected Employee ID is stored once');
select is((select employee_name_snapshot from public.job_work_completion_technicians), 'Taylor Technician', 'Employee name is snapshotted for the audit record');
select is((select count(*) from public.job_work_completion_scopes), 1::bigint, 'Only the Work Order assigned scope is captured');
select is((select scope_title_snapshot from public.job_work_completion_scopes), 'Fabricate Tank', 'Unrelated quotation scopes are excluded');

select throws_ok(
  $$select public.create_job_work_completion_draft(
    'e1000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000001', current_date, 'completed', null, null,
    array['e7000000-0000-4000-8000-000000000001'::uuid])$$,
  '23505', null, 'A concurrent generating certificate is rejected'
);

select public.finalize_job_work_completion(
  'e1000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001',
  ((select payload->>'id' from completion_result)::uuid), 'e0000000-0000-4000-8000-000000000001',
  'WC-test.pdf', 'e100/jobs/e600/work-completions/test.pdf', 1000, now()
);

select is((select job_status from public.jobs where id = 'e6000000-0000-4000-8000-000000000001'), 'work_completed', 'Finalization moves the same Job to Work Completed');
select is((select generation_status from public.job_work_completions), 'generated', 'Certificate is marked generated');
select is((select count(*) from public.job_status_history where job_id = 'e6000000-0000-4000-8000-000000000001' and new_status = 'work_completed'), 1::bigint, 'Completion status change is audited');
select is((select work_completion_id from public.job_status_history where job_id = 'e6000000-0000-4000-8000-000000000001' and new_status = 'work_completed'), ((select payload->>'id' from completion_result)::uuid), 'Audit record links the certificate');

create temporary table correction_result as
select public.create_job_work_completion_correction_draft(
  'e1000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001',
  ((select payload->>'id' from completion_result)::uuid), 'e0000000-0000-4000-8000-000000000001',
  current_date, 'completed_with_outstanding_items', 'Corrected completion notes',
  'Corrected outstanding item', array['e7000000-0000-4000-8000-000000000001'::uuid]
) as payload;

select is(
  (select correction_of_completion_id from public.job_work_completions where id = ((select payload->>'id' from correction_result)::uuid)),
  ((select payload->>'id' from completion_result)::uuid),
  'Correction links to and preserves the issued source certificate'
);
select isnt(
  (select payload->>'certificate_number' from correction_result),
  (select payload->>'certificate_number' from completion_result),
  'Correction receives a new unique certificate number'
);
select is((select (payload->>'revision_number')::integer from correction_result), 2, 'Correction increments the Job certificate revision');
select is(
  (select count(*) from public.job_work_completion_scopes where completion_id = ((select payload->>'id' from correction_result)::uuid)),
  1::bigint,
  'Correction retains only the source Work Order scope'
);

select public.finalize_job_work_completion_correction(
  'e1000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001',
  ((select payload->>'id' from completion_result)::uuid), ((select payload->>'id' from correction_result)::uuid),
  'e0000000-0000-4000-8000-000000000001', 'WC-corrected.pdf',
  'e100/jobs/e600/work-completions/corrected.pdf', 1100, now()
);

select is(
  (select latest_work_completion_id from public.jobs where id = 'e6000000-0000-4000-8000-000000000001'),
  ((select payload->>'id' from correction_result)::uuid),
  'Corrected certificate becomes the latest Job completion'
);
select is(
  (select count(*) from public.job_work_completions where job_id = 'e6000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Correction removes the superseded certificate database record'
);
select is((select job_status from public.jobs where id = 'e6000000-0000-4000-8000-000000000001'), 'work_completed', 'Correction keeps the Job completed');
select is(
  (select count(*) from public.job_status_history where job_id = 'e6000000-0000-4000-8000-000000000001' and previous_status = 'work_completed' and new_status = 'work_completed'),
  1::bigint,
  'Completion correction is added to the audit trail'
);

select public.reopen_completed_job(
  'e1000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001', 'Customer requested a modification'
);
select is((select job_status from public.jobs where id = 'e6000000-0000-4000-8000-000000000001'), 'work_in_process', 'Reopening returns the same Job to Work in Progress');
select is((select reopen_reason from public.job_work_completions where id = ((select payload->>'id' from correction_result)::uuid)), 'Customer requested a modification', 'Reopening reason is preserved on the latest revision');
select ok((select bool_and(generation_status = 'generated') from public.job_work_completions), 'Replacement certificate remains generated after reopening');

select * from finish();
rollback;
