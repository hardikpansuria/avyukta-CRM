begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(24);

select has_column('public', 'job_purchase_order_allocations', 'is_active', 'PO allocations have an active lifecycle state');
select has_column('public', 'job_purchase_order_allocations', 'unlinked_at', 'PO allocations retain their unlink timestamp');
select has_table('public', 'job_purchase_order_activity', 'PO edit and unlink activity is audited');
select has_function('public', 'update_job_purchase_order', array['uuid','text','date','text','jsonb'], 'PO correction RPC exists');
select has_function('public', 'unlink_job_purchase_order_allocation', array['uuid','text'], 'PO unlink RPC exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.job_purchase_order_activity'::regclass),
  true,
  'PO activity uses RLS'
);
select ok(
  not has_table_privilege('anon', 'public.job_purchase_order_activity', 'SELECT'),
  'Anonymous users cannot read PO activity'
);
select ok(
  not has_function_privilege('anon', 'public.update_job_purchase_order(uuid,text,date,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.unlink_job_purchase_order_allocation(uuid,text)', 'EXECUTE'),
  'Anonymous users cannot edit or unlink POs'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('b0000000-0000-4000-8000-000000000001', 'po-correction-admin@test.local', '{"full_name":"PO Correction Admin"}'::jsonb);

insert into public.organizations (id, org_code, name)
values ('b1000000-0000-4000-8000-000000000001', 'pocorrectionorg', 'PO Correction Test Org');

insert into public.org_members (user_id, org_id, role, status)
values ('b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'admin', 'active');

insert into public.customers (id, org_id, company_name, customer_code)
values ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Correction Customer', 'COR-1');

insert into public.quotations (
  id, org_id, customer_id, quotation_number, quote_year, quote_sequence,
  quotation_series_id, status, currency, project_name, tax_name, tax_rate,
  grand_total_before_tax, grand_total_after_tax
) values (
  'b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001', 'QT-COR-001', 2026, 201,
  'b4000000-0000-4000-8000-000000000001', 'accepted', 'CAD', 'Correction Work',
  'HST', 13, 100, 113
);

insert into public.quotation_scopes (id, org_id, quotation_id, scope_title, sort_order)
values ('b5000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
        'b3000000-0000-4000-8000-000000000001', 'Correction Scope', 1);

insert into public.jobs (
  id, org_id, quotation_series_id, original_accepted_quotation_id,
  latest_accepted_quotation_id, customer_id, job_number, job_year,
  job_sequence, job_status, salesperson_id
) values (
  'b6000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
  'JOB-COR-001', 2026, 201, 'work_in_process', 'b0000000-0000-4000-8000-000000000001'
);

insert into public.job_purchase_orders (
  id, org_id, customer_id, po_number, po_received_date, currency,
  combined_quotation_total, combined_po_amount_before_tax,
  combined_tax_amount, combined_po_total, difference_amount, current_po_total
) values (
  'b7000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001', 'PO-COR-001', current_date, 'CAD',
  113, 100, 13, 113, 0, 113
);

insert into public.job_purchase_order_allocations (
  id, org_id, purchase_order_id, job_id, quotation_id_snapshot,
  quotation_number_snapshot, revision_number_snapshot, project_name_snapshot,
  quotation_total, po_amount_before_tax, tax_name_snapshot, tax_rate_snapshot,
  tax_amount, total_po_amount, difference_amount, difference_acknowledged
) values (
  'b8000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
  'b7000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001', 'QT-COR-001', 0, 'Correction Work',
  113, 100, 'HST', 13, 13, 113, 0, false
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.update_job_purchase_order(
    'b7000000-0000-4000-8000-000000000001', 'PO-COR-001-UPDATED', current_date,
    'Corrected client PO',
    '[{"allocation_id":"b8000000-0000-4000-8000-000000000001","po_amount_before_tax":110,"difference_acknowledged":true}]'::jsonb
  )$$,
  'Authorized users can correct a PO atomically'
);
reset role;

select is((select count(*) from public.job_purchase_orders where id = 'b7000000-0000-4000-8000-000000000001'), 1::bigint, 'Editing updates the existing PO rather than duplicating it');
select is((select po_number from public.job_purchase_orders where id = 'b7000000-0000-4000-8000-000000000001'), 'PO-COR-001-UPDATED', 'PO number is corrected');
select is((select po_amount_before_tax from public.job_purchase_order_allocations where id = 'b8000000-0000-4000-8000-000000000001'), 110.00::numeric, 'PO allocation amount is corrected');
select is((select current_po_total from public.job_purchase_orders where id = 'b7000000-0000-4000-8000-000000000001'), 124.30::numeric, 'PO tax and current total are recalculated');
select is((select count(*) from public.job_purchase_order_activity where purchase_order_id = 'b7000000-0000-4000-8000-000000000001' and action = 'edited'), 1::bigint, 'PO correction is audited');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.unlink_job_purchase_order_allocation('b8000000-0000-4000-8000-000000000001', 'Wrong client PO')$$,
  'Authorized users can unlink an unused PO allocation'
);
reset role;

select is((select is_active from public.job_purchase_order_allocations where id = 'b8000000-0000-4000-8000-000000000001'), false, 'Unlink preserves the allocation as inactive history');
select is((select job_status from public.jobs where id = 'b6000000-0000-4000-8000-000000000001'), 'po_pending', 'Unlinked job returns to PO Pending');
select is((select current_po_total from public.job_purchase_orders where id = 'b7000000-0000-4000-8000-000000000001'), 0.00::numeric, 'Unlinked PO totals exclude inactive allocations');
select is((select count(*) from public.job_purchase_order_activity where allocation_id = 'b8000000-0000-4000-8000-000000000001' and action = 'unlinked'), 1::bigint, 'PO unlink is audited');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.create_job_purchase_order(
    'PO-COR-REPLACEMENT', current_date, 'Replacement PO',
    '[{"job_id":"b6000000-0000-4000-8000-000000000001","po_amount_before_tax":100,"difference_acknowledged":false}]'::jsonb
  )$$,
  'A corrected PO can be attached after unlinking the wrong one'
);
reset role;

select is((select count(*) from public.job_purchase_order_allocations where job_id = 'b6000000-0000-4000-8000-000000000001'), 2::bigint, 'Historical and replacement allocations are both preserved');
select is((select count(*) from public.job_purchase_order_allocations where job_id = 'b6000000-0000-4000-8000-000000000001' and is_active), 1::bigint, 'Only one replacement allocation is active');

insert into public.job_invoices (
  id, org_id, job_id, purchase_order_id, invoice_number, invoice_date,
  invoice_amount, status
)
select
  'b9000000-0000-4000-8000-000000000001', allocation.org_id,
  allocation.job_id, allocation.purchase_order_id, 'INV-COR-001', current_date,
  50, 'draft'
from public.job_purchase_order_allocations allocation
where allocation.job_id = 'b6000000-0000-4000-8000-000000000001'
  and allocation.is_active;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select throws_ok(
  format(
    'select public.unlink_job_purchase_order_allocation(%L::uuid, null)',
    (select id from public.job_purchase_order_allocations where job_id = 'b6000000-0000-4000-8000-000000000001' and is_active)
  ),
  'P0001',
  'This PO cannot be removed because invoicing or completed-work records exist for the job',
  'PO unlink is blocked once invoicing depends on the job'
);
reset role;

select is((select count(*) from public.job_purchase_order_allocations where job_id = 'b6000000-0000-4000-8000-000000000001' and is_active), 1::bigint, 'Blocked unlink leaves the replacement allocation active');

select * from finish();
rollback;
