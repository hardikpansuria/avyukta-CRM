create or replace function public.prevent_last_active_org_admin_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and old.status = 'active'
     and (
       tg_op = 'DELETE'
       or new.role <> 'admin'
       or new.status <> 'active'
     ) then
    -- Serialize administrator removals within an organization so two concurrent
    -- requests cannot both observe the other administrator and remove both.
    perform 1
    from public.organizations
    where id = old.org_id
    for update;

    if not exists (
       select 1
       from public.org_members as other_admin
       where other_admin.org_id = old.org_id
         and other_admin.id <> old.id
         and other_admin.role = 'admin'
         and other_admin.status = 'active'
     ) then
      raise exception using
        errcode = '23514',
        message = 'organization must retain at least one active administrator';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists protect_last_active_org_admin on public.org_members;
create trigger protect_last_active_org_admin
before update of role, status or delete on public.org_members
for each row
execute function public.prevent_last_active_org_admin_change();
create or replace function public.transfer_org_administrator(
  p_org_id uuid,
  p_current_member_id uuid,
  p_successor_member_id uuid,
  p_new_role text default null,
  p_new_status text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_current_member_id = p_successor_member_id then
    raise exception using errcode = '22023', message = 'successor must be another member';
  end if;

  if p_new_role is not null and p_new_role not in ('admin', 'accountant', 'sales') then
    raise exception using errcode = '22023', message = 'invalid organization role';
  end if;

  if p_new_status is not null and p_new_status not in ('active', 'inactive') then
    raise exception using errcode = '22023', message = 'invalid membership status';
  end if;

  perform 1
  from public.organizations
  where id = p_org_id
  for update;

  if not exists (
    select 1
    from public.org_members
    where id = p_current_member_id
      and org_id = p_org_id
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'current member is not an active administrator';
  end if;

  if not exists (
    select 1
    from public.org_members
    where id = p_successor_member_id
      and org_id = p_org_id
      and status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'successor is not an active organization member';
  end if;

  update public.org_members
  set role = 'admin'
  where id = p_successor_member_id
    and org_id = p_org_id;

  update public.org_members
  set
    role = coalesce(p_new_role, role),
    status = coalesce(p_new_status, status)
  where id = p_current_member_id
    and org_id = p_org_id;
end;
$$;
revoke all on function public.transfer_org_administrator(uuid, uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.transfer_org_administrator(uuid, uuid, uuid, text, text)
to service_role;
