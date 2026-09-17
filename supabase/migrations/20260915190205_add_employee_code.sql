alter table public.employee_directory
  add column employee_code text;

update public.employee_directory
set employee_code = 'EMP-' || upper(left(replace(id::text, '-', ''), 8))
where employee_code is null;

alter table public.employee_directory
  alter column employee_code set not null,
  add constraint employee_directory_employee_code_not_blank
    check (length(btrim(employee_code)) between 1 and 50);

create unique index employee_directory_org_employee_code_unique
  on public.employee_directory (org_id, lower(employee_code));

create function public.ensure_employee_directory_employee_code()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.employee_code is null or btrim(new.employee_code) = '' then
    new.employee_code := 'EMP-' || upper(left(replace(new.id::text, '-', ''), 8));
  else
    new.employee_code := btrim(new.employee_code);
  end if;

  return new;
end;
$function$;

revoke all on function public.ensure_employee_directory_employee_code() from public;
revoke all on function public.ensure_employee_directory_employee_code() from anon;
revoke all on function public.ensure_employee_directory_employee_code() from authenticated;

create trigger ensure_employee_directory_employee_code_before_write
  before insert or update of employee_code on public.employee_directory
  for each row
  execute function public.ensure_employee_directory_employee_code();
