-- Keep replacement PO semantics deterministic: a replacement supersedes the
-- job's single active PO, while supplemental POs remain independent additions.
create or replace function public.approve_job_change_order(
  p_change_order_id uuid,
  p_purchase_order_id uuid,
  p_po_amount_before_tax numeric,
  p_replaced_allocation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_change public.job_change_orders%rowtype;
  v_job public.jobs%rowtype;
  v_quotation public.quotations%rowtype;
  v_po public.job_purchase_orders%rowtype;
  v_replaced public.job_purchase_order_allocations%rowtype;
  v_expected_total numeric(14,2);
  v_before_tax numeric(14,2) := round(coalesce(p_po_amount_before_tax, 0), 2);
  v_tax numeric(14,2);
  v_total numeric(14,2);
  v_allocation_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;

  select * into v_change from public.job_change_orders
  where id = p_change_order_id for update;
  if not found then raise exception 'Change Order not found'; end if;
  if v_change.status <> 'draft' then raise exception 'Only a draft Change Order can be approved'; end if;
  if not private.current_user_has_permission(v_change.org_id, 'change_orders', 'approve')
     or not private.current_user_has_permission(v_change.org_id, 'purchase_orders', 'attach_po') then
    raise exception 'Not authorized';
  end if;

  select * into v_job from public.jobs
  where id = v_change.job_id and org_id = v_change.org_id for update;
  if v_job.job_status not in ('work_in_process', 'on_hold') then
    raise exception 'Only active or On Hold jobs can receive a Change Order';
  end if;
  select * into v_quotation from public.quotations
  where id = v_job.latest_accepted_quotation_id and org_id = v_job.org_id;
  if not found then raise exception 'Accepted quotation not found'; end if;
  select * into v_po from public.job_purchase_orders
  where id = p_purchase_order_id and org_id = v_change.org_id for update;
  if not found or v_po.customer_id <> v_job.customer_id then
    raise exception 'Prepared Purchase Order does not belong to this job';
  end if;
  if not exists (
    select 1 from public.job_purchase_order_documents document
    where document.purchase_order_id = v_po.id
      and document.org_id = v_po.org_id
      and document.document_type = 'purchase_order'
  ) then raise exception 'A Purchase Order document is required'; end if;
  if v_before_tax < 0 then raise exception 'PO Amount Before Tax cannot be negative'; end if;

  v_tax := round(v_before_tax * v_change.tax_rate / 100, 2);
  v_total := round(v_before_tax + v_tax, 2);
  if v_change.po_strategy = 'replacement' then
    if p_replaced_allocation_id is null then raise exception 'Select the PO allocation being replaced'; end if;
    select * into v_replaced from public.job_purchase_order_allocations
    where id = p_replaced_allocation_id
      and org_id = v_change.org_id and job_id = v_job.id and is_active
    for update;
    if not found then raise exception 'The selected PO allocation is no longer active'; end if;
    if (
      select count(*) from public.job_purchase_order_allocations allocation
      where allocation.job_id = v_job.id and allocation.org_id = v_job.org_id
        and allocation.is_active
    ) <> 1 then
      raise exception 'A replacement PO requires exactly one active job PO. Cancel or resolve supplemental POs first.';
    end if;
    v_expected_total := round(
      v_replaced.total_po_amount + v_change.total_amount,
      2
    );
  else
    if p_replaced_allocation_id is not null then raise exception 'Supplemental POs do not replace an allocation'; end if;
    v_expected_total := v_change.total_amount;
  end if;

  insert into public.job_purchase_order_allocations (
    org_id, purchase_order_id, job_id, quotation_id_snapshot,
    quotation_number_snapshot, revision_number_snapshot,
    customer_name_snapshot, project_name_snapshot, quotation_total,
    po_amount_before_tax, tax_name_snapshot, tax_rate_snapshot,
    tax_amount, total_po_amount, difference_amount,
    difference_acknowledged, allocation_type, change_order_id,
    replaces_allocation_id
  ) values (
    v_change.org_id, v_po.id, v_job.id, v_quotation.id,
    v_quotation.quotation_number, coalesce(v_quotation.revision_number, 0),
    null, v_quotation.project_name, v_expected_total,
    v_before_tax, v_change.tax_name, v_change.tax_rate,
    v_tax, v_total, round(v_total - v_expected_total, 2),
    v_total <> v_expected_total,
    v_change.po_strategy, v_change.id,
    case when v_change.po_strategy = 'replacement' then v_replaced.id else null end
  ) returning id into v_allocation_id;

  if v_change.po_strategy = 'replacement' then
    update public.job_purchase_order_allocations
    set is_active = false, unlinked_at = now(), unlinked_by = v_actor,
        unlink_reason = 'Replaced by ' || v_change.change_order_number
    where id = v_replaced.id;
    insert into public.job_purchase_order_activity (
      org_id, purchase_order_id, allocation_id, job_id, quotation_id,
      action, actor_id, before_data, after_data, notes
    ) values (
      v_change.org_id, v_replaced.purchase_order_id, v_replaced.id,
      v_job.id, v_replaced.quotation_id_snapshot, 'unlinked', v_actor,
      to_jsonb(v_replaced),
      jsonb_build_object('is_active', false, 'change_order_id', v_change.id),
      'Replaced by ' || v_change.change_order_number
    );
    perform private.recalculate_job_purchase_order_totals(v_replaced.purchase_order_id, v_actor);
  end if;

  insert into public.job_change_order_purchase_orders (
    org_id, change_order_id, purchase_order_id, relationship_type,
    replaced_allocation_id, created_by
  ) values (
    v_change.org_id, v_change.id, v_po.id, v_change.po_strategy,
    case when v_change.po_strategy = 'replacement' then v_replaced.id else null end,
    v_actor
  );

  update public.job_purchase_orders
  set combined_quotation_total = v_expected_total,
      combined_po_amount_before_tax = v_before_tax,
      combined_tax_amount = v_tax,
      combined_po_total = v_total,
      current_po_total = v_total,
      difference_amount = round(v_total - v_expected_total, 2),
      updated_by = v_actor, updated_at = now()
  where id = v_po.id;

  update public.job_change_orders
  set status = 'approved', approved_at = now(), approved_by = v_actor,
      updated_by = v_actor
  where id = v_change.id;
  return v_allocation_id;
end;
$$;

revoke all on function public.approve_job_change_order(uuid, uuid, numeric, uuid)
  from public, anon;
grant execute on function public.approve_job_change_order(uuid, uuid, numeric, uuid)
  to authenticated, service_role;
