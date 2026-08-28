-- Exact, organization-scoped billing balances for the Unbilled Jobs report.
-- Invoice requests reserve capacity for new requests, but only actual invoices
-- contribute to the "already invoiced" amount shown to users.

create view public.unbilled_job_balances
with (security_invoker = true)
as
with invoice_totals as (
  select
    invoice.org_id,
    invoice.job_id,
    coalesce(sum(invoice.invoice_amount), 0::numeric)::numeric(14,2)
      as invoiced_amount,
    max(invoice.invoice_date) as last_invoice_date
  from public.job_invoices invoice
  group by invoice.org_id, invoice.job_id
),
request_commitments as (
  select
    request.org_id,
    request.job_id,
    coalesce(sum(request.requested_amount), 0::numeric)::numeric(14,2)
      as pending_request_amount
  from public.invoice_requests request
  where request.status in ('pending', 'under_review')
    and request.invoice_type <> 'credit_note'
  group by request.org_id, request.job_id
)
select
  job.org_id,
  job.id as job_id,
  job.job_number,
  job.job_status,
  job.customer_id,
  job.salesperson_id,
  job.latest_accepted_quotation_id as quotation_id,
  allocation.purchase_order_id,
  purchase_order.po_number,
  coalesce(purchase_order.currency, customer.currency, 'CAD') as currency,
  customer.company_name as customer_name,
  quotation.project_name,
  coalesce(profile.full_name, profile.email) as salesperson_name,
  completion.completion_date,
  invoice_totals.last_invoice_date,
  allocation.total_po_amount::numeric(14,2)::text as po_amount,
  coalesce(invoice_totals.invoiced_amount, 0::numeric)::numeric(14,2)::text
    as invoiced_amount,
  (
    allocation.total_po_amount
    - coalesce(invoice_totals.invoiced_amount, 0::numeric)
  )::numeric(14,2)::text as remaining_unbilled_amount,
  coalesce(
    request_commitments.pending_request_amount,
    0::numeric
  )::numeric(14,2)::text as pending_request_amount,
  (
    allocation.total_po_amount
    - coalesce(invoice_totals.invoiced_amount, 0::numeric)
    - coalesce(request_commitments.pending_request_amount, 0::numeric)
  )::numeric(14,2)::text as available_to_request_amount,
  round(
    case
      when allocation.total_po_amount > 0 then
        coalesce(invoice_totals.invoiced_amount, 0::numeric)
          / allocation.total_po_amount * 100
      else 0::numeric
    end,
    2
  )::text as percentage_invoiced
from public.jobs job
join public.job_purchase_order_allocations allocation
  on allocation.job_id = job.id
 and allocation.org_id = job.org_id
join public.job_purchase_orders purchase_order
  on purchase_order.id = allocation.purchase_order_id
 and purchase_order.org_id = job.org_id
join public.customers customer
  on customer.id = job.customer_id
left join public.quotations quotation
  on quotation.id = job.latest_accepted_quotation_id
 and quotation.org_id = job.org_id
left join public.profiles profile
  on profile.id = job.salesperson_id
left join public.job_work_completions completion
  on completion.id = job.latest_work_completion_id
 and completion.org_id = job.org_id
left join invoice_totals
  on invoice_totals.job_id = job.id
 and invoice_totals.org_id = job.org_id
left join request_commitments
  on request_commitments.job_id = job.id
 and request_commitments.org_id = job.org_id
where job.job_status in ('work_in_process', 'work_completed')
  and allocation.total_po_amount > 0;

comment on view public.unbilled_job_balances is
  'Exact job-level PO, invoiced, pending request, and remaining balances for billing follow-up.';

revoke all on public.unbilled_job_balances from public, anon, authenticated;
grant select on public.unbilled_job_balances to authenticated, service_role;

-- Serialize active invoice-request commitments per job so two simultaneous
-- requests cannot reserve more than the exact remaining PO balance.
create function public.validate_invoice_request_available_balance()
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
     or new.invoice_type = 'credit_note' then
    return new;
  end if;

  select allocation.total_po_amount
  into v_po_total
  from public.job_purchase_order_allocations allocation
  where allocation.org_id = new.org_id
    and allocation.job_id = new.job_id
    and allocation.purchase_order_id = new.purchase_order_id
  for update;

  if not found then
    raise exception 'Job purchase order allocation was not found'
      using errcode = '23503';
  end if;

  select coalesce(sum(invoice.invoice_amount), 0::numeric)::numeric(14,2)
  into v_invoiced
  from public.job_invoices invoice
  where invoice.org_id = new.org_id
    and invoice.job_id = new.job_id;

  select coalesce(sum(request.requested_amount), 0::numeric)::numeric(14,2)
  into v_other_requests
  from public.invoice_requests request
  where request.org_id = new.org_id
    and request.job_id = new.job_id
    and request.id <> new.id
    and request.status in ('pending', 'under_review')
    and request.invoice_type <> 'credit_note';

  if v_invoiced + v_other_requests + new.requested_amount > v_po_total then
    raise exception 'Requested amount exceeds the uncommitted PO balance'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_invoice_request_available_balance()
  from public, anon, authenticated;
grant execute on function public.validate_invoice_request_available_balance()
  to service_role;

create trigger validate_invoice_request_available_balance_before_write
before insert or update of
  org_id,
  job_id,
  purchase_order_id,
  invoice_type,
  requested_amount,
  status
on public.invoice_requests
for each row
execute function public.validate_invoice_request_available_balance();
