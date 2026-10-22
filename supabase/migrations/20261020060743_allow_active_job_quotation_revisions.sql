-- Allow the existing quotation-revision engine to create a new editable
-- revision from the latest accepted quotation while its existing job is PO
-- Pending or Work in Progress. The accepted source remains locked and intact.
create or replace function private.create_quotation_revision_impl(
  p_source_quotation_id uuid,
  p_revision_purpose text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.quotations%rowtype;
  v_new_revision_number integer;
  v_new_id uuid;
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(coalesce(p_revision_purpose, '')), '') is null then
    raise exception 'Purpose of revision is required';
  end if;

  select *
  into v_source
  from public.quotations quotation
  where quotation.id = p_source_quotation_id
  for update;

  if not found then
    raise exception 'Quotation not found';
  end if;

  if not public.is_active_org_member(v_source.org_id)
     and not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  if v_source.status = 'accepted' then
    if not exists (
      select 1
      from public.jobs job
      where job.org_id = v_source.org_id
        and job.quotation_series_id = v_source.quotation_series_id
        and job.latest_accepted_quotation_id = v_source.id
        and job.job_status in ('po_pending', 'work_in_process')
    ) then
      raise exception 'Only the latest accepted quotation for a PO Pending or Work in Progress job can be revised';
    end if;

    if exists (
      select 1
      from public.quotations open_revision
      where open_revision.org_id = v_source.org_id
        and open_revision.quotation_series_id = v_source.quotation_series_id
        and open_revision.id <> v_source.id
        and open_revision.revision_number > v_source.revision_number
        and open_revision.status in ('draft', 'sent')
    ) then
      raise exception 'Complete the existing open revision before creating another revision';
    end if;
  elsif v_source.status <> 'sent' then
    raise exception 'A new revision can only be created from a Sent quotation or the latest accepted quotation for an active job';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_source.quotation_series_id::text, 0)
  );

  select coalesce(max(revision_number), -1) + 1
  into v_new_revision_number
  from public.quotations
  where org_id = v_source.org_id
    and quotation_series_id = v_source.quotation_series_id;

  insert into public.quotations (
    org_id,
    customer_id,
    quotation_number,
    quote_year,
    quote_sequence,
    quote_date,
    expiry_date,
    project_name,
    project_location,
    customer_rfq_number,
    revision_number,
    quotation_series_id,
    revision_source_id,
    revision_purpose,
    revision_created_by,
    revision_created_at,
    prepared_by,
    sales_rep_id,
    status,
    currency,
    final_discount_type,
    final_discount_value,
    final_discount_amount,
    material_total,
    material_profit_total,
    labour_total,
    scope_additional_charges_total,
    scopes_subtotal,
    scopes_discount_total,
    final_additional_charges_total,
    grand_total_before_tax,
    is_tax_exempt,
    tax_name,
    tax_rate,
    tax_amount,
    grand_total_after_tax,
    is_locked,
    created_by,
    updated_by
  ) values (
    v_source.org_id,
    v_source.customer_id,
    v_source.quotation_number,
    v_source.quote_year,
    v_source.quote_sequence,
    v_source.quote_date,
    v_source.expiry_date,
    v_source.project_name,
    v_source.project_location,
    v_source.customer_rfq_number,
    v_new_revision_number,
    v_source.quotation_series_id,
    v_source.id,
    btrim(p_revision_purpose),
    v_actor,
    now(),
    v_source.prepared_by,
    v_source.sales_rep_id,
    'draft',
    v_source.currency,
    v_source.final_discount_type,
    v_source.final_discount_value,
    v_source.final_discount_amount,
    v_source.material_total,
    v_source.material_profit_total,
    v_source.labour_total,
    v_source.scope_additional_charges_total,
    v_source.scopes_subtotal,
    v_source.scopes_discount_total,
    v_source.final_additional_charges_total,
    v_source.grand_total_before_tax,
    v_source.is_tax_exempt,
    v_source.tax_name,
    v_source.tax_rate,
    v_source.tax_amount,
    v_source.grand_total_after_tax,
    false,
    v_actor,
    v_actor
  )
  returning id into v_new_id;

  insert into public.quotation_revision_audit (
    org_id,
    quotation_id,
    quotation_series_id,
    revision_number,
    event_type,
    revision_source_id,
    revision_purpose,
    actor_id,
    metadata
  ) values (
    v_source.org_id,
    v_new_id,
    v_source.quotation_series_id,
    v_new_revision_number,
    'revision_created',
    v_source.id,
    btrim(p_revision_purpose),
    v_actor,
    jsonb_build_object(
      'source_status', v_source.status,
      'post_acceptance', v_source.status = 'accepted'
    )
  );

  return v_new_id;
end;
$$;

revoke all on function private.create_quotation_revision_impl(uuid, text)
  from public, anon, authenticated, service_role;
