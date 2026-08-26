alter table public.job_purchase_order_documents
  drop constraint job_purchase_order_documents_document_type_check;

alter table public.job_purchase_order_documents
  add constraint job_purchase_order_documents_document_type_check
  check (document_type = any (array[
    'purchase_order'::text,
    'supporting_document'::text,
    'po_revision'::text
  ]));

alter table public.job_purchase_orders
  add column current_revision_number integer not null default 0,
  add column current_po_total numeric(14,2);

alter table public.job_purchase_orders
  add constraint job_purchase_orders_current_revision_number_check
  check (current_revision_number >= 0);

update public.job_purchase_orders
set current_po_total = combined_po_total
where current_po_total is null;

alter table public.job_purchase_orders
  alter column current_po_total set default 0,
  alter column current_po_total set not null,
  add constraint job_purchase_orders_current_po_total_check
  check (current_po_total >= 0);

create table public.job_purchase_order_revisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  purchase_order_id uuid not null,
  revision_number integer not null,
  revision_date date not null,
  previous_po_amount numeric(14,2) not null,
  revised_po_amount numeric(14,2) not null,
  difference_amount numeric(14,2) not null,
  change_percentage numeric(12,4),
  document_id uuid,
  internal_remarks text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint job_po_revisions_number_check check (revision_number >= 0),
  constraint job_po_revisions_previous_amount_check check (previous_po_amount >= 0),
  constraint job_po_revisions_revised_amount_check check (revised_po_amount >= 0),
  constraint job_po_revisions_po_org_fkey foreign key (purchase_order_id, org_id)
    references public.job_purchase_orders(id, org_id) on delete restrict,
  constraint job_po_revisions_document_fkey foreign key (document_id)
    references public.job_purchase_order_documents(id) on delete restrict,
  constraint job_po_revisions_po_number_key unique (purchase_order_id, revision_number),
  constraint job_po_revisions_id_org_key unique (id, org_id)
);

create index idx_job_po_revisions_po
  on public.job_purchase_order_revisions (purchase_order_id, revision_number desc);
create index idx_job_po_revisions_org_date
  on public.job_purchase_order_revisions (org_id, revision_date desc);

alter table public.job_purchase_order_revisions enable row level security;
revoke all on table public.job_purchase_order_revisions from anon, authenticated;
grant select on table public.job_purchase_order_revisions to authenticated;
grant all on table public.job_purchase_order_revisions to service_role;
create policy job_po_revisions_select_allowed
  on public.job_purchase_order_revisions for select to authenticated
  using (public.is_super_admin() or public.is_active_org_member(org_id));

create table public.job_purchase_order_revision_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  revision_id uuid not null,
  allocation_id uuid not null,
  job_id uuid not null,
  quotation_id uuid not null,
  quotation_number_snapshot text not null,
  quotation_revision_snapshot integer not null,
  project_name_snapshot text,
  quotation_amount_snapshot numeric(14,2) not null,
  po_amount_snapshot numeric(14,2) not null,
  currency_snapshot text not null,
  job_number_snapshot text,
  job_status_snapshot text not null,
  change_type text not null,
  is_included boolean not null,
  created_at timestamptz not null default now(),
  constraint job_po_revision_items_revision_org_fkey foreign key (revision_id, org_id)
    references public.job_purchase_order_revisions(id, org_id) on delete restrict,
  constraint job_po_revision_items_allocation_fkey foreign key (allocation_id)
    references public.job_purchase_order_allocations(id) on delete restrict,
  constraint job_po_revision_items_job_fkey foreign key (job_id)
    references public.jobs(id) on delete restrict,
  constraint job_po_revision_items_quotation_fkey foreign key (quotation_id)
    references public.quotations(id) on delete restrict,
  constraint job_po_revision_items_change_type_check
    check (change_type = any (array['original'::text, 'carried'::text, 'added'::text, 'removed'::text])),
  constraint job_po_revision_items_quotation_amount_check check (quotation_amount_snapshot >= 0),
  constraint job_po_revision_items_po_amount_check check (po_amount_snapshot >= 0),
  constraint job_po_revision_items_revision_allocation_key unique (revision_id, allocation_id)
);

create index idx_job_po_revision_items_revision
  on public.job_purchase_order_revision_items (revision_id, is_included);
create index idx_job_po_revision_items_job
  on public.job_purchase_order_revision_items (job_id);

alter table public.job_purchase_order_revision_items enable row level security;
revoke all on table public.job_purchase_order_revision_items from anon, authenticated;
grant select on table public.job_purchase_order_revision_items to authenticated;
grant all on table public.job_purchase_order_revision_items to service_role;
create policy job_po_revision_items_select_allowed
  on public.job_purchase_order_revision_items for select to authenticated
  using (public.is_super_admin() or public.is_active_org_member(org_id));

