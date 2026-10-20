-- Record every PO-number correction in the existing organization-scoped
-- customer activity ledger. The trigger runs in the same transaction as the
-- PO update, so the number cannot change without its audit event.

alter table public.customer_activities
  drop constraint customer_activities_activity_type_check;

alter table public.customer_activities
  add constraint customer_activities_activity_type_check
  check (
    activity_type = any (array[
      'customer_created'::text,
      'profile_updated'::text,
      'quote_created'::text,
      'quote_revised'::text,
      'quote_sent'::text,
      'customer_po_received'::text,
      'customer_po_updated'::text,
      'work_order_created'::text,
      'invoice_created'::text,
      'invoice_sent'::text,
      'payment_recorded'::text,
      'phone_call_logged'::text,
      'meeting_logged'::text,
      'email_logged'::text,
      'note_added'::text,
      'contact_added'::text,
      'contact_updated'::text,
      'tag_added'::text,
      'tag_removed'::text
    ])
  );

create or replace function private.record_purchase_order_number_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.po_number is distinct from new.po_number then
    insert into public.customer_activities (
      org_id,
      customer_id,
      activity_type,
      description,
      linked_record_type,
      linked_record_id,
      linked_record_number,
      actor_id,
      occurred_at,
      metadata
    ) values (
      new.org_id,
      new.customer_id,
      'customer_po_updated',
      format(
        'PO number changed from %s to %s',
        old.po_number,
        new.po_number
      ),
      'purchase_order',
      new.id,
      new.po_number,
      new.updated_by,
      now(),
      jsonb_build_object(
        'field', 'po_number',
        'old_po_number', old.po_number,
        'new_po_number', new.po_number
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.record_purchase_order_number_change()
  from public, anon, authenticated, service_role;

drop trigger if exists record_purchase_order_number_change
  on public.job_purchase_orders;

create trigger record_purchase_order_number_change
after update of po_number on public.job_purchase_orders
for each row
when (old.po_number is distinct from new.po_number)
execute function private.record_purchase_order_number_change();
