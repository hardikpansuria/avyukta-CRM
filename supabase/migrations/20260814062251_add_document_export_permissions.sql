-- Phase 1 document export permissions. Exports are deliberately opt-in for
-- non-admin users because a backup can contain commercially sensitive files.

insert into public.permission_modules (
  module_key,
  display_name,
  description,
  sort_order
)
values (
  'document_exports',
  'Document Exports',
  'Download organization documents as a structured ZIP archive.',
  95
)
on conflict (module_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

with permissions(action_key, display_name, description, sort_order) as (
  values
    ('view', 'View', 'See the Download Documents action.', 10),
    ('date_range_export', 'Date Range Export', 'Download documents added within an inclusive date range.', 20),
    ('full_backup', 'Full Backup', 'Download every current CRM document for the organization.', 30)
)
insert into public.permission_definitions (
  module_id,
  action_key,
  display_name,
  description,
  sort_order
)
select pm.id, p.action_key, p.display_name, p.description, p.sort_order
from permissions p
join public.permission_modules pm on pm.module_key = 'document_exports'
on conflict (module_id, action_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.role_default_permissions (role_key, permission_id, allowed)
select roles.role_key, pd.id, roles.role_key = 'admin'
from (values ('admin'), ('sales'), ('accountant')) roles(role_key)
cross join public.permission_modules pm
join public.permission_definitions pd on pd.module_id = pm.id
where pm.module_key = 'document_exports'
on conflict (role_key, permission_id) do update set
  allowed = excluded.allowed,
  updated_at = now();