-- Every existing PO becomes an immutable Original snapshot. This also makes the
-- first user-created revision deterministic even for records created before this feature.
insert into public.job_purchase_order_revisions (
  org_id, purchase_order_id, revision_number, revision_date,
  previous_po_amount, revised_po_amount, difference_amount,
  change_percentage, created_by, created_at
)
select
  po.org_id, po.id, 0, po.po_received_date,
  po.combined_po_total, po.combined_po_total, 0, null,
  po.created_by, po.created_at
from public.job_purchase_orders po;

insert into public.job_purchase_order_revision_items (
  org_id, revision_id, allocation_id, job_id, quotation_id,
  quotation_number_snapshot, quotation_revision_snapshot,
  project_name_snapshot, quotation_amount_snapshot, po_amount_snapshot,
  currency_snapshot, job_number_snapshot, job_status_snapshot,
  change_type, is_included, created_at
)
select
  po.org_id, revision.id, allocation.id, allocation.job_id,
  allocation.quotation_id_snapshot, allocation.quotation_number_snapshot,
  allocation.revision_number_snapshot, allocation.project_name_snapshot,
  allocation.quotation_total, allocation.total_po_amount, po.currency,
  job.job_number, job.job_status, 'original', true, allocation.created_at
from public.job_purchase_orders po
join public.job_purchase_order_revisions revision
  on revision.purchase_order_id = po.id and revision.revision_number = 0
join public.job_purchase_order_allocations allocation
  on allocation.purchase_order_id = po.id
join public.jobs job on job.id = allocation.job_id;

create or replace function private.capture_original_job_purchase_order_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision_id uuid;
begin
  if exists (
    select 1 from public.job_purchase_order_revisions revision
    where revision.purchase_order_id = new.id
  ) then return new; end if;

  insert into public.job_purchase_order_revisions (
    org_id, purchase_order_id, revision_number, revision_date,
    previous_po_amount, revised_po_amount, difference_amount,
    created_by, created_at
  ) values (
    new.org_id, new.id, 0, new.po_received_date,
    new.combined_po_total, new.combined_po_total, 0,
    new.created_by, new.created_at
  ) returning id into v_revision_id;

  insert into public.job_purchase_order_revision_items (
    org_id, revision_id, allocation_id, job_id, quotation_id,
    quotation_number_snapshot, quotation_revision_snapshot,
    project_name_snapshot, quotation_amount_snapshot, po_amount_snapshot,
    currency_snapshot, job_number_snapshot, job_status_snapshot,
    change_type, is_included, created_at
  )
  select
    new.org_id, v_revision_id, allocation.id, allocation.job_id,
    allocation.quotation_id_snapshot, allocation.quotation_number_snapshot,
    allocation.revision_number_snapshot, allocation.project_name_snapshot,
    allocation.quotation_total, allocation.total_po_amount, new.currency,
    job.job_number, job.job_status, 'original', true, allocation.created_at
  from public.job_purchase_order_allocations allocation
  join public.jobs job on job.id = allocation.job_id
  where allocation.purchase_order_id = new.id;

  update public.job_purchase_orders
  set current_po_total = new.combined_po_total
  where id = new.id;
  return new;
end;
$$;

revoke all on function private.capture_original_job_purchase_order_revision()
  from public, anon, authenticated;
grant execute on function private.capture_original_job_purchase_order_revision()
  to service_role;

create trigger capture_original_job_po_revision
after update of combined_po_total on public.job_purchase_orders
for each row
when (old.combined_po_total is distinct from new.combined_po_total)
execute function private.capture_original_job_purchase_order_revision();

