import { NextResponse } from "next/server";

import type { OrgSession } from "@/lib/auth/verify-org-session";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupplierPricePermissions } from "@/lib/supplier-price-library/access";

export const permissionModules = [
  "dashboard",
  "customers",
  "quotations",
  "quotation_revisions",
  "supplier_quotations",
  "purchase_orders",
  "work_orders",
  "jobs",
  "invoice_requests",
  "invoices",
  "employees",
  "calendar",
  "supplier_price_library",
  "settings",
] as const;

export type PermissionModule = (typeof permissionModules)[number];
export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "revise"
  | "attach_po"
  | "update_status"
  | "record_payment"
  | "process"
  | "archive"
  | "reopen"
  | "manage";

export type PermissionKey = `${PermissionModule}.${PermissionAction}`;

export function accessDeniedResponse(module: string, action: string) {
  return NextResponse.json(
    {
      error: `You do not have permission to ${action.replaceAll("_", " ")} ${module.replaceAll("_", " ")}.`,
      code: "ACCESS_DENIED",
      module,
      action,
    },
    { status: 403 },
  );
}

export async function hasOrgPermission(
  session: OrgSession,
  module: PermissionModule,
  action: PermissionAction,
) {
  const { data, error } = await createAdminClient().rpc("user_has_permission", {
    p_user_id: session.user.id,
    p_org_id: session.org_id,
    p_module_key: module,
    p_action_key: action,
  });

  if (error) {
    console.error("Unable to evaluate organization permission", {
      module,
      action,
      code: error.code,
      message: error.message,
    });
    return false;
  }

  return data === true;
}

export async function requireOrgPermission(
  session: OrgSession,
  module: PermissionModule,
  action: PermissionAction,
) {
  return (await hasOrgPermission(session, module, action))
    ? null
    : accessDeniedResponse(module, action);
}

export async function authorizeOrgRequest(
  module: PermissionModule,
  action: PermissionAction,
) {
  const session = await verifyOrgSession();
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const denied = await requireOrgPermission(session, module, action);
  if (denied) return { response: denied } as const;
  return { session } as const;
}

export async function getEffectivePermissionKeys(session: OrgSession) {
  const admin = createAdminClient();
  const [{ data: definitions, error: definitionsError }, { data: overrides, error: overridesError }] =
    await Promise.all([
      admin
        .from("permission_definitions")
        .select("action_key, permission_modules!inner(module_key), role_default_permissions!inner(allowed, role_key)")
        .eq("is_active", true)
        .eq("permission_modules.is_active", true)
        .eq("role_default_permissions.role_key", session.role),
      admin
        .from("user_permission_overrides")
        .select("allowed, permission_definitions!inner(action_key, permission_modules!inner(module_key))")
        .eq("org_id", session.org_id)
        .eq("user_id", session.user.id),
    ]);

  if (definitionsError || overridesError) {
    console.error("Unable to load effective permissions", {
      definitionsError,
      overridesError,
    });
    return new Set<PermissionKey>();
  }

  const allowed = new Set<PermissionKey>();
  for (const row of definitions ?? []) {
    const moduleRelation = row.permission_modules as unknown as { module_key: string };
    const roleRelations = row.role_default_permissions as unknown as Array<{
      allowed: boolean;
      role_key: string;
    }>;
    const key = `${moduleRelation.module_key}.${row.action_key}` as PermissionKey;
    if (roleRelations.some((permission) => permission.allowed)) allowed.add(key);
  }

  for (const row of overrides ?? []) {
    const definition = row.permission_definitions as unknown as {
      action_key: string;
      permission_modules: { module_key: string };
    };
    const key = `${definition.permission_modules.module_key}.${definition.action_key}` as PermissionKey;
    if (row.allowed) allowed.add(key);
    else allowed.delete(key);
  }

  return allowed;
}

export async function getSupplierPricePermissions(
  session: OrgSession,
): Promise<SupplierPricePermissions> {
  const permissions = await getEffectivePermissionKeys(session);
  return {
    canView: permissions.has("supplier_price_library.view"),
    canEdit:
      permissions.has("supplier_price_library.create") ||
      permissions.has("supplier_price_library.edit"),
    canAdmin: permissions.has("supplier_price_library.delete"),
  };
}
