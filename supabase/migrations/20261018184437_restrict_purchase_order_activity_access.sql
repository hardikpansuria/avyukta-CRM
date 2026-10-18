-- Supabase's legacy default privileges may expose newly created public tables
-- to anon at the table ACL layer. RLS still denied rows, but this explicit
-- revoke keeps the audit table out of the anonymous Data API surface entirely.
revoke all on public.job_purchase_order_activity from anon;
