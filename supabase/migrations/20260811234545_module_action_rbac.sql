-- Avyukta CRM module/action RBAC and per-user overrides.
-- Canonical organization roles in public.org_members are admin, sales, accountant.

create schema if not exists private;

create table public.permission_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique check (module_key ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permission_definitions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.permission_modules(id) on delete cascade,
  action_key text not null check (action_key ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, action_key)
);

create table public.role_default_permissions (
  id uuid primary key default gen_random_uuid(),
  role_key text not null check (role_key in ('admin', 'sales', 'accountant')),
  permission_id uuid not null references public.permission_definitions(id) on delete cascade,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_key, permission_id)
);

create table public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_id uuid not null references public.permission_definitions(id) on delete cascade,
  allowed boolean not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, permission_id),
  foreign key (user_id, org_id)
    references public.org_members(user_id, org_id) on delete cascade
);

comment on table public.permission_modules is 'Product catalog of CRM authorization modules.';
comment on table public.permission_definitions is 'Valid actions for each CRM authorization module.';
comment on table public.role_default_permissions is 'Product-defined default permissions for organization roles.';
comment on table public.user_permission_overrides is 'Per-user grants and denials; absence means inherit the role default.';

create index idx_permission_definitions_module on public.permission_definitions(module_id);
create index idx_role_default_permissions_role on public.role_default_permissions(role_key);
create index idx_user_permission_overrides_org_user on public.user_permission_overrides(org_id, user_id);
create index idx_user_permission_overrides_permission on public.user_permission_overrides(permission_id);

insert into public.permission_modules (module_key, display_name, sort_order)
values
  ('dashboard', 'Dashboard', 10),
  ('customers', 'Customer Management', 20),
  ('quotations', 'Quotations', 30),
  ('quotation_revisions', 'Quotation Revisions', 40),
  ('supplier_quotations', 'Supplier Quotations', 50),
  ('purchase_orders', 'Purchase Orders', 60),
  ('work_orders', 'Work Orders', 70),
  ('jobs', 'Job On The Go', 80),
  ('invoices', 'Invoices', 90),
  ('employees', 'Employee List', 100),
  ('calendar', 'Public Calendar', 110),
  ('supplier_price_library', 'Supplier Price Library', 120),
  ('settings', 'Settings', 130)
on conflict (module_key) do update set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  updated_at = now();

with permissions(module_key, action_key, display_name, sort_order) as (
  values
    ('dashboard', 'view', 'View', 10),
    ('customers', 'view', 'View', 10), ('customers', 'create', 'Add', 20),
    ('customers', 'edit', 'Edit', 30), ('customers', 'delete', 'Delete', 40),
    ('quotations', 'view', 'View', 10), ('quotations', 'create', 'Add', 20),
    ('quotations', 'edit', 'Edit', 30), ('quotations', 'delete', 'Delete', 40),
    ('quotations', 'revise', 'Create Revision', 50),
    ('quotation_revisions', 'view', 'View', 10), ('quotation_revisions', 'create', 'Add', 20),
    ('quotation_revisions', 'edit', 'Edit', 30), ('quotation_revisions', 'delete', 'Delete', 40),
    ('supplier_quotations', 'view', 'View', 10), ('supplier_quotations', 'create', 'Add', 20),
    ('supplier_quotations', 'edit', 'Edit', 30), ('supplier_quotations', 'delete', 'Delete', 40),
    ('purchase_orders', 'view', 'View', 10), ('purchase_orders', 'create', 'Add', 20),
    ('purchase_orders', 'edit', 'Edit', 30), ('purchase_orders', 'delete', 'Delete', 40),
    ('purchase_orders', 'attach_po', 'Attach PO', 50),
    ('work_orders', 'view', 'View', 10), ('work_orders', 'create', 'Add', 20),
    ('work_orders', 'edit', 'Edit', 30), ('work_orders', 'delete', 'Delete', 40),
    ('jobs', 'view', 'View', 10), ('jobs', 'create', 'Add', 20),
    ('jobs', 'edit', 'Edit', 30), ('jobs', 'delete', 'Delete', 40),
    ('jobs', 'update_status', 'Update Status', 50),
    ('invoices', 'view', 'View', 10), ('invoices', 'create', 'Add', 20),
    ('invoices', 'edit', 'Edit', 30), ('invoices', 'delete', 'Delete', 40),
    ('invoices', 'record_payment', 'Record Payment', 50),
    ('invoices', 'update_status', 'Update Status', 60),
    ('employees', 'view', 'View', 10), ('employees', 'create', 'Add', 20),
    ('employees', 'edit', 'Edit', 30), ('employees', 'delete', 'Delete', 40),
    ('calendar', 'view', 'View', 10), ('calendar', 'create', 'Add', 20),
    ('calendar', 'edit', 'Edit', 30), ('calendar', 'delete', 'Delete', 40),
    ('supplier_price_library', 'view', 'View', 10),
    ('supplier_price_library', 'create', 'Add', 20),
    ('supplier_price_library', 'edit', 'Edit', 30),
    ('supplier_price_library', 'delete', 'Delete', 40),
    ('settings', 'view', 'View', 10), ('settings', 'manage', 'Manage', 20)
)
insert into public.permission_definitions (module_id, action_key, display_name, sort_order)
select pm.id, p.action_key, p.display_name, p.sort_order
from permissions p
join public.permission_modules pm using (module_key)
on conflict (module_id, action_key) do update set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.role_default_permissions (role_key, permission_id, allowed)
select roles.role_key, pd.id, false
from (values ('admin'), ('sales'), ('accountant')) roles(role_key)
cross join public.permission_definitions pd
on conflict (role_key, permission_id) do update set allowed = false, updated_at = now();

