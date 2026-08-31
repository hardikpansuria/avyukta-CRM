-- Job completion lifecycle and immutable Work Completion Acknowledgements.
-- The existing jobs row remains the workflow aggregate; completion rows are
-- revisions of a document owned by that job, never replacement jobs.

alter table public.jobs
  add column work_order_number text,
  add column latest_work_completion_id uuid,
  add column last_status_change_note text;

update public.jobs
set work_order_number = job_number
where job_number is not null and work_order_number is null;

create unique index jobs_org_work_order_number_unique
  on public.jobs(org_id, work_order_number)
  where work_order_number is not null;

create table public.work_completion_number_counters (
  counter_year integer primary key,
  last_sequence integer not null default 0 check (last_sequence >= 0),
  updated_at timestamptz not null default now()
);

create table public.job_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  job_id uuid not null,
  quotation_id uuid not null,
  scope_id uuid not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (job_id, scope_id),
  foreign key (job_id, org_id) references public.jobs(id, org_id) on delete restrict,
  foreign key (scope_id, quotation_id, org_id)
    references public.quotation_scopes(id, quotation_id, org_id) on delete restrict
);

create index job_scope_assignments_job_idx
  on public.job_scope_assignments(job_id, assigned_at);
create index job_scope_assignments_org_job_idx
  on public.job_scope_assignments(org_id, job_id);

insert into public.job_scope_assignments (
  org_id, job_id, quotation_id, scope_id, assigned_by
)
select j.org_id, j.id, j.latest_accepted_quotation_id, scope.id, j.updated_by
from public.jobs j
join public.quotation_scopes scope
  on scope.quotation_id = j.latest_accepted_quotation_id
 and scope.org_id = j.org_id
on conflict (job_id, scope_id) do nothing;

create table public.job_work_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  job_id uuid not null,
  certificate_number text not null unique,
  certificate_year integer not null,
  certificate_sequence integer not null check (certificate_sequence > 0),
  revision_number integer not null default 1 check (revision_number > 0),
  completion_date date not null,
  completion_status text not null check (
    completion_status in ('completed', 'completed_with_outstanding_items')
  ),
  completion_notes text,
  outstanding_items text,
  completed_by uuid references public.profiles(id) on delete restrict,
  completed_at timestamptz not null default now(),
  certificate_file_name text,
  certificate_storage_path text unique,
  certificate_file_size bigint check (certificate_file_size is null or certificate_file_size > 0),
  certificate_mime_type text,
  certificate_generated_at timestamptz,
  generation_status text not null default 'generating' check (
    generation_status in ('generating', 'generated', 'failed')
  ),
  reopened_by uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (job_id, revision_number),
  unique (certificate_year, certificate_sequence),
  foreign key (job_id, org_id) references public.jobs(id, org_id) on delete restrict,
  check (
    completion_status <> 'completed_with_outstanding_items'
    or nullif(btrim(outstanding_items), '') is not null
  ),
  check (
    (reopened_at is null and reopened_by is null and reopen_reason is null)
    or (reopened_at is not null and reopened_by is not null and nullif(btrim(reopen_reason), '') is not null)
  )
);

alter table public.jobs
  add constraint jobs_latest_work_completion_id_fkey
  foreign key (latest_work_completion_id)
  references public.job_work_completions(id) on delete restrict;

create index job_work_completions_job_idx
  on public.job_work_completions(job_id, completed_at desc);
create index job_work_completions_org_completed_idx
  on public.job_work_completions(org_id, completion_date desc, completed_at desc);
create unique index job_work_completions_one_generating_per_job_idx
  on public.job_work_completions(job_id)
  where generation_status = 'generating';
create index jobs_latest_work_completion_idx
  on public.jobs(latest_work_completion_id)
  where latest_work_completion_id is not null;

