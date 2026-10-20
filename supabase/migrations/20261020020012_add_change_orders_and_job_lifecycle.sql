-- Professional post-acceptance change management for jobs.
-- Existing quotations, POs, jobs, invoice requests, invoices, and completions
-- are preserved. Accepted quotation content remains immutable.

insert into public.permission_modules (
  module_key, display_name, description, sort_order
)
values (
  'change_orders',
  'Change Orders',
  'Post-acceptance scope and commercial changes for existing jobs.',
  85
)
on conflict (module_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

with actions(action_key, display_name, description, sort_order) as (
  values
    ('view', 'View', 'View job change orders.', 10),
    ('create', 'Create', 'Create draft job change orders.', 20),
    ('edit', 'Edit', 'Edit draft job change orders.', 30),
    ('approve', 'Approve', 'Approve a change order and apply its PO change.', 40),
    ('cancel', 'Cancel', 'Cancel a draft or approved change order.', 50)
)
insert into public.permission_definitions (
  module_id, action_key, display_name, description, sort_order
)
select module.id, action.action_key, action.display_name,
       action.description, action.sort_order
from actions action
join public.permission_modules module
  on module.module_key = 'change_orders'
on conflict (module_id, action_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.role_default_permissions (role_key, permission_id, allowed)
select role.role_key, definition.id,
  case
    when role.role_key = 'admin' then true
    when role.role_key = 'sales'
      and definition.action_key in ('view', 'create', 'edit') then true
    when role.role_key = 'accountant'
      and definition.action_key = 'view' then true
    else false
  end
from (values ('admin'), ('sales'), ('accountant')) role(role_key)
cross join public.permission_modules module
join public.permission_definitions definition
  on definition.module_id = module.id
where module.module_key = 'change_orders'
on conflict (role_key, permission_id) do update set
  allowed = excluded.allowed,
  updated_at = now();

alter table public.jobs
  drop constraint jobs_job_status_check;

alter table public.jobs
  add column status_reason text,
  add column status_effective_at timestamptz,
  add constraint jobs_job_status_check check (
    job_status = any (array[
      'po_pending'::text,
      'work_in_process'::text,
      'on_hold'::text,
      'work_completed'::text,
      'cancelled'::text,
      'terminated'::text
    ])
  ),
  add constraint jobs_terminal_status_reason_check check (
    job_status not in ('on_hold', 'cancelled', 'terminated')
    or nullif(btrim(status_reason), '') is not null
  );

create or replace function public.validate_job_lifecycle_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.job_status is not distinct from new.job_status then
    return new;
  end if;

  if old.job_status = 'work_completed'
     and new.job_status in ('cancelled', 'terminated') then
    raise exception 'Completed work cannot be cancelled or terminated';
  end if;

  if old.job_status in ('cancelled', 'terminated') then
    raise exception 'Cancelled or terminated jobs cannot be changed';
  end if;

  if new.job_status in ('on_hold', 'cancelled', 'terminated')
     and nullif(btrim(coalesce(new.status_reason, '')), '') is null then
    raise exception 'A reason is required for this job status';
  end if;

  new.status_effective_at := now();
  if new.job_status not in ('on_hold', 'cancelled', 'terminated') then
    new.status_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_job_lifecycle_transition_before_update
  on public.jobs;
create trigger validate_job_lifecycle_transition_before_update
before update of job_status on public.jobs
for each row execute function public.validate_job_lifecycle_transition();

create or replace function public.record_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.job_status is distinct from new.job_status then
    insert into public.job_status_history (
      org_id, job_id, previous_status, new_status,
      changed_by, changed_at, remarks
    ) values (
      new.org_id, new.id, old.job_status, new.job_status,
      coalesce(new.updated_by, (select auth.uid())), now(),
      nullif(btrim(coalesce(new.status_reason, '')), '')
    );
  end if;
  return new;
end;
$$;

create table public.job_change_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  job_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  change_order_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'cancelled')),
  title text not null check (nullif(btrim(title), '') is not null),
  reason text not null check (nullif(btrim(reason), '') is not null),
  description text,
  requested_date date not null default current_date,
  po_strategy text not null default 'supplemental'
    check (po_strategy in ('replacement', 'supplemental')),
  currency text not null default 'CAD'
    check (currency in ('CAD', 'USD', 'EUR')),
  subtotal numeric(14,2) not null default 0,
  tax_name text,
  tax_rate numeric(7,3) not null default 0 check (tax_rate >= 0),
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancellation_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (job_id, org_id)
    references public.jobs(id, org_id) on delete restrict,
  unique (id, org_id),
  unique (job_id, sequence_number),
  unique (job_id, change_order_number),
  check (change_order_number ~ '^CO-[0-9]{3,}$'),
  check (subtotal >= 0 and tax_amount >= 0 and total_amount >= 0),
  check (
    (status = 'draft' and approved_at is null and cancelled_at is null)
    or (status = 'approved' and approved_at is not null and approved_by is not null
        and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null
        and nullif(btrim(cancellation_reason), '') is not null)
  )
);

