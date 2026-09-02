import { NextResponse } from "next/server";

import { buildAuthRedirectUrl } from "@/lib/auth/auth-redirect-url";
import { findAuthUserByEmail } from "@/lib/auth/find-auth-user-by-email";
import { buildInvitationEmailData } from "@/lib/auth/invitation-email";
import { isPendingInvitation } from "@/lib/auth/invitation-status";
import { authorizeOrgRequest } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type CreateEmployeeBody = {
  email?: unknown;
  full_name?: unknown;
  role?: unknown;
};

type ProfileEmbed =
  | {
      email?: string | null;
      full_name?: string | null;
    }
  | {
      email?: string | null;
      full_name?: string | null;
    }[]
  | null;

type MembershipRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at?: string | null;
  profiles?: ProfileEmbed;
};

const employeeRoles = new Set(["accountant", "sales"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getProfile(profile: ProfileEmbed) {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile;
}

export async function GET() {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("org_members")
    .select("*, profiles(email, full_name)")
    .eq("org_id", session.org_id)
    .order("role", { ascending: true });

  if (error) {
    return jsonError("Unable to fetch employees", 500);
  }

  const invitationStates = new Map<
    string,
    { pending: boolean; invitedAt: string | null }
  >();

  await Promise.all(
    ((data ?? []) as MembershipRow[]).map(async (membership) => {
      const { data: authUserData, error: authUserError } =
        await admin.auth.admin.getUserById(membership.user_id);

      if (authUserError || !authUserData.user) {
        console.error("Unable to load employee invitation status", {
          membershipId: membership.id,
          code: authUserError?.code,
          message: authUserError?.message,
        });
        return;
      }

      invitationStates.set(membership.user_id, {
        pending: isPendingInvitation(authUserData.user),
        invitedAt: authUserData.user.invited_at ?? null,
      });
    }),
  );

  const employees = ((data ?? []) as MembershipRow[]).map((membership) => {
    const profile = getProfile(membership.profiles ?? null);
    const invitation = invitationStates.get(membership.user_id);

    return {
      id: membership.id,
      user_id: membership.user_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      role: membership.role,
      status: membership.status,
      member_since: membership.created_at ?? null,
      invitation_pending: invitation?.pending === true,
      invited_at: invitation?.invitedAt ?? null,
    };
  });

  return NextResponse.json({
    employees,
    can_manage_admins: session.role === "admin",
  });
}

export async function POST(request: Request) {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  let body: CreateEmployeeBody;

  try {
    body = (await request.json()) as CreateEmployeeBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName =
    typeof body.full_name === "string" ? body.full_name.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";

  if (!email || !fullName || !role) {
    return jsonError("Email, full name, and role are required", 400);
  }

  if (!employeeRoles.has(role)) {
    return jsonError("Role must be accountant or sales", 400);
  }

  const admin = createAdminClient();
  let userId: string;

  try {
    const existingUser = await findAuthUserByEmail(admin, email);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

      if (!siteUrl) {
        return jsonError("Missing NEXT_PUBLIC_SITE_URL", 500);
      }

      const { data: inviteData, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: buildInvitationEmailData({
            fullName,
            organizationName: session.org_name,
            organizationCode: session.org_code,
          }),
          redirectTo: buildAuthRedirectUrl(siteUrl, "/auth/reset-password"),
        });

      if (inviteError || !inviteData.user) {
        return jsonError("Unable to invite employee", 500);
      }

      userId = inviteData.user.id;
    }
  } catch {
    return jsonError("Unable to check employee user", 500);
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    status: "active",
  });

  if (profileError) {
    return jsonError("Unable to save employee profile", 500);
  }

  const { error: membershipError } = await admin.from("org_members").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    org_id: session.org_id,
    role,
    status: "active",
  });

  if (membershipError) {
    if (membershipError.code === "23505") {
      return jsonError(
        "This user is already a member of your organization",
        409,
      );
    }

    return jsonError("Unable to create employee membership", 500);
  }

  return NextResponse.json(
    {
      message: "Employee invited",
    },
    { status: 201 },
  );
}
