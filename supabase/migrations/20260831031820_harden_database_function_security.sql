-- Preserve the existing atomic implementations behind authorization wrappers.
-- The private implementations are not exposed by the Data API and receive no
-- direct execute grant.
alter function public.create_job_purchase_order(text, date, text, jsonb)
  rename to create_job_purchase_order_impl;
alter function public.create_job_purchase_order_impl(text, date, text, jsonb)
  set schema private;

alter function public.create_quotation_revision(uuid, text)
  rename to create_quotation_revision_impl;
alter function public.create_quotation_revision_impl(uuid, text)
  set schema private;

alter function public.create_job_purchase_order_revision(uuid, date, uuid, jsonb, uuid[], text, boolean)
  rename to create_job_purchase_order_revision_impl;
alter function public.create_job_purchase_order_revision_impl(uuid, date, uuid, jsonb, uuid[], text, boolean)
  set schema private;

create function public.create_job_purchase_order(
  p_po_number text,
  p_po_received_date date,
  p_internal_remarks text,
  p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org_id uuid;
  v_member_role text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  if p_allocations is null
     or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one job allocation is required';
  end if;

  select job.org_id
  into v_org_id
  from public.jobs job
  where job.id = (p_allocations->0->>'job_id')::uuid;
  if not found then
    raise exception 'Job not found';
  end if;

  if not private.user_has_permission(
    v_actor,
    v_org_id,
    'purchase_orders',
    'attach_po'
  ) then
    raise exception 'Not authorized';
  end if;

  select lower(member.role::text)
  into v_member_role
  from public.org_members member
  where member.user_id = v_actor
    and member.org_id = v_org_id
    and member.status = 'active';

  if v_member_role in ('sales', 'salesperson')
     and not private.user_has_permission(
       v_actor,
       v_org_id,
       'purchase_orders',
       'edit_all'
     )
     and exists (
       select 1
       from jsonb_array_elements(p_allocations) allocation
       join public.jobs job
         on job.id = (allocation->>'job_id')::uuid
        and job.org_id = v_org_id
       where job.salesperson_id is distinct from v_actor
     ) then
    raise exception 'Not authorized for one or more selected jobs';
  end if;

  return private.create_job_purchase_order_impl(
    p_po_number,
    p_po_received_date,
    p_internal_remarks,
    p_allocations
  );
end;
$$;

create function public.create_quotation_revision(
  p_source_quotation_id uuid,
  p_revision_purpose text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org_id uuid;
  v_sales_rep_id uuid;
  v_member_role text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select quotation.org_id, quotation.sales_rep_id
  into v_org_id, v_sales_rep_id
  from public.quotations quotation
  where quotation.id = p_source_quotation_id;
  if not found then
    raise exception 'Quotation not found';
  end if;

  if not private.user_has_permission(
    v_actor,
    v_org_id,
    'quotations',
    'revise'
  ) then
    raise exception 'Not authorized';
  end if;

  select lower(member.role::text)
  into v_member_role
  from public.org_members member
  where member.user_id = v_actor
    and member.org_id = v_org_id
    and member.status = 'active';

  if v_member_role in ('sales', 'salesperson')
     and v_sales_rep_id is distinct from v_actor
     and not private.user_has_permission(
       v_actor,
       v_org_id,
       'quotations',
       'edit_all'
     ) then
    raise exception 'Not authorized for this quotation';
  end if;

  return private.create_quotation_revision_impl(
    p_source_quotation_id,
    p_revision_purpose
  );
end;
$$;

create function public.create_job_purchase_order_revision(
  p_purchase_order_id uuid,
  p_revision_date date,
  p_document_id uuid,
  p_added_allocations jsonb,
  p_removed_allocation_ids uuid[] default '{}'::uuid[],
  p_internal_remarks text default null,
  p_allow_customer_override boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org_id uuid;
  v_member_role text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select purchase_order.org_id
  into v_org_id
  from public.job_purchase_orders purchase_order
  where purchase_order.id = p_purchase_order_id;
  if not found then
    raise exception 'Purchase order not found';
  end if;

  if not private.user_has_permission(
    v_actor,
    v_org_id,
    'purchase_orders',
    'attach_po'
  ) then
    raise exception 'Not authorized';
  end if;

  select lower(member.role::text)
  into v_member_role
  from public.org_members member
  where member.user_id = v_actor
    and member.org_id = v_org_id
    and member.status = 'active';

  if coalesce(p_allow_customer_override, false)
     and v_member_role <> 'admin' then
    raise exception 'Only an administrator can override the PO customer';
  end if;

  if v_member_role in ('sales', 'salesperson')
     and not private.user_has_permission(
       v_actor,
       v_org_id,
       'purchase_orders',
       'edit_all'
     )
     and (
       exists (
         select 1
         from public.job_purchase_order_allocations allocation
         join public.jobs job on job.id = allocation.job_id
         where allocation.purchase_order_id = p_purchase_order_id
           and allocation.org_id = v_org_id
           and job.salesperson_id is distinct from v_actor
       )
       or exists (
         select 1
         from jsonb_array_elements(coalesce(p_added_allocations, '[]'::jsonb)) added
         join public.jobs job
           on job.id = (added->>'job_id')::uuid
          and job.org_id = v_org_id
         where job.salesperson_id is distinct from v_actor
       )
     ) then
    raise exception 'Not authorized for one or more purchase-order jobs';
  end if;

  return private.create_job_purchase_order_revision_impl(
    p_purchase_order_id,
    p_revision_date,
    p_document_id,
    p_added_allocations,
    p_removed_allocation_ids,
    p_internal_remarks,
    p_allow_customer_override
  );
end;
$$;

-- Service-only lookups do not need owner privileges because service_role has
-- the required table access and bypasses RLS. Removing SECURITY DEFINER keeps
-- their privilege boundary as small as possible.
alter function public.check_public_calendar_conflicts(
  uuid, uuid[], timestamptz, timestamptz, text, uuid
) security invoker;
alter function private.user_has_permission(uuid, uuid, text, text)
  security invoker;
alter function public.user_has_permission(uuid, uuid, text, text)
  security invoker;

-- A fixed empty search path makes every remaining SECURITY DEFINER function
-- resolve application objects only through the schema-qualified references in
-- its body. pg_catalog remains implicitly available for built-ins.
do $$
declare
  function_record record;
begin
  for function_record in
    select procedure.oid::regprocedure as function_identity
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prosecdef
  loop
    execute format(
      'alter function %s set search_path = %L',
      function_record.function_identity,
      ''
    );
  end loop;
end;
$$;

-- Security Advisor also requires a fixed path for invoker trigger functions.
-- Their bodies use only trigger records, pg_catalog built-ins, and explicitly
-- qualified application relations, so the empty path is safe.
alter function public.enforce_max_two_quotation_contacts()
  set search_path = '';
alter function public.prevent_quotation_number_change()
  set search_path = '';
alter function public.set_updated_at()
  set search_path = '';

-- Remove all inherited and historical direct execution first. Trigger
-- invocation does not require the table-mutating role to have EXECUTE on the
-- trigger function, so trigger behavior is preserved.
do $$
declare
  function_record record;
begin
  for function_record in
    select procedure.oid::regprocedure as function_identity
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prokind = 'f'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      function_record.function_identity
    );
  end loop;
end;
$$;

-- RLS helpers and the three explicitly browser-callable mutation RPCs.
grant execute on function private.current_user_has_permission(uuid, text, text)
  to authenticated;
grant execute on function public.is_active_org_member(uuid)
  to authenticated;
grant execute on function public.is_org_admin(uuid)
  to authenticated;
grant execute on function public.is_super_admin()
  to authenticated;
grant execute on function public.can_edit_supplier_price_library(uuid)
  to authenticated;
grant execute on function public.can_manage_employee_directory(uuid)
  to authenticated;
grant execute on function public.can_manage_public_calendar(uuid)
  to authenticated;
grant execute on function public.can_view_supplier_price_library(uuid)
  to authenticated;
grant execute on function public.create_job_purchase_order(text, date, text, jsonb)
  to authenticated;
grant execute on function public.create_quotation_revision(uuid, text)
  to authenticated;
grant execute on function public.create_job_purchase_order_revision(
  uuid, date, uuid, jsonb, uuid[], text, boolean
) to authenticated;

-- Server-only RPC allowlist. These are invoked only with the service key after
-- the corresponding route has validated the user's session and permission.
grant execute on function public.check_public_calendar_conflicts(
  uuid, uuid[], timestamptz, timestamptz, text, uuid
) to service_role;
grant execute on function private.user_has_permission(uuid, uuid, text, text)
  to service_role;
grant execute on function public.user_has_permission(uuid, uuid, text, text)
  to service_role;
grant execute on function public.create_job_work_completion_draft(
  uuid, uuid, uuid, date, text, text, text, uuid[]
) to service_role;
grant execute on function public.finalize_job_work_completion(
  uuid, uuid, uuid, uuid, text, text, bigint, timestamptz
) to service_role;
grant execute on function public.create_job_work_completion_correction_draft(
  uuid, uuid, uuid, uuid, date, text, text, text, uuid[]
) to service_role;
grant execute on function public.finalize_job_work_completion_correction(
  uuid, uuid, uuid, uuid, uuid, text, text, bigint, timestamptz
) to service_role;
grant execute on function public.reopen_completed_job(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.transfer_org_administrator(
  uuid, uuid, uuid, text, text
) to service_role;

-- New functions are private by default and must be deliberately allowlisted in
-- the migration that creates them.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated, service_role;