create index job_change_orders_org_status_idx
  on public.job_change_orders(org_id, status, created_at desc);
create index job_change_orders_job_idx
  on public.job_change_orders(job_id, sequence_number desc);

create table public.job_change_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  change_order_id uuid not null,
  description text not null check (nullif(btrim(description), '') is not null),
  quantity_delta numeric(14,4) not null check (quantity_delta <> 0),
  unit_label text not null default 'unit',
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  line_total numeric(14,2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (change_order_id, org_id)
    references public.job_change_orders(id, org_id) on delete cascade,
  check (line_total = round(quantity_delta * unit_price, 2))
);

create index job_change_order_items_change_idx
  on public.job_change_order_items(change_order_id, sort_order, created_at);

create table public.job_change_order_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  change_order_id uuid not null,
  job_id uuid not null,
  action text not null
    check (action in ('created', 'edited', 'approved', 'cancelled')),
  actor_id uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (change_order_id, org_id)
    references public.job_change_orders(id, org_id) on delete restrict,
  foreign key (job_id, org_id)
    references public.jobs(id, org_id) on delete restrict
);

create index job_change_order_activity_change_idx
  on public.job_change_order_activity(change_order_id, created_at desc);
create index job_change_order_activity_job_idx
  on public.job_change_order_activity(job_id, created_at desc);

create table public.job_change_order_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  change_order_id uuid not null,
  purchase_order_id uuid not null,
  relationship_type text not null
    check (relationship_type in ('replacement', 'supplemental')),
  replaced_allocation_id uuid references public.job_purchase_order_allocations(id)
    on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (change_order_id, org_id)
    references public.job_change_orders(id, org_id) on delete restrict,
  foreign key (purchase_order_id, org_id)
    references public.job_purchase_orders(id, org_id) on delete restrict,
  unique (change_order_id, purchase_order_id)
);

create index job_change_order_pos_change_idx
  on public.job_change_order_purchase_orders(change_order_id, created_at);
create index job_change_order_pos_po_idx
  on public.job_change_order_purchase_orders(purchase_order_id);

drop index if exists public.job_po_allocations_one_active_per_job;

alter table public.job_purchase_order_allocations
  add column allocation_type text not null default 'baseline'
    check (allocation_type in ('baseline', 'replacement', 'supplemental')),
  add column change_order_id uuid,
  add column replaces_allocation_id uuid references public.job_purchase_order_allocations(id)
    on delete restrict,
  add constraint job_po_allocations_change_order_fkey
    foreign key (change_order_id, org_id)
    references public.job_change_orders(id, org_id) on delete restrict,
  add constraint job_po_allocations_change_order_type_check check (
    (allocation_type = 'baseline' and change_order_id is null)
    or (allocation_type in ('replacement', 'supplemental')
        and change_order_id is not null)
  ),
  add constraint job_po_allocations_replacement_check check (
    (allocation_type = 'replacement' and replaces_allocation_id is not null)
    or (allocation_type <> 'replacement' and replaces_allocation_id is null)
  );

create index job_po_allocations_active_job_idx
  on public.job_purchase_order_allocations(job_id, created_at)
  where is_active;
create index job_po_allocations_change_order_idx
  on public.job_purchase_order_allocations(change_order_id)
  where change_order_id is not null;

