begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);

select has_table('public', 'job_purchase_order_revisions', 'PO revision records exist');
select has_table('public', 'job_purchase_order_revision_items', 'PO revision snapshot items exist');
select has_column('public', 'job_purchase_orders', 'current_revision_number', 'PO tracks its current revision');
select has_column('public', 'job_purchase_orders', 'current_po_total', 'PO tracks its current revised total');
select col_not_null('public', 'job_purchase_order_revisions', 'revision_number', 'Revision number is required');
select col_not_null('public', 'job_purchase_order_revisions', 'revised_po_amount', 'Revised amount is required');
select col_not_null('public', 'job_purchase_order_revision_items', 'change_type', 'Item change type is required');
select col_not_null('public', 'job_purchase_order_revision_items', 'is_included', 'Snapshot inclusion state is required');
select has_function(
  'public',
  'create_job_purchase_order_revision',
  array['uuid', 'date', 'uuid', 'jsonb', 'uuid[]', 'text', 'boolean'],
  'Atomic PO revision function exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.job_purchase_order_revisions'::regclass),
  true,
  'PO revisions use RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.job_purchase_order_revision_items'::regclass),
  true,
  'PO revision items use RLS'
);
select ok(
  not has_table_privilege('anon', 'public.job_purchase_order_revisions', 'SELECT'),
  'Anonymous users cannot read PO revision history'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-000000000001', 'po-revision-admin@test.local', '{"full_name":"PO Revision Admin"}'::jsonb);

insert into public.organizations (id, org_code, name)
values ('a1000000-0000-4000-8000-000000000001', 'porevisionorg', 'PO Revision Test Org');

insert into public.org_members (user_id, org_id, role, status)
values ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'admin', 'active');

insert into public.customers (id, org_id, company_name, customer_code)
values ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Revision Customer', 'REV-1');

insert into public.quotations (
  id, org_id, customer_id, quotation_number, quote_year, quote_sequence,
  quotation_series_id, status, currency, project_name,
  grand_total_before_tax, grand_total_after_tax
) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'QT-REV-001', 2026, 101,
   'a4000000-0000-4000-8000-000000000001', 'accepted', 'CAD', 'Original Work', 370, 370),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'QT-REV-002', 2026, 102,
   'a4000000-0000-4000-8000-000000000002', 'accepted', 'CAD', 'Added Work', 80, 80);

insert into public.quotation_scopes (id, org_id, quotation_id, scope_title, sort_order)
values ('a5000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
        'a3000000-0000-4000-8000-000000000002', 'Added Scope', 1);

insert into public.jobs (
  id, org_id, quotation_series_id, original_accepted_quotation_id,
  latest_accepted_quotation_id, customer_id, job_number, job_year,
  job_sequence, job_status
) values
  ('a6000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'JOB-REV-001', 2026, 101, 'work_in_process'),
  ('a6000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002',
   'a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001',
   null, null, null, 'po_pending');

insert into public.job_purchase_orders (
  id, org_id, customer_id, po_number, po_received_date, currency
) values (
  'a7000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001', 'PO-REV-5001', current_date, 'CAD'
);

insert into public.job_purchase_order_allocations (
  id, org_id, purchase_order_id, job_id, quotation_id_snapshot,
  quotation_number_snapshot, revision_number_snapshot, project_name_snapshot,
  quotation_total, po_amount_before_tax, tax_rate_snapshot,
  tax_amount, total_po_amount, difference_amount, difference_acknowledged
) values (
  'a8000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001', 'QT-REV-001', 0, 'Original Work',
  370, 370, 0, 0, 370, 0, false
);

update public.job_purchase_orders
set combined_quotation_total = 370,
    combined_po_amount_before_tax = 370,
    combined_po_total = 370
where id = 'a7000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.job_purchase_order_revisions where purchase_order_id = 'a7000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Completing the existing PO workflow creates one Original snapshot'
);
select is(
  (select revised_po_amount from public.job_purchase_order_revisions where purchase_order_id = 'a7000000-0000-4000-8000-000000000001' and revision_number = 0),
  370.00::numeric,
  'Original PO amount is preserved in Revision 0'
);
select is(
  (select count(*) from public.job_purchase_order_revision_items where allocation_id = 'a8000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Original quotation relationship is snapshotted once'
);

update public.jobs set job_status = 'work_completed'
where id = 'a6000000-0000-4000-8000-000000000001';

insert into public.job_purchase_order_documents (
  id, org_id, purchase_order_id, document_type, file_name, file_path, mime_type
) values (
  'a9000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001', 'po_revision', 'PO-REV-5001-R1.pdf',
  'a1000000-0000-4000-8000-000000000001/purchase-orders/a7000000-0000-4000-8000-000000000001/a9000000-0000-4000-8000-000000000001-PO-REV-5001-R1.pdf',
  'application/pdf'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.create_job_purchase_order_revision(
    'a7000000-0000-4000-8000-000000000001', current_date,
    'a9000000-0000-4000-8000-000000000001',
    '[{"job_id":"a6000000-0000-4000-8000-000000000002","po_amount_before_tax":80,"difference_acknowledged":false,"scope_ids":["a5000000-0000-4000-8000-000000000002"]}]'::jsonb,
    '{}'::uuid[], null, false
  )$$,
  'An authorized user can create Revision 1 atomically'
);
reset role;

select is((select current_revision_number from public.job_purchase_orders where id = 'a7000000-0000-4000-8000-000000000001'), 1, 'PO advances to Revision 1');
select is((select current_po_total from public.job_purchase_orders where id = 'a7000000-0000-4000-8000-000000000001'), 450.00::numeric, 'Current PO total becomes 450');
select is((select difference_amount from public.job_purchase_order_revisions where purchase_order_id = 'a7000000-0000-4000-8000-000000000001' and revision_number = 1), 80.00::numeric, 'PO Revision Impact is +80');
select is((select change_percentage from public.job_purchase_order_revisions where purchase_order_id = 'a7000000-0000-4000-8000-000000000001' and revision_number = 1), 21.6216::numeric, 'PO Revision Impact percentage is calculated');
select is((select count(*) from public.job_purchase_order_revision_items item join public.job_purchase_order_revisions revision on revision.id = item.revision_id where revision.purchase_order_id = 'a7000000-0000-4000-8000-000000000001' and revision.revision_number = 1 and item.is_included), 2::bigint, 'Revision 1 contains the carried and added quotations');
select is((select job_status from public.jobs where id = 'a6000000-0000-4000-8000-000000000001'), 'work_completed', 'Existing completed job stays completed');
select is((select job_status from public.jobs where id = 'a6000000-0000-4000-8000-000000000002'), 'work_in_process', 'Only the newly added job becomes active');
select is((select count(*) from public.job_purchase_order_allocations where purchase_order_id = 'a7000000-0000-4000-8000-000000000001'), 2::bigint, 'New quotation receives one PO allocation without duplicating the original');
select is((select document_id from public.job_purchase_order_revisions where purchase_order_id = 'a7000000-0000-4000-8000-000000000001' and revision_number = 1), 'a9000000-0000-4000-8000-000000000001'::uuid, 'Revision links the required revised PO document');

select * from finish();
rollback;
