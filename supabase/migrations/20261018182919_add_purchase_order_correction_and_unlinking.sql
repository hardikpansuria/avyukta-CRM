-- Allow a PO allocation to be unlinked without deleting historical PO data.
-- Only one active PO allocation may exist for a job at a time.
alter table public.job_purchase_order_allocations
  add column is_active boolean not null default true,
  add column unlinked_at timestamptz,
  add column unlinked_by uuid references public.profiles(id) on delete set null,
  add column unlink_reason text,
  add constraint job_po_allocations_unlink_state_check check (
    (is_active and unlinked_at is null and unlinked_by is null)
    or
    (not is_active and unlinked_at is not null)
  );

alter table public.job_purchase_order_allocations
  drop constraint job_purchase_order_allocations_job_id_key,
  drop constraint job_purchase_order_allocations_purchase_order_id_job_id_key;

create unique index job_po_allocations_one_active_per_job
  on public.job_purchase_order_allocations(job_id)
  where is_active;

create unique index job_po_allocations_one_active_per_po_job
  on public.job_purchase_order_allocations(purchase_order_id, job_id)
  where is_active;

create index job_po_allocations_active_po_idx
  on public.job_purchase_order_allocations(purchase_order_id, created_at)
  where is_active;

create table public.job_purchase_order_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  purchase_order_id uuid not null,
  allocation_id uuid,
  job_id uuid,
  quotation_id uuid,
  action text not null check (action in ('edited', 'document_replaced', 'unlinked')),
  actor_id uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (purchase_order_id, org_id)
    references public.job_purchase_orders(id, org_id) on delete restrict,
  foreign key (allocation_id)
    references public.job_purchase_order_allocations(id) on delete restrict,
  foreign key (job_id, org_id)
    references public.jobs(id, org_id) on delete restrict,
  foreign key (quotation_id)
    references public.quotations(id) on delete restrict
);

create index job_po_activity_po_created_idx
  on public.job_purchase_order_activity(purchase_order_id, created_at desc);
create index job_po_activity_job_created_idx
  on public.job_purchase_order_activity(job_id, created_at desc)
  where job_id is not null;

alter table public.job_purchase_order_activity enable row level security;

create policy job_purchase_order_activity_member_read
  on public.job_purchase_order_activity
  for select to authenticated
  using (public.is_super_admin() or public.is_active_org_member(org_id));

revoke all on public.job_purchase_order_activity from anon;
grant select on public.job_purchase_order_activity to authenticated;
grant all on public.job_purchase_order_activity to service_role;