create or replace function private.prevent_final_change_order_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    if old.status = 'approved'
       and new.status = 'cancelled'
       and to_jsonb(old) - 'status' - 'cancelled_at' - 'cancelled_by'
             - 'cancellation_reason' - 'updated_at' - 'updated_by'
           is not distinct from
           to_jsonb(new) - 'status' - 'cancelled_at' - 'cancelled_by'
             - 'cancellation_reason' - 'updated_at' - 'updated_by' then
      return new;
    end if;
    raise exception 'Only a draft Change Order can be edited';
  end if;
  return new;
end;
$$;

create trigger prevent_final_change_order_mutation_before_update
before update on public.job_change_orders
for each row execute function private.prevent_final_change_order_mutation();

create or replace function private.prevent_final_change_order_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_change_order_id uuid := coalesce(new.change_order_id, old.change_order_id);
begin
  if not exists (
    select 1 from public.job_change_orders change_order
    where change_order.id = v_change_order_id
      and change_order.status = 'draft'
  ) then
    raise exception 'Approved or cancelled Change Order items are immutable';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger prevent_final_change_order_item_mutation_before_write
before insert or update or delete on public.job_change_order_items
for each row execute function private.prevent_final_change_order_item_mutation();

create or replace function private.log_job_change_order_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_actor := coalesce(new.created_by, (select auth.uid()));
  elsif old.status is distinct from new.status and new.status = 'approved' then
    v_action := 'approved';
    v_actor := coalesce(new.approved_by, new.updated_by, (select auth.uid()));
  elsif old.status is distinct from new.status and new.status = 'cancelled' then
    v_action := 'cancelled';
    v_actor := coalesce(new.cancelled_by, new.updated_by, (select auth.uid()));
  else
    v_action := 'edited';
    v_actor := coalesce(new.updated_by, (select auth.uid()));
  end if;

  insert into public.job_change_order_activity (
    org_id, change_order_id, job_id, action, actor_id,
    before_data, after_data, notes
  ) values (
    new.org_id, new.id, new.job_id, v_action, v_actor,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    case when v_action = 'cancelled' then new.cancellation_reason else null end
  );
  return new;
end;
$$;

create trigger log_job_change_order_activity_after_write
after insert or update on public.job_change_orders
for each row execute function private.log_job_change_order_activity();

create trigger set_job_change_orders_updated_at
before update on public.job_change_orders
for each row execute function public.set_updated_at();

