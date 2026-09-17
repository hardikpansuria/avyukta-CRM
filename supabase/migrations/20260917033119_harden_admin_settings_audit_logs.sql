-- Supabase may grant service_role broad table privileges through project
-- defaults. Remove those grants so this audit history is append-only to the
-- application, then restore only the operations required by trusted routes.

revoke all on table public.admin_audit_logs from service_role;
grant select, insert on table public.admin_audit_logs to service_role;
