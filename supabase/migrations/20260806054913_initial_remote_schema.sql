-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

-- Keep Supabase-managed platform extensions intact on fresh hosted projects.
-- This baseline was generated from a project where pg_net was disabled, but
-- dropping it is not part of the CRM schema and may be rejected by the hosted
-- platform because Database Webhooks and other managed services depend on it.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE FUNCTION public.assign_supplier_material_code()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if new.material_code is null
     or length(trim(new.material_code)) = 0 then
    new.material_code :=
      public.generate_supplier_material_code(new.org_id);
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.assign_supplier_material_code() TO anon;

GRANT ALL ON FUNCTION public.assign_supplier_material_code() TO authenticated;

GRANT ALL ON FUNCTION public.assign_supplier_material_code() TO service_role;

CREATE FUNCTION public.can_edit_supplier_price_library (
  p_org_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.org_members member
      where member.org_id = p_org_id
        and member.user_id = auth.uid()
        and lower(member.status::text) = 'active'
        and lower(member.role::text) in (
          'org_admin',
          'admin',
          'sales',
          'estimator'
        )
    );
$function$;

GRANT ALL ON FUNCTION public.can_edit_supplier_price_library(uuid) TO anon;

GRANT ALL ON FUNCTION public.can_edit_supplier_price_library(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.can_edit_supplier_price_library(uuid) TO service_role;

CREATE FUNCTION public.can_manage_employee_directory (
  p_org_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.org_members member
      where member.org_id = p_org_id
        and member.user_id = auth.uid()
        and lower(member.status::text) = 'active'
        and lower(member.role::text) in (
          'org_admin',
          'admin',
          'sales',
          'accountant',
          'accounts'
        )
    );
$function$;

GRANT ALL ON FUNCTION public.can_manage_employee_directory(uuid) TO anon;

GRANT ALL ON FUNCTION public.can_manage_employee_directory(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.can_manage_employee_directory(uuid) TO service_role;

CREATE FUNCTION public.can_manage_public_calendar (
  p_org_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.org_members member
      where member.org_id = p_org_id
        and member.user_id = auth.uid()
        and lower(member.status::text) = 'active'
        and lower(member.role::text) in (
          'org_admin',
          'admin',
          'sales',
          'accountant',
          'accounts'
        )
    );
$function$;

GRANT ALL ON FUNCTION public.can_manage_public_calendar(uuid) TO anon;

GRANT ALL ON FUNCTION public.can_manage_public_calendar(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.can_manage_public_calendar(uuid) TO service_role;

CREATE FUNCTION public.can_view_supplier_price_library (
  p_org_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.org_members member
      where member.org_id = p_org_id
        and member.user_id = auth.uid()
        and lower(member.status::text) = 'active'
        and lower(member.role::text) in (
          'org_admin',
          'admin',
          'sales',
          'accountant',
          'accounts',
          'estimator',
          'production'
        )
    );
$function$;

GRANT ALL ON FUNCTION public.can_view_supplier_price_library(uuid) TO anon;

GRANT ALL ON FUNCTION public.can_view_supplier_price_library(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.can_view_supplier_price_library(uuid) TO service_role;

CREATE FUNCTION public.capture_customer_note_revision()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if old.body_html is distinct from new.body_html then
    insert into public.customer_note_revisions (
      org_id,
      customer_id,
      note_id,
      edited_by,
      old_body_html,
      new_body_html
    )
    values (
      new.org_id,
      new.customer_id,
      new.id,
      coalesce(new.updated_by, auth.uid()),
      old.body_html,
      new.body_html
    );
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.capture_customer_note_revision() TO anon;

GRANT ALL ON FUNCTION public.capture_customer_note_revision() TO authenticated;

GRANT ALL ON FUNCTION public.capture_customer_note_revision() TO service_role;

CREATE FUNCTION public.check_public_calendar_conflicts (
  p_org_id               uuid,
  p_employee_ids         uuid[],
  p_starts_at            timestamp with time zone,
  p_ends_at              timestamp with time zone,
  p_requested_event_type text,
  p_exclude_event_id     uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    employee_id             uuid,
    employee_name           text,
    conflicting_event_id    uuid,
    conflicting_event_type  text,
    conflicting_event_title text,
    conflicting_starts_at   timestamp with time zone,
    conflicting_ends_at     timestamp with time zone,
    conflict_level          text,
    conflict_message        text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    employee.id,
    employee.employee_name,
    existing_event.id,
    existing_event.event_type,
    existing_event.title,
    existing_event.starts_at,
    existing_event.ends_at,

    case
      when existing_event.event_type in (
        'employee_holiday',
        'job_site_assignment'
      )
      then 'hard_conflict'
      else 'warning'
    end as conflict_level,

    case
      when existing_event.event_type = 'employee_holiday'
      then
        'This employee is scheduled for leave during the selected time and cannot be assigned.'

      when existing_event.event_type = 'job_site_assignment'
      then
        'This employee is already assigned to another job during the selected time period.'

      else
        'This employee is participating in another company event during the selected time period.'
    end as conflict_message

  from public.employee_directory employee

  join public.public_calendar_event_participants participant
    on participant.employee_id = employee.id
   and participant.org_id = employee.org_id

  join public.public_calendar_events existing_event
    on existing_event.id = participant.event_id
   and existing_event.org_id = participant.org_id

  where employee.org_id = p_org_id
    and employee.id = any(p_employee_ids)
    and employee.employee_status = 'active'
    and existing_event.event_status = 'scheduled'

    and (
      p_exclude_event_id is null
      or existing_event.id <> p_exclude_event_id
    )

    -- PostgreSQL half-open overlap:
    -- existing starts before requested ends
    -- and existing ends after requested starts
    and existing_event.starts_at < p_ends_at
    and existing_event.ends_at > p_starts_at

    -- Company events are warnings.
    -- Holidays and job assignments are hard conflicts.
    and (
      existing_event.event_type in (
        'employee_holiday',
        'job_site_assignment'
      )
      or participant.participation_required = true
    )

  order by
    employee.employee_name,
    existing_event.starts_at;
$function$;

GRANT ALL ON FUNCTION public.check_public_calendar_conflicts(uuid, uuid[], timestamp WITH time zone, timestamp WITH time zone, text, uuid) TO anon;

GRANT ALL ON FUNCTION public.check_public_calendar_conflicts(uuid, uuid[], timestamp WITH time zone, timestamp WITH time zone, text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.check_public_calendar_conflicts(uuid, uuid[], timestamp WITH time zone, timestamp WITH time zone, text, uuid) TO service_role;

CREATE FUNCTION public.create_job_purchase_order (
  p_po_number        text,
  p_po_received_date date,
  p_internal_remarks text,
  p_allocations      jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_actor uuid;
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
  v_actor := auth.uid();

  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_po_number is null
     or length(trim(p_po_number)) = 0 then
    raise exception 'Purchase Order Number is required';
  end if;

  if p_po_received_date is null then
    raise exception 'Purchase Order Received Date is required';
  end if;

  if p_allocations is null
     or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one job allocation is required';
  end if;

  -- Resolve organization and customer from first job.
  select j.*
  into v_job
  from public.jobs j
  where j.id =
    (p_allocations->0->>'job_id')::uuid
  for update;

  if not found then
    raise exception 'Job not found';
  end if;

  v_org_id := v_job.org_id;
  v_customer_id := v_job.customer_id;

  if not public.is_active_org_member(v_org_id)
     and not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.job_purchase_orders (
    org_id,
    customer_id,
    po_number,
    po_received_date,
    internal_remarks,
    created_by,
    updated_by
  )
  values (
    v_org_id,
    v_customer_id,
    trim(p_po_number),
    p_po_received_date,
    nullif(trim(p_internal_remarks), ''),
    v_actor,
    v_actor
  )
  returning id into v_po_id;

  for v_allocation in
    select value
    from jsonb_array_elements(p_allocations)
  loop
    select j.*
    into v_job
    from public.jobs j
    where j.id =
      (v_allocation->>'job_id')::uuid
      and j.org_id = v_org_id
    for update;

    if not found then
      raise exception 'One or more selected jobs were not found';
    end if;

    if v_job.customer_id <> v_customer_id then
      raise exception
        'A combined Purchase Order can contain jobs for only one customer';
    end if;

    if v_job.job_status <> 'po_pending' then
      raise exception
        'Job % is not awaiting a Purchase Order',
        v_job.id;
    end if;

    if exists (
      select 1
      from public.job_purchase_order_allocations a
      where a.job_id = v_job.id
    ) then
      raise exception
        'Job % is already linked to a Purchase Order',
        v_job.id;
    end if;

    select q.*
    into v_quotation
    from public.quotations q
    where q.id = v_job.latest_accepted_quotation_id
      and q.org_id = v_org_id;

    if not found then
      raise exception 'Accepted quotation was not found';
    end if;

    v_before_tax :=
      round(
        coalesce(
          (v_allocation->>'po_amount_before_tax')::numeric,
          0
        ),
        2
      );

    if v_before_tax < 0 then
      raise exception 'PO Amount Before Tax cannot be negative';
    end if;

    v_tax_rate := coalesce(v_quotation.tax_rate, 0);

    v_tax_amount :=
      round(
        v_before_tax * v_tax_rate / 100,
        2
      );

    v_po_total :=
      round(v_before_tax + v_tax_amount, 2);

    v_difference :=
      round(
        v_po_total
        - coalesce(v_quotation.grand_total_after_tax, 0),
        2
      );

    v_acknowledged :=
      coalesce(
        (v_allocation->>'difference_acknowledged')::boolean,
        false
      );

    if v_difference <> 0
       and v_acknowledged = false then
      raise exception
        'PO total differs from quotation total. Difference acknowledgement is required.';
    end if;

    -- Assign permanent job number only when PO is received.
    if v_job.job_number is null then
      select
        generated.job_number,
        generated.job_year,
        generated.job_sequence
      into
        v_job_number,
        v_job_year,
        v_job_sequence
      from public.generate_job_number(v_org_id) generated;

      update public.jobs
      set
        job_number = v_job_number,
        job_year = v_job_year,
        job_sequence = v_job_sequence,
        job_status = 'work_in_process',
        updated_by = v_actor,
        updated_at = now()
      where id = v_job.id;
    else
      update public.jobs
      set
        job_status = 'work_in_process',
        updated_by = v_actor,
        updated_at = now()
      where id = v_job.id;
    end if;

    insert into public.job_purchase_order_allocations (
      org_id,
      purchase_order_id,
      job_id,
      quotation_id_snapshot,
      quotation_number_snapshot,
      revision_number_snapshot,
      customer_name_snapshot,
      project_name_snapshot,
      quotation_total,
      po_amount_before_tax,
      tax_name_snapshot,
      tax_rate_snapshot,
      tax_amount,
      total_po_amount,
      difference_amount,
      difference_acknowledged
    )
    values (
      v_org_id,
      v_po_id,
      v_job.id,
      v_quotation.id,
      v_quotation.quotation_number,
      coalesce(v_quotation.revision_number, 0),
      null,
      v_quotation.project_name,
      coalesce(v_quotation.grand_total_after_tax, 0),
      v_before_tax,
      v_quotation.tax_name,
      v_tax_rate,
      v_tax_amount,
      v_po_total,
      v_difference,
      v_acknowledged
    );

    v_combined_quotation_total :=
      v_combined_quotation_total
      + coalesce(v_quotation.grand_total_after_tax, 0);

    v_combined_before_tax :=
      v_combined_before_tax + v_before_tax;

    v_combined_tax :=
      v_combined_tax + v_tax_amount;

    v_combined_total :=
      v_combined_total + v_po_total;
  end loop;

  update public.job_purchase_orders
  set
    combined_quotation_total =
      round(v_combined_quotation_total, 2),

    combined_po_amount_before_tax =
      round(v_combined_before_tax, 2),

    combined_tax_amount =
      round(v_combined_tax, 2),

    combined_po_total =
      round(v_combined_total, 2),

    difference_amount =
      round(
        v_combined_total
        - v_combined_quotation_total,
        2
      ),

    updated_by = v_actor,
    updated_at = now()
  where id = v_po_id;

  return v_po_id;
end;
$function$;

GRANT ALL ON FUNCTION public.create_job_purchase_order(text, date, text, jsonb) TO anon;

GRANT ALL ON FUNCTION public.create_job_purchase_order(text, date, text, jsonb) TO authenticated;

GRANT ALL ON FUNCTION public.create_job_purchase_order(text, date, text, jsonb) TO service_role;

CREATE FUNCTION public.create_job_when_quotation_accepted()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_job_id uuid;
  v_series_id uuid;
  v_actor uuid;
begin
  if new.status = 'accepted'
     and old.status is distinct from 'accepted' then

    v_series_id := coalesce(
      new.quotation_series_id,
      new.id
    );

    v_actor := coalesce(
      new.updated_by,
      new.created_by,
      new.prepared_by
    );

    insert into public.jobs (
      org_id,
      quotation_series_id,
      original_accepted_quotation_id,
      latest_accepted_quotation_id,
      customer_id,
      job_status,
      accepted_at,
      salesperson_id,
      created_by,
      updated_by
    )
    values (
      new.org_id,
      v_series_id,
      new.id,
      new.id,
      new.customer_id,
      'po_pending',
      now(),
      coalesce(new.sales_rep_id, new.prepared_by),
      v_actor,
      v_actor
    )
    on conflict (org_id, quotation_series_id)
    do update
    set
      latest_accepted_quotation_id =
        excluded.latest_accepted_quotation_id,
      customer_id =
        excluded.customer_id,
      salesperson_id =
        excluded.salesperson_id,
      accepted_at =
        excluded.accepted_at,
      updated_by =
        excluded.updated_by,
      updated_at = now()
    returning id into v_job_id;

    insert into public.job_quotation_history (
      org_id,
      job_id,
      quotation_id,
      revision_number,
      accepted_at,
      accepted_by
    )
    values (
      new.org_id,
      v_job_id,
      new.id,
      coalesce(new.revision_number, 0),
      now(),
      v_actor
    )
    on conflict (job_id, quotation_id)
    do nothing;

  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.create_job_when_quotation_accepted() TO anon;

GRANT ALL ON FUNCTION public.create_job_when_quotation_accepted() TO authenticated;

GRANT ALL ON FUNCTION public.create_job_when_quotation_accepted() TO service_role;

CREATE FUNCTION public.create_quotation_revision (
  p_source_quotation_id uuid,
  p_revision_purpose    text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_source public.quotations%rowtype;
  v_new_revision_number integer;
  v_new_id uuid;
  v_actor uuid;
begin

  v_actor := auth.uid();

  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_revision_purpose is null
     or length(trim(p_revision_purpose)) = 0 then
    raise exception 'Purpose of revision is required';
  end if;

  select *
  into v_source
  from public.quotations
  where id = p_source_quotation_id
  for update;

  if not found then
    raise exception 'Quotation not found';
  end if;

  if not public.is_active_org_member(v_source.org_id)
     and not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  if v_source.status <> 'sent' then
    raise exception
      'A new revision can only be created from a Sent quotation';
  end if;

  -- Prevent concurrent revision number allocation for same series.
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_source.quotation_series_id::text,
      0
    )
  );

  select coalesce(max(revision_number), -1) + 1
  into v_new_revision_number
  from public.quotations
  where org_id = v_source.org_id
    and quotation_series_id =
        v_source.quotation_series_id;

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
  )
  values (
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
    trim(p_revision_purpose),
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
    actor_id
  )
  values (
    v_source.org_id,
    v_new_id,
    v_source.quotation_series_id,
    v_new_revision_number,
    'revision_created',
    v_source.id,
    trim(p_revision_purpose),
    v_actor
  );

  return v_new_id;
end;
$function$;

GRANT ALL ON FUNCTION public.create_quotation_revision(uuid, text) TO anon;

GRANT ALL ON FUNCTION public.create_quotation_revision(uuid, text) TO authenticated;

GRANT ALL ON FUNCTION public.create_quotation_revision(uuid, text) TO service_role;

CREATE FUNCTION public.enforce_max_two_quotation_contacts()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.quotation_contacts
  where quotation_id = new.quotation_id
    and id <> coalesce(new.id, gen_random_uuid());

  if v_count >= 2 then
    raise exception 'Only two contacts are allowed per quotation';
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.enforce_max_two_quotation_contacts() TO anon;

GRANT ALL ON FUNCTION public.enforce_max_two_quotation_contacts() TO authenticated;

GRANT ALL ON FUNCTION public.enforce_max_two_quotation_contacts() TO service_role;

CREATE FUNCTION public.generate_customer_code()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_next bigint;
  v_org_code text;
begin
  if new.customer_code is null or trim(new.customer_code) = '' then

    insert into public.customer_counters (org_id, next_customer_number)
    values (new.org_id, 1)
    on conflict (org_id) do nothing;

    update public.customer_counters
    set next_customer_number = next_customer_number + 1,
        updated_at = now()
    where org_id = new.org_id
    returning next_customer_number - 1 into v_next;

    select org_code
    into v_org_code
    from public.organizations
    where id = new.org_id;

    new.customer_code :=
      upper(v_org_code) || '-CUS-' || lpad(v_next::text, 6, '0');

  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.generate_customer_code() TO anon;

GRANT ALL ON FUNCTION public.generate_customer_code() TO authenticated;

GRANT ALL ON FUNCTION public.generate_customer_code() TO service_role;

CREATE FUNCTION public.generate_job_number (
  p_org_id uuid
)
  RETURNS TABLE (
    job_number   text,
    job_year     integer,
    job_sequence integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_year integer;
  v_sequence integer;
  v_job_number text;
begin
  v_year := extract(year from current_date)::integer;

  insert into public.job_number_counters (
    org_id,
    counter_year,
    last_sequence
  )
  values (
    p_org_id,
    v_year,
    1
  )
  on conflict (org_id, counter_year)
  do update
  set
    last_sequence =
      public.job_number_counters.last_sequence + 1,
    updated_at = now()
  returning last_sequence
  into v_sequence;

  if v_sequence > 9999 then
    raise exception
      'Annual job number limit exceeded for organization and year %',
      v_year;
  end if;

  v_job_number :=
    right(v_year::text, 2)
    || lpad(v_sequence::text, 4, '0');

  return query
  select
    v_job_number,
    v_year,
    v_sequence;
end;
$function$;

GRANT ALL ON FUNCTION public.generate_job_number(uuid) TO anon;

GRANT ALL ON FUNCTION public.generate_job_number(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.generate_job_number(uuid) TO service_role;

CREATE FUNCTION public.generate_quotation_number()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_quote_date date;
  v_year integer;
  v_year_short text;
  v_sequence integer;
  v_employee_initials text;
  v_customer_prefix text;
begin
  if new.quotation_number is not null and trim(new.quotation_number) <> '' then
    return new;
  end if;

  if new.org_id is null then
    raise exception 'org_id is required for quotation number generation';
  end if;

  if new.customer_id is null then
    raise exception 'customer_id is required for quotation number generation';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = new.customer_id
      and c.org_id = new.org_id
  ) then
    raise exception 'customer does not belong to this organization';
  end if;

  v_quote_date := coalesce(new.quote_date, current_date);
  v_year := extract(year from v_quote_date)::integer;
  v_year_short := to_char(v_quote_date, 'YY');

  new.quote_date := v_quote_date;
  new.quote_year := v_year;

  new.prepared_by := coalesce(new.prepared_by, auth.uid());
  new.created_by := coalesce(new.created_by, auth.uid());

  insert into public.quotation_counters (org_id, quote_year, next_sequence)
  values (new.org_id, v_year, 1)
  on conflict (org_id, quote_year) do nothing;

  update public.quotation_counters
  set next_sequence = next_sequence + 1,
      updated_at = now()
  where org_id = new.org_id
    and quote_year = v_year
  returning next_sequence - 1 into v_sequence;

  new.quote_sequence := v_sequence;

  v_employee_initials := public.get_profile_initials(new.prepared_by);
  v_customer_prefix := public.get_customer_quote_prefix(new.org_id, new.customer_id);

  new.quotation_number :=
    v_year_short ||
    lpad(v_sequence::text, 4, '0') ||
    v_employee_initials ||
    '-' ||
    v_customer_prefix;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.generate_quotation_number() TO anon;

GRANT ALL ON FUNCTION public.generate_quotation_number() TO authenticated;

GRANT ALL ON FUNCTION public.generate_quotation_number() TO service_role;

CREATE FUNCTION public.generate_supplier_material_code (
  p_org_id uuid
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_sequence bigint;
begin
  if p_org_id is null then
    raise exception 'Organization ID is required';
  end if;

  insert into public.supplier_price_material_counters (
    org_id,
    last_sequence
  )
  values (
    p_org_id,
    1
  )
  on conflict (org_id)
  do update
  set
    last_sequence =
      public.supplier_price_material_counters.last_sequence + 1,
    updated_at = now()
  returning last_sequence
  into v_sequence;

  return 'MAT-' || lpad(v_sequence::text, 6, '0');
end;
$function$;

GRANT ALL ON FUNCTION public.generate_supplier_material_code(uuid) TO anon;

GRANT ALL ON FUNCTION public.generate_supplier_material_code(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.generate_supplier_material_code(uuid) TO service_role;

CREATE FUNCTION public.get_customer_quote_prefix (
  p_org_id      uuid,
  p_customer_id uuid
)
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_company_name text;
  v_clean text;
begin
  select company_name
  into v_company_name
  from public.customers
  where id = p_customer_id
    and org_id = p_org_id;

  v_clean := regexp_replace(upper(coalesce(v_company_name, 'CUS')), '[^A-Z0-9]', '', 'g');

  return rpad(left(coalesce(nullif(v_clean, ''), 'CUS'), 3), 3, 'X');
end;
$function$;

GRANT ALL ON FUNCTION public.get_customer_quote_prefix(uuid, uuid) TO anon;

GRANT ALL ON FUNCTION public.get_customer_quote_prefix(uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.get_customer_quote_prefix(uuid, uuid) TO service_role;

CREATE FUNCTION public.get_profile_initials (
  p_user_id uuid
)
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_full_name text;
  v_email text;
  v_parts text[];
  v_initials text;
begin
  select full_name, email
  into v_full_name, v_email
  from public.profiles
  where id = p_user_id;

  v_full_name := trim(coalesce(v_full_name, ''));

  if v_full_name <> '' then
    v_parts := regexp_split_to_array(regexp_replace(v_full_name, '\s+', ' ', 'g'), ' ');

    if array_length(v_parts, 1) >= 2 then
      v_initials :=
        upper(left(v_parts[1], 1) || left(v_parts[array_length(v_parts, 1)], 1));
    else
      v_initials := upper(left(regexp_replace(v_parts[1], '[^A-Za-z]', '', 'g'), 2));
    end if;
  else
    v_initials := upper(left(regexp_replace(coalesce(v_email, ''), '[^A-Za-z]', '', 'g'), 2));
  end if;

  v_initials := regexp_replace(coalesce(v_initials, ''), '[^A-Z]', '', 'g');

  return rpad(left(coalesce(nullif(v_initials, ''), 'XX'), 2), 2, 'X');
end;
$function$;

GRANT ALL ON FUNCTION public.get_profile_initials(uuid) TO anon;

GRANT ALL ON FUNCTION public.get_profile_initials(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.get_profile_initials(uuid) TO service_role;

CREATE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'active'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      status = public.profiles.status;

  return new;
end;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;

GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

CREATE FUNCTION public.is_active_org_member (
  p_org_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.org_members om
    join public.organizations o on o.id = om.org_id
    join public.profiles p on p.id = om.user_id
    where om.user_id = auth.uid()
      and om.org_id = p_org_id
      and om.status = 'active'
      and o.status = 'active'
      and p.status = 'active'
  );
$function$;

GRANT ALL ON FUNCTION public.is_active_org_member(uuid) TO anon;

GRANT ALL ON FUNCTION public.is_active_org_member(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.is_active_org_member(uuid) TO service_role;

CREATE FUNCTION public.is_org_admin (
  p_org_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.org_members om
    join public.organizations o on o.id = om.org_id
    join public.profiles p on p.id = om.user_id
    where om.user_id = auth.uid()
      and om.org_id = p_org_id
      and om.role = 'admin'
      and om.status = 'active'
      and o.status = 'active'
      and p.status = 'active'
  );
$function$;

GRANT ALL ON FUNCTION public.is_org_admin(uuid) TO anon;

GRANT ALL ON FUNCTION public.is_org_admin(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.is_org_admin(uuid) TO service_role;

CREATE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.super_admins sa
    join public.profiles p on p.id = sa.id
    where sa.id = auth.uid()
      and p.status = 'active'
  );
$function$;

GRANT ALL ON FUNCTION public.is_super_admin() TO anon;

GRANT ALL ON FUNCTION public.is_super_admin() TO authenticated;

GRANT ALL ON FUNCTION public.is_super_admin() TO service_role;

CREATE FUNCTION public.lock_quotation_when_sent()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin

  if new.status = 'sent'
     and old.status is distinct from 'sent' then

    new.is_locked := true;
    new.locked_at := now();
    new.locked_by := coalesce(
      new.updated_by,
      auth.uid()
    );

  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.lock_quotation_when_sent() TO anon;

GRANT ALL ON FUNCTION public.lock_quotation_when_sent() TO authenticated;

GRANT ALL ON FUNCTION public.lock_quotation_when_sent() TO service_role;

CREATE FUNCTION public.log_customer_activity_from_customer()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.customer_activities (
      org_id,
      customer_id,
      activity_type,
      description,
      actor_id
    )
    values (
      new.org_id,
      new.id,
      'customer_created',
      'Customer profile created',
      coalesce(new.created_by, auth.uid())
    );

    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.customer_activities (
      org_id,
      customer_id,
      activity_type,
      description,
      actor_id
    )
    values (
      new.org_id,
      new.id,
      'profile_updated',
      'Customer profile updated',
      coalesce(new.updated_by, auth.uid())
    );

    return new;
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.log_customer_activity_from_customer() TO anon;

GRANT ALL ON FUNCTION public.log_customer_activity_from_customer() TO authenticated;

GRANT ALL ON FUNCTION public.log_customer_activity_from_customer() TO service_role;

CREATE FUNCTION public.log_quotation_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if old.status is distinct from new.status then
    insert into public.quotation_status_history (
      org_id,
      quotation_id,
      old_status,
      new_status,
      changed_by
    )
    values (
      new.org_id,
      new.id,
      old.status,
      new.status,
      coalesce(new.updated_by, auth.uid())
    );
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.log_quotation_status_change() TO anon;

GRANT ALL ON FUNCTION public.log_quotation_status_change() TO authenticated;

GRANT ALL ON FUNCTION public.log_quotation_status_change() TO service_role;

CREATE FUNCTION public.prepare_job_invoice_status()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if new.status = 'sent'
     and old.status is distinct from 'sent'
     and new.sent_at is null then
    new.sent_at := now();
  end if;

  if new.status = 'payment_received'
     and new.payment_date is null then
    raise exception
      'Payment date is required when invoice status is Payment Received';
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.prepare_job_invoice_status() TO anon;

GRANT ALL ON FUNCTION public.prepare_job_invoice_status() TO authenticated;

GRANT ALL ON FUNCTION public.prepare_job_invoice_status() TO service_role;

CREATE FUNCTION public.prevent_calendar_event_reschedule_conflict()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_participant record;
  v_conflict record;
begin
  if new.event_status <> 'scheduled' then
    return new;
  end if;

  if new.event_type = 'company_event' then
    return new;
  end if;

  if new.starts_at is not distinct from old.starts_at
     and new.ends_at is not distinct from old.ends_at
     and new.event_type is not distinct from old.event_type then
    return new;
  end if;

  for v_participant in
    select participant.employee_id
    from public.public_calendar_event_participants participant
    where participant.event_id = new.id
      and participant.org_id = new.org_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        new.org_id::text || ':' || v_participant.employee_id::text,
        0
      )
    );

    select
      existing_event.id,
      existing_event.event_type
    into v_conflict

    from public.public_calendar_event_participants existing_participant

    join public.public_calendar_events existing_event
      on existing_event.id = existing_participant.event_id
     and existing_event.org_id = existing_participant.org_id

    where existing_participant.org_id = new.org_id
      and existing_participant.employee_id =
          v_participant.employee_id

      and existing_event.id <> new.id
      and existing_event.event_status = 'scheduled'

      and existing_event.starts_at < new.ends_at
      and existing_event.ends_at > new.starts_at

      and existing_event.event_type in (
        'employee_holiday',
        'job_site_assignment'
      )

    limit 1;

    if found then
      if v_conflict.event_type = 'employee_holiday' then
        raise exception
          'This employee is scheduled for leave during the selected time and cannot be assigned.';
      else
        raise exception
          'This employee is already assigned to another job during the selected time period.';
      end if;
    end if;
  end loop;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.prevent_calendar_event_reschedule_conflict() TO anon;

GRANT ALL ON FUNCTION public.prevent_calendar_event_reschedule_conflict() TO authenticated;

GRANT ALL ON FUNCTION public.prevent_calendar_event_reschedule_conflict() TO service_role;

CREATE FUNCTION public.prevent_hard_calendar_conflict()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_event public.public_calendar_events%rowtype;
  v_conflict record;
begin
  select *
  into v_event
  from public.public_calendar_events
  where id = new.event_id
    and org_id = new.org_id;

  if not found then
    raise exception 'Calendar event not found';
  end if;

  if v_event.event_status <> 'scheduled' then
    return new;
  end if;

  -- Serialize scheduling operations for the same employee.
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.org_id::text || ':' || new.employee_id::text,
      0
    )
  );

  -- Company events only produce warnings, so they are not blocked here.
  if v_event.event_type = 'company_event' then
    return new;
  end if;

  select
    existing_event.id,
    existing_event.event_type,
    existing_event.title
  into v_conflict

  from public.public_calendar_event_participants existing_participant

  join public.public_calendar_events existing_event
    on existing_event.id = existing_participant.event_id
   and existing_event.org_id = existing_participant.org_id

  where existing_participant.org_id = new.org_id
    and existing_participant.employee_id = new.employee_id
    and existing_event.id <> new.event_id
    and existing_event.event_status = 'scheduled'

    and existing_event.starts_at < v_event.ends_at
    and existing_event.ends_at > v_event.starts_at

    and existing_event.event_type in (
      'employee_holiday',
      'job_site_assignment'
    )

  limit 1;

  if found then
    if v_conflict.event_type = 'employee_holiday' then
      raise exception
        'This employee is scheduled for leave during the selected time and cannot be assigned.';
    else
      raise exception
        'This employee is already assigned to another job during the selected time period.';
    end if;
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.prevent_hard_calendar_conflict() TO anon;

GRANT ALL ON FUNCTION public.prevent_hard_calendar_conflict() TO authenticated;

GRANT ALL ON FUNCTION public.prevent_hard_calendar_conflict() TO service_role;

CREATE FUNCTION public.prevent_locked_quotation_child_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_quotation_id uuid;
  v_is_locked boolean;
begin

  if tg_op = 'DELETE' then
    v_quotation_id :=
      (to_jsonb(old)->>'quotation_id')::uuid;
  else
    v_quotation_id :=
      (to_jsonb(new)->>'quotation_id')::uuid;
  end if;

  if v_quotation_id is null then
    return coalesce(new, old);
  end if;

  select q.is_locked
  into v_is_locked
  from public.quotations q
  where q.id = v_quotation_id;

  if coalesce(v_is_locked, false) then
    raise exception
      'This quotation revision is locked and cannot be modified';
  end if;

  return coalesce(new, old);
end;
$function$;

GRANT ALL ON FUNCTION public.prevent_locked_quotation_child_change() TO anon;

GRANT ALL ON FUNCTION public.prevent_locked_quotation_child_change() TO authenticated;

GRANT ALL ON FUNCTION public.prevent_locked_quotation_child_change() TO service_role;

CREATE FUNCTION public.prevent_locked_quotation_edit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  v_old jsonb;
  v_new jsonb;
begin

  if old.is_locked = true then

    -- Fields that may still change after quotation is issued.
    v_old :=
      to_jsonb(old)
      - 'status'
      - 'updated_at'
      - 'updated_by';

    v_new :=
      to_jsonb(new)
      - 'status'
      - 'updated_at'
      - 'updated_by';

    if v_old is distinct from v_new then
      raise exception
        'This quotation revision is locked because it has already been sent to the customer';
    end if;

  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.prevent_locked_quotation_edit() TO anon;

GRANT ALL ON FUNCTION public.prevent_locked_quotation_edit() TO authenticated;

GRANT ALL ON FUNCTION public.prevent_locked_quotation_edit() TO service_role;

CREATE FUNCTION public.prevent_quotation_number_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if old.quotation_number is distinct from new.quotation_number then
    raise exception 'quotation_number cannot be changed manually';
  end if;

  if old.quote_year is distinct from new.quote_year then
    raise exception 'quote_year cannot be changed manually';
  end if;

  if old.quote_sequence is distinct from new.quote_sequence then
    raise exception 'quote_sequence cannot be changed manually';
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.prevent_quotation_number_change() TO anon;

GRANT ALL ON FUNCTION public.prevent_quotation_number_change() TO authenticated;

GRANT ALL ON FUNCTION public.prevent_quotation_number_change() TO service_role;

CREATE FUNCTION public.prevent_supplier_price_overwrite()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if old.org_id is distinct from new.org_id
     or old.material_id is distinct from new.material_id
     or old.supplier_id is distinct from new.supplier_id
     or old.unit_price is distinct from new.unit_price
     or old.currency is distinct from new.currency
     or old.quote_date is distinct from new.quote_date then

    raise exception
      'Supplier price history cannot be overwritten. Create a new price record instead.';
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.prevent_supplier_price_overwrite() TO anon;

GRANT ALL ON FUNCTION public.prevent_supplier_price_overwrite() TO authenticated;

GRANT ALL ON FUNCTION public.prevent_supplier_price_overwrite() TO service_role;

CREATE FUNCTION public.record_job_invoice_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if old.status is distinct from new.status then
    insert into public.job_invoice_status_history (
      org_id,
      invoice_id,
      previous_status,
      new_status,
      changed_by,
      payment_date,
      payment_reference_number,
      payment_notes
    )
    values (
      new.org_id,
      new.id,
      old.status,
      new.status,
      coalesce(new.updated_by, auth.uid()),
      new.payment_date,
      new.payment_reference_number,
      new.payment_notes
    );
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.record_job_invoice_status_change() TO anon;

GRANT ALL ON FUNCTION public.record_job_invoice_status_change() TO authenticated;

GRANT ALL ON FUNCTION public.record_job_invoice_status_change() TO service_role;

CREATE FUNCTION public.record_job_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if old.job_status is distinct from new.job_status then
    insert into public.job_status_history (
      org_id,
      job_id,
      previous_status,
      new_status,
      changed_by
    )
    values (
      new.org_id,
      new.id,
      old.job_status,
      new.job_status,
      coalesce(new.updated_by, auth.uid())
    );
  end if;

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.record_job_status_change() TO anon;

GRANT ALL ON FUNCTION public.record_job_status_change() TO authenticated;

GRANT ALL ON FUNCTION public.record_job_status_change() TO service_role;

CREATE FUNCTION public.record_public_calendar_event_history()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_action text;
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_actor := coalesce(new.created_by, auth.uid());

    insert into public.public_calendar_event_history (
      org_id,
      event_id,
      action_type,
      actor_id,
      previous_data,
      new_data
    )
    values (
      new.org_id,
      new.id,
      v_action,
      v_actor,
      null,
      to_jsonb(new)
    );

    return new;

  elsif tg_op = 'UPDATE' then
    if old.event_status <> 'cancelled'
       and new.event_status = 'cancelled' then
      v_action := 'cancelled';
    else
      v_action := 'updated';
    end if;

    v_actor := coalesce(
      new.updated_by,
      new.cancelled_by,
      auth.uid()
    );

    insert into public.public_calendar_event_history (
      org_id,
      event_id,
      action_type,
      actor_id,
      previous_data,
      new_data
    )
    values (
      new.org_id,
      new.id,
      v_action,
      v_actor,
      to_jsonb(old),
      to_jsonb(new)
    );

    return new;

  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_actor := coalesce(old.updated_by, old.created_by, auth.uid());

    insert into public.public_calendar_event_history (
      org_id,
      event_id,
      action_type,
      actor_id,
      previous_data,
      new_data
    )
    values (
      old.org_id,
      old.id,
      v_action,
      v_actor,
      to_jsonb(old),
      null
    );

    return old;
  end if;

  return null;
end;
$function$;

GRANT ALL ON FUNCTION public.record_public_calendar_event_history() TO anon;

GRANT ALL ON FUNCTION public.record_public_calendar_event_history() TO authenticated;

GRANT ALL ON FUNCTION public.record_public_calendar_event_history() TO service_role;

CREATE FUNCTION public.seed_supplier_categories_after_org_insert()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  perform public.seed_supplier_price_categories_for_org(new.id);
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.seed_supplier_categories_after_org_insert() TO anon;

GRANT ALL ON FUNCTION public.seed_supplier_categories_after_org_insert() TO authenticated;

GRANT ALL ON FUNCTION public.seed_supplier_categories_after_org_insert() TO service_role;

CREATE FUNCTION public.seed_supplier_price_categories_for_org (
  p_org_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.supplier_price_categories (
    org_id,
    category_name,
    is_archived
  )
  select
    p_org_id,
    category.category_name,
    false
  from (
    values
      ('Pipe'),
      ('Tube'),
      ('Plate'),
      ('Sheet'),
      ('Structural Steel'),
      ('Fittings'),
      ('Flanges'),
      ('Valves'),
      ('Pumps'),
      ('Motors'),
      ('Bearings'),
      ('Fasteners'),
      ('Welding Consumables'),
      ('Electrical Components'),
      ('Instrumentation'),
      ('Gaskets'),
      ('Hydraulic Components'),
      ('Pneumatic Components'),
      ('Miscellaneous')
  ) as category(category_name)
  on conflict do nothing;
end;
$function$;

GRANT ALL ON FUNCTION public.seed_supplier_price_categories_for_org(uuid) TO anon;

GRANT ALL ON FUNCTION public.seed_supplier_price_categories_for_org(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.seed_supplier_price_categories_for_org(uuid) TO service_role;

CREATE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;

GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;

GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;

CREATE FUNCTION public.sync_org_member_employee_trigger()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  perform public.sync_org_member_to_employee_directory(
    new.org_id,
    new.user_id,
    new.role::text,
    new.status::text
  );

  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.sync_org_member_employee_trigger() TO anon;

GRANT ALL ON FUNCTION public.sync_org_member_employee_trigger() TO authenticated;

GRANT ALL ON FUNCTION public.sync_org_member_employee_trigger() TO service_role;

CREATE FUNCTION public.sync_org_member_to_employee_directory (
  p_org_id        uuid,
  p_user_id       uuid,
  p_member_role   text,
  p_member_status text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
  AS $function$
declare
  v_email text;
  v_employee_name text;
  v_directory_role text;
  v_profile jsonb;
  v_existing_employee_id uuid;
begin
  if p_org_id is null or p_user_id is null then
    return;
  end if;

  select
    user_record.email
  into
    v_email
  from auth.users user_record
  where user_record.id = p_user_id;

  select
    to_jsonb(profile_record)
  into
    v_profile
  from public.profiles profile_record
  where profile_record.id = p_user_id;

  v_employee_name := coalesce(
    nullif(trim(v_profile->>'full_name'), ''),
    nullif(trim(v_profile->>'display_name'), ''),
    nullif(trim(v_profile->>'name'), ''),
    nullif(trim(v_email), ''),
    'Employee'
  );

  v_directory_role :=
    case lower(coalesce(p_member_role, ''))
      when 'org_admin' then 'admin'
      when 'admin' then 'admin'
      when 'sales' then 'sales'
      when 'accountant' then 'accounts'
      when 'accounts' then 'accounts'
      else 'worker'
    end;

  -- When CRM membership is not active, mark the corresponding
  -- employee record inactive rather than deleting it.

  if lower(coalesce(p_member_status, '')) <> 'active' then
    update public.employee_directory
    set
      employee_status = 'inactive',
      updated_at = now()
    where org_id = p_org_id
      and system_user_id = p_user_id;

    return;
  end if;

  -- First look for an existing directory record by Auth user.

  select employee.id
  into v_existing_employee_id
  from public.employee_directory employee
  where employee.org_id = p_org_id
    and employee.system_user_id = p_user_id
  limit 1;

  -- A person may have been manually added before receiving CRM access.
  -- In that case match by email and link the existing record.

  if v_existing_employee_id is null
     and v_email is not null then

    select employee.id
    into v_existing_employee_id
    from public.employee_directory employee
    where employee.org_id = p_org_id
      and lower(employee.email) = lower(v_email)
    limit 1;
  end if;

  if v_existing_employee_id is not null then
    update public.employee_directory
    set
      system_user_id = p_user_id,
      employee_name = v_employee_name,
      email = v_email,
      employee_role = v_directory_role,
      employee_status = 'active',
      source_type = 'system',
      updated_at = now()
    where id = v_existing_employee_id;

  else
    insert into public.employee_directory (
      org_id,
      system_user_id,
      employee_name,
      email,
      employee_role,
      employee_status,
      source_type
    )
    values (
      p_org_id,
      p_user_id,
      v_employee_name,
      v_email,
      v_directory_role,
      'active',
      'system'
    );
  end if;
end;
$function$;

GRANT ALL ON FUNCTION public.sync_org_member_to_employee_directory(uuid, uuid, text, text) TO anon;

GRANT ALL ON FUNCTION public.sync_org_member_to_employee_directory(uuid, uuid, text, text) TO authenticated;

GRANT ALL ON FUNCTION public.sync_org_member_to_employee_directory(uuid, uuid, text, text) TO service_role;

CREATE TABLE public.customer_activities (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id               uuid                     NOT NULL,
  customer_id          uuid                     NOT NULL,
  activity_type        text                     NOT NULL,
  description          text                     NOT NULL,
  linked_record_type   text,
  linked_record_id     uuid,
  linked_record_number text,
  actor_id             uuid,
  occurred_at          timestamp with time zone DEFAULT now() NOT NULL,
  metadata             jsonb                    DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE public.customer_activities
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_activities
  ADD CONSTRAINT customer_activities_activity_type_check
    CHECK
    (activity_type = ANY (ARRAY['customer_created'::text, 'profile_updated'::text, 'quote_created'::text, 'quote_revised'::text, 'quote_sent'::text, 'customer_po_received'::text,
    'work_order_created'::text,
    'invoice_created'::text,
    'invoice_sent'::text,
    'payment_recorded'::text,
    'phone_call_logged'::text,
    'meeting_logged'::text, 'email_logged'::text, 'note_added'::text, 'contact_added'::text, 'contact_updated'::text, 'tag_added'::text, 'tag_removed'::text]));

ALTER TABLE public.customer_activities
  ADD CONSTRAINT customer_activities_pkey PRIMARY KEY (id);

GRANT ALL ON public.customer_activities TO anon;

GRANT ALL ON public.customer_activities TO authenticated;

GRANT ALL ON public.customer_activities TO service_role;

CREATE INDEX idx_customer_activities_org_id ON public.customer_activities (org_id);

CREATE INDEX idx_customer_activities_type ON public.customer_activities (activity_type);

CREATE INDEX idx_customer_activities_occurred_at ON public.customer_activities (occurred_at DESC);

CREATE INDEX idx_customer_activities_customer_id ON public.customer_activities (customer_id);

CREATE POLICY customer_activities_insert_allowed ON public.customer_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY customer_activities_select_allowed ON public.customer_activities
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.customer_addresses (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id              uuid                     NOT NULL,
  customer_id         uuid                     NOT NULL,
  address_type        text                     NOT NULL,
  same_as_head_office boolean                  DEFAULT false NOT NULL,
  address_line_1      text,
  address_line_2      text,
  city                text,
  province_state      text,
  postal_code         text,
  country             text                     DEFAULT 'Canada'::text,
  status              text                     DEFAULT 'active'::text NOT NULL,
  created_by          uuid,
  updated_by          uuid,
  created_at          timestamp with time zone DEFAULT now(),
  updated_at          timestamp with time zone
);

ALTER TABLE public.customer_addresses
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_address_type_check CHECK (address_type = ANY (ARRAY['head_office'::text, 'billing'::text, 'shipping'::text, 'other'::text]));

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_customer_id_address_type_key UNIQUE (customer_id, address_type);

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text]));

GRANT ALL ON public.customer_addresses TO anon;

GRANT ALL ON public.customer_addresses TO authenticated;

GRANT ALL ON public.customer_addresses TO service_role;

CREATE INDEX idx_customer_addresses_org_id ON public.customer_addresses (org_id);

CREATE INDEX idx_customer_addresses_customer_id ON public.customer_addresses (customer_id);

CREATE TRIGGER set_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY customer_addresses_delete_admin_only ON public.customer_addresses
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_org_admin(org_id)));

CREATE POLICY customer_addresses_insert_allowed ON public.customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY customer_addresses_select_allowed ON public.customer_addresses
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY customer_addresses_update_allowed ON public.customer_addresses
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.customer_contacts (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id        uuid                     NOT NULL,
  customer_id   uuid                     NOT NULL,
  first_name    text                     NOT NULL,
  last_name     text,
  job_title     text,
  department    text,
  email         text,
  mobile_number text,
  office_phone  text,
  extension     text,
  is_primary    boolean                  DEFAULT false NOT NULL,
  notes         text,
  status        text                     DEFAULT 'active'::text NOT NULL,
  created_by    uuid,
  updated_by    uuid,
  created_at    timestamp with time zone DEFAULT now(),
  updated_at    timestamp with time zone
);

ALTER TABLE public.customer_contacts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_contacts
  ADD CONSTRAINT customer_contacts_department_check
    CHECK
    (department IS NULL OR (department = ANY (ARRAY['purchasing'::text, 'engineering'::text, 'production'::text, 'operations'::text, 'maintenance'::text, 'finance'::text,
    'accounts_payable'::text, 'accounts_receivable'::text, 'shipping'::text, 'receiving'::text, 'quality'::text, 'administration'::text, 'other'::text])));

ALTER TABLE public.customer_contacts
  ADD CONSTRAINT customer_contacts_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_contacts
  ADD CONSTRAINT customer_contacts_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text]));

GRANT ALL ON public.customer_contacts TO anon;

GRANT ALL ON public.customer_contacts TO authenticated;

GRANT ALL ON public.customer_contacts TO service_role;

CREATE INDEX idx_customer_contacts_org_id ON public.customer_contacts (org_id);

CREATE INDEX idx_customer_contacts_email ON public.customer_contacts (email);

CREATE INDEX idx_customer_contacts_customer_id ON public.customer_contacts (customer_id);

CREATE INDEX idx_customer_contacts_status ON public.customer_contacts (status);

CREATE UNIQUE INDEX idx_one_primary_contact_per_customer ON public.customer_contacts (org_id, customer_id)
  WHERE is_primary = true AND status = 'active'::text;

CREATE TRIGGER set_customer_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY customer_contacts_delete_admin_only ON public.customer_contacts
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_org_admin(org_id)));

CREATE POLICY customer_contacts_insert_allowed ON public.customer_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY customer_contacts_select_allowed ON public.customer_contacts
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY customer_contacts_update_allowed ON public.customer_contacts
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.customer_counters (
  org_id               uuid                     NOT NULL,
  next_customer_number bigint                   DEFAULT 1 NOT NULL,
  created_at           timestamp with time zone DEFAULT now(),
  updated_at           timestamp with time zone
);

ALTER TABLE public.customer_counters
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_counters
  ADD CONSTRAINT customer_counters_pkey PRIMARY KEY (org_id);

GRANT ALL ON public.customer_counters TO anon;

GRANT ALL ON public.customer_counters TO authenticated;

GRANT ALL ON public.customer_counters TO service_role;

CREATE POLICY customer_counters_select_allowed ON public.customer_counters
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.customer_note_revisions (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id        uuid                     NOT NULL,
  customer_id   uuid                     NOT NULL,
  note_id       uuid                     NOT NULL,
  edited_by     uuid,
  old_body_html text,
  new_body_html text,
  created_at    timestamp with time zone DEFAULT now()
);

ALTER TABLE public.customer_note_revisions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_note_revisions
  ADD CONSTRAINT customer_note_revisions_pkey PRIMARY KEY (id);

GRANT ALL ON public.customer_note_revisions TO anon;

GRANT ALL ON public.customer_note_revisions TO authenticated;

GRANT ALL ON public.customer_note_revisions TO service_role;

CREATE INDEX idx_customer_note_revisions_note_id ON public.customer_note_revisions (note_id);

CREATE INDEX idx_customer_note_revisions_customer_id ON public.customer_note_revisions (customer_id);

CREATE POLICY customer_note_revisions_select_allowed ON public.customer_note_revisions
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.customer_notes (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id      uuid                     NOT NULL,
  customer_id uuid                     NOT NULL,
  body_html   text                     NOT NULL,
  body_text   text,
  is_pinned   boolean                  DEFAULT false NOT NULL,
  status      text                     DEFAULT 'active'::text NOT NULL,
  author_id   uuid,
  updated_by  uuid,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone
);

ALTER TABLE public.customer_notes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_notes
  ADD CONSTRAINT customer_notes_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_note_revisions
  ADD CONSTRAINT customer_note_revisions_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.customer_notes(id) ON DELETE CASCADE;

ALTER TABLE public.customer_notes
  ADD CONSTRAINT customer_notes_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text]));

