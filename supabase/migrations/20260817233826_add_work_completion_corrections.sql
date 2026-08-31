-- Completion corrections are generated as a safe replacement draft. Once the
-- replacement is finalized, the superseded database certificate is removed;
-- the API then removes its private Storage object.

alter table public.job_work_completions
  add column correction_of_completion_id uuid,
  add column replaces_certificate_number text;

alter table public.job_work_completions
  add constraint job_work_completions_id_job_org_key unique (id, job_id, org_id),
  add constraint job_work_completions_correction_source_fkey
    foreign key (correction_of_completion_id, job_id, org_id)
    references public.job_work_completions(id, job_id, org_id) on delete restrict;

create unique index job_work_completions_correction_source_active_unique
  on public.job_work_completions(correction_of_completion_id)
  where correction_of_completion_id is not null
    and generation_status in ('generating', 'generated');

create or replace function public.create_job_work_completion_correction_draft(
  p_org_id uuid,
  p_job_id uuid,
  p_source_completion_id uuid,
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
  v_source public.job_work_completions%rowtype;
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
  if v_job.job_status <> 'work_completed' then
    raise exception 'Only a Work Completed job can be corrected';
  end if;
  if v_job.latest_work_completion_id <> p_source_completion_id then
    raise exception 'Only the latest completion certificate can be corrected';
  end if;

  select * into v_source from public.job_work_completions
  where id = p_source_completion_id and job_id = p_job_id and org_id = p_org_id
    and generation_status = 'generated';
  if not found then raise exception 'Source completion certificate not found'; end if;
  if v_source.reopened_at is not null then
    raise exception 'A reopened completion certificate cannot be corrected';
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
    completion_status, completion_notes, outstanding_items, completed_by,
    correction_of_completion_id, replaces_certificate_number
  ) values (
    v_completion_id, p_org_id, p_job_id, v_number, v_year,
    v_sequence, v_revision, p_completion_date, p_completion_status,
    nullif(btrim(p_completion_notes), ''), nullif(btrim(p_outstanding_items), ''),
    p_actor_id, p_source_completion_id, v_source.certificate_number
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
  select v_completion_id, scope_id, org_id, quotation_id, scope_title_snapshot,
    scope_description_snapshot, sort_order
  from public.job_work_completion_scopes
  where completion_id = p_source_completion_id and org_id = p_org_id;
  get diagnostics v_scope_count = row_count;
  if v_scope_count = 0 then raise exception 'The source certificate has no Work Order scope'; end if;

  return jsonb_build_object(
    'id', v_completion_id,
    'certificate_number', v_number,
    'revision_number', v_revision,
    'correction_of_completion_id', p_source_completion_id
  );
end;
$$;

create or replace function public.finalize_job_work_completion_correction(
  p_org_id uuid,
  p_job_id uuid,
  p_source_completion_id uuid,
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
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs
  where id = p_job_id and org_id = p_org_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job.job_status <> 'work_completed'
     or v_job.latest_work_completion_id <> p_source_completion_id then
    raise exception 'Job completion changed during correction';
  end if;

  update public.job_work_completions set
    certificate_file_name = p_file_name,
    certificate_storage_path = p_storage_path,
    certificate_file_size = p_file_size,
    certificate_mime_type = 'application/pdf',
    certificate_generated_at = p_generated_at,
    generation_status = 'generated'
  where id = p_completion_id and job_id = p_job_id and org_id = p_org_id
    and correction_of_completion_id = p_source_completion_id
    and generation_status = 'generating';
  if not found then raise exception 'Completion correction draft not found'; end if;

  update public.jobs set
    latest_work_completion_id = p_completion_id,
    last_status_change_note = 'Completion information corrected',
    updated_by = p_actor_id,
    updated_at = now()
  where id = p_job_id and org_id = p_org_id;

  -- The correction is a replacement, not an additional Job document. Move all
  -- audit links to the replacement before removing the superseded row.
  update public.job_status_history
  set work_completion_id = p_completion_id
  where org_id = p_org_id
    and job_id = p_job_id
    and work_completion_id = p_source_completion_id;

  update public.job_work_completions
  set correction_of_completion_id = null
  where id = p_completion_id and org_id = p_org_id;

  delete from public.job_work_completion_technicians
  where completion_id = p_source_completion_id and org_id = p_org_id;
  delete from public.job_work_completion_scopes
  where completion_id = p_source_completion_id and org_id = p_org_id;
  delete from public.job_work_completions
  where id = p_source_completion_id and job_id = p_job_id and org_id = p_org_id;
  if not found then raise exception 'Superseded completion certificate not found'; end if;

  insert into public.job_status_history (
    org_id, job_id, previous_status, new_status, changed_by, changed_at,
    remarks, work_completion_id
  ) values (
    p_org_id, p_job_id, 'work_completed', 'work_completed', p_actor_id,
    p_generated_at, 'Completion information corrected; the previous certificate was replaced',
    p_completion_id
  );
end;
$$;

revoke all on function public.create_job_work_completion_correction_draft(uuid, uuid, uuid, uuid, date, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.finalize_job_work_completion_correction(uuid, uuid, uuid, uuid, uuid, text, text, bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.create_job_work_completion_correction_draft(uuid, uuid, uuid, uuid, date, text, text, text, uuid[]) to service_role;
grant execute on function public.finalize_job_work_completion_correction(uuid, uuid, uuid, uuid, uuid, text, text, bigint, timestamptz) to service_role;
