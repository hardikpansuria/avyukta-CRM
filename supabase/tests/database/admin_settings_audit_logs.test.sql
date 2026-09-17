begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

select has_table(
  'public',
  'admin_audit_logs',
  'Admin settings audit table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.admin_audit_logs'::regclass),
  'Admin settings audit table has RLS enabled'
);

select is(
  has_table_privilege('anon', 'public.admin_audit_logs', 'SELECT'),
  false,
  'Anonymous users cannot read audit logs'
);
select is(
  has_table_privilege('authenticated', 'public.admin_audit_logs', 'SELECT'),
  false,
  'Authenticated clients cannot read audit logs directly'
);
select is(
  has_table_privilege('authenticated', 'public.admin_audit_logs', 'INSERT'),
  false,
  'Authenticated clients cannot insert audit logs directly'
);
select is(
  has_table_privilege('authenticated', 'public.admin_audit_logs', 'UPDATE'),
  false,
  'Authenticated clients cannot edit audit logs'
);
select is(
  has_table_privilege('authenticated', 'public.admin_audit_logs', 'DELETE'),
  false,
  'Authenticated clients cannot delete audit logs'
);
select is(
  has_table_privilege('service_role', 'public.admin_audit_logs', 'SELECT'),
  true,
  'Trusted server routes can read audit logs'
);
select is(
  has_table_privilege('service_role', 'public.admin_audit_logs', 'INSERT'),
  true,
  'Trusted server routes can append audit logs'
);
select is(
  has_table_privilege('service_role', 'public.admin_audit_logs', 'UPDATE'),
  false,
  'Trusted server routes cannot rewrite audit history'
);
select is(
  has_table_privilege('service_role', 'public.admin_audit_logs', 'DELETE'),
  false,
  'Trusted server routes cannot delete audit history'
);

select * from finish();
rollback;
