export const adminAuditActions = ["add", "edit", "delete"] as const;
export type AdminAuditAction = (typeof adminAuditActions)[number];

export const adminAuditModules = [
  "company_branding",
  "invite_employee",
  "crm_users",
  "module_permissions",
] as const;
export type AdminAuditModule = (typeof adminAuditModules)[number];

export type AdminAuditChange = {
  field: string;
  from: string | null;
  to: string | null;
};

export type AdminAuditLog = {
  id: string;
  actor_name: string;
  actor_email: string | null;
  action_type: AdminAuditAction;
  module_key: AdminAuditModule;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  summary: string;
  changes: AdminAuditChange[];
  created_at: string;
};
