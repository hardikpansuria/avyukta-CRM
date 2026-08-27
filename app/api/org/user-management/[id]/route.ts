import { NextResponse } from "next/server";

import { isPendingInvitation } from "@/lib/auth/invitation-status";
import { authorizeOrgRequest } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type UpdateEmployeeBody = {
  role?: unknown;
  status?: unknown;
  transfer_to_member_id?: unknown;
  admin_confirmation?: unknown;
  admin_demotion_confirmed?: unknown;
};

const employeeRoles = new Set(["admin", "accountant", "sales"]);
const employeeStatuses = new Set(["active", "inactive"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/user-management/[id]">,
) {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await context.params;
  let body: UpdateEmployeeBody;

  try {
    body = (await request.json()) as UpdateEmployeeBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const updates: { role?: string; status?: string } = {};

  if (body.role !== undefined) {
    if (typeof body.role !== "string" || !employeeRoles.has(body.role)) {
      return jsonError("Role must be admin, accountant, or sales", 400);
    }

    updates.role = body.role;
  }

  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !employeeStatuses.has(body.status)
    ) {
      return jsonError("Status must be active or inactive", 400);
    }

    updates.status = body.status;
  }

  if (!updates.role && !updates.status) {
    return jsonError("Role or status is required", 400);
  }

  const admin = createAdminClient();
  const { data: currentEmployee, error: currentEmployeeError } = await admin
    .from("org_members")
    .select("id, user_id, role, status")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (currentEmployeeError) {
    return jsonError("Unable to validate employee", 500);
  }

  if (!currentEmployee) {
    return jsonError("Employee not found", 404);
  }

  if (
    session.role !== "admin" &&
    (currentEmployee.role === "admin" || updates.role === "admin")
  ) {
    return jsonError("Only an administrator can manage administrator access", 403);
  }

  const promotesToAdmin =
    currentEmployee.role !== "admin" && updates.role === "admin";

  if (promotesToAdmin && body.admin_confirmation !== "admin role") {
    return NextResponse.json(
      {
        error: 'Enter "admin role" to confirm administrator access.',
        code: "ADMIN_CONFIRMATION_REQUIRED",
      },
      { status: 400 },
    );
  }

  const demotesFromAdmin =
    currentEmployee.role === "admin" &&
    updates.role !== undefined &&
    updates.role !== "admin";

  if (demotesFromAdmin && body.admin_demotion_confirmed !== true) {
    return NextResponse.json(
      {
        error: "Confirm that you want to remove administrator access.",
        code: "ADMIN_DEMOTION_CONFIRMATION_REQUIRED",
      },
      { status: 400 },
    );
  }

  const removesActiveAdmin =
    currentEmployee.role === "admin" &&
    currentEmployee.status === "active" &&
    ((updates.role !== undefined && updates.role !== "admin") ||
      (updates.status !== undefined && updates.status !== "active"));

  if (removesActiveAdmin) {
    const { count, error: adminCountError } = await admin
      .from("org_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", session.org_id)
      .eq("role", "admin")
      .eq("status", "active")
      .neq("id", id);

    if (adminCountError) {
      return jsonError("Unable to validate organization administrators", 500);
    }

    if ((count ?? 0) === 0) {
      const transferToMemberId =
        typeof body.transfer_to_member_id === "string"
          ? body.transfer_to_member_id
          : "";

      if (!transferToMemberId) {
        return NextResponse.json(
          {
            error:
              "This is the organization's last active administrator. Transfer ownership before continuing.",
            code: "ADMIN_TRANSFER_REQUIRED",
          },
          { status: 409 },
        );
      }

      if (session.role !== "admin") {
        return jsonError("Only an administrator can transfer ownership", 403);
      }

      const { data: successor, error: successorError } = await admin
        .from("org_members")
        .select("id, user_id, role, status")
        .eq("id", transferToMemberId)
        .eq("org_id", session.org_id)
        .neq("id", id)
        .maybeSingle();

      if (successorError) {
        return jsonError("Unable to validate the new administrator", 500);
      }

      if (!successor || successor.status !== "active") {
        return jsonError(
          "Select another active organization user as the new administrator",
          400,
        );
      }

      const { data: successorAuthData, error: successorAuthError } =
        await admin.auth.admin.getUserById(successor.user_id);

      if (successorAuthError || !successorAuthData.user) {
        return jsonError("Unable to validate the new administrator's account", 500);
      }

      if (isPendingInvitation(successorAuthData.user)) {
        return jsonError(
          "Select a user who has accepted their invitation as the new administrator",
          400,
        );
      }

      const { error: transferError } = await admin.rpc(
        "transfer_org_administrator",
        {
          p_org_id: session.org_id,
          p_current_member_id: id,
          p_successor_member_id: successor.id,
          p_new_role: updates.role ?? null,
          p_new_status: updates.status ?? null,
        },
      );

      if (transferError) {
        return jsonError("Unable to transfer administrator access", 500);
      }

      const { data: transferredEmployee, error: transferredEmployeeError } =
        await admin
          .from("org_members")
          .select("id, role, status")
          .eq("id", id)
          .eq("org_id", session.org_id)
          .maybeSingle();

      if (transferredEmployeeError || !transferredEmployee) {
        return jsonError(
          "Administrator access transferred, but the updated user could not be loaded",
          500,
        );
      }

      return NextResponse.json({
        employee: transferredEmployee,
        message: "Administrator access transferred.",
      });
    }
  }

  const { data, error } = await admin
    .from("org_members")
    .update(updates)
    .eq("id", id)
    .eq("org_id", session.org_id)
    .select("id, role, status")
    .maybeSingle();

  if (error) {
    if (error.code === "23514") {
      return NextResponse.json(
        {
          error:
            "This is the organization's last active administrator. Transfer ownership before continuing.",
          code: "ADMIN_TRANSFER_REQUIRED",
        },
        { status: 409 },
      );
    }
    return jsonError("Unable to update employee", 500);
  }

  if (!data) {
    return jsonError("Employee not found", 404);
  }

  return NextResponse.json({
    employee: {
      id: data.id,
      role: data.role,
      status: data.status,
    },
    message: promotesToAdmin
      ? "Administrator access granted."
      : removesActiveAdmin
        ? "Administrator access updated."
        : "Employee updated.",
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/org/user-management/[id]">,
) {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("org_members")
    .select("id, user_id, role, status")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (membershipError) {
    return jsonError("Unable to validate the invited user", 500);
  }

  if (!membership) {
    return jsonError("Employee not found", 404);
  }

  const { data: authUserData, error: authUserError } =
    await admin.auth.admin.getUserById(membership.user_id);

  if (authUserError || !authUserData.user) {
    return jsonError("Unable to validate the invitation", 500);
  }

  if (!isPendingInvitation(authUserData.user)) {
    return NextResponse.json(
      {
        error:
          "This invitation has already been accepted. The user can no longer be deleted as a pending invite.",
        code: "INVITATION_ALREADY_ACCEPTED",
      },
      { status: 409 },
    );
  }

  const { count, error: membershipCountError } = await admin
    .from("org_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", membership.user_id);

  if (membershipCountError) {
    return jsonError("Unable to validate the invited user's memberships", 500);
  }

  if ((count ?? 0) <= 1) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(
      membership.user_id,
    );

    if (deleteUserError) {
      return jsonError("Unable to delete the pending invitation", 500);
    }
  } else {
    const { error: deleteMembershipError } = await admin
      .from("org_members")
      .delete()
      .eq("id", membership.id)
      .eq("org_id", session.org_id);

    if (deleteMembershipError) {
      return jsonError("Unable to delete the pending invitation", 500);
    }
  }

  return NextResponse.json({
    message: "Pending invitation deleted.",
  });
}
