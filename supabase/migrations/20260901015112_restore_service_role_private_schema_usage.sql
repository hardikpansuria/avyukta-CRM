-- The server-only permission RPC is SECURITY INVOKER and delegates to the
-- explicitly allowlisted helper in the private schema. PostgreSQL requires
-- both schema USAGE and function EXECUTE; the hardening migration restored
-- only EXECUTE, causing every server-side permission check to fail closed.
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