create or replace function public.create_job_purchase_order_revision(
  p_purchase_order_id uuid,
  p_revision_date date,
  p_document_id uuid,
  p_added_allocations jsonb,
  p_removed_allocation_ids uuid[] default '{}'::uuid[],
  p_internal_remarks text default null,
  p_allow_customer_override boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_po public.job_purchase_orders%rowtype;
  v_revision_id uuid := gen_random_uuid();
  v_revision_number integer;
  v_previous_total numeric(14,2);
  v_revised_total numeric(14,2);
  v_added jsonb;
  v_job public.jobs%rowtype;
  v_quotation public.quotations%rowtype;
  v_allocation_id uuid;
  v_before_tax numeric(14,2);
  v_tax_amount numeric(14,2);
  v_po_total numeric(14,2);
  v_difference numeric(14,2);
  v_job_number text;
  v_job_year integer;
  v_job_sequence integer;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_revision_date is null then raise exception 'Revision date is required'; end if;
  if p_document_id is null then raise exception 'A revised PO document is required'; end if;
  if p_added_allocations is null or jsonb_typeof(p_added_allocations) <> 'array' then
    raise exception 'Added allocations are invalid';
  end if;

  select * into v_po
  from public.job_purchase_orders
  where id = p_purchase_order_id
  for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not private.current_user_has_permission(v_po.org_id, 'purchase_orders', 'attach_po') then
    raise exception 'Not authorized';
  end if;
  if not exists (
    select 1 from public.job_purchase_order_documents document
    where document.id = p_document_id
      and document.purchase_order_id = v_po.id
      and document.org_id = v_po.org_id
      and document.document_type = 'po_revision'
  ) then raise exception 'Revised PO document was not found'; end if;

  select coalesce(max(revision_number), 0) + 1 into v_revision_number
  from public.job_purchase_order_revisions
  where purchase_order_id = v_po.id;
  v_previous_total := v_po.current_po_total;

  if exists (
    select 1 from unnest(coalesce(p_removed_allocation_ids, '{}'::uuid[])) removed_id
    where not exists (
      select 1
      from public.job_purchase_order_revision_items item
      join public.job_purchase_order_revisions revision on revision.id = item.revision_id
      where revision.purchase_order_id = v_po.id
        and revision.revision_number = v_po.current_revision_number
        and item.allocation_id = removed_id
        and item.is_included
    )
  ) then raise exception 'A removed quotation is not in the current PO revision'; end if;

  insert into public.job_purchase_order_revisions (
    id, org_id, purchase_order_id, revision_number, revision_date,
    previous_po_amount, revised_po_amount, difference_amount,
    document_id, internal_remarks, created_by
  ) values (
    v_revision_id, v_po.org_id, v_po.id, v_revision_number, p_revision_date,
    v_previous_total, v_previous_total, 0,
    p_document_id, nullif(trim(p_internal_remarks), ''), v_actor
  );

  insert into public.job_purchase_order_revision_items (
    org_id, revision_id, allocation_id, job_id, quotation_id,
    quotation_number_snapshot, quotation_revision_snapshot,
    project_name_snapshot, quotation_amount_snapshot, po_amount_snapshot,
    currency_snapshot, job_number_snapshot, job_status_snapshot,
    change_type, is_included
  )
  select
    item.org_id, v_revision_id, item.allocation_id, item.job_id, item.quotation_id,
    item.quotation_number_snapshot, item.quotation_revision_snapshot,
    item.project_name_snapshot, item.quotation_amount_snapshot,
    item.po_amount_snapshot, item.currency_snapshot,
    job.job_number, job.job_status,
    case when item.allocation_id = any(coalesce(p_removed_allocation_ids, '{}'::uuid[]))
      then 'removed' else 'carried' end,
    not (item.allocation_id = any(coalesce(p_removed_allocation_ids, '{}'::uuid[])))
  from public.job_purchase_order_revision_items item
  join public.job_purchase_order_revisions prior on prior.id = item.revision_id
  join public.jobs job on job.id = item.job_id
  where prior.purchase_order_id = v_po.id
    and prior.revision_number = v_po.current_revision_number
    and item.is_included;

  for v_added in select value from jsonb_array_elements(p_added_allocations)
  loop
    select * into v_job from public.jobs
    where id = (v_added->>'job_id')::uuid and org_id = v_po.org_id
    for update;
    if not found then raise exception 'One or more selected jobs were not found'; end if;
    if v_job.customer_id <> v_po.customer_id and not (
      coalesce(p_allow_customer_override, false)
      and exists (
        select 1 from public.org_members member
        where member.user_id = v_actor
          and member.org_id = v_po.org_id
          and member.status = 'active'
          and member.role = 'admin'
      )
    ) then
      raise exception 'Revised PO quotations must belong to the same customer';
    end if;
    if v_job.job_status <> 'po_pending' then
      raise exception 'Every added quotation must be PO Pending';
    end if;
    if exists (select 1 from public.job_purchase_order_allocations where job_id = v_job.id) then
      raise exception 'An added quotation is already linked to a purchase order';
    end if;
    select * into v_quotation from public.quotations
    where id = v_job.latest_accepted_quotation_id and org_id = v_po.org_id;
    if not found then raise exception 'Accepted quotation was not found'; end if;
    if v_quotation.currency <> v_po.currency then
      raise exception 'Revised PO quotations must use the same currency as the purchase order';
    end if;

    v_before_tax := round(coalesce((v_added->>'po_amount_before_tax')::numeric, 0), 2);
    if v_before_tax < 0 then raise exception 'PO Amount Before Tax cannot be negative'; end if;
    v_tax_amount := round(v_before_tax * coalesce(v_quotation.tax_rate, 0) / 100, 2);
    v_po_total := round(v_before_tax + v_tax_amount, 2);
    v_difference := round(v_po_total - coalesce(v_quotation.grand_total_after_tax, 0), 2);
    if v_difference <> 0 and coalesce((v_added->>'difference_acknowledged')::boolean, false) = false then
      raise exception 'PO total differs from quotation total. Difference acknowledgement is required.';
    end if;

    if exists (
      select 1 from jsonb_array_elements_text(coalesce(v_added->'scope_ids', '[]'::jsonb)) scope_id
      where not exists (
        select 1 from public.quotation_scopes scope
        where scope.id = scope_id::uuid and scope.quotation_id = v_quotation.id and scope.org_id = v_po.org_id
      )
    ) or jsonb_array_length(coalesce(v_added->'scope_ids', '[]'::jsonb)) = 0 then
      raise exception 'Each added Work Order requires valid quotation scopes';
    end if;

    if v_job.job_number is null then
      select generated.job_number, generated.job_year, generated.job_sequence
        into v_job_number, v_job_year, v_job_sequence
      from public.generate_job_number(v_po.org_id) generated;
    else
      v_job_number := v_job.job_number;
      v_job_year := v_job.job_year;
      v_job_sequence := v_job.job_sequence;
    end if;
    update public.jobs set
      job_number = coalesce(job_number, v_job_number),
      job_year = coalesce(job_year, v_job_year),
      job_sequence = coalesce(job_sequence, v_job_sequence),
      job_status = 'work_in_process', updated_by = v_actor, updated_at = now()
    where id = v_job.id;

    delete from public.job_scope_assignments where org_id = v_po.org_id and job_id = v_job.id;
    insert into public.job_scope_assignments (org_id, job_id, quotation_id, scope_id, assigned_by)
    select v_po.org_id, v_job.id, v_quotation.id, scope_id::uuid, v_actor
    from jsonb_array_elements_text(v_added->'scope_ids') scope_id;

    insert into public.job_purchase_order_allocations (
      org_id, purchase_order_id, job_id, quotation_id_snapshot,
      quotation_number_snapshot, revision_number_snapshot, project_name_snapshot,
      quotation_total, po_amount_before_tax, tax_name_snapshot, tax_rate_snapshot,
      tax_amount, total_po_amount, difference_amount, difference_acknowledged
    ) values (
      v_po.org_id, v_po.id, v_job.id, v_quotation.id,
      v_quotation.quotation_number, v_quotation.revision_number, v_quotation.project_name,
      v_quotation.grand_total_after_tax, v_before_tax, v_quotation.tax_name,
      v_quotation.tax_rate, v_tax_amount, v_po_total, v_difference,
      coalesce((v_added->>'difference_acknowledged')::boolean, false)
    ) returning id into v_allocation_id;

    insert into public.job_purchase_order_revision_items (
      org_id, revision_id, allocation_id, job_id, quotation_id,
      quotation_number_snapshot, quotation_revision_snapshot,
      project_name_snapshot, quotation_amount_snapshot, po_amount_snapshot,
      currency_snapshot, job_number_snapshot, job_status_snapshot,
      change_type, is_included
    ) values (
      v_po.org_id, v_revision_id, v_allocation_id, v_job.id, v_quotation.id,
      v_quotation.quotation_number, v_quotation.revision_number,
      v_quotation.project_name, v_quotation.grand_total_after_tax, v_po_total,
      v_po.currency, coalesce(v_job.job_number, v_job_number), 'work_in_process',
      'added', true
    );
  end loop;

  select coalesce(sum(po_amount_snapshot), 0) into v_revised_total
  from public.job_purchase_order_revision_items
  where revision_id = v_revision_id and is_included;

  update public.job_purchase_order_revisions set
    revised_po_amount = v_revised_total,
    difference_amount = round(v_revised_total - v_previous_total, 2),
    change_percentage = case when v_previous_total = 0 then null
      else round((v_revised_total - v_previous_total) * 100 / v_previous_total, 4) end
  where id = v_revision_id;

  update public.job_purchase_orders set
    current_revision_number = v_revision_number,
    current_po_total = v_revised_total,
    updated_by = v_actor,
    updated_at = now()
  where id = v_po.id;

  return v_revision_id;
end;
$$;

revoke all on function public.create_job_purchase_order_revision(uuid, date, uuid, jsonb, uuid[], text, boolean)
  from public, anon;
grant execute on function public.create_job_purchase_order_revision(uuid, date, uuid, jsonb, uuid[], text, boolean)
  to authenticated, service_role;
