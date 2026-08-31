begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prokind = 'f'
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  'Anonymous cannot execute any application database function'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral aclexplode(
      coalesce(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )
    ) privilege
    where namespace.nspname in ('public', 'private')
      and procedure.prokind = 'f'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no inherited execution privilege on application functions'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and exists (
        select 1
        from pg_catalog.pg_trigger trigger
        where trigger.tgfoid = procedure.oid
          and not trigger.tgisinternal
      )
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ),
  'Authenticated clients cannot invoke trigger-only functions directly'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and exists (
        select 1
        from pg_catalog.pg_trigger trigger
        where trigger.tgfoid = procedure.oid
          and not trigger.tgisinternal
      )
      and has_function_privilege('service_role', procedure.oid, 'EXECUTE')
  ),
  'Trigger-only functions have no direct service-role RPC surface'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prosecdef
      and not (
        coalesce(procedure.proconfig, '{}'::text[])
        @> array['search_path=""']::text[]
      )
  ),
  'Every SECURITY DEFINER function has an empty fixed search path'
);

select ok(
  (
    select bool_and(has_function_privilege('authenticated', function_oid, 'EXECUTE'))
    from unnest(array[
      'public.create_job_purchase_order(text,date,text,jsonb)'::regprocedure,
      'public.create_quotation_revision(uuid,text)'::regprocedure,
      'public.create_job_purchase_order_revision(uuid,date,uuid,jsonb,uuid[],text,boolean)'::regprocedure
    ]) function_oid
  ),
  'Authenticated clients retain only the reviewed mutation RPC entry points'
);

select ok(
  (
    select bool_and(has_function_privilege('service_role', function_oid, 'EXECUTE'))
    from unnest(array[
      'public.check_public_calendar_conflicts(uuid,uuid[],timestamptz,timestamptz,text,uuid)'::regprocedure,
      'public.user_has_permission(uuid,uuid,text,text)'::regprocedure,
      'public.create_job_work_completion_draft(uuid,uuid,uuid,date,text,text,text,uuid[])'::regprocedure,
      'public.finalize_job_work_completion(uuid,uuid,uuid,uuid,text,text,bigint,timestamptz)'::regprocedure,
      'public.create_job_work_completion_correction_draft(uuid,uuid,uuid,uuid,date,text,text,text,uuid[])'::regprocedure,
      'public.finalize_job_work_completion_correction(uuid,uuid,uuid,uuid,uuid,text,text,bigint,timestamptz)'::regprocedure,
      'public.reopen_completed_job(uuid,uuid,uuid,text)'::regprocedure,
      'public.transfer_org_administrator(uuid,uuid,uuid,text,text)'::regprocedure
    ]) function_oid
  ),
  'Service role retains every reviewed server-only RPC'
);

select ok(
  (
    select bool_and(not has_function_privilege('authenticated', function_oid, 'EXECUTE'))
    from unnest(array[
      'public.check_public_calendar_conflicts(uuid,uuid[],timestamptz,timestamptz,text,uuid)'::regprocedure,
      'public.user_has_permission(uuid,uuid,text,text)'::regprocedure,
      'public.create_job_work_completion_draft(uuid,uuid,uuid,date,text,text,text,uuid[])'::regprocedure,
      'public.finalize_job_work_completion(uuid,uuid,uuid,uuid,text,text,bigint,timestamptz)'::regprocedure,
      'public.create_job_work_completion_correction_draft(uuid,uuid,uuid,uuid,date,text,text,text,uuid[])'::regprocedure,
      'public.finalize_job_work_completion_correction(uuid,uuid,uuid,uuid,uuid,text,text,bigint,timestamptz)'::regprocedure,
      'public.reopen_completed_job(uuid,uuid,uuid,text)'::regprocedure,
      'public.transfer_org_administrator(uuid,uuid,uuid,text,text)'::regprocedure
    ]) function_oid
  ),
  'Authenticated clients cannot invoke any reviewed server-only RPC'
);

select ok(
  (
    select bool_and(
      not has_function_privilege('anon', function_oid, 'EXECUTE')
      and not has_function_privilege('authenticated', function_oid, 'EXECUTE')
      and not has_function_privilege('service_role', function_oid, 'EXECUTE')
    )
    from unnest(array[
      'private.create_job_purchase_order_impl(text,date,text,jsonb)'::regprocedure,
      'private.create_quotation_revision_impl(uuid,text)'::regprocedure,
      'private.create_job_purchase_order_revision_impl(uuid,date,uuid,jsonb,uuid[],text,boolean)'::regprocedure
    ]) function_oid
  ),
  'Private mutation implementations cannot be invoked directly by API roles'
);