create or replace function private.recalculate_job_purchase_order_totals(
  p_purchase_order_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quotation_total numeric(14,2);
  v_before_tax numeric(14,2);
  v_tax numeric(14,2);
  v_total numeric(14,2);
begin
  select
    round(coalesce(sum(allocation.quotation_total), 0), 2),
    round(coalesce(sum(allocation.po_amount_before_tax), 0), 2),
    round(coalesce(sum(allocation.tax_amount), 0), 2),
    round(coalesce(sum(allocation.total_po_amount), 0), 2)
  into v_quotation_total, v_before_tax, v_tax, v_total
  from public.job_purchase_order_allocations allocation
  where allocation.purchase_order_id = p_purchase_order_id
    and allocation.is_active;

  update public.job_purchase_orders
  set combined_quotation_total = v_quotation_total,
      combined_po_amount_before_tax = v_before_tax,
      combined_tax_amount = v_tax,
      combined_po_total = v_total,
      current_po_total = v_total,
      difference_amount = round(v_total - v_quotation_total, 2),
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_purchase_order_id;
end;
$$;

revoke all on function private.recalculate_job_purchase_order_totals(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.update_job_purchase_order_impl(
  p_purchase_order_id uuid,
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
  v_po public.job_purchase_orders%rowtype;
  v_item jsonb;
  v_allocation public.job_purchase_order_allocations%rowtype;
  v_before_tax numeric(14,2);
  v_tax numeric(14,2);
  v_total numeric(14,2);
  v_difference numeric(14,2);
  v_acknowledged boolean;
  v_active_count integer;
  v_distinct_count integer;
  v_before jsonb;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_po_number), '') is null then
    raise exception 'Purchase Order Number is required';
  end if;
  if p_po_received_date is null then
    raise exception 'Purchase Order Received Date is required';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Purchase Order allocations are invalid';
  end if;

  select * into v_po
  from public.job_purchase_orders
  where id = p_purchase_order_id
  for update;
  if not found then raise exception 'Purchase order not found'; end if;

  select count(*) into v_active_count
  from public.job_purchase_order_allocations
  where purchase_order_id = v_po.id and is_active;

  select count(distinct (item->>'allocation_id')) into v_distinct_count
  from jsonb_array_elements(p_allocations) item;

  if v_active_count = 0 then
    raise exception 'This purchase order is no longer attached to a quotation';
  end if;
  if jsonb_array_length(p_allocations) <> v_active_count
     or v_distinct_count <> v_active_count then
    raise exception 'Every active Purchase Order allocation must be supplied once';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_allocations) item
    where not exists (
      select 1 from public.job_purchase_order_allocations allocation
      where allocation.id = (item->>'allocation_id')::uuid
        and allocation.purchase_order_id = v_po.id
        and allocation.org_id = v_po.org_id
        and allocation.is_active
    )
  ) then
    raise exception 'One or more Purchase Order allocations are invalid';
  end if;

  v_before := jsonb_build_object(
    'po_number', v_po.po_number,
    'po_received_date', v_po.po_received_date,
    'internal_remarks', v_po.internal_remarks,
    'current_po_total', v_po.current_po_total
  );

  for v_item in select value from jsonb_array_elements(p_allocations)
  loop
    select * into v_allocation
    from public.job_purchase_order_allocations
    where id = (v_item->>'allocation_id')::uuid
      and purchase_order_id = v_po.id
      and is_active
    for update;

    v_before_tax := round(coalesce((v_item->>'po_amount_before_tax')::numeric, 0), 2);
    if v_before_tax < 0 then
      raise exception 'PO Amount Before Tax cannot be negative';
    end if;
    v_tax := round(v_before_tax * coalesce(v_allocation.tax_rate_snapshot, 0) / 100, 2);
    v_total := round(v_before_tax + v_tax, 2);
    v_difference := round(v_total - v_allocation.quotation_total, 2);
    v_acknowledged := coalesce((v_item->>'difference_acknowledged')::boolean, false);
    if v_difference <> 0 and not v_acknowledged then
      raise exception 'PO total differs from quotation total. Difference acknowledgement is required.';
    end if;

    update public.job_purchase_order_allocations
    set po_amount_before_tax = v_before_tax,
        tax_amount = v_tax,
        total_po_amount = v_total,
        difference_amount = v_difference,
        difference_acknowledged = v_acknowledged
    where id = v_allocation.id;
  end loop;

  update public.job_purchase_orders
  set po_number = btrim(p_po_number),
      po_received_date = p_po_received_date,
      internal_remarks = nullif(btrim(coalesce(p_internal_remarks, '')), ''),
      updated_by = v_actor,
      updated_at = now()
  where id = v_po.id;

  perform private.recalculate_job_purchase_order_totals(v_po.id, v_actor);

  insert into public.job_purchase_order_activity (
    org_id, purchase_order_id, action, actor_id, before_data, after_data
  )
  select
    updated.org_id,
    updated.id,
    'edited',
    v_actor,
    v_before,
    jsonb_build_object(
      'po_number', updated.po_number,
      'po_received_date', updated.po_received_date,
      'internal_remarks', updated.internal_remarks,
      'current_po_total', updated.current_po_total,
      'allocations', p_allocations
    )
  from public.job_purchase_orders updated
  where updated.id = v_po.id;

  return v_po.id;
