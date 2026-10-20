-- Keep an in-progress job, its assigned scopes, its linked PO allocation, and
-- its billing balance aligned when a later quotation revision is accepted.
-- Existing invoices and invoice requests remain linked to the same job and PO.

alter table public.job_purchase_order_revision_items
  drop constraint job_po_revision_items_change_type_check;

alter table public.job_purchase_order_revision_items
  add constraint job_po_revision_items_change_type_check
  check (
    change_type = any (array[
      'original'::text,
      'carried'::text,
      'added'::text,
      'removed'::text,
      'updated'::text
    ])
  );

create or replace function public.sync_job_scope_assignments()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.job_status in ('po_pending', 'work_in_process') then
    delete from public.job_scope_assignments
    where job_id = new.id;

    insert into public.job_scope_assignments (
      org_id,
      job_id,
      quotation_id,
      scope_id,
      assigned_by
    )
    select
      new.org_id,
      new.id,
      new.latest_accepted_quotation_id,
      scope.id,
      coalesce(new.updated_by, new.created_by)
    from public.quotation_scopes scope
    where scope.org_id = new.org_id
      and scope.quotation_id = new.latest_accepted_quotation_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_job_scope_assignments()
  from public, anon, authenticated;
grant execute on function public.sync_job_scope_assignments()
  to service_role;

create or replace function private.sync_purchase_order_from_accepted_quotation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allocation public.job_purchase_order_allocations%rowtype;
  v_quotation public.quotations%rowtype;
  v_purchase_order public.job_purchase_orders%rowtype;
  v_actor uuid;
  v_invoiced numeric(14,2) := 0;
  v_pending_requests numeric(14,2) := 0;
  v_committed numeric(14,2) := 0;
  v_before_tax numeric(14,2) := 0;
  v_tax_amount numeric(14,2) := 0;
  v_new_total numeric(14,2) := 0;
  v_combined_quotation_total numeric(14,2) := 0;
  v_combined_before_tax numeric(14,2) := 0;
  v_combined_tax numeric(14,2) := 0;
  v_combined_po_total numeric(14,2) := 0;
  v_revision_number integer;
  v_revision_id uuid;
