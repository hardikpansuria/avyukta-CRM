import { NextResponse } from "next/server";

import { authorizeOrgRequest } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type OverrideBody = {
  user_id?: unknown;
  permission_id?: unknown;
  allowed?: unknown;
};

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json({ error, code }, { status });
}

export async function GET() {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  const [modules, defaults, overrides] = await Promise.all([
    admin
      .from("permission_modules")
      .select("id,module_key,display_name,description,sort_order,permission_definitions(id,action_key,display_name,description,sort_order)")
      .eq("is_active", true)
      .eq("permission_definitions.is_active", true)
      .order("sort_order")
      .order("sort_order", { referencedTable: "permission_definitions" }),
    admin
      .from("role_default_permissions")
      .select("role_key,permission_id,allowed"),
    admin
      .from("user_permission_overrides")
      .select("user_id,permission_id,allowed")
      .eq("org_id", auth.session.org_id),
  ]);

  const error = modules.error ?? defaults.error ?? overrides.error;
  if (error) {
    console.error("Unable to load permission settings", error);
    return jsonError("Unable to load permission settings", 500);
  }

  return NextResponse.json({
    modules: modules.data ?? [],
    role_defaults: defaults.data ?? [],
    overrides: overrides.data ?? [],
  });
}

export async function PUT(request: Request) {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;

  let body: OverrideBody;
  try {
    body = (await request.json()) as OverrideBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const permissionId = typeof body.permission_id === "string" ? body.permission_id : "";
  if (!userId || !permissionId || typeof body.allowed !== "boolean") {
    return jsonError("User, permission, and allowed value are required", 400);
  }

  const admin = createAdminClient();
  const [{ data: member }, { data: permission }] = await Promise.all([
    admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", auth.session.org_id)
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("permission_definitions").select("id").eq("id", permissionId).eq("is_active", true).maybeSingle(),
  ]);

  if (!member) return jsonError("User is not a member of this organization", 404);
  if (!permission) return jsonError("Permission not found", 404);

  const { data, error } = await admin
    .from("user_permission_overrides")
    .upsert(
      {
        org_id: auth.session.org_id,
        user_id: userId,
        permission_id: permissionId,
        allowed: body.allowed,
        granted_by: auth.session.user.id,
      },
      { onConflict: "org_id,user_id,permission_id" },
    )
    .select("user_id,permission_id,allowed")
    .single();

  if (error) {
    const lockout = error.code === "23514";
    return jsonError(
      lockout
        ? "This change would remove the organization's last active Settings manager."
        : "Unable to save permission override",
      lockout ? 409 : 500,
      lockout ? "LAST_SETTINGS_MANAGER" : undefined,
    );
  }

  return NextResponse.json({ override: data });
}

export async function DELETE(request: Request) {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;

  const userId = new URL(request.url).searchParams.get("user_id");
  if (!userId) return jsonError("User is required", 400);

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", auth.session.org_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return jsonError("User is not a member of this organization", 404);

  const { error } = await admin
    .from("user_permission_overrides")
    .delete()
    .eq("org_id", auth.session.org_id)
    .eq("user_id", userId);
  if (error) return jsonError("Unable to reset role defaults", 500);

  return NextResponse.json({ message: "Permissions reset to role defaults" });
}