create or replace function public.create_job_change_order(
  p_job_id uuid,
  p_title text,
  p_reason text,
  p_description text,
  p_requested_date date,
  p_po_strategy text,
  p_currency text,
  p_tax_name text,
  p_tax_rate numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_job public.jobs%rowtype;
  v_id uuid := gen_random_uuid();
  v_sequence integer;
  v_item jsonb;
  v_quantity numeric(14,4);
  v_unit_price numeric(14,2);
  v_line_total numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_tax numeric(14,2);
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if not private.current_user_has_permission(v_job.org_id, 'change_orders', 'create') then
    raise exception 'Not authorized';
  end if;
  if v_job.job_status not in ('work_in_process', 'on_hold') then
    raise exception 'Change Orders can only be created for active or On Hold jobs';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null
     or nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Title and reason are required';
  end if;
  if p_po_strategy not in ('replacement', 'supplemental') then
    raise exception 'Invalid PO strategy';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one change item is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_job.org_id::text || ':' || v_job.id::text, 0));
  select coalesce(max(sequence_number), 0) + 1 into v_sequence
  from public.job_change_orders where job_id = v_job.id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if nullif(btrim(coalesce(v_item->>'description', '')), '') is null then
      raise exception 'Every change item requires a description';
    end if;
    v_quantity := coalesce((v_item->>'quantity_delta')::numeric, 0);
    v_unit_price := round(coalesce((v_item->>'unit_price')::numeric, 0), 2);
    if v_quantity = 0 or v_unit_price < 0 then
      raise exception 'Change item quantity must be non-zero and unit price cannot be negative';
    end if;
    v_subtotal := v_subtotal + round(v_quantity * v_unit_price, 2);
  end loop;
  v_subtotal := round(v_subtotal, 2);
  if v_subtotal < 0 then raise exception 'Change Order subtotal cannot be negative'; end if;
  v_tax := round(v_subtotal * coalesce(p_tax_rate, 0) / 100, 2);

  insert into public.job_change_orders (
    id, org_id, job_id, sequence_number, change_order_number,
    title, reason, description, requested_date, po_strategy,
    currency, subtotal, tax_name, tax_rate, tax_amount, total_amount,
    created_by, updated_by
  ) values (
    v_id, v_job.org_id, v_job.id, v_sequence,
    'CO-' || lpad(v_sequence::text, 3, '0'),
    btrim(p_title), btrim(p_reason), nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(p_requested_date, current_date), p_po_strategy,
    coalesce(p_currency, 'CAD'), v_subtotal,
    nullif(btrim(coalesce(p_tax_name, '')), ''), coalesce(p_tax_rate, 0),
    v_tax, round(v_subtotal + v_tax, 2), v_actor, v_actor
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity_delta')::numeric;
    v_unit_price := round((v_item->>'unit_price')::numeric, 2);
    v_line_total := round(v_quantity * v_unit_price, 2);
    insert into public.job_change_order_items (
      org_id, change_order_id, description, quantity_delta,
      unit_label, unit_price, line_total, sort_order
    ) values (
      v_job.org_id, v_id, btrim(v_item->>'description'), v_quantity,
      coalesce(nullif(btrim(v_item->>'unit_label'), ''), 'unit'),
      v_unit_price, v_line_total,
      coalesce((v_item->>'sort_order')::integer, 0)
    );
  end loop;
  return v_id;
end;
$$;

revoke all on function public.create_job_change_order(
  uuid, text, text, text, date, text, text, text, numeric, jsonb
) from public, anon;
grant execute on function public.create_job_change_order(
  uuid, text, text, text, date, text, text, text, numeric, jsonb
) to authenticated, service_role;

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
    select round(
      coalesce(v_quotation.grand_total_after_tax, 0)
      + coalesce(sum(approved.total_amount), 0)
      + v_change.total_amount,
      2
    ) into v_expected_total
    from public.job_change_orders approved
    where approved.job_id = v_job.id and approved.status = 'approved';
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

create or replace function public.cancel_job_change_order(
  p_change_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_change public.job_change_orders%rowtype;
  v_job public.jobs%rowtype;
  v_link record;
  v_allocation record;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cancellation reason is required';
  end if;
  select * into v_change from public.job_change_orders
  where id = p_change_order_id for update;
  if not found then raise exception 'Change Order not found'; end if;
  if not private.current_user_has_permission(v_change.org_id, 'change_orders', 'cancel') then
    raise exception 'Not authorized';
  end if;
  if v_change.status = 'cancelled' then raise exception 'Change Order is already cancelled'; end if;
  select * into v_job from public.jobs
  where id = v_change.job_id and org_id = v_change.org_id for update;

  if v_change.status = 'approved' then
    if v_job.job_status = 'work_completed' then
      raise exception 'An approved Change Order cannot be cancelled after job completion';
    end if;
    if exists (
      select 1 from public.job_change_orders later
      where later.job_id = v_change.job_id and later.status = 'approved'
        and later.sequence_number > v_change.sequence_number
    ) then raise exception 'Cancel later approved Change Orders first'; end if;
    if exists (
      select 1 from public.job_change_order_purchase_orders link
      join public.job_invoices invoice
        on invoice.purchase_order_id = link.purchase_order_id
       and invoice.org_id = link.org_id
      where link.change_order_id = v_change.id
    ) or exists (
      select 1 from public.job_change_order_purchase_orders link
      join public.invoice_requests request
        on request.purchase_order_id = link.purchase_order_id
       and request.org_id = link.org_id
      where link.change_order_id = v_change.id
    ) then raise exception 'This Change Order has billing activity and cannot be cancelled'; end if;
    if not exists (
      select 1 from public.job_purchase_order_allocations allocation
      where allocation.change_order_id = v_change.id and allocation.is_active
    ) then raise exception 'The Change Order PO is no longer active'; end if;

    for v_allocation in
      select * from public.job_purchase_order_allocations
      where change_order_id = v_change.id and is_active for update
    loop
      update public.job_purchase_order_allocations
      set is_active = false, unlinked_at = now(), unlinked_by = v_actor,
          unlink_reason = 'Change Order cancelled: ' || btrim(p_reason)
      where id = v_allocation.id;
      perform private.recalculate_job_purchase_order_totals(v_allocation.purchase_order_id, v_actor);
    end loop;

    for v_link in
      select * from public.job_change_order_purchase_orders
      where change_order_id = v_change.id and replaced_allocation_id is not null
    loop
      update public.job_purchase_order_allocations
      set is_active = true, unlinked_at = null, unlinked_by = null,
          unlink_reason = null
      where id = v_link.replaced_allocation_id;
      perform private.recalculate_job_purchase_order_totals(
        (select purchase_order_id from public.job_purchase_order_allocations
         where id = v_link.replaced_allocation_id), v_actor
      );
    end loop;
  end if;

  update public.job_change_orders
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_actor,
      cancellation_reason = btrim(p_reason), updated_by = v_actor
  where id = v_change.id;
end;
$$;

revoke all on function public.cancel_job_change_order(uuid, text)
  from public, anon;
grant execute on function public.cancel_job_change_order(uuid, text)
  to authenticated, service_role;

alter table public.job_change_orders enable row level security;
alter table public.job_change_order_items enable row level security;
alter table public.job_change_order_activity enable row level security;
alter table public.job_change_order_purchase_orders enable row level security;

create policy job_change_orders_member_read on public.job_change_orders
for select to authenticated
using (public.is_super_admin() or public.is_active_org_member(org_id));
create policy job_change_order_items_member_read on public.job_change_order_items
for select to authenticated
using (public.is_super_admin() or public.is_active_org_member(org_id));
create policy job_change_order_activity_member_read on public.job_change_order_activity
for select to authenticated
using (public.is_super_admin() or public.is_active_org_member(org_id));
create policy job_change_order_pos_member_read on public.job_change_order_purchase_orders
for select to authenticated
using (public.is_super_admin() or public.is_active_org_member(org_id));

revoke all on public.job_change_orders, public.job_change_order_items,
  public.job_change_order_activity, public.job_change_order_purchase_orders
  from public, anon, authenticated;
grant select on public.job_change_orders, public.job_change_order_items,
  public.job_change_order_activity, public.job_change_order_purchase_orders
  to authenticated;
grant all on public.job_change_orders, public.job_change_order_items,
  public.job_change_order_activity, public.job_change_order_purchase_orders
  to service_role;

-- A job has one billing row regardless of how many active baseline or
-- supplemental PO allocations it has. Historical inactive allocations never
-- contribute to the current contract or unbilled balance.
create or replace view public.unbilled_job_balances
with (security_invoker = true)
as
with active_allocations as (
  select
    allocation.org_id,
    allocation.job_id,
    case when count(*) = 1 then min(allocation.purchase_order_id::text)::uuid end
      as purchase_order_id,
    string_agg(purchase_order.po_number, ', ' order by allocation.created_at)
      as po_number,
    min(purchase_order.currency) as currency,
    sum(allocation.total_po_amount)::numeric(14,2) as po_amount
  from public.job_purchase_order_allocations allocation
  join public.job_purchase_orders purchase_order
    on purchase_order.id = allocation.purchase_order_id
   and purchase_order.org_id = allocation.org_id
  where allocation.is_active
  group by allocation.org_id, allocation.job_id
),
invoice_totals as (
  select invoice.org_id, invoice.job_id,
    coalesce(sum(invoice.invoice_amount), 0::numeric)::numeric(14,2) as invoiced_amount,
    max(invoice.invoice_date) as last_invoice_date
  from public.job_invoices invoice
  group by invoice.org_id, invoice.job_id
),
request_commitments as (
  select request.org_id, request.job_id,
    coalesce(sum(request.requested_amount), 0::numeric)::numeric(14,2)
      as pending_request_amount
  from public.invoice_requests request
  where request.status in ('pending', 'under_review')
    and request.invoice_type <> 'credit_note'
  group by request.org_id, request.job_id
)
select
  job.org_id, job.id as job_id, job.job_number, job.job_status,
  job.customer_id, job.salesperson_id,
  job.latest_accepted_quotation_id as quotation_id,
  active_allocations.purchase_order_id,
  active_allocations.po_number,
  coalesce(active_allocations.currency, customer.currency, 'CAD') as currency,
  customer.company_name as customer_name,
  quotation.project_name,
  coalesce(profile.full_name, profile.email) as salesperson_name,
  completion.completion_date,
  invoice_totals.last_invoice_date,
  active_allocations.po_amount::text as po_amount,
  coalesce(invoice_totals.invoiced_amount, 0::numeric)::numeric(14,2)::text
    as invoiced_amount,
  (active_allocations.po_amount - coalesce(invoice_totals.invoiced_amount, 0::numeric))
    ::numeric(14,2)::text as remaining_unbilled_amount,
  coalesce(request_commitments.pending_request_amount, 0::numeric)
    ::numeric(14,2)::text as pending_request_amount,
  (active_allocations.po_amount
    - coalesce(invoice_totals.invoiced_amount, 0::numeric)
    - coalesce(request_commitments.pending_request_amount, 0::numeric))
    ::numeric(14,2)::text as available_to_request_amount,
  round(case when active_allocations.po_amount > 0 then
    coalesce(invoice_totals.invoiced_amount, 0::numeric)
      / active_allocations.po_amount * 100
    else 0::numeric end, 2)::text as percentage_invoiced
from public.jobs job
join active_allocations
  on active_allocations.job_id = job.id
 and active_allocations.org_id = job.org_id
join public.customers customer on customer.id = job.customer_id
left join public.quotations quotation
  on quotation.id = job.latest_accepted_quotation_id
 and quotation.org_id = job.org_id
left join public.profiles profile on profile.id = job.salesperson_id
left join public.job_work_completions completion
  on completion.id = job.latest_work_completion_id
 and completion.org_id = job.org_id
left join invoice_totals
  on invoice_totals.job_id = job.id and invoice_totals.org_id = job.org_id
left join request_commitments
  on request_commitments.job_id = job.id
 and request_commitments.org_id = job.org_id
where job.job_status in ('work_in_process', 'work_completed')
  and active_allocations.po_amount > 0;

comment on view public.unbilled_job_balances is
  'One current billing balance per job, aggregated from active PO allocations only.';

revoke all on public.unbilled_job_balances from public, anon, authenticated;
grant select on public.unbilled_job_balances to authenticated, service_role;

create or replace function public.validate_invoice_request_available_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_po_total numeric(14,2);
  v_invoiced numeric(14,2);
  v_other_requests numeric(14,2);
begin
  if new.status not in ('pending', 'under_review')
     or new.invoice_type = 'credit_note' then return new; end if;

  perform 1 from public.jobs job
  where job.id = new.job_id and job.org_id = new.org_id for update;

  if not exists (
    select 1 from public.job_purchase_order_allocations allocation
    where allocation.org_id = new.org_id
      and allocation.job_id = new.job_id
      and allocation.purchase_order_id = new.purchase_order_id
      and allocation.is_active
  ) then
    raise exception 'The selected Purchase Order is not active for this job'
      using errcode = '23503';
  end if;

  select coalesce(sum(allocation.total_po_amount), 0::numeric)::numeric(14,2)
  into v_po_total
  from public.job_purchase_order_allocations allocation
  where allocation.org_id = new.org_id
    and allocation.job_id = new.job_id and allocation.is_active;

  select coalesce(sum(invoice.invoice_amount), 0::numeric)::numeric(14,2)
  into v_invoiced from public.job_invoices invoice
  where invoice.org_id = new.org_id and invoice.job_id = new.job_id;

  select coalesce(sum(request.requested_amount), 0::numeric)::numeric(14,2)
  into v_other_requests from public.invoice_requests request
  where request.org_id = new.org_id and request.job_id = new.job_id
    and request.id <> new.id
    and request.status in ('pending', 'under_review')
    and request.invoice_type <> 'credit_note';

  if v_invoiced + v_other_requests + new.requested_amount > v_po_total then
    raise exception 'Requested amount exceeds the uncommitted active PO balance'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