begin
  if old.latest_accepted_quotation_id is not distinct from
     new.latest_accepted_quotation_id then
    return new;
  end if;

  if new.job_status <> 'work_in_process' then
    return new;
  end if;

  select allocation.*
  into v_allocation
  from public.job_purchase_order_allocations allocation
  where allocation.org_id = new.org_id
    and allocation.job_id = new.id
  for update;

  if not found then
    return new;
  end if;

  select quotation.*
  into v_quotation
  from public.quotations quotation
  where quotation.org_id = new.org_id
    and quotation.id = new.latest_accepted_quotation_id;

  if not found or v_quotation.status <> 'accepted' then
    raise exception 'The latest accepted quotation could not be loaded'
      using errcode = '23514';
  end if;

  select purchase_order.*
  into v_purchase_order
  from public.job_purchase_orders purchase_order
  where purchase_order.org_id = new.org_id
    and purchase_order.id = v_allocation.purchase_order_id
  for update;

  if not found then
    raise exception 'The linked purchase order could not be loaded'
      using errcode = '23514';
  end if;

  v_actor := coalesce(new.updated_by, new.created_by, new.salesperson_id);
  v_before_tax := round(coalesce(v_quotation.grand_total_before_tax, 0), 2);
  v_tax_amount := round(coalesce(v_quotation.tax_amount, 0), 2);
  v_new_total := round(
    coalesce(
      v_quotation.grand_total_after_tax,
      v_before_tax + v_tax_amount,
      0
    ),
    2
  );

  select coalesce(sum(invoice.invoice_amount), 0)::numeric(14,2)
  into v_invoiced
  from public.job_invoices invoice
  where invoice.org_id = new.org_id
    and invoice.job_id = new.id;

  select coalesce(sum(request.requested_amount), 0)::numeric(14,2)
  into v_pending_requests
  from public.invoice_requests request
  where request.org_id = new.org_id
    and request.job_id = new.id
    and request.status in ('pending', 'under_review')
    and request.invoice_type <> 'credit_note';

  v_committed := round(v_invoiced + v_pending_requests, 2);
  if v_new_total + 0.005 < v_committed then
    raise exception
      'The revised quotation total cannot be lower than the amount already invoiced or committed through active invoice requests'
      using errcode = '23514';
  end if;

  update public.job_purchase_order_allocations
  set
    quotation_id_snapshot = v_quotation.id,
    quotation_number_snapshot = v_quotation.quotation_number,
    revision_number_snapshot = v_quotation.revision_number,
    project_name_snapshot = v_quotation.project_name,
    quotation_total = v_new_total,
    po_amount_before_tax = v_before_tax,
    tax_name_snapshot = v_quotation.tax_name,
    tax_rate_snapshot = coalesce(v_quotation.tax_rate, 0),
    tax_amount = v_tax_amount,
    total_po_amount = v_new_total,
    difference_amount = 0,
    difference_acknowledged = false
  where id = v_allocation.id
    and org_id = new.org_id;

  select
    coalesce(sum(allocation.quotation_total), 0)::numeric(14,2),
    coalesce(sum(allocation.po_amount_before_tax), 0)::numeric(14,2),
    coalesce(sum(allocation.tax_amount), 0)::numeric(14,2),
    coalesce(sum(allocation.total_po_amount), 0)::numeric(14,2)
  into
    v_combined_quotation_total,
    v_combined_before_tax,
    v_combined_tax,
    v_combined_po_total
  from public.job_purchase_order_allocations allocation
  where allocation.org_id = new.org_id
    and allocation.purchase_order_id = v_purchase_order.id;

  select coalesce(max(revision.revision_number), 0) + 1
  into v_revision_number
  from public.job_purchase_order_revisions revision
  where revision.purchase_order_id = v_purchase_order.id;

  insert into public.job_purchase_order_revisions (
    org_id,
    purchase_order_id,
    revision_number,
    revision_date,
    previous_po_amount,
    revised_po_amount,
    difference_amount,
    change_percentage,
    document_id,
    internal_remarks,
    created_by
  ) values (
    new.org_id,
    v_purchase_order.id,
    v_revision_number,
    current_date,
    v_purchase_order.current_po_total,
    v_combined_po_total,
    round(v_combined_po_total - v_purchase_order.current_po_total, 2),
    case
      when v_purchase_order.current_po_total = 0 then null
      else round(
        (v_combined_po_total - v_purchase_order.current_po_total)
          * 100 / v_purchase_order.current_po_total,
        4
      )
    end,
    null,
    format(
      'Automatically synchronized after acceptance of quotation %s Revision %s.',
      v_quotation.quotation_number,
      v_quotation.revision_number
    ),
    v_actor
  )
  returning id into v_revision_id;

  insert into public.job_purchase_order_revision_items (
    org_id,
    revision_id,
    allocation_id,
    job_id,
    quotation_id,
    quotation_number_snapshot,
    quotation_revision_snapshot,
    project_name_snapshot,
    quotation_amount_snapshot,
    po_amount_snapshot,
    currency_snapshot,
    job_number_snapshot,
    job_status_snapshot,
    change_type,
    is_included
  )
  select
    allocation.org_id,
    v_revision_id,
    allocation.id,
    allocation.job_id,
    allocation.quotation_id_snapshot,
    allocation.quotation_number_snapshot,
    allocation.revision_number_snapshot,
    allocation.project_name_snapshot,
    allocation.quotation_total,
    allocation.total_po_amount,
    v_purchase_order.currency,
    job.job_number,
    job.job_status,
    case
      when allocation.id = v_allocation.id then 'updated'
      else 'carried'
    end,
    true
  from public.job_purchase_order_allocations allocation
  join public.jobs job
    on job.id = allocation.job_id
   and job.org_id = allocation.org_id
  where allocation.org_id = new.org_id
    and allocation.purchase_order_id = v_purchase_order.id;

  update public.job_purchase_orders
  set
    combined_quotation_total = v_combined_quotation_total,
    combined_po_amount_before_tax = v_combined_before_tax,
    combined_tax_amount = v_combined_tax,
    combined_po_total = v_combined_po_total,
    difference_amount = round(
      v_combined_po_total - v_combined_quotation_total,
      2
    ),
    current_revision_number = v_revision_number,
    current_po_total = v_combined_po_total,
    updated_by = v_actor,
    updated_at = now()
  where id = v_purchase_order.id
    and org_id = new.org_id;

  return new;
end;
$$;

revoke all on function private.sync_purchase_order_from_accepted_quotation()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_purchase_order_from_accepted_quotation
  on public.jobs;

create trigger sync_purchase_order_from_accepted_quotation
after update of latest_accepted_quotation_id on public.jobs
for each row
when (
  old.latest_accepted_quotation_id is distinct from
  new.latest_accepted_quotation_id
)
execute function private.sync_purchase_order_from_accepted_quotation();
