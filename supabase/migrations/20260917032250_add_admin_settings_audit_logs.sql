-- Organization-scoped audit trail for critical Admin Settings mutations.
-- The application writes and reads these records only from trusted server routes.

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_name text not null check (length(btrim(actor_name)) > 0),
  actor_email text,
  action_type text not null check (action_type in ('add', 'edit', 'delete')),
  module_key text not null check (
    module_key in (
      'company_branding',
      'invite_employee',
      'crm_users',
      'module_permissions'
    )
  ),
  target_type text not null check (length(btrim(target_type)) > 0),
  target_id text,
  target_label text,
  summary text not null check (length(btrim(summary)) > 0),
  changes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(changes) = 'array'),
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_logs is
  'Append-only audit trail for critical changes made from organization Admin Settings.';
comment on column public.admin_audit_logs.changes is
  'Array of user-facing field changes with field, from, and to values.';

create index admin_audit_logs_org_created_at_idx
  on public.admin_audit_logs (org_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

revoke all on table public.admin_audit_logs from anon, authenticated;
grant select, insert on table public.admin_audit_logs to service_role;
