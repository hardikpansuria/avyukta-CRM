-- Private implementations are reachable only through their reviewed public
-- SECURITY DEFINER wrappers. API roles do not need direct execution rights.
revoke all on function private.recalculate_job_purchase_order_totals(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.update_job_purchase_order_impl(uuid, text, date, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.unlink_job_purchase_order_allocation_impl(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.create_job_purchase_order_impl(text, date, text, jsonb)
  from public, anon, authenticated, service_role;