update public.role_default_permissions set allowed = true, updated_at = now()
where role_key = 'admin';

with allowed(role_key, module_key, action_key) as (
  values
    ('sales', 'dashboard', 'view'),
    ('sales', 'customers', 'view'), ('sales', 'customers', 'create'), ('sales', 'customers', 'edit'),
    ('sales', 'quotations', 'view'), ('sales', 'quotations', 'create'), ('sales', 'quotations', 'edit'),
    ('sales', 'quotations', 'delete'), ('sales', 'quotations', 'revise'),
    ('sales', 'quotation_revisions', 'view'), ('sales', 'quotation_revisions', 'create'),
    ('sales', 'quotation_revisions', 'edit'), ('sales', 'quotation_revisions', 'delete'),
    ('sales', 'supplier_quotations', 'view'), ('sales', 'supplier_quotations', 'create'),
    ('sales', 'supplier_quotations', 'edit'), ('sales', 'supplier_quotations', 'delete'),
    ('sales', 'purchase_orders', 'view'), ('sales', 'purchase_orders', 'create'),
    ('sales', 'purchase_orders', 'edit'), ('sales', 'purchase_orders', 'attach_po'),
    ('sales', 'work_orders', 'view'),
    ('sales', 'jobs', 'view'), ('sales', 'jobs', 'update_status'),
    ('sales', 'invoices', 'view'), ('sales', 'employees', 'view'),
    ('sales', 'calendar', 'view'), ('sales', 'calendar', 'create'), ('sales', 'calendar', 'edit'),
    ('sales', 'supplier_price_library', 'view'), ('sales', 'supplier_price_library', 'create'),
    ('sales', 'supplier_price_library', 'edit'), ('sales', 'supplier_price_library', 'delete'),
    ('accountant', 'dashboard', 'view'), ('accountant', 'customers', 'view'),
    ('accountant', 'quotations', 'view'), ('accountant', 'quotation_revisions', 'view'),
    ('accountant', 'supplier_quotations', 'view'),
    ('accountant', 'purchase_orders', 'view'), ('accountant', 'purchase_orders', 'create'),
    ('accountant', 'purchase_orders', 'edit'), ('accountant', 'purchase_orders', 'delete'),
    ('accountant', 'work_orders', 'view'), ('accountant', 'jobs', 'view'),
    ('accountant', 'invoices', 'view'), ('accountant', 'invoices', 'create'),
    ('accountant', 'invoices', 'edit'), ('accountant', 'invoices', 'delete'),
    ('accountant', 'invoices', 'record_payment'), ('accountant', 'invoices', 'update_status'),
    ('accountant', 'employees', 'view'),
    ('accountant', 'calendar', 'view'), ('accountant', 'calendar', 'create'), ('accountant', 'calendar', 'edit'),
    ('accountant', 'supplier_price_library', 'view')
)
update public.role_default_permissions rdp
set allowed = true, updated_at = now()
from public.permission_definitions pd
join public.permission_modules pm on pm.id = pd.module_id
join allowed a on a.module_key = pm.module_key and a.action_key = pd.action_key
where rdp.permission_id = pd.id and rdp.role_key = a.role_key;

