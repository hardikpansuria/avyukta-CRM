import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { logCustomerActivity } from "@/lib/customers/activity";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedRoles = new Set(["admin", "sales", "accountant"]);
const allowedLogoTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["svg", "image/svg+xml"],
]);
const maxLogoBytes = 10 * 1024 * 1024;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function safeFileName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "logo";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }
  const denied = await requireOrgPermission(session, "customers", "edit");
  if (denied) return denied;

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("logo");

  if (!(file instanceof File)) {
    return jsonError("Logo file is required", 400);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (allowedLogoTypes.get(extension) !== file.type.toLowerCase()) {
    return jsonError("Logo must be JPEG, PNG, WebP, or SVG", 400);
  }

  if (file.size === 0) {
    return jsonError("Logo file is empty", 400);
  }

  if (file.size > maxLogoBytes) {
    return jsonError("Logo must be 10 MB or smaller", 400);
  }

  const admin = createAdminClient();
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .neq("record_status", "deleted")
    .maybeSingle();

  if (customerError) {
    return jsonError("Unable to validate customer", 500);
  }

  if (!customer) {
    return jsonError("Customer not found", 404);
  }

  const storagePath = `${session.org_id}/customers/${id}/logo/${Date.now()}-${safeFileName(file.name)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("crm-assets")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return jsonError("Unable to upload logo", 500);
  }

  const { error: updateError } = await admin
    .from("customers")
    .update({
      logo_storage_path: storagePath,
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("org_id", session.org_id);

  if (updateError) {
    await admin.storage.from("crm-assets").remove([storagePath]);
    return jsonError("Unable to save logo path", 500);
  }

  const { data: signedData } = await admin.storage
    .from("crm-assets")
    .createSignedUrl(storagePath, 60 * 60);

  await logCustomerActivity(admin, {
    org_id: session.org_id,
    customer_id: id,
    activity_type: "profile_updated",
    description: "Customer logo updated",
    actor_id: session.user.id,
  });

  return NextResponse.json({
    logo_storage_path: storagePath,
    logo_signed_url: signedData?.signedUrl ?? null,
    message: "Logo uploaded",
  });
}