create table public.job_work_completion_technicians (
  completion_id uuid not null,
  employee_id uuid not null,
  org_id uuid not null references public.organizations(id) on delete restrict,
  employee_name_snapshot text not null,
  sort_order integer not null default 1 check (sort_order > 0),
  primary key (completion_id, employee_id),
  foreign key (completion_id, org_id)
    references public.job_work_completions(id, org_id) on delete restrict,
  foreign key (employee_id, org_id)
    references public.employee_directory(id, org_id) on delete restrict
);

create index job_work_completion_technicians_employee_idx
  on public.job_work_completion_technicians(employee_id);
create index job_work_completion_technicians_org_idx
  on public.job_work_completion_technicians(org_id);

create table public.job_work_completion_scopes (
  completion_id uuid not null,
  scope_id uuid not null,
  org_id uuid not null references public.organizations(id) on delete restrict,
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  scope_title_snapshot text not null,
  scope_description_snapshot text,
  sort_order integer not null default 1,
  primary key (completion_id, scope_id),
  foreign key (completion_id, org_id)
    references public.job_work_completions(id, org_id) on delete restrict,
  foreign key (scope_id, quotation_id, org_id)
    references public.quotation_scopes(id, quotation_id, org_id) on delete restrict
);

create index job_work_completion_scopes_scope_idx
  on public.job_work_completion_scopes(scope_id);
create index job_work_completion_scopes_org_idx
  on public.job_work_completion_scopes(org_id);

alter table public.job_status_history
  add column work_completion_id uuid
    references public.job_work_completions(id) on delete restrict;

create or replace function public.sync_job_work_order_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.job_number is not null and new.work_order_number is null then
    new.work_order_number := new.job_number;
  end if;
  return new;
end;
$$;

create trigger sync_job_work_order_number_before_write
before insert or update of job_number on public.jobs
for each row execute function public.sync_job_work_order_number();

create or replace function public.sync_job_scope_assignments()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.job_status = 'po_pending' then
    delete from public.job_scope_assignments where job_id = new.id;
    insert into public.job_scope_assignments (
      org_id, job_id, quotation_id, scope_id, assigned_by
    )
    select new.org_id, new.id, new.latest_accepted_quotation_id, scope.id,
      coalesce(new.updated_by, new.created_by)
    from public.quotation_scopes scope
    where scope.org_id = new.org_id
      and scope.quotation_id = new.latest_accepted_quotation_id;
  end if;
  return new;
end;
$$;

create trigger sync_job_scope_assignments_after_write
after insert or update of latest_accepted_quotation_id on public.jobs
for each row execute function public.sync_job_scope_assignments();