create or replace function private.user_has_permission(
  p_user_id uuid, p_org_id uuid, p_module_key text, p_action_key text
) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select coalesce(upo.allowed, rdp.allowed, false)
    from public.org_members om
    join public.permission_modules pm
      on pm.module_key = p_module_key and pm.is_active
    join public.permission_definitions pd
      on pd.module_id = pm.id and pd.action_key = p_action_key and pd.is_active
    left join public.user_permission_overrides upo
      on upo.org_id = om.org_id and upo.user_id = om.user_id and upo.permission_id = pd.id
    left join public.role_default_permissions rdp
      on rdp.role_key = om.role and rdp.permission_id = pd.id
    where om.user_id = p_user_id and om.org_id = p_org_id and om.status = 'active'
    limit 1
  ), false);
$$;

create or replace function public.user_has_permission(
  p_user_id uuid, p_org_id uuid, p_module_key text, p_action_key text
) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_has_permission(p_user_id, p_org_id, p_module_key, p_action_key);
$$;

revoke all on function private.user_has_permission(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function private.user_has_permission(uuid, uuid, text, text) to service_role;
revoke all on function public.user_has_permission(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.user_has_permission(uuid, uuid, text, text) to service_role;

create or replace function private.current_user_has_permission(
  p_org_id uuid, p_module_key text, p_action_key text
) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_has_permission((select auth.uid()), p_org_id, p_module_key, p_action_key);
$$;

revoke all on function private.current_user_has_permission(uuid, text, text) from public, anon;
grant execute on function private.current_user_has_permission(uuid, text, text) to authenticated, service_role;

create or replace function private.prevent_last_settings_manager_loss()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  affected_org_id uuid := coalesce(new.org_id, old.org_id);
begin
  if not exists (
    select 1
    from public.org_members om
    where om.org_id = affected_org_id
      and om.status = 'active'
      and private.user_has_permission(om.user_id, om.org_id, 'settings', 'manage')
  ) then
    raise exception using
      errcode = '23514',
      message = 'Organization must retain at least one active Settings manager.';
  end if;
  return coalesce(new, old);
end;
$$;

create constraint trigger protect_last_settings_manager_override
after insert or update or delete on public.user_permission_overrides
deferrable initially immediate
for each row execute function private.prevent_last_settings_manager_loss();

create constraint trigger protect_last_settings_manager_membership
after update of role, status or delete on public.org_members
deferrable initially immediate
for each row execute function private.prevent_last_settings_manager_loss();

create trigger set_permission_modules_updated_at before update on public.permission_modules
for each row execute function public.set_updated_at();
create trigger set_permission_definitions_updated_at before update on public.permission_definitions
for each row execute function public.set_updated_at();
create trigger set_role_default_permissions_updated_at before update on public.role_default_permissions
for each row execute function public.set_updated_at();
create trigger set_user_permission_overrides_updated_at before update on public.user_permission_overrides
for each row execute function public.set_updated_at();

alter table public.permission_modules enable row level security;
alter table public.permission_definitions enable row level security;
alter table public.role_default_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;

grant select on public.permission_modules, public.permission_definitions,
  public.role_default_permissions to authenticated, service_role;
grant select, insert, update, delete on public.user_permission_overrides to authenticated, service_role;

create policy permission_modules_authenticated_read on public.permission_modules
for select to authenticated using (true);
create policy permission_definitions_authenticated_read on public.permission_definitions
for select to authenticated using (true);
create policy role_default_permissions_authenticated_read on public.role_default_permissions
for select to authenticated using (true);

create policy user_permission_overrides_select on public.user_permission_overrides
for select to authenticated using (
  user_id = (select auth.uid())
  or (select private.current_user_has_permission(org_id, 'settings', 'manage'))
);
create policy user_permission_overrides_insert on public.user_permission_overrides
for insert to authenticated with check (
  (select private.current_user_has_permission(org_id, 'settings', 'manage'))
  and granted_by = (select auth.uid())
);
create policy user_permission_overrides_update on public.user_permission_overrides
for update to authenticated
using ((select private.current_user_has_permission(org_id, 'settings', 'manage')))
with check (
  (select private.current_user_has_permission(org_id, 'settings', 'manage'))
  and granted_by = (select auth.uid())
);
create policy user_permission_overrides_delete on public.user_permission_overrides
for delete to authenticated
using ((select private.current_user_has_permission(org_id, 'settings', 'manage')));
