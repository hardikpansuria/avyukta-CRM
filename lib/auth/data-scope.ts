import { NextResponse } from "next/server";

import type { OrgSession } from "./verify-org-session";
import { hasOrgPermission, type PermissionModule } from "./permissions";

export function isSalesRole(role: string) {
  return role === "sales" || role === "salesperson";
}

export async function requireOwnedMutation(
  session: OrgSession,
  module: Extract<PermissionModule, "customers" | "quotations" | "purchase_orders" | "jobs">,
  ownerIds: Array<string | null | undefined>,
  match: "any" | "all" = "any",
) {
  if (!isSalesRole(session.role)) return null;
  const scopedOwners = ownerIds.filter((id): id is string => Boolean(id));
  const ownsRecord = match === "all"
    ? scopedOwners.length > 0 && scopedOwners.every((id) => id === session.user.id)
    : scopedOwners.some((id) => id === session.user.id);
  if (ownsRecord) return null;
  if (await hasOrgPermission(session, module, "edit_all")) return null;
  return NextResponse.json(
    {
      error: "This company record is read-only for you because it belongs to another salesperson.",
      code: "RECORD_SCOPE_DENIED",
      module,
      action: "edit_all",
    },
    { status: 403 },
  );
}