set local role anon;
select throws_ok(
  $$select * from public.check_public_calendar_conflicts(
    'fa100000-0000-4000-8000-000000000001',
    '{}'::uuid[],
    now(),
    now() + interval '1 hour',
    'company_event',
    null
  )$$,
  '42501',
  null,
  'Anonymous invocation of the calendar-conflict RPC is rejected'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select public.user_has_permission(
    'fa000000-0000-4000-8000-000000000001',
    'fa100000-0000-4000-8000-000000000001',
    'jobs',
    'view'
  )$$,
  '42501',
  null,
  'Authenticated invocation of the service-only permission RPC is rejected'
);
select throws_ok(
  $$select public.create_job_work_completion_draft(
    'fa100000-0000-4000-8000-000000000001',
    'fa600000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000001',
    current_date,
    'completed',
    null,
    null,
    '{}'::uuid[]
  )$$,
  '42501',
  null,
  'Authenticated invocation of a work-completion RPC is rejected'
);
select throws_ok(
  $$select public.transfer_org_administrator(
    'fa100000-0000-4000-8000-000000000001',
    'fa200000-0000-4000-8000-000000000001',
    'fa200000-0000-4000-8000-000000000002',
    null,
    null
  )$$,
  '42501',
  null,
  'Authenticated invocation of the administrator-transfer RPC is rejected'
);
reset role;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('fa000000-0000-4000-8000-000000000001', 'function-admin-a@test.local', '{}'::jsonb),
  ('fb000000-0000-4000-8000-000000000001', 'function-admin-b@test.local', '{}'::jsonb);

select is(
  (
    select count(*)
    from public.profiles
    where id in (
      'fa000000-0000-4000-8000-000000000001',
      'fb000000-0000-4000-8000-000000000001'
    )
  ),
  2::bigint,
  'Auth profile trigger still executes after direct EXECUTE is revoked'
);

insert into public.organizations (id, org_code, name)
values
  ('fa100000-0000-4000-8000-000000000001', 'functionorga', 'Function Security Org A'),
  ('fb100000-0000-4000-8000-000000000001', 'functionorgb', 'Function Security Org B');

select is(
  (
    select count(*)
    from public.employee_skills
    where org_id in (
      'fa100000-0000-4000-8000-000000000001',
      'fb100000-0000-4000-8000-000000000001'
    )
  ),
  22::bigint,
  'Organization seed triggers still execute with protected helper functions'
);