GRANT ALL ON public.customer_notes TO anon;

GRANT ALL ON public.customer_notes TO authenticated;

GRANT ALL ON public.customer_notes TO service_role;

CREATE INDEX idx_customer_notes_customer_id ON public.customer_notes (customer_id);

CREATE INDEX idx_customer_notes_author_id ON public.customer_notes (author_id);

CREATE INDEX idx_customer_notes_is_pinned ON public.customer_notes (is_pinned);

CREATE INDEX idx_customer_notes_status ON public.customer_notes (status);

CREATE INDEX idx_customer_notes_org_id ON public.customer_notes (org_id);

CREATE TRIGGER capture_customer_note_revision_after_update
  AFTER UPDATE ON public.customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_customer_note_revision();

CREATE TRIGGER set_customer_notes_updated_at
  BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY customer_notes_delete_admin_only ON public.customer_notes
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_org_admin(org_id)));

CREATE POLICY customer_notes_insert_allowed ON public.customer_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY customer_notes_select_allowed ON public.customer_notes
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY customer_notes_update_allowed ON public.customer_notes
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.customer_tags (
  org_id      uuid                     NOT NULL,
  customer_id uuid                     NOT NULL,
  tag_id      uuid                     NOT NULL,
  created_by  uuid,
  created_at  timestamp with time zone DEFAULT now()
);

