create or replace function public.enforce_quotation_status_transition()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if old.status = 'draft' and new.status = 'sent' then
    return new;
  end if;

  if old.status = 'sent' and new.status = 'accepted' then
    return new;
  end if;

  raise exception using
    errcode = '23514',
    message = format(
      'Quotation status cannot change from %s to %s',
      coalesce(old.status, 'null'),
      coalesce(new.status, 'null')
    );
end;
$function$;

drop trigger if exists enforce_quotation_status_transition_before_update
on public.quotations;

create trigger enforce_quotation_status_transition_before_update
before update of status on public.quotations
for each row
execute function public.enforce_quotation_status_transition();