insert into public.org_members (id, user_id, org_id, role, status)
values
  ('fa200000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001', 'fa100000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('fb200000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000001', 'fb100000-0000-4000-8000-000000000001', 'admin', 'active');

insert into public.customers (id, org_id, company_name, customer_code)
values
  ('fa300000-0000-4000-8000-000000000001', 'fa100000-0000-4000-8000-000000000001', 'Function Customer A', 'FUN-A'),
  ('fb300000-0000-4000-8000-000000000001', 'fb100000-0000-4000-8000-000000000001', 'Function Customer B', 'FUN-B');

insert into public.quotations (
  id, org_id, customer_id, quotation_number, quote_year, quote_sequence,
  quotation_series_id, status, sales_rep_id
)
values
  (
    'fa400000-0000-4000-8000-000000000001',
    'fa100000-0000-4000-8000-000000000001',
    'fa300000-0000-4000-8000-000000000001',
    'QT-FUN-A', 2026, 8001,
    'fa500000-0000-4000-8000-000000000001',
    'accepted',
    'fa000000-0000-4000-8000-000000000001'
  ),
  (
    'fb400000-0000-4000-8000-000000000001',
    'fb100000-0000-4000-8000-000000000001',
    'fb300000-0000-4000-8000-000000000001',
    'QT-FUN-B', 2026, 8002,
    'fb500000-0000-4000-8000-000000000001',
    'sent',
    'fb000000-0000-4000-8000-000000000001'
  );

insert into public.jobs (
  id, org_id, quotation_series_id, original_accepted_quotation_id,
  latest_accepted_quotation_id, customer_id, job_status, salesperson_id
)
values
  (
    'fa600000-0000-4000-8000-000000000001',
    'fa100000-0000-4000-8000-000000000001',
    'fa500000-0000-4000-8000-000000000001',
    'fa400000-0000-4000-8000-000000000001',
    'fa400000-0000-4000-8000-000000000001',
    'fa300000-0000-4000-8000-000000000001',
    'po_pending',
    'fa000000-0000-4000-8000-000000000001'
  ),
  (
    'fb600000-0000-4000-8000-000000000001',
    'fb100000-0000-4000-8000-000000000001',
    'fb500000-0000-4000-8000-000000000001',
    'fb400000-0000-4000-8000-000000000001',
    'fb400000-0000-4000-8000-000000000001',
    'fb300000-0000-4000-8000-000000000001',
    'po_pending',
    'fb000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'fa000000-0000-4000-8000-000000000001',
  true
);

select is(
  public.is_active_org_member('fb100000-0000-4000-8000-000000000001'),
  false,
  'An Org A user is not treated as an Org B member'
);

select throws_ok(
  $$select public.create_quotation_revision(
    'fb400000-0000-4000-8000-000000000001',
    'Cross-organization attempt'
  )$$,
  'P0001',
  'Not authorized',
  'An Org A user cannot revise an Org B quotation'
);

reset role;

select is(
  (
    select count(*)
    from public.quotations
    where quotation_series_id = 'fb500000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'A rejected cross-organization revision creates no additional quotation'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'fa000000-0000-4000-8000-000000000001',
  true
);
select throws_ok(
  $$select public.create_job_purchase_order(
    'PO-CROSS-ORG',
    current_date,
    null,
    '[{"job_id":"fb600000-0000-4000-8000-000000000001","po_amount_before_tax":100,"difference_acknowledged":true}]'::jsonb
  )$$,
  'P0001',
  'Not authorized',
  'An Org A user cannot create a purchase order for an Org B job'
);
reset role;

select is(
  (
    select count(*)
    from public.job_purchase_orders
    where org_id = 'fb100000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'A rejected cross-organization PO call creates no database record'
);

insert into public.job_purchase_orders (
  id, org_id, customer_id, po_number, po_received_date, created_by
)
values (
  'fa700000-0000-4000-8000-000000000001',
  'fa100000-0000-4000-8000-000000000001',
  'fa300000-0000-4000-8000-000000000001',
  'PO-DUPLICATE',
  current_date,
  'fa000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'fa000000-0000-4000-8000-000000000001',
  true
);
select throws_ok(
  $$select public.create_job_purchase_order(
    'PO-DUPLICATE',
    current_date,
    null,
    '[{"job_id":"fa600000-0000-4000-8000-000000000001","po_amount_before_tax":100,"difference_acknowledged":true}]'::jsonb
  )$$,
  '23505',
  null,
  'A duplicate customer PO number returns a database conflict'
);
reset role;

select is(
  (
    select count(*)
    from public.job_purchase_orders
    where org_id = 'fa100000-0000-4000-8000-000000000001'
      and customer_id = 'fa300000-0000-4000-8000-000000000001'
      and po_number = 'PO-DUPLICATE'
  ),
  1::bigint,
  'A duplicate PO attempt does not create a partial purchase-order record'
);

select is(
  (
    select job_status
    from public.jobs
    where id = 'fa600000-0000-4000-8000-000000000001'
  ),
  'po_pending',
  'A duplicate PO attempt leaves the job unchanged'
);

update public.jobs
set job_status = 'work_in_process'
where id = 'fa600000-0000-4000-8000-000000000001';

insert into public.employee_directory (
  id, org_id, employee_name, employee_status, created_by
)
values (
  'fa800000-0000-4000-8000-000000000001',
  'fa100000-0000-4000-8000-000000000001',
  'No Scope Technician',
  'active',
  'fa000000-0000-4000-8000-000000000001'
);

delete from public.job_scope_assignments
where job_id = 'fa600000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.create_job_work_completion_draft(
    'fa100000-0000-4000-8000-000000000001',
    'fa600000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000001',
    current_date,
    'completed',
    null,
    null,
    array['fa800000-0000-4000-8000-000000000001'::uuid]
  )$$,
  'P0001',
  'The Work Order has no assigned quotation scope',
  'Completing a job without an assigned scope returns a readable validation error'
);

select is(
  (
    select count(*)
    from public.job_work_completions
    where job_id = 'fa600000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'A rejected no-scope completion leaves no partial draft'
);

select * from finish();
rollback;