ALTER TABLE public.customer_tags
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_tags
  ADD CONSTRAINT customer_tags_pkey PRIMARY KEY (customer_id, tag_id);

GRANT ALL ON public.customer_tags TO anon;

GRANT ALL ON public.customer_tags TO authenticated;

GRANT ALL ON public.customer_tags TO service_role;

CREATE INDEX idx_customer_tags_org_id ON public.customer_tags (org_id);

CREATE INDEX idx_customer_tags_customer_id ON public.customer_tags (customer_id);

CREATE INDEX idx_customer_tags_tag_id ON public.customer_tags (tag_id);

CREATE POLICY customer_tags_delete_allowed ON public.customer_tags
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY customer_tags_insert_allowed ON public.customer_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY customer_tags_select_allowed ON public.customer_tags
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.customers (
  id                           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                       uuid                     NOT NULL,
  company_name                 text                     NOT NULL,
  customer_code                text,
  logo_storage_path            text,
  industry                     text,
  business_registration_number text,
  gst_hst_number               text,
  assigned_sales_rep_id        uuid,
  account_manager_id           uuid,
  lead_source                  text,
  referral_source              text,
  customer_since               date,
  customer_status              text                     DEFAULT 'prospect'::text NOT NULL,
  credit_limit                 numeric(14,2)            DEFAULT 0,
  credit_terms                 text                     DEFAULT 'net_30'::text,
  tax_exempt                   boolean                  DEFAULT false NOT NULL,
  currency                     text                     DEFAULT 'CAD'::text NOT NULL,
  preferred_payment_method     text,
  accounts_payable_email       text,
  invoice_email                text,
  record_status                text                     DEFAULT 'active'::text NOT NULL,
  created_by                   uuid,
  updated_by                   uuid,
  created_at                   timestamp with time zone DEFAULT now(),
  updated_at                   timestamp with time zone
);

ALTER TABLE public.customers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_credit_terms_check CHECK (credit_terms = ANY (ARRAY['due_on_receipt'::text, 'net_15'::text, 'net_30'::text, 'net_45'::text, 'net_60'::text]));

ALTER TABLE public.customers
  ADD CONSTRAINT customers_currency_check CHECK (currency = ANY (ARRAY['CAD'::text, 'USD'::text, 'EUR'::text]));

ALTER TABLE public.customers
  ADD CONSTRAINT customers_customer_status_check CHECK (customer_status = ANY (ARRAY['prospect'::text, 'active'::text, 'inactive'::text, 'blacklisted'::text]));

