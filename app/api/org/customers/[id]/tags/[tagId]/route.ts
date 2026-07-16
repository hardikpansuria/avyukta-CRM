import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { logCustomerActivity } from "@/lib/customers/activity";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedRoles = new Set(["admin", "sales", "accountant"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/org/customers/[id]/tags/[tagId]">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id, tagId } = await context.params;
  const admin = createAdminClient();
  const { data: tag, error: tagError } = await admin
    .from("tags")
    .select("id, name")
    .eq("id", tagId)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (tagError) {
    return jsonError("Unable to validate tag", 500);
  }

  const { error } = await admin
    .from("customer_tags")
    .delete()
    .eq("org_id", session.org_id)
    .eq("customer_id", id)
    .eq("tag_id", tagId);

  if (error) {
    return jsonError("Unable to remove tag", 500);
  }

  await logCustomerActivity(admin, {
    org_id: session.org_id,
    customer_id: id,
    activity_type: "tag_removed",
    description: tag?.name ? `Tag removed: ${tag.name}` : "Tag removed",
    actor_id: session.user.id,
    linked_record_type: "tag",
    linked_record_id: tagId,
    linked_record_number: tag?.name ?? null,
  });

  return NextResponse.json({ message: "Tag removed" });
}
