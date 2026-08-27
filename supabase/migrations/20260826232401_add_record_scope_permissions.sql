-- Company visibility and company-wide editing are intentionally separate.
-- Sales users inherit edit rights for their own records; edit_all is an
-- explicit override that an administrator can grant when needed.
with modules(module_key) as (
  values ('customers'), ('quotations'), ('purchase_orders'), ('jobs')
)
insert into public.permission_definitions (module_id, action_key, display_name, description, sort_order)
select pm.id, 'edit_all', 'Edit All Company Records',
  'Allows edits to records assigned to another salesperson.', 35
from modules m
join public.permission_modules pm on pm.module_key = m.module_key
on conflict (module_id, action_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.role_default_permissions (role_key, permission_id, allowed)
select roles.role_key, pd.id, roles.role_key = 'admin'
from (values ('admin'), ('sales'), ('accountant')) roles(role_key)
join public.permission_definitions pd on pd.action_key = 'edit_all'
join public.permission_modules pm on pm.id = pd.module_id
  and pm.module_key in ('customers', 'quotations', 'purchase_orders', 'jobs')
on conflict (role_key, permission_id) do update set
  allowed = excluded.allowed,
  updated_at = now();