ALTER TABLE public.customers
  ADD CONSTRAINT customers_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.customer_activities
  ADD CONSTRAINT customer_activities_customer_id_org_id_fkey FOREIGN KEY (customer_id, org_id) REFERENCES public.customers(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_customer_id_org_id_fkey FOREIGN KEY (customer_id, org_id) REFERENCES public.customers(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.customer_contacts
  ADD CONSTRAINT customer_contacts_customer_id_org_id_fkey FOREIGN KEY (customer_id, org_id) REFERENCES public.customers(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.customer_note_revisions
  ADD CONSTRAINT customer_note_revisions_customer_id_org_id_fkey FOREIGN KEY (customer_id, org_id) REFERENCES public.customers(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.customer_notes
  ADD CONSTRAINT customer_notes_customer_id_org_id_fkey FOREIGN KEY (customer_id, org_id) REFERENCES public.customers(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.customer_tags
  ADD CONSTRAINT customer_tags_customer_id_org_id_fkey FOREIGN KEY (customer_id, org_id) REFERENCES public.customers(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_industry_not_blank CHECK (industry IS NULL OR length(TRIM(BOTH FROM industry)) > 0);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_org_id_customer_code_key UNIQUE (org_id, customer_code);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_preferred_payment_method_check
    CHECK (preferred_payment_method IS NULL OR (preferred_payment_method = ANY (ARRAY['eft'::text, 'cheque'::text, 'wire_transfer'::text, 'credit_card'::text])));

ALTER TABLE public.customers
  ADD CONSTRAINT customers_record_status_check CHECK (record_status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text, 'deleted'::text]));

GRANT ALL ON public.customers TO anon;

GRANT ALL ON public.customers TO authenticated;

GRANT ALL ON public.customers TO service_role;

CREATE INDEX idx_customers_customer_status ON public.customers (customer_status);

CREATE INDEX idx_customers_record_status ON public.customers (record_status);

CREATE INDEX idx_customers_sales_rep ON public.customers (assigned_sales_rep_id);

CREATE INDEX idx_customers_company_name ON public.customers (company_name);

CREATE INDEX idx_customers_org_id ON public.customers (org_id);

CREATE INDEX idx_customers_customer_code ON public.customers (customer_code);

CREATE TRIGGER generate_customer_code_before_insert
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_customer_code();

CREATE TRIGGER log_customer_created_after_insert
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_customer_activity_from_customer();

CREATE TRIGGER log_customer_updated_after_update
  AFTER UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_customer_activity_from_customer();

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY customers_delete_admin_only ON public.customers
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_org_admin(org_id)));

CREATE POLICY customers_insert_allowed ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY customers_select_allowed ON public.customers
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY customers_update_allowed ON public.customers
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.employee_directory (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id          uuid                     NOT NULL,
  system_user_id  uuid,
  employee_name   text                     NOT NULL,
  email           text,
  contact_number  text,
  employee_role   text                     DEFAULT 'worker'::text NOT NULL,
  notes           text,
  employee_status text                     DEFAULT 'active'::text NOT NULL,
  source_type     text                     DEFAULT 'manual'::text NOT NULL,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.employee_directory
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_employee_role_check CHECK (employee_role = ANY (ARRAY['admin'::text, 'sales'::text, 'accounts'::text, 'worker'::text]));

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_employee_status_check CHECK (employee_status = ANY (ARRAY['active'::text, 'inactive'::text]));

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_pkey PRIMARY KEY (id);

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_source_type_check CHECK (source_type = ANY (ARRAY['manual'::text, 'system'::text]));

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_system_user_id_fkey FOREIGN KEY (system_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT ALL ON public.employee_directory TO anon;

GRANT ALL ON public.employee_directory TO authenticated;

GRANT ALL ON public.employee_directory TO service_role;

CREATE INDEX idx_employee_directory_org_role ON public.employee_directory (org_id, employee_role);

CREATE UNIQUE INDEX employee_directory_org_system_user_unique ON public.employee_directory (org_id, system_user_id)
  WHERE system_user_id IS NOT NULL;

CREATE UNIQUE INDEX employee_directory_org_email_unique ON public.employee_directory (org_id, lower(email))
  WHERE email IS NOT NULL AND length(TRIM(BOTH FROM email)) > 0;

CREATE INDEX idx_employee_directory_org_status ON public.employee_directory (org_id, employee_status);

CREATE INDEX idx_employee_directory_org_created ON public.employee_directory (org_id, created_at DESC);

CREATE INDEX idx_employee_directory_org_name ON public.employee_directory (org_id, employee_name);

CREATE TRIGGER set_employee_directory_updated_at
  BEFORE UPDATE ON public.employee_directory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY employee_directory_insert_allowed ON public.employee_directory
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_employee_directory(org_id));

CREATE POLICY employee_directory_select_allowed ON public.employee_directory
  FOR SELECT
  TO authenticated
  USING (public.can_manage_employee_directory(org_id));

CREATE POLICY employee_directory_update_allowed ON public.employee_directory
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_employee_directory(org_id))
  WITH CHECK (public.can_manage_employee_directory(org_id));

CREATE TABLE public.employee_directory_skills (
  org_id      uuid                     NOT NULL,
  employee_id uuid                     NOT NULL,
  skill_id    uuid                     NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.employee_directory_skills
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_directory_skills
  ADD CONSTRAINT employee_directory_skills_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employee_directory_skills
  ADD CONSTRAINT employee_directory_skills_employee_id_org_id_fkey FOREIGN KEY (employee_id, org_id) REFERENCES public.employee_directory(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.employee_directory_skills
  ADD CONSTRAINT employee_directory_skills_pkey PRIMARY KEY (employee_id, skill_id);

GRANT ALL ON public.employee_directory_skills TO anon;

GRANT ALL ON public.employee_directory_skills TO authenticated;

GRANT ALL ON public.employee_directory_skills TO service_role;

CREATE INDEX idx_employee_directory_skills_org ON public.employee_directory_skills (org_id);

CREATE INDEX idx_employee_directory_skills_skill ON public.employee_directory_skills (skill_id);

CREATE POLICY employee_directory_skills_delete_allowed ON public.employee_directory_skills
  FOR DELETE
  TO authenticated
  USING (public.can_manage_employee_directory(org_id));

CREATE POLICY employee_directory_skills_insert_allowed ON public.employee_directory_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_employee_directory(org_id));

CREATE POLICY employee_directory_skills_select_allowed ON public.employee_directory_skills
  FOR SELECT
  TO authenticated
  USING (public.can_manage_employee_directory(org_id));

CREATE TABLE public.employee_skills (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id     uuid                     NOT NULL,
  skill_name text                     NOT NULL,
  is_active  boolean                  DEFAULT true NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.employee_skills
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_skills
  ADD CONSTRAINT employee_skills_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employee_skills
  ADD CONSTRAINT employee_skills_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.employee_directory_skills
  ADD CONSTRAINT employee_directory_skills_skill_id_org_id_fkey FOREIGN KEY (skill_id, org_id) REFERENCES public.employee_skills(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.employee_skills
  ADD CONSTRAINT employee_skills_pkey PRIMARY KEY (id);

ALTER TABLE public.employee_skills
  ADD CONSTRAINT employee_skills_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT ALL ON public.employee_skills TO anon;

GRANT ALL ON public.employee_skills TO authenticated;

GRANT ALL ON public.employee_skills TO service_role;

CREATE UNIQUE INDEX employee_skills_org_name_unique ON public.employee_skills (org_id, lower(skill_name));

CREATE INDEX idx_employee_skills_org_active ON public.employee_skills (org_id, is_active, skill_name);

CREATE TRIGGER set_employee_skills_updated_at
  BEFORE UPDATE ON public.employee_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY employee_skills_delete_allowed ON public.employee_skills
  FOR DELETE
  TO authenticated
  USING (public.can_manage_employee_directory(org_id));

CREATE POLICY employee_skills_insert_allowed ON public.employee_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_employee_directory(org_id));

CREATE POLICY employee_skills_select_allowed ON public.employee_skills
  FOR SELECT
  TO authenticated
  USING (public.can_manage_employee_directory(org_id));

CREATE POLICY employee_skills_update_allowed ON public.employee_skills
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_employee_directory(org_id))
  WITH CHECK (public.can_manage_employee_directory(org_id));

CREATE TABLE public.job_invoice_documents (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id      uuid                     NOT NULL,
  invoice_id  uuid                     NOT NULL,
  file_name   text                     NOT NULL,
  file_path   text                     NOT NULL,
  file_size   bigint,
  mime_type   text,
  uploaded_by uuid,
  uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.job_invoice_documents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_invoice_documents
  ADD CONSTRAINT job_invoice_documents_file_path_key UNIQUE (file_path);

ALTER TABLE public.job_invoice_documents
  ADD CONSTRAINT job_invoice_documents_pkey PRIMARY KEY (id);

GRANT ALL ON public.job_invoice_documents TO anon;

GRANT ALL ON public.job_invoice_documents TO authenticated;

GRANT ALL ON public.job_invoice_documents TO service_role;

CREATE INDEX idx_job_invoice_documents_invoice ON public.job_invoice_documents (invoice_id);

CREATE POLICY job_invoice_documents_select_allowed ON public.job_invoice_documents
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.job_invoice_status_history (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                   uuid                     NOT NULL,
  invoice_id               uuid                     NOT NULL,
  previous_status          text,
  new_status               text                     NOT NULL,
  changed_by               uuid,
  changed_at               timestamp with time zone DEFAULT now() NOT NULL,
  payment_date             date,
  payment_reference_number text,
  payment_notes            text
);

ALTER TABLE public.job_invoice_status_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_invoice_status_history
  ADD CONSTRAINT job_invoice_status_history_pkey PRIMARY KEY (id);

GRANT ALL ON public.job_invoice_status_history TO anon;

GRANT ALL ON public.job_invoice_status_history TO authenticated;

GRANT ALL ON public.job_invoice_status_history TO service_role;

CREATE INDEX idx_job_invoice_status_history_invoice ON public.job_invoice_status_history (invoice_id, changed_at DESC);

CREATE POLICY job_invoice_status_history_select_allowed ON public.job_invoice_status_history
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.job_invoices (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                   uuid                     NOT NULL,
  job_id                   uuid                     NOT NULL,
  purchase_order_id        uuid                     NOT NULL,
  invoice_number           text                     NOT NULL,
  invoice_date             date                     NOT NULL,
  currency                 text                     DEFAULT 'CAD'::text NOT NULL,
  invoice_amount           numeric(14,2)            NOT NULL,
  status                   text                     DEFAULT 'draft'::text NOT NULL,
  sent_at                  timestamp with time zone,
  payment_date             date,
  payment_reference_number text,
  payment_notes            text,
  remarks                  text,
  created_by               uuid,
  updated_by               uuid,
  created_at               timestamp with time zone DEFAULT now() NOT NULL,
  updated_at               timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.job_invoices
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_check CHECK (status <> 'payment_received'::text OR payment_date IS NOT NULL);

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.job_invoice_documents
  ADD CONSTRAINT job_invoice_documents_invoice_id_org_id_fkey FOREIGN KEY (invoice_id, org_id) REFERENCES public.job_invoices(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_invoice_amount_check CHECK (invoice_amount >= 0::numeric);

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_org_id_invoice_number_key UNIQUE (org_id, invoice_number);

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_pkey PRIMARY KEY (id);

ALTER TABLE public.job_invoice_status_history
  ADD CONSTRAINT job_invoice_status_history_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.job_invoices(id) ON DELETE RESTRICT;

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_status_check CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'payment_received'::text]));

GRANT ALL ON public.job_invoices TO anon;

GRANT ALL ON public.job_invoices TO authenticated;

GRANT ALL ON public.job_invoices TO service_role;

CREATE INDEX idx_job_invoices_po ON public.job_invoices (purchase_order_id);

CREATE INDEX idx_job_invoices_job ON public.job_invoices (job_id, invoice_date DESC);

CREATE INDEX idx_job_invoices_customer_search ON public.job_invoices (org_id, invoice_number);

CREATE INDEX idx_job_invoices_status ON public.job_invoices (org_id, status);

CREATE TRIGGER prepare_job_invoice_status_before_update
  BEFORE UPDATE OF status ON public.job_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_job_invoice_status();

CREATE TRIGGER record_job_invoice_status_after_update
  AFTER UPDATE OF status ON public.job_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.record_job_invoice_status_change();

CREATE TRIGGER set_job_invoices_updated_at
  BEFORE UPDATE ON public.job_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY job_invoices_select_allowed ON public.job_invoices
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.job_number_counters (
  org_id        uuid                     NOT NULL,
  counter_year  integer                  NOT NULL,
  last_sequence integer                  DEFAULT 0 NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.job_number_counters
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_number_counters
  ADD CONSTRAINT job_number_counters_last_sequence_check CHECK (last_sequence >= 0);

ALTER TABLE public.job_number_counters
  ADD CONSTRAINT job_number_counters_pkey PRIMARY KEY (org_id, counter_year);

GRANT ALL ON public.job_number_counters TO anon;

GRANT ALL ON public.job_number_counters TO authenticated;

GRANT ALL ON public.job_number_counters TO service_role;

CREATE TABLE public.job_purchase_order_allocations (
  id                        uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                    uuid                     NOT NULL,
  purchase_order_id         uuid                     NOT NULL,
  job_id                    uuid                     NOT NULL,
  quotation_id_snapshot     uuid                     NOT NULL,
  quotation_number_snapshot text                     NOT NULL,
  revision_number_snapshot  integer                  NOT NULL,
  customer_name_snapshot    text,
  project_name_snapshot     text,
  quotation_total           numeric(14,2)            DEFAULT 0 NOT NULL,
  po_amount_before_tax      numeric(14,2)            DEFAULT 0 NOT NULL,
  tax_name_snapshot         text,
  tax_rate_snapshot         numeric(7,3)             DEFAULT 0 NOT NULL,
  tax_amount                numeric(14,2)            DEFAULT 0 NOT NULL,
  total_po_amount           numeric(14,2)            DEFAULT 0 NOT NULL,
  difference_amount         numeric(14,2)            DEFAULT 0 NOT NULL,
  difference_acknowledged   boolean                  DEFAULT false NOT NULL,
  created_at                timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.job_purchase_order_allocations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_job_id_key UNIQUE (job_id);

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_pkey PRIMARY KEY (id);

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_po_amount_before_tax_check CHECK (po_amount_before_tax >= 0::numeric);

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_purchase_order_id_job_id_key UNIQUE (purchase_order_id, job_id);

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_quotation_total_check CHECK (quotation_total >= 0::numeric);

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_tax_amount_check CHECK (tax_amount >= 0::numeric);

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_tax_rate_snapshot_check CHECK (tax_rate_snapshot >= 0::numeric);

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_total_po_amount_check CHECK (total_po_amount >= 0::numeric);

GRANT ALL ON public.job_purchase_order_allocations TO anon;

GRANT ALL ON public.job_purchase_order_allocations TO authenticated;

GRANT ALL ON public.job_purchase_order_allocations TO service_role;

CREATE INDEX idx_job_po_allocations_po ON public.job_purchase_order_allocations (purchase_order_id);

CREATE INDEX idx_job_po_allocations_quotation ON public.job_purchase_order_allocations (quotation_id_snapshot);

CREATE INDEX idx_job_po_allocations_job ON public.job_purchase_order_allocations (job_id);

CREATE POLICY job_purchase_order_allocations_select_allowed ON public.job_purchase_order_allocations
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.job_purchase_order_documents (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id            uuid                     NOT NULL,
  purchase_order_id uuid                     NOT NULL,
  document_type     text                     NOT NULL,
  file_name         text                     NOT NULL,
  file_path         text                     NOT NULL,
  file_size         bigint,
  mime_type         text,
  uploaded_by       uuid,
  uploaded_at       timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.job_purchase_order_documents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_purchase_order_documents
  ADD CONSTRAINT job_purchase_order_documents_document_type_check CHECK (document_type = ANY (ARRAY['purchase_order'::text, 'supporting_document'::text]));

ALTER TABLE public.job_purchase_order_documents
  ADD CONSTRAINT job_purchase_order_documents_file_path_key UNIQUE (file_path);

ALTER TABLE public.job_purchase_order_documents
  ADD CONSTRAINT job_purchase_order_documents_pkey PRIMARY KEY (id);

GRANT ALL ON public.job_purchase_order_documents TO anon;

GRANT ALL ON public.job_purchase_order_documents TO authenticated;

GRANT ALL ON public.job_purchase_order_documents TO service_role;

CREATE INDEX idx_job_po_documents_po ON public.job_purchase_order_documents (purchase_order_id);

CREATE POLICY job_purchase_order_documents_select_allowed ON public.job_purchase_order_documents
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.job_purchase_orders (
  id                            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                        uuid                     NOT NULL,
  customer_id                   uuid                     NOT NULL,
  po_number                     text                     NOT NULL,
  po_received_date              date                     NOT NULL,
  currency                      text                     DEFAULT 'CAD'::text NOT NULL,
  combined_quotation_total      numeric(14,2)            DEFAULT 0 NOT NULL,
  combined_po_amount_before_tax numeric(14,2)            DEFAULT 0 NOT NULL,
  combined_tax_amount           numeric(14,2)            DEFAULT 0 NOT NULL,
  combined_po_total             numeric(14,2)            DEFAULT 0 NOT NULL,
  difference_amount             numeric(14,2)            DEFAULT 0 NOT NULL,
  internal_remarks              text,
  created_by                    uuid,
  updated_by                    uuid,
  created_at                    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.job_purchase_orders
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_combined_po_amount_before_tax_check CHECK (combined_po_amount_before_tax >= 0::numeric);

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_combined_po_total_check CHECK (combined_po_total >= 0::numeric);

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_combined_quotation_total_check CHECK (combined_quotation_total >= 0::numeric);

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_combined_tax_amount_check CHECK (combined_tax_amount >= 0::numeric);

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_purchase_order_id_org_id_fkey FOREIGN KEY (purchase_order_id, org_id) REFERENCES public.job_purchase_orders(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_purchase_order_id_org_id_fkey FOREIGN KEY (purchase_order_id, org_id) REFERENCES public.job_purchase_orders(id, org_id)
    ON DELETE RESTRICT;

ALTER TABLE public.job_purchase_order_documents
  ADD CONSTRAINT job_purchase_order_documents_purchase_order_id_org_id_fkey FOREIGN KEY (purchase_order_id, org_id) REFERENCES public.job_purchase_orders(id, org_id)
    ON DELETE RESTRICT;

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_org_id_customer_id_po_number_key UNIQUE (org_id, customer_id, po_number);

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_pkey PRIMARY KEY (id);

GRANT ALL ON public.job_purchase_orders TO anon;

GRANT ALL ON public.job_purchase_orders TO authenticated;

GRANT ALL ON public.job_purchase_orders TO service_role;

CREATE INDEX idx_job_purchase_orders_org_date ON public.job_purchase_orders (org_id, po_received_date DESC);

CREATE INDEX idx_job_purchase_orders_customer ON public.job_purchase_orders (org_id, customer_id);

CREATE INDEX idx_job_purchase_orders_number ON public.job_purchase_orders (org_id, po_number);

CREATE TRIGGER set_job_purchase_orders_updated_at
  BEFORE UPDATE ON public.job_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY job_purchase_orders_select_allowed ON public.job_purchase_orders
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.job_quotation_history (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id          uuid                     NOT NULL,
  job_id          uuid                     NOT NULL,
  quotation_id    uuid                     NOT NULL,
  revision_number integer                  NOT NULL,
  accepted_at     timestamp with time zone DEFAULT now() NOT NULL,
  accepted_by     uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.job_quotation_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_quotation_history
  ADD CONSTRAINT job_quotation_history_job_id_quotation_id_key UNIQUE (job_id, quotation_id);

ALTER TABLE public.job_quotation_history
  ADD CONSTRAINT job_quotation_history_pkey PRIMARY KEY (id);

GRANT ALL ON public.job_quotation_history TO anon;

GRANT ALL ON public.job_quotation_history TO authenticated;

GRANT ALL ON public.job_quotation_history TO service_role;

CREATE INDEX idx_job_quotation_history_job ON public.job_quotation_history (job_id, accepted_at DESC);

CREATE POLICY job_quotation_history_select_allowed ON public.job_quotation_history
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.job_status_history (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id          uuid                     NOT NULL,
  job_id          uuid                     NOT NULL,
  previous_status text,
  new_status      text                     NOT NULL,
  changed_by      uuid,
  changed_at      timestamp with time zone DEFAULT now() NOT NULL,
  remarks         text
);

ALTER TABLE public.job_status_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_status_history
  ADD CONSTRAINT job_status_history_pkey PRIMARY KEY (id);

GRANT ALL ON public.job_status_history TO anon;

GRANT ALL ON public.job_status_history TO authenticated;

GRANT ALL ON public.job_status_history TO service_role;

CREATE INDEX idx_job_status_history_job ON public.job_status_history (job_id, changed_at DESC);

CREATE POLICY job_status_history_select_allowed ON public.job_status_history
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.jobs (
  id                             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                         uuid                     NOT NULL,
  quotation_series_id            uuid                     NOT NULL,
  original_accepted_quotation_id uuid                     NOT NULL,
  latest_accepted_quotation_id   uuid                     NOT NULL,
  customer_id                    uuid                     NOT NULL,
  job_number                     text,
  job_year                       integer,
  job_sequence                   integer,
  job_status                     text                     DEFAULT 'po_pending'::text NOT NULL,
  accepted_at                    timestamp with time zone DEFAULT now() NOT NULL,
  salesperson_id                 uuid,
  created_by                     uuid,
  updated_by                     uuid,
  created_at                     timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                     timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.jobs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_job_id_org_id_fkey FOREIGN KEY (job_id, org_id) REFERENCES public.jobs(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_job_id_org_id_fkey FOREIGN KEY (job_id, org_id) REFERENCES public.jobs(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_job_status_check CHECK (job_status = ANY (ARRAY['po_pending'::text, 'work_in_process'::text, 'work_completed'::text]));

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_org_id_job_number_key UNIQUE (org_id, job_number);

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_org_id_job_year_job_sequence_key UNIQUE (org_id, job_year, job_sequence);

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_org_id_quotation_series_id_key UNIQUE (org_id, quotation_series_id);

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);

ALTER TABLE public.job_quotation_history
  ADD CONSTRAINT job_quotation_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.job_status_history
  ADD CONSTRAINT job_status_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE RESTRICT;

GRANT ALL ON public.jobs TO anon;

GRANT ALL ON public.jobs TO authenticated;

GRANT ALL ON public.jobs TO service_role;

CREATE INDEX idx_jobs_number ON public.jobs (org_id, job_number);

CREATE INDEX idx_jobs_latest_quotation ON public.jobs (latest_accepted_quotation_id);

CREATE INDEX idx_jobs_customer ON public.jobs (org_id, customer_id);

CREATE INDEX idx_jobs_org_status ON public.jobs (org_id, job_status);

CREATE TRIGGER record_job_status_change_after_update
  AFTER UPDATE OF job_status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.record_job_status_change();

CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY jobs_select_allowed ON public.jobs
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.org_members (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid                     NOT NULL,
  org_id     uuid                     NOT NULL,
  role       text                     NOT NULL,
  status     text                     DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone
);

ALTER TABLE public.org_members
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_pkey PRIMARY KEY (id);

ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_role_check CHECK (role = ANY (ARRAY['admin'::text, 'accountant'::text, 'sales'::text]));

ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));

ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_user_id_org_id_key UNIQUE (user_id, org_id);

GRANT ALL ON public.org_members TO anon;

GRANT ALL ON public.org_members TO authenticated;

GRANT ALL ON public.org_members TO service_role;

CREATE INDEX idx_org_members_status ON public.org_members (status);

CREATE INDEX idx_org_members_org_id ON public.org_members (org_id);

CREATE INDEX idx_org_members_user_id ON public.org_members (user_id);

CREATE INDEX idx_org_members_role ON public.org_members (ROLE);

CREATE TRIGGER sync_org_member_employee_after_change
  AFTER INSERT OR UPDATE OF user_id, ROLE, status ON public.org_members
  FOR EACH ROW
  WHEN (new.user_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_org_member_employee_trigger();

CREATE POLICY org_members_select_allowed ON public.org_members
  FOR SELECT
  TO authenticated
  USING (((user_id = auth.uid()) OR public.is_super_admin() OR public.is_org_admin(org_id)));

CREATE TABLE public.organizations (
  id                     uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_code               text                     NOT NULL,
  name                   text                     NOT NULL,
  status                 text                     DEFAULT 'active'::text NOT NULL,
  created_at             timestamp with time zone DEFAULT now(),
  updated_at             timestamp with time zone,
  logo_storage_path      text,
  quotation_company_name text,
  quotation_phone        text,
  quotation_fax          text,
  quotation_footer_text  text,
  quotation_terms_html   text,
  quotation_terms_text   text
);

ALTER TABLE public.organizations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_org_code_format CHECK (org_code = lower(org_code) AND org_code ~ '^[a-z0-9]+$'::text);

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_org_code_key UNIQUE (org_code);

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_counters
  ADD CONSTRAINT customer_counters_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.employee_directory
  ADD CONSTRAINT employee_directory_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.employee_skills
  ADD CONSTRAINT employee_skills_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.job_invoice_status_history
  ADD CONSTRAINT job_invoice_status_history_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.job_number_counters
  ADD CONSTRAINT job_number_counters_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.job_quotation_history
  ADD CONSTRAINT job_quotation_history_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.job_status_history
  ADD CONSTRAINT job_status_history_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_status_check CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'deleted'::text]));

GRANT ALL ON public.organizations TO anon;

GRANT ALL ON public.organizations TO authenticated;

GRANT ALL ON public.organizations TO service_role;

CREATE INDEX idx_organizations_org_code ON public.organizations (org_code);

CREATE INDEX idx_organizations_status ON public.organizations (status);

CREATE TRIGGER seed_supplier_categories_after_org_insert
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_supplier_categories_after_org_insert();

CREATE POLICY organizations_select_allowed ON public.organizations
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(id)));

CREATE TABLE public.profiles (
  id         uuid                     NOT NULL,
  email      text                     NOT NULL,
  full_name  text,
  avatar_url text,
  status     text                     DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone
);

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_key UNIQUE (email);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_activities
  ADD CONSTRAINT customer_activities_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_contacts
  ADD CONSTRAINT customer_contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_contacts
  ADD CONSTRAINT customer_contacts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_note_revisions
  ADD CONSTRAINT customer_note_revisions_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_notes
  ADD CONSTRAINT customer_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_notes
  ADD CONSTRAINT customer_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_tags
  ADD CONSTRAINT customer_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_account_manager_id_fkey FOREIGN KEY (account_manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_assigned_sales_rep_id_fkey FOREIGN KEY (assigned_sales_rep_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_invoice_documents
  ADD CONSTRAINT job_invoice_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_invoice_status_history
  ADD CONSTRAINT job_invoice_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_purchase_order_documents
  ADD CONSTRAINT job_purchase_order_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_purchase_orders
  ADD CONSTRAINT job_purchase_orders_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_quotation_history
  ADD CONSTRAINT job_quotation_history_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_status_history
  ADD CONSTRAINT job_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));

GRANT ALL ON public.profiles TO anon;

GRANT ALL ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

CREATE INDEX idx_profiles_email ON public.profiles (email);

CREATE INDEX idx_profiles_status ON public.profiles (status);

CREATE POLICY profiles_select_allowed ON public.profiles
  FOR SELECT
  TO authenticated
  USING (((id = auth.uid()) OR public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM (public.org_members me
     JOIN public.org_members them ON ((them.org_id = me.org_id)))
  WHERE ((me.user_id = auth.uid()) AND (them.user_id = profiles.id) AND (me.status = 'active'::text) AND (them.status = 'active'::text))))));

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

CREATE TABLE public.public_calendar_event_history (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id        uuid                     NOT NULL,
  event_id      uuid                     NOT NULL,
  action_type   text                     NOT NULL,
  actor_id      uuid,
  previous_data jsonb,
  new_data      jsonb,
  occurred_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.public_calendar_event_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.public_calendar_event_history
  ADD CONSTRAINT public_calendar_event_history_action_type_check CHECK (action_type = ANY (ARRAY['created'::text, 'updated'::text, 'cancelled'::text, 'deleted'::text]));

ALTER TABLE public.public_calendar_event_history
  ADD CONSTRAINT public_calendar_event_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.public_calendar_event_history
  ADD CONSTRAINT public_calendar_event_history_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.public_calendar_event_history
  ADD CONSTRAINT public_calendar_event_history_pkey PRIMARY KEY (id);

GRANT ALL ON public.public_calendar_event_history TO anon;

GRANT ALL ON public.public_calendar_event_history TO authenticated;

GRANT ALL ON public.public_calendar_event_history TO service_role;

CREATE INDEX idx_public_calendar_history_org ON public.public_calendar_event_history (org_id, occurred_at DESC);

CREATE INDEX idx_public_calendar_history_event ON public.public_calendar_event_history (event_id, occurred_at DESC);

CREATE POLICY public_calendar_history_select_allowed ON public.public_calendar_event_history
  FOR SELECT
  TO authenticated
  USING (public.can_manage_public_calendar(org_id));

CREATE TABLE public.public_calendar_event_participants (
  org_id                 uuid                     NOT NULL,
  event_id               uuid                     NOT NULL,
  employee_id            uuid                     NOT NULL,
  participation_required boolean                  DEFAULT true NOT NULL,
  added_by               uuid,
  added_at               timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.public_calendar_event_participants
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.public_calendar_event_participants
  ADD CONSTRAINT public_calendar_event_participants_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.public_calendar_event_participants
  ADD CONSTRAINT public_calendar_event_participants_employee_id_org_id_fkey FOREIGN KEY (employee_id, org_id) REFERENCES public.employee_directory(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.public_calendar_event_participants
  ADD CONSTRAINT public_calendar_event_participants_pkey PRIMARY KEY (event_id, employee_id);

GRANT ALL ON public.public_calendar_event_participants TO anon;

GRANT ALL ON public.public_calendar_event_participants TO authenticated;

GRANT ALL ON public.public_calendar_event_participants TO service_role;

CREATE INDEX idx_public_calendar_participants_event ON public.public_calendar_event_participants (event_id);

CREATE INDEX idx_public_calendar_participants_employee ON public.public_calendar_event_participants (org_id, employee_id);

CREATE TRIGGER prevent_calendar_participant_conflict
  BEFORE INSERT OR UPDATE ON public.public_calendar_event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hard_calendar_conflict();

CREATE POLICY public_calendar_participants_delete_allowed ON public.public_calendar_event_participants
  FOR DELETE
  TO authenticated
  USING (public.can_manage_public_calendar(org_id));

CREATE POLICY public_calendar_participants_insert_allowed ON public.public_calendar_event_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_public_calendar(org_id));

CREATE POLICY public_calendar_participants_select_allowed ON public.public_calendar_event_participants
  FOR SELECT
  TO authenticated
  USING (public.can_manage_public_calendar(org_id));

CREATE POLICY public_calendar_participants_update_allowed ON public.public_calendar_event_participants
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_public_calendar(org_id))
  WITH CHECK (public.can_manage_public_calendar(org_id));

CREATE TABLE public.public_calendar_events (
  id                             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                         uuid                     NOT NULL,
  event_type                     text                     NOT NULL,
  event_status                   text                     DEFAULT 'scheduled'::text NOT NULL,
  title                          text                     NOT NULL,
  starts_at                      timestamp with time zone NOT NULL,
  ends_at                        timestamp with time zone NOT NULL,
  all_day                        boolean                  DEFAULT false NOT NULL,
  holiday_type                   text,
  job_id                         uuid,
  purchase_order_id              uuid,
  customer_id                    uuid,
  job_number_snapshot            text,
  purchase_order_number_snapshot text,
  customer_name_snapshot         text,
  project_name_snapshot          text,
  site_address                   text,
  description                    text,
  notes                          text,
  created_by                     uuid,
  updated_by                     uuid,
  cancelled_by                   uuid,
  cancelled_at                   timestamp with time zone,
  created_at                     timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                     timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.public_calendar_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_check CHECK (ends_at > starts_at);

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_check1 CHECK (event_type <> 'employee_holiday'::text OR holiday_type IS NOT NULL);

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_check2 CHECK (event_type <> 'job_site_assignment'::text OR job_id IS NOT NULL);

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_check3 CHECK (event_status <> 'cancelled'::text OR cancelled_at IS NOT NULL);

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_event_status_check CHECK (event_status = ANY (ARRAY['scheduled'::text, 'cancelled'::text]));

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_event_type_check CHECK (event_type = ANY (ARRAY['employee_holiday'::text, 'job_site_assignment'::text, 'company_event'::text]));

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_holiday_type_check
    CHECK (holiday_type IS NULL OR (holiday_type = ANY (ARRAY['vacation'::text, 'personal_leave'::text, 'sick_leave'::text, 'statutory_holiday'::text, 'other'::text])));

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.public_calendar_event_participants
  ADD CONSTRAINT public_calendar_event_participants_event_id_org_id_fkey FOREIGN KEY (event_id, org_id) REFERENCES public.public_calendar_events(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_pkey PRIMARY KEY (id);

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.job_purchase_orders(id) ON DELETE RESTRICT;

ALTER TABLE public.public_calendar_events
  ADD CONSTRAINT public_calendar_events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT ALL ON public.public_calendar_events TO anon;

GRANT ALL ON public.public_calendar_events TO authenticated;

GRANT ALL ON public.public_calendar_events TO service_role;

CREATE INDEX idx_public_calendar_events_job ON public.public_calendar_events (job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX idx_public_calendar_events_org_dates ON public.public_calendar_events (org_id, starts_at, ends_at);

CREATE INDEX idx_public_calendar_events_org_type ON public.public_calendar_events (org_id, event_type);

CREATE INDEX idx_public_calendar_events_org_status ON public.public_calendar_events (org_id, event_status);

CREATE INDEX idx_public_calendar_events_customer ON public.public_calendar_events (org_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX idx_public_calendar_events_po ON public.public_calendar_events (purchase_order_id)
  WHERE purchase_order_id IS NOT NULL;

CREATE TRIGGER prevent_calendar_event_reschedule_conflict
  BEFORE UPDATE OF starts_at, ends_at, event_type ON public.public_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_calendar_event_reschedule_conflict();

CREATE TRIGGER record_public_calendar_event_history
  AFTER INSERT OR DELETE OR UPDATE ON public.public_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.record_public_calendar_event_history();

CREATE TRIGGER set_public_calendar_events_updated_at
  BEFORE UPDATE ON public.public_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY public_calendar_events_delete_allowed ON public.public_calendar_events
  FOR DELETE
  TO authenticated
  USING (public.can_manage_public_calendar(org_id));

CREATE POLICY public_calendar_events_insert_allowed ON public.public_calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_public_calendar(org_id));

CREATE POLICY public_calendar_events_select_allowed ON public.public_calendar_events
  FOR SELECT
  TO authenticated
  USING (public.can_manage_public_calendar(org_id));

CREATE POLICY public_calendar_events_update_allowed ON public.public_calendar_events
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_public_calendar(org_id))
  WITH CHECK (public.can_manage_public_calendar(org_id));

CREATE TABLE public.quotation_contacts (
  id                    uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                uuid                     NOT NULL,
  quotation_id          uuid                     NOT NULL,
  customer_contact_id   uuid,
  contact_role          text                     DEFAULT 'quotation_contact'::text,
  sort_order            integer                  DEFAULT 1 NOT NULL,
  contact_name_snapshot text,
  email_snapshot        text,
  phone_snapshot        text,
  created_at            timestamp with time zone DEFAULT now()
);

ALTER TABLE public.quotation_contacts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_contacts
  ADD CONSTRAINT quotation_contacts_customer_contact_id_fkey FOREIGN KEY (customer_contact_id) REFERENCES public.customer_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.quotation_contacts
  ADD CONSTRAINT quotation_contacts_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_contacts
  ADD CONSTRAINT quotation_contacts_quotation_id_sort_order_key UNIQUE (quotation_id, sort_order);

ALTER TABLE public.quotation_contacts
  ADD CONSTRAINT quotation_contacts_sort_order_check CHECK (sort_order >= 1 AND sort_order <= 2);

GRANT ALL ON public.quotation_contacts TO anon;

GRANT ALL ON public.quotation_contacts TO authenticated;

GRANT ALL ON public.quotation_contacts TO service_role;

CREATE INDEX idx_quotation_contacts_org_id ON public.quotation_contacts (org_id);

CREATE INDEX idx_quotation_contacts_quotation_id ON public.quotation_contacts (quotation_id);

CREATE TRIGGER enforce_max_two_quotation_contacts_before_insert
  BEFORE INSERT ON public.quotation_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_two_quotation_contacts();

CREATE TRIGGER protect_locked_quotation_contacts
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE POLICY quotation_contacts_delete_allowed ON public.quotation_contacts
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_contacts_insert_allowed ON public.quotation_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_contacts_select_allowed ON public.quotation_contacts
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_contacts_update_allowed ON public.quotation_contacts
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_counters (
  org_id        uuid                     NOT NULL,
  quote_year    integer                  NOT NULL,
  next_sequence integer                  DEFAULT 1 NOT NULL,
  created_at    timestamp with time zone DEFAULT now(),
  updated_at    timestamp with time zone
);

ALTER TABLE public.quotation_counters
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_counters
  ADD CONSTRAINT quotation_counters_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_counters
  ADD CONSTRAINT quotation_counters_pkey PRIMARY KEY (org_id, quote_year);

GRANT ALL ON public.quotation_counters TO anon;

GRANT ALL ON public.quotation_counters TO authenticated;

GRANT ALL ON public.quotation_counters TO service_role;

CREATE TRIGGER set_quotation_counters_updated_at
  BEFORE UPDATE ON public.quotation_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_counters_select_allowed ON public.quotation_counters
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_customer_document_items (
  id                    uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                uuid                     NOT NULL,
  customer_document_id  uuid                     NOT NULL,
  quotation_id          uuid                     NOT NULL,
  scope_id              uuid                     NOT NULL,
  sort_order            integer                  DEFAULT 1 NOT NULL,
  scope_title_snapshot  text                     NOT NULL,
  description_html      text,
  description_text      text,
  imported_scope_amount numeric(14,2),
  estimation_quantity   numeric(14,4),
  quantity              numeric(14,4)            DEFAULT 1 NOT NULL,
  price_each            numeric(14,2)            DEFAULT 0 NOT NULL,
  price_ext             numeric(14,2)            DEFAULT 0 NOT NULL,
  created_at            timestamp with time zone DEFAULT now() NOT NULL,
  updated_at            timestamp with time zone
);

COMMENT ON COLUMN public.quotation_customer_document_items.imported_scope_amount IS 'Automatic snapshot of quotation_scopes.scope_total_after_discount. No manual import is required.';

COMMENT ON COLUMN public.quotation_customer_document_items.estimation_quantity IS 'Automatic snapshot of quotation_scopes.quantity.';

COMMENT ON COLUMN public.quotation_customer_document_items.quantity IS 'Read-only customer-facing quantity copied from quotation_scopes.quantity.';

COMMENT ON COLUMN public.quotation_customer_document_items.price_each IS 'Read-only value calculated as scope total divided by internal scope quantity.';

COMMENT ON COLUMN public.quotation_customer_document_items.price_ext IS 'Read-only value calculated as price_each multiplied by quantity.';

ALTER TABLE public.quotation_customer_document_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_document_i_customer_document_id_scope_id_key UNIQUE (customer_document_id, scope_id);

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_document_items_estimation_quantity_check CHECK (estimation_quantity IS NULL OR estimation_quantity > 0::numeric);

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_document_items_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_document_items_quantity_check CHECK (quantity > 0::numeric);

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_items_imported_amount_nonnegative CHECK (imported_scope_amount IS NULL OR imported_scope_amount >= 0::numeric);

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_items_price_each_nonnegative CHECK (price_each >= 0::numeric);

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_items_price_ext_nonnegative CHECK (price_ext >= 0::numeric);

GRANT ALL ON public.quotation_customer_document_items TO anon;

GRANT ALL ON public.quotation_customer_document_items TO authenticated;

GRANT ALL ON public.quotation_customer_document_items TO service_role;

CREATE INDEX idx_quotation_customer_document_items_org_id ON public.quotation_customer_document_items (org_id);

CREATE INDEX idx_quotation_customer_document_items_scope_id ON public.quotation_customer_document_items (scope_id);

CREATE INDEX idx_quotation_customer_document_items_document_id ON public.quotation_customer_document_items (customer_document_id);

CREATE INDEX idx_quotation_customer_document_items_quotation_id ON public.quotation_customer_document_items (quotation_id);

CREATE TRIGGER protect_locked_customer_document_items
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_customer_document_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_customer_document_items_updated_at
  BEFORE UPDATE ON public.quotation_customer_document_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_customer_document_items_delete_allowed ON public.quotation_customer_document_items
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_customer_document_items_insert_allowed ON public.quotation_customer_document_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_customer_document_items_select_allowed ON public.quotation_customer_document_items
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_customer_document_items_update_allowed ON public.quotation_customer_document_items
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_customer_documents (
  id                               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                           uuid                     NOT NULL,
  quotation_id                     uuid                     NOT NULL,
  document_status                  text                     DEFAULT 'draft'::text NOT NULL,
  quotation_date                   date,
  quotation_number_snapshot        text                     NOT NULL,
  revision_number_snapshot         integer                  DEFAULT 0 NOT NULL,
  customer_name_snapshot           text,
  address_line_1_snapshot          text,
  city_snapshot                    text,
  province_snapshot                text,
  postal_code_snapshot             text,
  attendee_name_snapshot           text,
  attendee_email_snapshot          text,
  delivery_text                    text,
  terms_text                       text,
  fob_text                         text,
  prepared_by_id                   uuid,
  prepared_by_name_snapshot        text,
  subtotal                         numeric(14,2)            DEFAULT 0 NOT NULL,
  total                            numeric(14,2)            DEFAULT 0 NOT NULL,
  generated_pdf_storage_path       text,
  created_by                       uuid,
  updated_by                       uuid,
  created_at                       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                       timestamp with time zone,
  generated_at                     timestamp with time zone,
  organization_name_snapshot       text,
  organization_logo_path_snapshot  text,
  organization_phone_snapshot      text,
  organization_fax_snapshot        text,
  organization_footer_snapshot     text,
  organization_terms_html_snapshot text,
  organization_terms_text_snapshot text,
  discount_amount                  numeric(14,2)            DEFAULT 0 NOT NULL,
  tax_name_snapshot                text,
  tax_rate_snapshot                numeric(7,3)             DEFAULT 0 NOT NULL,
  tax_amount                       numeric(14,2)            DEFAULT 0 NOT NULL,
  pricing_synced_at                timestamp with time zone
);

COMMENT ON COLUMN public.quotation_customer_documents.subtotal IS 'Sum of all synchronized customer-facing scope price_ext values.';

COMMENT ON COLUMN public.quotation_customer_documents.total IS 'Final customer-facing grand total copied from quotations.grand_total_after_tax.';

COMMENT ON COLUMN public.quotation_customer_documents.discount_amount IS 'Final quotation-level discount copied from quotations.final_discount_amount.';

COMMENT ON COLUMN public.quotation_customer_documents.tax_amount IS 'Tax amount copied from the internal quotation revision.';

ALTER TABLE public.quotation_customer_documents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_discount_nonnegative CHECK (discount_amount >= 0::numeric);

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_document_status_check CHECK (document_status = ANY (ARRAY['draft'::text, 'generated'::text, 'archived'::text]));

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_id_quotation_id_org_id_key UNIQUE (id, quotation_id, org_id);

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_document_i_customer_document_id_quotati_fkey FOREIGN KEY (customer_document_id, quotation_id, org_id)
    REFERENCES public.quotation_customer_documents(id, quotation_id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_prepared_by_id_fkey FOREIGN KEY (prepared_by_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_quotation_id_revision_number_s_key UNIQUE (quotation_id, revision_number_snapshot);

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_subtotal_nonnegative CHECK (subtotal >= 0::numeric);

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_tax_nonnegative CHECK (tax_amount >= 0::numeric);

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_total_nonnegative CHECK (total >= 0::numeric);

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

GRANT ALL ON public.quotation_customer_documents TO anon;

GRANT ALL ON public.quotation_customer_documents TO authenticated;

GRANT ALL ON public.quotation_customer_documents TO service_role;

CREATE INDEX idx_quotation_customer_documents_created_at ON public.quotation_customer_documents (created_at DESC);

CREATE INDEX idx_quotation_customer_documents_org_id ON public.quotation_customer_documents (org_id);

CREATE INDEX idx_quotation_customer_documents_quotation_id ON public.quotation_customer_documents (quotation_id);

CREATE INDEX idx_quotation_customer_documents_status ON public.quotation_customer_documents (document_status);

CREATE TRIGGER protect_locked_customer_documents
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_customer_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_customer_documents_updated_at
  BEFORE UPDATE ON public.quotation_customer_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_customer_documents_delete_allowed ON public.quotation_customer_documents
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_org_admin(org_id)));

CREATE POLICY quotation_customer_documents_insert_allowed ON public.quotation_customer_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_customer_documents_select_allowed ON public.quotation_customer_documents
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_customer_documents_update_allowed ON public.quotation_customer_documents
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_final_adjustments (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id            uuid                     NOT NULL,
  quotation_id      uuid                     NOT NULL,
  adjustment_type   text                     NOT NULL,
  description       text                     NOT NULL,
  calculation_type  text                     NOT NULL,
  value             numeric(14,2)            DEFAULT 0 NOT NULL,
  calculated_amount numeric(14,2)            DEFAULT 0 NOT NULL,
  sort_order        integer                  DEFAULT 1 NOT NULL,
  created_at        timestamp with time zone DEFAULT now(),
  updated_at        timestamp with time zone
);

ALTER TABLE public.quotation_final_adjustments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_final_adjustments
  ADD CONSTRAINT quotation_final_adjustments_adjustment_type_check CHECK (adjustment_type = ANY (ARRAY['discount'::text, 'additional_charge'::text]));

ALTER TABLE public.quotation_final_adjustments
  ADD CONSTRAINT quotation_final_adjustments_calculation_type_check CHECK (calculation_type = ANY (ARRAY['percentage'::text, 'amount'::text]));

ALTER TABLE public.quotation_final_adjustments
  ADD CONSTRAINT quotation_final_adjustments_pkey PRIMARY KEY (id);

GRANT ALL ON public.quotation_final_adjustments TO anon;

GRANT ALL ON public.quotation_final_adjustments TO authenticated;

GRANT ALL ON public.quotation_final_adjustments TO service_role;

CREATE INDEX idx_quotation_final_adjustments_quotation_id ON public.quotation_final_adjustments (quotation_id);

CREATE INDEX idx_quotation_final_adjustments_org_id ON public.quotation_final_adjustments (org_id);

CREATE TRIGGER protect_locked_quotation_final_adjustments
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_final_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_final_adjustments_updated_at
  BEFORE UPDATE ON public.quotation_final_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_final_adjustments_delete_allowed ON public.quotation_final_adjustments
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_final_adjustments_insert_allowed ON public.quotation_final_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_final_adjustments_select_allowed ON public.quotation_final_adjustments
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_final_adjustments_update_allowed ON public.quotation_final_adjustments
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_generated_documents (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id               uuid                     NOT NULL,
  quotation_id         uuid                     NOT NULL,
  customer_document_id uuid                     NOT NULL,
  revision_number      integer                  DEFAULT 0 NOT NULL,
  file_name            text                     NOT NULL,
  file_path            text                     NOT NULL,
  file_size            bigint,
  generated_by         uuid,
  generated_at         timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.quotation_generated_documents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_generated_documents
  ADD CONSTRAINT quotation_generated_documents_customer_document_id_quotati_fkey FOREIGN KEY (customer_document_id, quotation_id, org_id)
    REFERENCES public.quotation_customer_documents(id, quotation_id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_generated_documents
  ADD CONSTRAINT quotation_generated_documents_file_path_key UNIQUE (file_path);

ALTER TABLE public.quotation_generated_documents
  ADD CONSTRAINT quotation_generated_documents_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotation_generated_documents
  ADD CONSTRAINT quotation_generated_documents_pkey PRIMARY KEY (id);

GRANT ALL ON public.quotation_generated_documents TO anon;

GRANT ALL ON public.quotation_generated_documents TO authenticated;

GRANT ALL ON public.quotation_generated_documents TO service_role;

CREATE INDEX idx_quotation_generated_documents_org_id ON public.quotation_generated_documents (org_id);

CREATE INDEX idx_quotation_generated_documents_quotation_id ON public.quotation_generated_documents (quotation_id);

CREATE INDEX idx_quotation_generated_documents_customer_document_id ON public.quotation_generated_documents (customer_document_id);

CREATE INDEX idx_quotation_generated_documents_generated_at ON public.quotation_generated_documents (generated_at DESC);

CREATE POLICY quotation_generated_documents_insert_allowed ON public.quotation_generated_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_generated_documents_select_allowed ON public.quotation_generated_documents
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_labour_items (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id             uuid                     NOT NULL,
  quotation_id       uuid                     NOT NULL,
  scope_id           uuid                     NOT NULL,
  labour_description text                     NOT NULL,
  calculation_method text                     NOT NULL,
  total_hours        numeric(14,2),
  number_of_workers  numeric(14,2),
  number_of_days     numeric(14,2),
  hours_per_day      numeric(14,2),
  work_type          text                     DEFAULT 'regular'::text NOT NULL,
  regular_hours      numeric(14,2)            DEFAULT 0 NOT NULL,
  overtime_hours     numeric(14,2)            DEFAULT 0 NOT NULL,
  regular_rate       numeric(14,2)            DEFAULT 0 NOT NULL,
  overtime_rate      numeric(14,2)            DEFAULT 0 NOT NULL,
  regular_cost       numeric(14,2)            DEFAULT 0 NOT NULL,
  overtime_cost      numeric(14,2)            DEFAULT 0 NOT NULL,
  total_cost         numeric(14,2)            DEFAULT 0 NOT NULL,
  sort_order         integer                  DEFAULT 1 NOT NULL,
  created_at         timestamp with time zone DEFAULT now(),
  updated_at         timestamp with time zone
);

ALTER TABLE public.quotation_labour_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_labour_items
  ADD CONSTRAINT quotation_labour_items_calculation_method_check CHECK (calculation_method = ANY (ARRAY['hourly'::text, 'crew'::text]));

ALTER TABLE public.quotation_labour_items
  ADD CONSTRAINT quotation_labour_items_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_labour_items
  ADD CONSTRAINT quotation_labour_items_work_type_check CHECK (work_type = ANY (ARRAY['regular'::text, 'overtime'::text, 'weekend'::text, 'confined_space'::text]));

GRANT ALL ON public.quotation_labour_items TO anon;

GRANT ALL ON public.quotation_labour_items TO authenticated;

GRANT ALL ON public.quotation_labour_items TO service_role;

CREATE INDEX idx_quotation_labour_items_quotation_id ON public.quotation_labour_items (quotation_id);

CREATE INDEX idx_quotation_labour_items_org_id ON public.quotation_labour_items (org_id);

CREATE INDEX idx_quotation_labour_items_scope_id ON public.quotation_labour_items (scope_id);

CREATE TRIGGER protect_locked_quotation_labour_items
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_labour_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_labour_items_updated_at
  BEFORE UPDATE ON public.quotation_labour_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_labour_items_delete_allowed ON public.quotation_labour_items
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_labour_items_insert_allowed ON public.quotation_labour_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_labour_items_select_allowed ON public.quotation_labour_items
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_labour_items_update_allowed ON public.quotation_labour_items
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_material_documents (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id           uuid                     NOT NULL,
  quotation_id     uuid                     NOT NULL,
  scope_id         uuid                     NOT NULL,
  material_item_id uuid                     NOT NULL,
  storage_bucket   text                     DEFAULT 'quotation-documents'::text NOT NULL,
  file_name        text                     NOT NULL,
  file_path        text                     NOT NULL,
  file_size        bigint,
  mime_type        text                     DEFAULT 'application/pdf'::text NOT NULL,
  uploaded_by      uuid,
  created_at       timestamp with time zone DEFAULT now(),
  updated_at       timestamp with time zone
);

ALTER TABLE public.quotation_material_documents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_material_documents
  ADD CONSTRAINT quotation_material_documents_material_item_id_key UNIQUE (material_item_id);

ALTER TABLE public.quotation_material_documents
  ADD CONSTRAINT quotation_material_documents_mime_type_check CHECK (mime_type = 'application/pdf'::text);

ALTER TABLE public.quotation_material_documents
  ADD CONSTRAINT quotation_material_documents_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_material_documents
  ADD CONSTRAINT quotation_material_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

GRANT ALL ON public.quotation_material_documents TO anon;

GRANT ALL ON public.quotation_material_documents TO authenticated;

GRANT ALL ON public.quotation_material_documents TO service_role;

CREATE INDEX idx_quotation_material_documents_quotation_id ON public.quotation_material_documents (quotation_id);

CREATE INDEX idx_quotation_material_documents_material_item_id ON public.quotation_material_documents (material_item_id);

CREATE INDEX idx_quotation_material_documents_org_id ON public.quotation_material_documents (org_id);

CREATE TRIGGER protect_locked_quotation_material_documents
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_material_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_material_documents_updated_at
  BEFORE UPDATE ON public.quotation_material_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_material_documents_delete_allowed ON public.quotation_material_documents
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_material_documents_insert_allowed ON public.quotation_material_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_material_documents_select_allowed ON public.quotation_material_documents
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_material_documents_update_allowed ON public.quotation_material_documents
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_material_items (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                   uuid                     NOT NULL,
  quotation_id             uuid                     NOT NULL,
  scope_id                 uuid                     NOT NULL,
  material_description     text                     NOT NULL,
  material_category        text,
  supplier_name            text,
  supplier_quote_reference text,
  quantity                 numeric(14,4)            DEFAULT 0 NOT NULL,
  unit_cost                numeric(14,2)            DEFAULT 0 NOT NULL,
  material_cost            numeric(14,2)            DEFAULT 0 NOT NULL,
  profit_type              text                     DEFAULT 'percentage'::text NOT NULL,
  profit_value             numeric(14,2)            DEFAULT 0 NOT NULL,
  profit_amount            numeric(14,2)            DEFAULT 0 NOT NULL,
  line_total               numeric(14,2)            DEFAULT 0 NOT NULL,
  sort_order               integer                  DEFAULT 1 NOT NULL,
  created_at               timestamp with time zone DEFAULT now(),
  updated_at               timestamp with time zone
);

ALTER TABLE public.quotation_material_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_material_items
  ADD CONSTRAINT quotation_material_items_id_quotation_id_org_id_key UNIQUE (id, quotation_id, org_id);

ALTER TABLE public.quotation_material_documents
  ADD CONSTRAINT quotation_material_documents_material_item_id_quotation_id_fkey FOREIGN KEY (material_item_id, quotation_id, org_id)
    REFERENCES public.quotation_material_items(id, quotation_id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_material_items
  ADD CONSTRAINT quotation_material_items_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_material_items
  ADD CONSTRAINT quotation_material_items_profit_type_check CHECK (profit_type = ANY (ARRAY['percentage'::text, 'amount'::text]));

GRANT ALL ON public.quotation_material_items TO anon;

GRANT ALL ON public.quotation_material_items TO authenticated;

GRANT ALL ON public.quotation_material_items TO service_role;

CREATE INDEX idx_quotation_material_items_quotation_id ON public.quotation_material_items (quotation_id);

CREATE INDEX idx_quotation_material_items_org_id ON public.quotation_material_items (org_id);

CREATE INDEX idx_quotation_material_items_scope_id ON public.quotation_material_items (scope_id);

CREATE TRIGGER protect_locked_quotation_material_items
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_material_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_material_items_updated_at
  BEFORE UPDATE ON public.quotation_material_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_material_items_delete_allowed ON public.quotation_material_items
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_material_items_insert_allowed ON public.quotation_material_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_material_items_select_allowed ON public.quotation_material_items
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_material_items_update_allowed ON public.quotation_material_items
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_note_sections (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id              uuid                     NOT NULL,
  quotation_id        uuid                     NOT NULL,
  section_type        text                     NOT NULL,
  title               text,
  body_html           text,
  body_text           text,
  visible_to_customer boolean                  DEFAULT true NOT NULL,
  created_at          timestamp with time zone DEFAULT now(),
  updated_at          timestamp with time zone
);

ALTER TABLE public.quotation_note_sections
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_note_sections
  ADD CONSTRAINT quotation_note_sections_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_note_sections
  ADD CONSTRAINT quotation_note_sections_quotation_id_section_type_key UNIQUE (quotation_id, section_type);

ALTER TABLE public.quotation_note_sections
  ADD CONSTRAINT quotation_note_sections_section_type_check
    CHECK
    (section_type = ANY (ARRAY['scope_of_work'::text, 'exclusions'::text, 'assumptions'::text, 'warranty'::text, 'delivery_time'::text, 'payment_terms'::text,
    'quotation_validity'::text, 'customer_notes'::text, 'internal_notes'::text]));

GRANT ALL ON public.quotation_note_sections TO anon;

GRANT ALL ON public.quotation_note_sections TO authenticated;

GRANT ALL ON public.quotation_note_sections TO service_role;

CREATE INDEX idx_quotation_note_sections_quotation_id ON public.quotation_note_sections (quotation_id);

CREATE INDEX idx_quotation_note_sections_org_id ON public.quotation_note_sections (org_id);

CREATE TRIGGER protect_locked_quotation_note_sections
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_note_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_note_sections_updated_at
  BEFORE UPDATE ON public.quotation_note_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_note_sections_delete_allowed ON public.quotation_note_sections
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_note_sections_insert_allowed ON public.quotation_note_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_note_sections_select_allowed ON public.quotation_note_sections
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_note_sections_update_allowed ON public.quotation_note_sections
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_revision_audit (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id              uuid                     NOT NULL,
  quotation_id        uuid                     NOT NULL,
  quotation_series_id uuid                     NOT NULL,
  revision_number     integer                  NOT NULL,
  event_type          text                     NOT NULL,
  revision_source_id  uuid,
  revision_purpose    text,
  previous_status     text,
  new_status          text,
  actor_id            uuid,
  occurred_at         timestamp with time zone DEFAULT now() NOT NULL,
  metadata            jsonb                    DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE public.quotation_revision_audit
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_revision_audit
  ADD CONSTRAINT quotation_revision_audit_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotation_revision_audit
  ADD CONSTRAINT quotation_revision_audit_event_type_check
    CHECK (event_type = ANY (ARRAY['revision_created'::text, 'revision_modified'::text, 'status_changed'::text, 'customer_pdf_generated'::text]));

ALTER TABLE public.quotation_revision_audit
  ADD CONSTRAINT quotation_revision_audit_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.quotation_revision_audit
  ADD CONSTRAINT quotation_revision_audit_pkey PRIMARY KEY (id);

GRANT ALL ON public.quotation_revision_audit TO anon;

GRANT ALL ON public.quotation_revision_audit TO authenticated;

GRANT ALL ON public.quotation_revision_audit TO service_role;

CREATE INDEX idx_quotation_revision_audit_occurred ON public.quotation_revision_audit (occurred_at DESC);

CREATE INDEX idx_quotation_revision_audit_quotation ON public.quotation_revision_audit (quotation_id);

CREATE INDEX idx_quotation_revision_audit_series ON public.quotation_revision_audit (org_id, quotation_series_id, revision_number);

CREATE POLICY quotation_revision_audit_insert_allowed ON public.quotation_revision_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_revision_audit_select_allowed ON public.quotation_revision_audit
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_revisions (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id           uuid                     NOT NULL,
  quotation_id     uuid                     NOT NULL,
  revision_number  integer                  NOT NULL,
  quotation_number text                     NOT NULL,
  snapshot_json    jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  created_by       uuid,
  created_at       timestamp with time zone DEFAULT now()
);

ALTER TABLE public.quotation_revisions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_revisions
  ADD CONSTRAINT quotation_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotation_revisions
  ADD CONSTRAINT quotation_revisions_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_revisions
  ADD CONSTRAINT quotation_revisions_quotation_id_revision_number_key UNIQUE (quotation_id, revision_number);

GRANT ALL ON public.quotation_revisions TO anon;

GRANT ALL ON public.quotation_revisions TO authenticated;

GRANT ALL ON public.quotation_revisions TO service_role;

CREATE INDEX idx_quotation_revisions_org_id ON public.quotation_revisions (org_id);

CREATE INDEX idx_quotation_revisions_quotation_id ON public.quotation_revisions (quotation_id);

CREATE POLICY quotation_revisions_insert_allowed ON public.quotation_revisions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_revisions_select_allowed ON public.quotation_revisions
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_scope_charge_documents (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id          uuid                     NOT NULL,
  quotation_id    uuid                     NOT NULL,
  scope_id        uuid                     NOT NULL,
  scope_charge_id uuid                     NOT NULL,
  storage_bucket  text                     DEFAULT 'quotation-documents'::text NOT NULL,
  file_name       text                     NOT NULL,
  file_path       text                     NOT NULL,
  file_size       bigint,
  mime_type       text                     DEFAULT 'application/pdf'::text NOT NULL,
  uploaded_by     uuid,
  created_at      timestamp with time zone DEFAULT now(),
  updated_at      timestamp with time zone
);

ALTER TABLE public.quotation_scope_charge_documents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_scope_charge_documents
  ADD CONSTRAINT quotation_scope_charge_documents_mime_type_check CHECK (mime_type = 'application/pdf'::text);

ALTER TABLE public.quotation_scope_charge_documents
  ADD CONSTRAINT quotation_scope_charge_documents_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_scope_charge_documents
  ADD CONSTRAINT quotation_scope_charge_documents_scope_charge_id_key UNIQUE (scope_charge_id);

ALTER TABLE public.quotation_scope_charge_documents
  ADD CONSTRAINT quotation_scope_charge_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

GRANT ALL ON public.quotation_scope_charge_documents TO anon;

GRANT ALL ON public.quotation_scope_charge_documents TO authenticated;

GRANT ALL ON public.quotation_scope_charge_documents TO service_role;

CREATE INDEX idx_quotation_scope_charge_documents_quotation_id ON public.quotation_scope_charge_documents (quotation_id);

CREATE INDEX idx_quotation_scope_charge_documents_org_id ON public.quotation_scope_charge_documents (org_id);

CREATE INDEX idx_quotation_scope_charge_documents_charge_id ON public.quotation_scope_charge_documents (scope_charge_id);

CREATE INDEX idx_quotation_scope_charge_documents_scope_id ON public.quotation_scope_charge_documents (scope_id);

CREATE TRIGGER protect_locked_scope_charge_documents
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_scope_charge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_scope_charge_documents_updated_at
  BEFORE UPDATE ON public.quotation_scope_charge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_scope_charge_documents_delete_allowed ON public.quotation_scope_charge_documents
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_scope_charge_documents_insert_allowed ON public.quotation_scope_charge_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_scope_charge_documents_select_allowed ON public.quotation_scope_charge_documents
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_scope_charge_documents_update_allowed ON public.quotation_scope_charge_documents
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_scope_charges (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id        uuid                     NOT NULL,
  quotation_id  uuid                     NOT NULL,
  scope_id      uuid                     NOT NULL,
  description   text                     NOT NULL,
  amount        numeric(14,2)            DEFAULT 0 NOT NULL,
  sort_order    integer                  DEFAULT 1 NOT NULL,
  created_at    timestamp with time zone DEFAULT now(),
  updated_at    timestamp with time zone,
  profit_type   text                     DEFAULT 'percentage'::text NOT NULL,
  profit_value  numeric(14,2)            DEFAULT 0 NOT NULL,
  profit_amount numeric(14,2)            DEFAULT 0 NOT NULL,
  line_total    numeric(14,2)            DEFAULT 0 NOT NULL
);

ALTER TABLE public.quotation_scope_charges
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_scope_charges
  ADD CONSTRAINT quotation_scope_charges_id_quotation_org_unique UNIQUE (id, quotation_id, org_id);

ALTER TABLE public.quotation_scope_charge_documents
  ADD CONSTRAINT quotation_scope_charge_docume_scope_charge_id_quotation_id_fkey FOREIGN KEY (scope_charge_id, quotation_id, org_id)
    REFERENCES public.quotation_scope_charges(id, quotation_id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_scope_charges
  ADD CONSTRAINT quotation_scope_charges_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_scope_charges
  ADD CONSTRAINT quotation_scope_charges_profit_type_check CHECK (profit_type = ANY (ARRAY['percentage'::text, 'amount'::text]));

GRANT ALL ON public.quotation_scope_charges TO anon;

GRANT ALL ON public.quotation_scope_charges TO authenticated;

GRANT ALL ON public.quotation_scope_charges TO service_role;

CREATE INDEX idx_quotation_scope_charges_org_id ON public.quotation_scope_charges (org_id);

CREATE INDEX idx_quotation_scope_charges_quotation_id ON public.quotation_scope_charges (quotation_id);

CREATE INDEX idx_quotation_scope_charges_scope_id ON public.quotation_scope_charges (scope_id);

CREATE TRIGGER protect_locked_quotation_scope_charges
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_scope_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_scope_charges_updated_at
  BEFORE UPDATE ON public.quotation_scope_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_scope_charges_delete_allowed ON public.quotation_scope_charges
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_scope_charges_insert_allowed ON public.quotation_scope_charges
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_scope_charges_select_allowed ON public.quotation_scope_charges
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_scope_charges_update_allowed ON public.quotation_scope_charges
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_scopes (
  id                             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                         uuid                     NOT NULL,
  quotation_id                   uuid                     NOT NULL,
  scope_title                    text                     DEFAULT 'Scope of Work'::text NOT NULL,
  scope_description              text,
  sort_order                     integer                  DEFAULT 1 NOT NULL,
  labour_calculation_method      text                     DEFAULT 'hourly'::text NOT NULL,
  regular_hourly_rate            numeric(14,2)            DEFAULT 0 NOT NULL,
  overtime_hourly_rate           numeric(14,2)            DEFAULT 0 NOT NULL,
  material_total                 numeric(14,2)            DEFAULT 0 NOT NULL,
  material_profit_total          numeric(14,2)            DEFAULT 0 NOT NULL,
  labour_total                   numeric(14,2)            DEFAULT 0 NOT NULL,
  additional_charges_total       numeric(14,2)            DEFAULT 0 NOT NULL,
  scope_subtotal_before_discount numeric(14,2)            DEFAULT 0 NOT NULL,
  discount_type                  text                     DEFAULT 'none'::text NOT NULL,
  discount_value                 numeric(14,2)            DEFAULT 0 NOT NULL,
  discount_amount                numeric(14,2)            DEFAULT 0 NOT NULL,
  scope_total_after_discount     numeric(14,2)            DEFAULT 0 NOT NULL,
  created_at                     timestamp with time zone DEFAULT now(),
  updated_at                     timestamp with time zone,
  quantity                       numeric(14,4)            DEFAULT 1 NOT NULL
);

COMMENT ON COLUMN public.quotation_scopes.quantity IS 'Number of units for which this internal scope estimate was calculated. Copied independently into each quotation revision.';

ALTER TABLE public.quotation_scopes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_scopes
  ADD CONSTRAINT quotation_scopes_discount_type_check CHECK (discount_type = ANY (ARRAY['none'::text, 'percentage'::text, 'amount'::text]));

ALTER TABLE public.quotation_scopes
  ADD CONSTRAINT quotation_scopes_id_quotation_id_org_id_key UNIQUE (id, quotation_id, org_id);

ALTER TABLE public.quotation_customer_document_items
  ADD CONSTRAINT quotation_customer_document_i_scope_id_quotation_id_org_id_fkey FOREIGN KEY (scope_id, quotation_id, org_id)
    REFERENCES public.quotation_scopes(id, quotation_id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.quotation_labour_items
  ADD CONSTRAINT quotation_labour_items_scope_id_quotation_id_org_id_fkey FOREIGN KEY (scope_id, quotation_id, org_id) REFERENCES public.quotation_scopes(id, quotation_id, org_id)
    ON DELETE CASCADE;

ALTER TABLE public.quotation_material_documents
  ADD CONSTRAINT quotation_material_documents_scope_id_quotation_id_org_id_fkey FOREIGN KEY (scope_id, quotation_id, org_id)
    REFERENCES public.quotation_scopes(id, quotation_id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_material_items
  ADD CONSTRAINT quotation_material_items_scope_id_quotation_id_org_id_fkey FOREIGN KEY (scope_id, quotation_id, org_id)
    REFERENCES public.quotation_scopes(id, quotation_id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_scope_charge_documents
  ADD CONSTRAINT quotation_scope_charge_docume_scope_id_quotation_id_org_id_fkey FOREIGN KEY (scope_id, quotation_id, org_id)
    REFERENCES public.quotation_scopes(id, quotation_id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_scope_charges
  ADD CONSTRAINT quotation_scope_charges_scope_id_quotation_id_org_id_fkey FOREIGN KEY (scope_id, quotation_id, org_id) REFERENCES public.quotation_scopes(id, quotation_id, org_id)
    ON DELETE CASCADE;

ALTER TABLE public.quotation_scopes
  ADD CONSTRAINT quotation_scopes_labour_calculation_method_check CHECK (labour_calculation_method = ANY (ARRAY['hourly'::text, 'crew'::text]));

ALTER TABLE public.quotation_scopes
  ADD CONSTRAINT quotation_scopes_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_scopes
  ADD CONSTRAINT quotation_scopes_quantity_positive CHECK (quantity > 0::numeric);

GRANT ALL ON public.quotation_scopes TO anon;

GRANT ALL ON public.quotation_scopes TO authenticated;

GRANT ALL ON public.quotation_scopes TO service_role;

CREATE INDEX idx_quotation_scopes_org_id ON public.quotation_scopes (org_id);

CREATE INDEX idx_quotation_scopes_quotation_id ON public.quotation_scopes (quotation_id);

CREATE TRIGGER protect_locked_quotation_scopes
  BEFORE INSERT OR DELETE OR UPDATE ON public.quotation_scopes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_child_change();

CREATE TRIGGER set_quotation_scopes_updated_at
  BEFORE UPDATE ON public.quotation_scopes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotation_scopes_delete_allowed ON public.quotation_scopes
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_scopes_insert_allowed ON public.quotation_scopes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_scopes_select_allowed ON public.quotation_scopes
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotation_scopes_update_allowed ON public.quotation_scopes
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotation_status_history (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id       uuid                     NOT NULL,
  quotation_id uuid                     NOT NULL,
  old_status   text,
  new_status   text                     NOT NULL,
  changed_by   uuid,
  change_note  text,
  created_at   timestamp with time zone DEFAULT now()
);

ALTER TABLE public.quotation_status_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_status_history
  ADD CONSTRAINT quotation_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotation_status_history
  ADD CONSTRAINT quotation_status_history_pkey PRIMARY KEY (id);

GRANT ALL ON public.quotation_status_history TO anon;

GRANT ALL ON public.quotation_status_history TO authenticated;

GRANT ALL ON public.quotation_status_history TO service_role;

CREATE INDEX idx_quotation_status_history_created_at ON public.quotation_status_history (created_at DESC);

CREATE INDEX idx_quotation_status_history_org_id ON public.quotation_status_history (org_id);

CREATE INDEX idx_quotation_status_history_quotation_id ON public.quotation_status_history (quotation_id);

CREATE POLICY quotation_status_history_insert_allowed ON public.quotation_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotation_status_history_select_allowed ON public.quotation_status_history
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.quotations (
  id                             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                         uuid                     NOT NULL,
  customer_id                    uuid                     NOT NULL,
  quotation_number               text                     NOT NULL,
  quote_year                     integer                  NOT NULL,
  quote_sequence                 integer                  NOT NULL,
  quote_date                     date                     DEFAULT CURRENT_DATE NOT NULL,
  expiry_date                    date,
  project_name                   text,
  project_location               text,
  customer_rfq_number            text,
  revision_number                integer                  DEFAULT 0 NOT NULL,
  prepared_by                    uuid,
  sales_rep_id                   uuid,
  status                         text                     DEFAULT 'draft'::text NOT NULL,
  currency                       text                     DEFAULT 'CAD'::text NOT NULL,
  final_discount_type            text                     DEFAULT 'none'::text NOT NULL,
  final_discount_value           numeric(14,2)            DEFAULT 0 NOT NULL,
  final_discount_amount          numeric(14,2)            DEFAULT 0 NOT NULL,
  material_total                 numeric(14,2)            DEFAULT 0 NOT NULL,
  material_profit_total          numeric(14,2)            DEFAULT 0 NOT NULL,
  labour_total                   numeric(14,2)            DEFAULT 0 NOT NULL,
  scope_additional_charges_total numeric(14,2)            DEFAULT 0 NOT NULL,
  scopes_subtotal                numeric(14,2)            DEFAULT 0 NOT NULL,
  scopes_discount_total          numeric(14,2)            DEFAULT 0 NOT NULL,
  final_additional_charges_total numeric(14,2)            DEFAULT 0 NOT NULL,
  grand_total_before_tax         numeric(14,2)            DEFAULT 0 NOT NULL,
  is_tax_exempt                  boolean                  DEFAULT false NOT NULL,
  tax_name                       text,
  tax_rate                       numeric(7,3)             DEFAULT 0 NOT NULL,
  tax_amount                     numeric(14,2)            DEFAULT 0 NOT NULL,
  grand_total_after_tax          numeric(14,2)            DEFAULT 0 NOT NULL,
  created_by                     uuid,
  updated_by                     uuid,
  created_at                     timestamp with time zone DEFAULT now(),
  updated_at                     timestamp with time zone,
  quotation_series_id            uuid                     NOT NULL,
  revision_source_id             uuid,
  revision_purpose               text,
  revision_created_by            uuid,
  revision_created_at            timestamp with time zone,
  is_locked                      boolean                  DEFAULT false NOT NULL,
  locked_at                      timestamp with time zone,
  locked_by                      uuid
);

ALTER TABLE public.quotations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_currency_check CHECK (currency = ANY (ARRAY['CAD'::text, 'USD'::text, 'EUR'::text]));

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_customer_id_org_id_fkey FOREIGN KEY (customer_id, org_id) REFERENCES public.customers(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_final_discount_type_check CHECK (final_discount_type = ANY (ARRAY['none'::text, 'percentage'::text, 'amount'::text]));

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.quotation_contacts
  ADD CONSTRAINT quotation_contacts_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_final_adjustments
  ADD CONSTRAINT quotation_final_adjustments_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_generated_documents
  ADD CONSTRAINT quotation_generated_documents_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_labour_items
  ADD CONSTRAINT quotation_labour_items_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_material_documents
  ADD CONSTRAINT quotation_material_documents_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_material_items
  ADD CONSTRAINT quotation_material_items_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_note_sections
  ADD CONSTRAINT quotation_note_sections_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_revisions
  ADD CONSTRAINT quotation_revisions_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_scope_charge_documents
  ADD CONSTRAINT quotation_scope_charge_documents_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_scope_charges
  ADD CONSTRAINT quotation_scope_charges_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_scopes
  ADD CONSTRAINT quotation_scopes_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotation_status_history
  ADD CONSTRAINT quotation_status_history_quotation_id_org_id_fkey FOREIGN KEY (quotation_id, org_id) REFERENCES public.quotations(id, org_id) ON DELETE CASCADE;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_org_number_revision_unique UNIQUE (org_id, quotation_number, revision_number);

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_org_sequence_revision_unique UNIQUE (org_id, quote_year, quote_sequence, revision_number);

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);

ALTER TABLE public.job_purchase_order_allocations
  ADD CONSTRAINT job_purchase_order_allocations_quotation_id_snapshot_fkey FOREIGN KEY (quotation_id_snapshot) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE public.job_quotation_history
  ADD CONSTRAINT job_quotation_history_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_latest_accepted_quotation_id_fkey FOREIGN KEY (latest_accepted_quotation_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_original_accepted_quotation_id_fkey FOREIGN KEY (original_accepted_quotation_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE public.quotation_revision_audit
  ADD CONSTRAINT quotation_revision_audit_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE public.quotation_revision_audit
  ADD CONSTRAINT quotation_revision_audit_revision_source_id_fkey FOREIGN KEY (revision_source_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_revision_created_by_fkey FOREIGN KEY (revision_created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_revision_purpose_required CHECK (revision_number = 0 OR revision_purpose IS NOT NULL AND length(TRIM(BOTH FROM revision_purpose)) > 0);

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_revision_source_id_fkey FOREIGN KEY (revision_source_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_status_check
    CHECK
    (status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'converted_to_work_order'::text,
    'archived'::text]));

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

GRANT ALL ON public.quotations TO anon;

GRANT ALL ON public.quotations TO authenticated;

GRANT ALL ON public.quotations TO service_role;

CREATE INDEX idx_quotations_series_revision ON public.quotations (org_id, quotation_series_id, revision_number);

CREATE INDEX idx_quotations_prepared_by ON public.quotations (prepared_by);

CREATE INDEX idx_quotations_quote_date ON public.quotations (quote_date);

CREATE INDEX idx_quotations_status ON public.quotations (status);

CREATE INDEX idx_quotations_quotation_number ON public.quotations (quotation_number);

CREATE INDEX idx_quotations_customer_id ON public.quotations (customer_id);

CREATE INDEX idx_quotations_org_id ON public.quotations (org_id);

CREATE INDEX idx_quotations_series_id ON public.quotations (quotation_series_id);

CREATE INDEX idx_quotations_revision_source_id ON public.quotations (revision_source_id);

CREATE INDEX idx_quotations_locked ON public.quotations (is_locked);

CREATE TRIGGER create_job_after_quotation_accepted
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_job_when_quotation_accepted();

CREATE TRIGGER generate_quotation_number_before_insert
  BEFORE INSERT ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_quotation_number();

CREATE TRIGGER lock_quotation_when_sent_before_update
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_quotation_when_sent();

CREATE TRIGGER log_quotation_status_change_after_update
  AFTER UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_quotation_status_change();

CREATE TRIGGER prevent_locked_quotation_edit_before_update
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_quotation_edit();

CREATE TRIGGER prevent_quotation_number_change_before_update
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_quotation_number_change();

CREATE TRIGGER set_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY quotations_delete_admin_only ON public.quotations
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_org_admin(org_id)));

CREATE POLICY quotations_insert_allowed ON public.quotations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY quotations_select_allowed ON public.quotations
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY quotations_update_allowed ON public.quotations
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.super_admins (
  id         uuid                     NOT NULL,
  email      text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.super_admins
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.super_admins
  ADD CONSTRAINT super_admins_email_key UNIQUE (email);

ALTER TABLE public.super_admins
  ADD CONSTRAINT super_admins_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.super_admins
  ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);

GRANT ALL ON public.super_admins TO anon;

GRANT ALL ON public.super_admins TO authenticated;

GRANT ALL ON public.super_admins TO service_role;

CREATE POLICY super_admins_select_self ON public.super_admins
  FOR SELECT
  TO authenticated
  USING ((id = auth.uid()));

CREATE TABLE public.supplier_price_categories (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id        uuid                     NOT NULL,
  category_name text                     NOT NULL,
  is_archived   boolean                  DEFAULT false NOT NULL,
  archived_at   timestamp with time zone,
  archived_by   uuid,
  created_by    uuid,
  updated_by    uuid,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.supplier_price_categories
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_price_categories
  ADD CONSTRAINT supplier_price_categories_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_price_categories
  ADD CONSTRAINT supplier_price_categories_category_name_check CHECK (length(TRIM(BOTH FROM category_name)) > 0);

ALTER TABLE public.supplier_price_categories
  ADD CONSTRAINT supplier_price_categories_check CHECK (is_archived = false OR archived_at IS NOT NULL);

ALTER TABLE public.supplier_price_categories
  ADD CONSTRAINT supplier_price_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_price_categories
  ADD CONSTRAINT supplier_price_categories_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.supplier_price_categories
  ADD CONSTRAINT supplier_price_categories_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_price_categories
  ADD CONSTRAINT supplier_price_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.supplier_price_categories
  ADD CONSTRAINT supplier_price_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT ALL ON public.supplier_price_categories TO anon;

GRANT ALL ON public.supplier_price_categories TO authenticated;

GRANT ALL ON public.supplier_price_categories TO service_role;

CREATE INDEX idx_supplier_price_categories_org_archived ON public.supplier_price_categories (org_id, is_archived, category_name);

CREATE UNIQUE INDEX supplier_price_categories_org_name_unique ON public.supplier_price_categories (org_id, lower(TRIM(BOTH FROM category_name)));

CREATE TRIGGER set_supplier_price_categories_updated_at
  BEFORE UPDATE ON public.supplier_price_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY supplier_price_categories_insert_allowed ON public.supplier_price_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_supplier_price_library(org_id));

CREATE POLICY supplier_price_categories_select_allowed ON public.supplier_price_categories
  FOR SELECT
  TO authenticated
  USING (public.can_view_supplier_price_library(org_id));

CREATE POLICY supplier_price_categories_update_allowed ON public.supplier_price_categories
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_supplier_price_library(org_id))
  WITH CHECK (public.can_edit_supplier_price_library(org_id));

CREATE TABLE public.supplier_price_material_counters (
  org_id        uuid                     NOT NULL,
  last_sequence bigint                   DEFAULT 0 NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.supplier_price_material_counters
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_price_material_counters
  ADD CONSTRAINT supplier_price_material_counters_last_sequence_check CHECK (last_sequence >= 0);

ALTER TABLE public.supplier_price_material_counters
  ADD CONSTRAINT supplier_price_material_counters_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_price_material_counters
  ADD CONSTRAINT supplier_price_material_counters_pkey PRIMARY KEY (org_id);

GRANT ALL ON public.supplier_price_material_counters TO anon;

GRANT ALL ON public.supplier_price_material_counters TO authenticated;

GRANT ALL ON public.supplier_price_material_counters TO service_role;

CREATE TABLE public.supplier_price_materials (
  id                          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                      uuid                     NOT NULL,
  material_code               text                     NOT NULL,
  category_id                 uuid                     NOT NULL,
  material_description        text                     NOT NULL,
  size_specification          text,
  grade_material_type         text,
  unit_of_measure             text                     NOT NULL,
  notes                       text,
  is_archived                 boolean                  DEFAULT false NOT NULL,
  archived_at                 timestamp with time zone,
  archived_by                 uuid,
  duplicated_from_material_id uuid,
  created_by                  uuid,
  updated_by                  uuid,
  created_at                  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.supplier_price_materials
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_category_id_org_id_fkey FOREIGN KEY (category_id, org_id) REFERENCES public.supplier_price_categories(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_check CHECK (is_archived = false OR archived_at IS NOT NULL);

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_material_code_check CHECK (length(TRIM(BOTH FROM material_code)) > 0);

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_material_description_check CHECK (length(TRIM(BOTH FROM material_description)) > 0);

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_org_id_material_code_key UNIQUE (org_id, material_code);

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_pkey PRIMARY KEY (id);

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_duplicated_from_material_id_fkey FOREIGN KEY (duplicated_from_material_id) REFERENCES public.supplier_price_materials(id) ON DELETE
    SET NULL;

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_unit_of_measure_check CHECK (length(TRIM(BOTH FROM unit_of_measure)) > 0);

ALTER TABLE public.supplier_price_materials
  ADD CONSTRAINT supplier_price_materials_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT ALL ON public.supplier_price_materials TO anon;

GRANT ALL ON public.supplier_price_materials TO authenticated;

GRANT ALL ON public.supplier_price_materials TO service_role;

CREATE INDEX idx_supplier_price_materials_org_updated ON public.supplier_price_materials (org_id, updated_at DESC);

CREATE UNIQUE INDEX supplier_price_materials_unique_definition
  ON public.supplier_price_materials
  (org_id, category_id, lower(TRIM(BOTH FROM material_description)), lower(COALESCE(TRIM(BOTH FROM size_specification), ''::text)), lower(COALESCE(TRIM(BOTH FROM
  grade_material_type), ''::text)), lower(TRIM(BOTH FROM unit_of_measure)));

CREATE INDEX idx_supplier_price_materials_org_category ON public.supplier_price_materials (org_id, category_id, is_archived);

CREATE INDEX idx_supplier_price_materials_org_description ON public.supplier_price_materials (org_id, material_description);

CREATE TRIGGER assign_supplier_material_code_before_insert
  BEFORE INSERT ON public.supplier_price_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_material_code();

CREATE TRIGGER set_supplier_price_materials_updated_at
  BEFORE UPDATE ON public.supplier_price_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY supplier_price_materials_insert_allowed ON public.supplier_price_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_supplier_price_library(org_id));

CREATE POLICY supplier_price_materials_select_allowed ON public.supplier_price_materials
  FOR SELECT
  TO authenticated
  USING (public.can_view_supplier_price_library(org_id));

CREATE POLICY supplier_price_materials_update_allowed ON public.supplier_price_materials
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_supplier_price_library(org_id))
  WITH CHECK (public.can_edit_supplier_price_library(org_id));

CREATE TABLE public.supplier_price_records (
  id                         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id                     uuid                     NOT NULL,
  material_id                uuid                     NOT NULL,
  supplier_id                uuid                     NOT NULL,
  supplier_quote_number      text,
  unit_price                 numeric(16,4)            NOT NULL,
  currency                   text                     DEFAULT 'CAD'::text NOT NULL,
  quote_date                 date                     NOT NULL,
  price_valid_until          date,
  notes                      text,
  record_status              text                     DEFAULT 'active'::text NOT NULL,
  supersedes_price_record_id uuid,
  created_by                 uuid,
  updated_by                 uuid,
  created_at                 timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                 timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.supplier_price_records
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_check CHECK (price_valid_until IS NULL OR price_valid_until >= quote_date);

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_material_id_org_id_fkey FOREIGN KEY (material_id, org_id) REFERENCES public.supplier_price_materials(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_pkey PRIMARY KEY (id);

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_record_status_check CHECK (record_status = ANY (ARRAY['active'::text, 'superseded'::text, 'archived'::text]));

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_supersedes_price_record_id_fkey FOREIGN KEY (supersedes_price_record_id) REFERENCES public.supplier_price_records(id) ON DELETE RESTRICT;

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_unit_price_check CHECK (unit_price >= 0::numeric);

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT ALL ON public.supplier_price_records TO anon;

GRANT ALL ON public.supplier_price_records TO authenticated;

GRANT ALL ON public.supplier_price_records TO service_role;

CREATE INDEX idx_supplier_price_records_status ON public.supplier_price_records (org_id, record_status);

CREATE INDEX idx_supplier_price_records_material_date ON public.supplier_price_records (org_id, material_id, quote_date DESC, created_at DESC);

CREATE INDEX idx_supplier_price_records_supplier_date ON public.supplier_price_records (org_id, supplier_id, quote_date DESC);

CREATE INDEX idx_supplier_price_records_quote_number ON public.supplier_price_records (org_id, supplier_quote_number)
  WHERE supplier_quote_number IS NOT NULL;

CREATE TRIGGER prevent_supplier_price_overwrite_before_update
  BEFORE UPDATE ON public.supplier_price_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_supplier_price_overwrite();

CREATE TRIGGER set_supplier_price_records_updated_at
  BEFORE UPDATE ON public.supplier_price_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY supplier_price_records_insert_allowed ON public.supplier_price_records
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_supplier_price_library(org_id));

CREATE POLICY supplier_price_records_select_allowed ON public.supplier_price_records
  FOR SELECT
  TO authenticated
  USING (public.can_view_supplier_price_library(org_id));

CREATE POLICY supplier_price_records_update_allowed ON public.supplier_price_records
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_supplier_price_library(org_id))
  WITH CHECK (public.can_edit_supplier_price_library(org_id));

CREATE TABLE public.supplier_price_suppliers (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id          uuid                     NOT NULL,
  company_name    text                     NOT NULL,
  contact_person  text,
  company_address text,
  email_address   text,
  contact_number  text,
  is_archived     boolean                  DEFAULT false NOT NULL,
  archived_at     timestamp with time zone,
  archived_by     uuid,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.supplier_price_suppliers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_check CHECK (is_archived = false OR archived_at IS NOT NULL);

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_company_name_check CHECK (length(TRIM(BOTH FROM company_name)) > 0);

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_email_address_check CHECK (email_address IS NULL OR length(TRIM(BOTH FROM email_address)) > 0);

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_id_org_id_key UNIQUE (id, org_id);

ALTER TABLE public.supplier_price_records
  ADD CONSTRAINT supplier_price_records_supplier_id_org_id_fkey FOREIGN KEY (supplier_id, org_id) REFERENCES public.supplier_price_suppliers(id, org_id) ON DELETE RESTRICT;

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_pkey PRIMARY KEY (id);

ALTER TABLE public.supplier_price_suppliers
  ADD CONSTRAINT supplier_price_suppliers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT ALL ON public.supplier_price_suppliers TO anon;

GRANT ALL ON public.supplier_price_suppliers TO authenticated;

GRANT ALL ON public.supplier_price_suppliers TO service_role;

CREATE INDEX idx_supplier_price_suppliers_org_updated ON public.supplier_price_suppliers (org_id, updated_at DESC);

CREATE UNIQUE INDEX supplier_price_suppliers_org_company_unique ON public.supplier_price_suppliers (org_id, lower(TRIM(BOTH FROM company_name)));

CREATE INDEX idx_supplier_price_suppliers_org_archived ON public.supplier_price_suppliers (org_id, is_archived, company_name);

CREATE TRIGGER set_supplier_price_suppliers_updated_at
  BEFORE UPDATE ON public.supplier_price_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY supplier_price_suppliers_insert_allowed ON public.supplier_price_suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_supplier_price_library(org_id));

CREATE POLICY supplier_price_suppliers_select_allowed ON public.supplier_price_suppliers
  FOR SELECT
  TO authenticated
  USING (public.can_view_supplier_price_library(org_id));

CREATE POLICY supplier_price_suppliers_update_allowed ON public.supplier_price_suppliers
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_supplier_price_library(org_id))
  WITH CHECK (public.can_edit_supplier_price_library(org_id));

CREATE TABLE public.tags (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  org_id     uuid                     NOT NULL,
  name       text                     NOT NULL,
  color      text                     DEFAULT '#64748b'::text NOT NULL,
  is_default boolean                  DEFAULT false NOT NULL,
  status     text                     DEFAULT 'active'::text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone
);

ALTER TABLE public.tags
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tags
  ADD CONSTRAINT tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tags
  ADD CONSTRAINT tags_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.tags
  ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_tags
  ADD CONSTRAINT customer_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

ALTER TABLE public.tags
  ADD CONSTRAINT tags_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text]));

GRANT ALL ON public.tags TO anon;

GRANT ALL ON public.tags TO authenticated;

GRANT ALL ON public.tags TO service_role;

CREATE INDEX idx_tags_status ON public.tags (status);

CREATE UNIQUE INDEX idx_tags_unique_org_name ON public.tags (org_id, lower(name));

CREATE INDEX idx_tags_org_id ON public.tags (org_id);

CREATE TRIGGER set_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY tags_delete_admin_only ON public.tags
  FOR DELETE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_org_admin(org_id)));

CREATE POLICY tags_insert_allowed ON public.tags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_org_member(org_id));

CREATE POLICY tags_select_allowed ON public.tags
  FOR SELECT
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE POLICY tags_update_allowed ON public.tags
  FOR UPDATE
  TO authenticated
  USING ((public.is_super_admin() OR public.is_active_org_member(org_id)))
  WITH CHECK ((public.is_super_admin() OR public.is_active_org_member(org_id)));

CREATE TABLE public.tax_rates (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  country_code   text                     DEFAULT 'CA'::text NOT NULL,
  province_code  text                     NOT NULL,
  province_name  text                     NOT NULL,
  tax_name       text                     NOT NULL,
  gst_rate       numeric(7,3)             DEFAULT 0 NOT NULL,
  pst_rate       numeric(7,3)             DEFAULT 0 NOT NULL,
  qst_rate       numeric(7,3)             DEFAULT 0 NOT NULL,
  hst_rate       numeric(7,3)             DEFAULT 0 NOT NULL,
  combined_rate  numeric(7,3)             DEFAULT 0 NOT NULL,
  effective_from date                     DEFAULT CURRENT_DATE NOT NULL,
  effective_to   date,
  status         text                     DEFAULT 'active'::text NOT NULL,
  created_at     timestamp with time zone DEFAULT now(),
  updated_at     timestamp with time zone
);

ALTER TABLE public.tax_rates
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tax_rates
  ADD CONSTRAINT tax_rates_country_code_province_code_effective_from_key UNIQUE (country_code, province_code, effective_from);

ALTER TABLE public.tax_rates
  ADD CONSTRAINT tax_rates_pkey PRIMARY KEY (id);

ALTER TABLE public.tax_rates
  ADD CONSTRAINT tax_rates_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));

GRANT ALL ON public.tax_rates TO anon;

GRANT ALL ON public.tax_rates TO authenticated;

GRANT ALL ON public.tax_rates TO service_role;

CREATE INDEX idx_tax_rates_country_province ON public.tax_rates (country_code, province_code);

CREATE INDEX idx_tax_rates_status ON public.tax_rates (status);

CREATE TRIGGER set_tax_rates_updated_at
  BEFORE UPDATE ON public.tax_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY tax_rates_select_authenticated ON public.tax_rates
  FOR SELECT
  TO authenticated
  USING ((status = 'active'::text));

CREATE VIEW public.job_outstanding_invoices WITH (security_invoker=true) AS SELECT invoice.id AS invoice_id,
    invoice.org_id,
    po.id AS purchase_order_id,
    po.po_number,
    job.id AS job_id,
    job.job_number,
    job.customer_id,
    quotation.quotation_number,
    quotation.revision_number,
    quotation.project_name,
    invoice.invoice_number,
    invoice.invoice_date,
    invoice.invoice_amount,
    invoice.status,
    invoice.sent_at,
        CASE
            WHEN (invoice.status = 'payment_received'::text) THEN 0
            WHEN (invoice.sent_at IS NULL) THEN 0
            ELSE GREATEST(0, (CURRENT_DATE - (invoice.sent_at)::date))
        END AS days_outstanding,
        CASE
            WHEN (invoice.status = 'payment_received'::text) THEN (0)::numeric
            ELSE invoice.invoice_amount
        END AS outstanding_balance
   FROM (((public.job_invoices invoice
     JOIN public.jobs job ON (((job.id = invoice.job_id) AND (job.org_id = invoice.org_id))))
     JOIN public.job_purchase_orders po ON (((po.id = invoice.purchase_order_id) AND (po.org_id = invoice.org_id))))
     JOIN public.quotations quotation ON (((quotation.id = job.latest_accepted_quotation_id) AND (quotation.org_id = job.org_id))))
  WHERE (invoice.status = 'sent'::text);

GRANT ALL ON public.job_outstanding_invoices TO anon;

GRANT ALL ON public.job_outstanding_invoices TO authenticated;

GRANT ALL ON public.job_outstanding_invoices TO service_role;

CREATE VIEW public.supplier_price_latest_records WITH (security_invoker=true) AS SELECT DISTINCT ON (price.org_id, price.material_id, price.supplier_id) price.id,
    price.org_id,
    price.material_id,
    price.supplier_id,
    supplier.company_name AS supplier_name,
    price.supplier_quote_number,
    price.unit_price,
    price.currency,
    price.quote_date,
    price.price_valid_until,
    price.notes,
    price.record_status,
    price.created_at,
    price.updated_at
   FROM (public.supplier_price_records price
     JOIN public.supplier_price_suppliers supplier ON (((supplier.id = price.supplier_id) AND (supplier.org_id = price.org_id))))
  WHERE ((price.record_status = 'active'::text) AND (supplier.is_archived = false))
  ORDER BY price.org_id, price.material_id, price.supplier_id, price.quote_date DESC, price.created_at DESC, price.id DESC;

COMMENT ON VIEW public.supplier_price_latest_records IS 'Latest active supplier price for each material and supplier. Full history remains in supplier_price_records.';

GRANT ALL ON public.supplier_price_latest_records TO anon;

GRANT ALL ON public.supplier_price_latest_records TO authenticated;

GRANT ALL ON public.supplier_price_latest_records TO service_role;
