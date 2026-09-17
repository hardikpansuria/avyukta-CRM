import type { OrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

import type {
  AdminAuditAction,
  AdminAuditChange,
  AdminAuditModule,
} from "./types";

type AuditEntry = {
  action: AdminAuditAction;
  module: AdminAuditModule;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  summary: string;
  changes?: AdminAuditChange[];
};

export async function recordAdminAuditLog(
  session: OrgSession,
  entry: AuditEntry,
) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name,email")
    .eq("id", session.user.id)
    .maybeSingle();

  const actorName =
    profile?.full_name?.trim() || profile?.email || session.user.email || "Administrator";
  const actorEmail = profile?.email || session.user.email || null;
  const { error } = await admin.from("admin_audit_logs").insert({
    org_id: session.org_id,
    actor_user_id: session.user.id,
    actor_name: actorName,
    actor_email: actorEmail,
    action_type: entry.action,
    module_key: entry.module,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    target_label: entry.targetLabel ?? null,
    summary: entry.summary,
    changes: entry.changes ?? [],
  });

  if (error) {
    console.error("Unable to write admin audit log", {
      code: error.code,
      message: error.message,
      module: entry.module,
      action: entry.action,
    });
    return false;
  }

  return true;
}
