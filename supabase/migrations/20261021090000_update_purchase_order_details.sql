-- Atomically correct the editable details of an existing single-job PO while
-- preserving the PO, job, invoices, invoice requests, documents, and history.
-- Combined POs must continue through the allocation-aware PO Revision flow.

create or replace function public.update_job_purchase_order_details(
  p_purchase_order_id uuid,
  p_po_number text,
  p_po_amount_before_tax numeric,
  p_internal_remarks text,
  p_po_received_date date default null,
  p_document_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_po public.job_purchase_orders%rowtype;
  v_allocation public.job_purchase_order_allocations%rowtype;
  v_job public.jobs%rowtype;
  v_current_allocation_count integer := 0;
  v_current_allocation_id uuid;
  v_previous_document_id uuid;
  v_revision_id uuid := gen_random_uuid();
  v_revision_number integer;
  v_before_tax numeric(14,2);
  v_tax_amount numeric(14,2);
  v_total numeric(14,2);
  v_difference numeric(14,2);
  v_invoiced numeric(14,2) := 0;
  v_pending_requests numeric(14,2) := 0;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  if p_purchase_order_id is null then
    raise exception 'Purchase order is required';
  end if;
  if nullif(trim(p_po_number), '') is null then
    raise exception 'PO number is required';
  end if;
  if length(trim(p_po_number)) > 120 then
    raise exception 'PO number must be 120 characters or less';
  end if;
  if p_po_amount_before_tax is null or p_po_amount_before_tax < 0 then
    raise exception 'PO Amount Before Tax is required and cannot be negative';
  end if;
  if nullif(trim(p_internal_remarks), '') is null then
    raise exception 'Internal Remarks are required';
  end if;
  if length(trim(p_internal_remarks)) > 4000 then
    raise exception 'Internal Remarks must be 4,000 characters or less';
  end if;

  select purchase_order.*
  into v_po
  from public.job_purchase_orders purchase_order
  where purchase_order.id = p_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase order not found';
  end if;
  if not private.current_user_has_permission(
    v_po.org_id,
    'purchase_orders',
    'edit'
  ) then
    raise exception 'Not authorized';
  end if;

  if p_document_id is not null and not exists (
    select 1
    from public.job_purchase_order_documents document
    where document.id = p_document_id
      and document.org_id = v_po.org_id
      and document.purchase_order_id = v_po.id
  ) then
    raise exception 'The replacement PO document was not found';
  end if;

  select
    count(*)::integer,
    (array_agg(item.allocation_id order by item.created_at))[1]
  into v_current_allocation_count, v_current_allocation_id
  from public.job_purchase_order_revision_items item
  join public.job_purchase_order_revisions revision
    on revision.id = item.revision_id
   and revision.org_id = item.org_id
  where revision.purchase_order_id = v_po.id
    and revision.revision_number = v_po.current_revision_number
    and item.is_included;

  if v_current_allocation_count = 0 then
    select
      count(*)::integer,
      (array_agg(allocation.id order by allocation.created_at))[1]
    into v_current_allocation_count, v_current_allocation_id
    from public.job_purchase_order_allocations allocation
    where allocation.org_id = v_po.org_id
      and allocation.purchase_order_id = v_po.id;
  end if;

  if v_current_allocation_count = 0 or v_current_allocation_id is null then
    raise exception 'The current PO allocation could not be loaded';
  end if;

  if v_current_allocation_count > 1 then
    if round(p_po_amount_before_tax, 2) is distinct from
       round(v_po.combined_po_amount_before_tax, 2) then
      raise exception 'A combined PO amount must be changed through the PO Revision workflow so each job allocation remains accurate';
    end if;

    update public.job_purchase_orders
    set
      po_number = trim(p_po_number),
      po_received_date = coalesce(p_po_received_date, po_received_date),
      internal_remarks = trim(p_internal_remarks),
      updated_by = v_actor,
      updated_at = now()
    where id = v_po.id
      and org_id = v_po.org_id;

    if v_po.po_received_date is distinct from coalesce(p_po_received_date, v_po.po_received_date)
       or v_po.internal_remarks is distinct from trim(p_internal_remarks)
       or p_document_id is not null then
      insert into public.customer_activities (
        org_id,
        customer_id,
        activity_type,
        description,
        linked_record_type,
        linked_record_id,
        linked_record_number,
        actor_id,
        occurred_at,
        metadata
      ) values (
        v_po.org_id,
        v_po.customer_id,
        'customer_po_updated',
        format('PO %s details updated', trim(p_po_number)),
        'purchase_order',
        v_po.id,
        trim(p_po_number),
        v_actor,
        now(),
        jsonb_build_object(
          'fields', jsonb_build_array(
            'internal_remarks',
            'po_received_date',
            'document'
          ),
          'combined_po', true,
          'old_po_received_date', v_po.po_received_date,
          'new_po_received_date', coalesce(p_po_received_date, v_po.po_received_date),
          'document_id', p_document_id
        )
      );
    end if;

    return v_po.id;
  end if;

  select allocation.*
  into v_allocation
  from public.job_purchase_order_allocations allocation
  where allocation.id = v_current_allocation_id
    and allocation.org_id = v_po.org_id
  for update;

  if not found then
    raise exception 'The current PO allocation could not be loaded';
  end if;

  select job.*
  into v_job
  from public.jobs job
  where job.id = v_allocation.job_id
    and job.org_id = v_po.org_id;

  if not found then
    raise exception 'The linked job could not be loaded';
  end if;

  v_before_tax := round(p_po_amount_before_tax, 2);
  v_tax_amount := round(
    v_before_tax * coalesce(v_allocation.tax_rate_snapshot, 0) / 100,
    2
  );
  v_total := round(v_before_tax + v_tax_amount, 2);
  v_difference := round(v_total - v_allocation.quotation_total, 2);

  select coalesce(sum(invoice.invoice_amount), 0)::numeric(14,2)
  into v_invoiced
  from public.job_invoices invoice
  where invoice.org_id = v_po.org_id
    and invoice.job_id = v_allocation.job_id;

  select coalesce(sum(request.requested_amount), 0)::numeric(14,2)
  into v_pending_requests
  from public.invoice_requests request
  where request.org_id = v_po.org_id
    and request.job_id = v_allocation.job_id
    and request.status in ('pending', 'under_review')
    and request.invoice_type <> 'credit_note';

  if v_total + 0.005 < round(v_invoiced + v_pending_requests, 2) then
    raise exception 'The revised PO total cannot be lower than the amount already invoiced or committed through active invoice requests';
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
  into v_revision_number
  from public.job_purchase_order_revisions revision
  where revision.purchase_order_id = v_po.id;

  select revision.document_id
  into v_previous_document_id
  from public.job_purchase_order_revisions revision
  where revision.purchase_order_id = v_po.id
    and revision.revision_number = v_po.current_revision_number;

  update public.job_purchase_order_allocations
  set
    po_amount_before_tax = v_before_tax,
    tax_amount = v_tax_amount,
    total_po_amount = v_total,
    difference_amount = v_difference,
    difference_acknowledged = (v_difference <> 0)
  where id = v_allocation.id
    and org_id = v_po.org_id;

  insert into public.job_purchase_order_revisions (
    id,
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
    v_revision_id,
    v_po.org_id,
    v_po.id,
    v_revision_number,
    coalesce(p_po_received_date, v_po.po_received_date, current_date),
    v_po.current_po_total,
    v_total,
    round(v_total - v_po.current_po_total, 2),
    case
      when v_po.current_po_total = 0 then null
      else round((v_total - v_po.current_po_total) * 100 / v_po.current_po_total, 4)
    end,
    coalesce(p_document_id, v_previous_document_id),
    trim(p_internal_remarks),
    v_actor
  );

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
  ) values (
    v_po.org_id,
    v_revision_id,
    v_allocation.id,
    v_allocation.job_id,
    v_allocation.quotation_id_snapshot,
    v_allocation.quotation_number_snapshot,
    v_allocation.revision_number_snapshot,
    v_allocation.project_name_snapshot,
    v_allocation.quotation_total,
    v_total,
    v_po.currency,
    v_job.job_number,
    v_job.job_status,
    'updated',
    true
  );

  update public.job_purchase_orders
  set
    po_number = trim(p_po_number),
    po_received_date = coalesce(p_po_received_date, po_received_date),
    combined_quotation_total = v_allocation.quotation_total,
    combined_po_amount_before_tax = v_before_tax,
    combined_tax_amount = v_tax_amount,
    combined_po_total = v_total,
    difference_amount = v_difference,
    current_revision_number = v_revision_number,
    current_po_total = v_total,
    internal_remarks = trim(p_internal_remarks),
    updated_by = v_actor,
    updated_at = now()
  where id = v_po.id
    and org_id = v_po.org_id;

  if v_po.combined_po_amount_before_tax is distinct from v_before_tax
     or v_po.po_received_date is distinct from coalesce(p_po_received_date, v_po.po_received_date)
     or v_po.internal_remarks is distinct from trim(p_internal_remarks)
     or p_document_id is not null then
    insert into public.customer_activities (
      org_id,
      customer_id,
      activity_type,
      description,
      linked_record_type,
      linked_record_id,
      linked_record_number,
      actor_id,
      occurred_at,
      metadata
    ) values (
      v_po.org_id,
      v_po.customer_id,
      'customer_po_updated',
      format('PO %s details updated', trim(p_po_number)),
      'purchase_order',
      v_po.id,
      trim(p_po_number),
      v_actor,
      now(),
      jsonb_build_object(
        'fields', jsonb_build_array(
          'po_amount_before_tax',
          'internal_remarks',
          'po_received_date',
          'document'
        ),
        'old_po_amount_before_tax', v_po.combined_po_amount_before_tax,
        'new_po_amount_before_tax', v_before_tax,
        'old_po_total', v_po.current_po_total,
        'new_po_total', v_total,
        'old_po_received_date', v_po.po_received_date,
        'new_po_received_date', coalesce(p_po_received_date, v_po.po_received_date),
        'document_id', p_document_id,
        'revision_number', v_revision_number
      )
    );
  end if;

  return v_revision_id;
end;
$$;

revoke all on function public.update_job_purchase_order_details(
  uuid,
  text,
  numeric,
  text,
  date,
  uuid
) from public, anon;

grant execute on function public.update_job_purchase_order_details(
  uuid,
  text,
  numeric,
  text,
  date,
  uuid
) to authenticated;