create or replace function public.record_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.job_status is distinct from new.job_status then
    insert into public.job_status_history (
      org_id, job_id, previous_status, new_status, changed_by, remarks,
      work_completion_id
    ) values (
      new.org_id, new.id, old.job_status, new.job_status,
      coalesce(new.updated_by, (select auth.uid())),
      nullif(btrim(new.last_status_change_note), ''),
      coalesce(new.latest_work_completion_id, old.latest_work_completion_id)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.record_job_status_change() from public, anon, authenticated;
grant execute on function public.record_job_status_change() to service_role;

create or replace function public.create_job_work_completion_draft(
  p_org_id uuid,
  p_job_id uuid,
  p_actor_id uuid,
  p_completion_date date,
  p_completion_status text,
  p_completion_notes text,
  p_outstanding_items text,
  p_employee_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_year integer := extract(year from current_date)::integer;
  v_sequence integer;
  v_revision integer;
  v_number text;
  v_completion_id uuid := gen_random_uuid();
  v_employee_count integer;
  v_scope_count integer;
begin
  if p_completion_date is null then raise exception 'Completion Date is required'; end if;
  if p_completion_date > current_date then raise exception 'Completion Date cannot be in the future'; end if;
  if p_completion_status not in ('completed', 'completed_with_outstanding_items') then
    raise exception 'Invalid completion status';
  end if;
  if p_completion_status = 'completed_with_outstanding_items'
     and nullif(btrim(p_outstanding_items), '') is null then
    raise exception 'Outstanding Items are required for this completion status';
  end if;
  if p_employee_ids is null or cardinality(p_employee_ids) = 0 then
    raise exception 'At least one Technician is required';
  end if;

  select * into v_job from public.jobs
  where id = p_job_id and org_id = p_org_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job.job_status <> 'work_in_process' then
    raise exception 'Only a Work in Progress job can be completed';
  end if;

  select count(*) into v_employee_count
  from public.employee_directory employee
  where employee.org_id = p_org_id
    and employee.employee_status = 'active'
    and employee.id = any(p_employee_ids);
  if v_employee_count <> cardinality(p_employee_ids) then
    raise exception 'One or more selected Technicians are invalid or inactive';
  end if;

  insert into public.work_completion_number_counters(counter_year, last_sequence)
  values (v_year, 1)
  on conflict (counter_year) do update
    set last_sequence = public.work_completion_number_counters.last_sequence + 1,
        updated_at = now()
  returning last_sequence into v_sequence;

  v_number := 'WC-' || right(v_year::text, 2) || lpad(v_sequence::text, 4, '0');
  select coalesce(max(revision_number), 0) + 1 into v_revision
  from public.job_work_completions where job_id = p_job_id;

  insert into public.job_work_completions (
    id, org_id, job_id, certificate_number, certificate_year,
    certificate_sequence, revision_number, completion_date,
    completion_status, completion_notes, outstanding_items, completed_by
  ) values (
    v_completion_id, p_org_id, p_job_id, v_number, v_year,
    v_sequence, v_revision, p_completion_date, p_completion_status,
    nullif(btrim(p_completion_notes), ''), nullif(btrim(p_outstanding_items), ''),
    p_actor_id
  );

  insert into public.job_work_completion_technicians (
    completion_id, employee_id, org_id, employee_name_snapshot, sort_order
  )
  select v_completion_id, employee.id, p_org_id, employee.employee_name,
    array_position(p_employee_ids, employee.id)
  from public.employee_directory employee
  where employee.org_id = p_org_id and employee.id = any(p_employee_ids);

  insert into public.job_work_completion_scopes (
    completion_id, scope_id, org_id, quotation_id, scope_title_snapshot,
    scope_description_snapshot, sort_order
  )
  select v_completion_id, scope.id, p_org_id, assignment.quotation_id,
    scope.scope_title, scope.scope_description, scope.sort_order
  from public.job_scope_assignments assignment
  join public.quotation_scopes scope
    on scope.id = assignment.scope_id and scope.org_id = assignment.org_id
  where assignment.job_id = p_job_id and assignment.org_id = p_org_id;
  get diagnostics v_scope_count = row_count;
  if v_scope_count = 0 then raise exception 'The Work Order has no assigned quotation scope'; end if;

  return jsonb_build_object(
    'id', v_completion_id,
    'certificate_number', v_number,
    'revision_number', v_revision
  );
end;
$$;

create or replace function public.finalize_job_work_completion(
  p_org_id uuid,
  p_job_id uuid,
  p_completion_id uuid,
  p_actor_id uuid,
  p_file_name text,
  p_storage_path text,
  p_file_size bigint,
  p_generated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job_status text;
begin
  select job_status into v_job_status from public.jobs
  where id = p_job_id and org_id = p_org_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job_status <> 'work_in_process' then raise exception 'Job status changed during completion'; end if;

  update public.job_work_completions set
    certificate_file_name = p_file_name,
    certificate_storage_path = p_storage_path,
    certificate_file_size = p_file_size,
    certificate_mime_type = 'application/pdf',
    certificate_generated_at = p_generated_at,
    generation_status = 'generated'
  where id = p_completion_id and job_id = p_job_id and org_id = p_org_id
    and generation_status = 'generating';
  if not found then raise exception 'Completion draft not found'; end if;

  update public.jobs set
    job_status = 'work_completed',
    latest_work_completion_id = p_completion_id,
    last_status_change_note = 'Work completion acknowledgement generated',
    updated_by = p_actor_id
  where id = p_job_id and org_id = p_org_id;
end;
$$;

create or replace function public.reopen_completed_job(
  p_org_id uuid,
  p_job_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_completion_id uuid;
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'Reason for Reopening is required'; end if;
  select latest_work_completion_id into v_completion_id from public.jobs
  where id = p_job_id and org_id = p_org_id and job_status = 'work_completed'
  for update;
  if not found or v_completion_id is null then raise exception 'Completed job not found'; end if;

  update public.job_work_completions set
    reopened_by = p_actor_id, reopened_at = now(), reopen_reason = btrim(p_reason)
  where id = v_completion_id and org_id = p_org_id and reopened_at is null;
  if not found then raise exception 'This completion has already been reopened'; end if;

  update public.jobs set
    job_status = 'work_in_process',
    last_status_change_note = btrim(p_reason),
    updated_by = p_actor_id
  where id = p_job_id and org_id = p_org_id;
end;
$$;

revoke all on function public.create_job_work_completion_draft(uuid, uuid, uuid, date, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.finalize_job_work_completion(uuid, uuid, uuid, uuid, text, text, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.reopen_completed_job(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_job_work_completion_draft(uuid, uuid, uuid, date, text, text, text, uuid[]) to service_role;
grant execute on function public.finalize_job_work_completion(uuid, uuid, uuid, uuid, text, text, bigint, timestamptz) to service_role;
grant execute on function public.reopen_completed_job(uuid, uuid, uuid, text) to service_role;

alter table public.work_completion_number_counters enable row level security;
alter table public.job_scope_assignments enable row level security;
alter table public.job_work_completions enable row level security;
alter table public.job_work_completion_technicians enable row level security;
alter table public.job_work_completion_scopes enable row level security;

create policy job_scope_assignments_member_read on public.job_scope_assignments
for select to authenticated
using (public.is_super_admin() or public.is_active_org_member(org_id));
create policy job_work_completions_member_read on public.job_work_completions
for select to authenticated
using (public.is_super_admin() or public.is_active_org_member(org_id));
create policy job_work_completion_technicians_member_read on public.job_work_completion_technicians
for select to authenticated
using (public.is_super_admin() or public.is_active_org_member(org_id));
create policy job_work_completion_scopes_member_read on public.job_work_completion_scopes
for select to authenticated
using (public.is_super_admin() or public.is_active_org_member(org_id));

grant select on public.job_scope_assignments, public.job_work_completions,
  public.job_work_completion_technicians, public.job_work_completion_scopes
to authenticated;
grant all on public.work_completion_number_counters, public.job_scope_assignments,
  public.job_work_completions, public.job_work_completion_technicians,
  public.job_work_completion_scopes to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-completion-acknowledgements',
  'work-completion-acknowledgements',
  false,
  15728640,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.permission_definitions (
  module_id, action_key, display_name, sort_order
)
select id, 'reopen', 'Reopen Completed Job', 60
from public.permission_modules where module_key = 'jobs'
on conflict (module_id, action_key) do update set
  display_name = excluded.display_name, sort_order = excluded.sort_order,
  is_active = true, updated_at = now();

insert into public.role_default_permissions (role_key, permission_id, allowed)
select role.role_key, permission.id, role.role_key = 'admin'
from (values ('admin'), ('sales'), ('accountant')) role(role_key)
join public.permission_modules module on module.module_key = 'jobs'
join public.permission_definitions permission on permission.module_id = module.id
  and permission.action_key = 'reopen'
on conflict (role_key, permission_id) do update set
  allowed = excluded.allowed, updated_at = now();