end;
$$;

create or replace function public.update_job_purchase_order(
  p_purchase_order_id uuid,
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
  v_role text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select purchase_order.org_id into v_org_id
  from public.job_purchase_orders purchase_order
  where purchase_order.id = p_purchase_order_id;
  if not found then raise exception 'Purchase order not found'; end if;

  if not private.user_has_permission(v_actor, v_org_id, 'purchase_orders', 'edit') then
    raise exception 'Not authorized';
  end if;
  select lower(member.role::text) into v_role
  from public.org_members member
  where member.user_id = v_actor and member.org_id = v_org_id
    and member.status = 'active';
  if v_role in ('sales', 'salesperson')
     and not private.user_has_permission(v_actor, v_org_id, 'purchase_orders', 'edit_all')
     and exists (
       select 1
       from public.job_purchase_order_allocations allocation
       join public.jobs job on job.id = allocation.job_id
       where allocation.purchase_order_id = p_purchase_order_id
         and allocation.is_active
         and job.salesperson_id is distinct from v_actor
     ) then
    raise exception 'Not authorized for one or more purchase-order jobs';
  end if;

  return private.update_job_purchase_order_impl(
    p_purchase_order_id, p_po_number, p_po_received_date,
    p_internal_remarks, p_allocations
  );
end;
$$;

revoke all on function private.update_job_purchase_order_impl(uuid, text, date, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.update_job_purchase_order(uuid, text, date, text, jsonb)
  from public, anon;
grant execute on function public.update_job_purchase_order(uuid, text, date, text, jsonb)
  to authenticated, service_role;

create or replace function private.unlink_job_purchase_order_allocation_impl(
  p_allocation_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_allocation public.job_purchase_order_allocations%rowtype;
  v_po_number text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;

  select allocation.* into v_allocation
  from public.job_purchase_order_allocations allocation
  where allocation.id = p_allocation_id
  for update;
  if not found or not v_allocation.is_active then
    raise exception 'Active Purchase Order attachment not found';
  end if;

  if exists (select 1 from public.job_invoices invoice where invoice.job_id = v_allocation.job_id)
     or exists (select 1 from public.invoice_requests request where request.job_id = v_allocation.job_id)
     or exists (select 1 from public.job_work_completions completion where completion.job_id = v_allocation.job_id)
     or exists (
       select 1 from public.jobs job
       where job.id = v_allocation.job_id and job.job_status = 'work_completed'
     ) then
    raise exception 'This PO cannot be removed because invoicing or completed-work records exist for the job';
  end if;

  select purchase_order.po_number into v_po_number
  from public.job_purchase_orders purchase_order
  where purchase_order.id = v_allocation.purchase_order_id;

  update public.job_purchase_order_allocations
  set is_active = false,
      unlinked_at = now(),
      unlinked_by = v_actor,
      unlink_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = v_allocation.id;

  update public.jobs
  set job_status = 'po_pending',
      updated_by = v_actor,
      updated_at = now(),
      last_status_change_note = 'Purchase Order ' || coalesce(v_po_number, '') || ' was unlinked.'
  where id = v_allocation.job_id;

  delete from public.job_scope_assignments
  where org_id = v_allocation.org_id and job_id = v_allocation.job_id;
  insert into public.job_scope_assignments (
    org_id, job_id, quotation_id, scope_id, assigned_by
  )
  select
    job.org_id, job.id, job.latest_accepted_quotation_id, scope.id, v_actor
  from public.jobs job
  join public.quotation_scopes scope
    on scope.quotation_id = job.latest_accepted_quotation_id
   and scope.org_id = job.org_id
  where job.id = v_allocation.job_id;

  perform private.recalculate_job_purchase_order_totals(
    v_allocation.purchase_order_id, v_actor
  );

  insert into public.job_purchase_order_activity (
    org_id, purchase_order_id, allocation_id, job_id, quotation_id,
    action, actor_id, before_data, after_data, notes
  ) values (
    v_allocation.org_id,
    v_allocation.purchase_order_id,
    v_allocation.id,
    v_allocation.job_id,
    v_allocation.quotation_id_snapshot,
    'unlinked',
    v_actor,
    jsonb_build_object(
      'is_active', true,
      'po_number', v_po_number,
      'total_po_amount', v_allocation.total_po_amount
    ),
    jsonb_build_object('is_active', false, 'job_status', 'po_pending'),
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  return v_allocation.purchase_order_id;
end;
$$;

create or replace function public.unlink_job_purchase_order_allocation(
  p_allocation_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org_id uuid;
  v_salesperson_id uuid;
  v_role text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select allocation.org_id, job.salesperson_id
  into v_org_id, v_salesperson_id
  from public.job_purchase_order_allocations allocation
  join public.jobs job on job.id = allocation.job_id
  where allocation.id = p_allocation_id and allocation.is_active;
  if not found then raise exception 'Active Purchase Order attachment not found'; end if;

  if not private.user_has_permission(v_actor, v_org_id, 'purchase_orders', 'delete') then
    raise exception 'Not authorized';
  end if;
  select lower(member.role::text) into v_role
  from public.org_members member
  where member.user_id = v_actor and member.org_id = v_org_id
    and member.status = 'active';
  if v_role in ('sales', 'salesperson')
     and v_salesperson_id is distinct from v_actor
     and not private.user_has_permission(v_actor, v_org_id, 'purchase_orders', 'edit_all') then
    raise exception 'Not authorized for this purchase-order job';
  end if;

  return private.unlink_job_purchase_order_allocation_impl(p_allocation_id, p_reason);
end;
$$;

revoke all on function private.unlink_job_purchase_order_allocation_impl(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.unlink_job_purchase_order_allocation(uuid, text)
  from public, anon;
grant execute on function public.unlink_job_purchase_order_allocation(uuid, text)
  to authenticated, service_role;

-- The original create function must ignore historical, inactive allocations so
-- a corrected PO can be attached to the same job after an unlink.
create or replace function private.create_job_purchase_order_impl(
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
  v_customer_id uuid;
  v_po_id uuid;
  v_allocation jsonb;
  v_job public.jobs%rowtype;
  v_quotation public.quotations%rowtype;
  v_job_number text;
  v_job_year integer;
  v_job_sequence integer;
  v_before_tax numeric(14,2);
  v_tax_rate numeric(7,3);
  v_tax_amount numeric(14,2);
  v_po_total numeric(14,2);
  v_difference numeric(14,2);
  v_acknowledged boolean;
  v_combined_quotation_total numeric(14,2) := 0;
  v_combined_before_tax numeric(14,2) := 0;
  v_combined_tax numeric(14,2) := 0;
  v_combined_total numeric(14,2) := 0;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_po_number), '') is null then
    raise exception 'Purchase Order Number is required';
  end if;
  if p_po_received_date is null then
    raise exception 'Purchase Order Received Date is required';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one job allocation is required';
  end if;

  select job.* into v_job
  from public.jobs job
  where job.id = (p_allocations->0->>'job_id')::uuid
  for update;
  if not found then raise exception 'Job not found'; end if;
  v_org_id := v_job.org_id;
  v_customer_id := v_job.customer_id;
  if not public.is_active_org_member(v_org_id) and not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.job_purchase_orders (
    org_id, customer_id, po_number, po_received_date, internal_remarks,
    created_by, updated_by
  ) values (
    v_org_id, v_customer_id, btrim(p_po_number), p_po_received_date,
    nullif(btrim(coalesce(p_internal_remarks, '')), ''), v_actor, v_actor
  ) returning id into v_po_id;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    select job.* into v_job
    from public.jobs job
    where job.id = (v_allocation->>'job_id')::uuid and job.org_id = v_org_id
    for update;
    if not found then raise exception 'One or more selected jobs were not found'; end if;
    if v_job.customer_id <> v_customer_id then
      raise exception 'A combined Purchase Order can contain jobs for only one customer';
    end if;
    if v_job.job_status <> 'po_pending' then
      raise exception 'Job % is not awaiting a Purchase Order', v_job.id;
    end if;
    if exists (
      select 1 from public.job_purchase_order_allocations allocation
      where allocation.job_id = v_job.id and allocation.is_active
    ) then
      raise exception 'Job % is already linked to a Purchase Order', v_job.id;
    end if;

    select quotation.* into v_quotation
    from public.quotations quotation
    where quotation.id = v_job.latest_accepted_quotation_id
      and quotation.org_id = v_org_id;
    if not found then raise exception 'Accepted quotation was not found'; end if;

    v_before_tax := round(coalesce((v_allocation->>'po_amount_before_tax')::numeric, 0), 2);
    if v_before_tax < 0 then raise exception 'PO Amount Before Tax cannot be negative'; end if;
    v_tax_rate := coalesce(v_quotation.tax_rate, 0);
    v_tax_amount := round(v_before_tax * v_tax_rate / 100, 2);
    v_po_total := round(v_before_tax + v_tax_amount, 2);
    v_difference := round(v_po_total - coalesce(v_quotation.grand_total_after_tax, 0), 2);
    v_acknowledged := coalesce((v_allocation->>'difference_acknowledged')::boolean, false);
    if v_difference <> 0 and not v_acknowledged then
      raise exception 'PO total differs from quotation total. Difference acknowledgement is required.';
    end if;

    if v_job.job_number is null then
      select generated.job_number, generated.job_year, generated.job_sequence
      into v_job_number, v_job_year, v_job_sequence
      from public.generate_job_number(v_org_id) generated;
      update public.jobs
      set job_number = v_job_number, job_year = v_job_year,
          job_sequence = v_job_sequence, job_status = 'work_in_process',
          updated_by = v_actor, updated_at = now()
      where id = v_job.id;
    else
      update public.jobs
      set job_status = 'work_in_process', updated_by = v_actor, updated_at = now()
      where id = v_job.id;
    end if;

    insert into public.job_purchase_order_allocations (
      org_id, purchase_order_id, job_id, quotation_id_snapshot,
      quotation_number_snapshot, revision_number_snapshot,
      customer_name_snapshot, project_name_snapshot, quotation_total,
      po_amount_before_tax, tax_name_snapshot, tax_rate_snapshot,
      tax_amount, total_po_amount, difference_amount, difference_acknowledged
    ) values (
      v_org_id, v_po_id, v_job.id, v_quotation.id,
      v_quotation.quotation_number, coalesce(v_quotation.revision_number, 0),
      null, v_quotation.project_name,
      coalesce(v_quotation.grand_total_after_tax, 0), v_before_tax,
      v_quotation.tax_name, v_tax_rate, v_tax_amount, v_po_total,
      v_difference, v_acknowledged
    );

    v_combined_quotation_total := v_combined_quotation_total + coalesce(v_quotation.grand_total_after_tax, 0);
    v_combined_before_tax := v_combined_before_tax + v_before_tax;
    v_combined_tax := v_combined_tax + v_tax_amount;
    v_combined_total := v_combined_total + v_po_total;
  end loop;

  update public.job_purchase_orders
  set combined_quotation_total = round(v_combined_quotation_total, 2),
      combined_po_amount_before_tax = round(v_combined_before_tax, 2),
      combined_tax_amount = round(v_combined_tax, 2),
      combined_po_total = round(v_combined_total, 2),
      difference_amount = round(v_combined_total - v_combined_quotation_total, 2),
      updated_by = v_actor,
      updated_at = now()
  where id = v_po_id;

  return v_po_id;
end;
$$;

revoke all on function private.create_job_purchase_order_impl(text, date, text, jsonb)
  from public, anon, authenticated, service_role;
