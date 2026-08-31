import { NextResponse } from "next/server";

import { buildAuthRedirectUrl } from "@/lib/auth/auth-redirect-url";
import { isPendingInvitation } from "@/lib/auth/invitation-status";
import { authorizeOrgRequest } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type ProfileEmbed =
  | { email?: string | null; full_name?: string | null }
  | { email?: string | null; full_name?: string | null }[]
  | null;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getProfile(profile: ProfileEmbed) {
  return Array.isArray(profile) ? (profile[0] ?? null) : profile;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("org_members")
    .select("id, user_id, profiles(email, full_name)")
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
        error: "This invitation has already been accepted.",
        code: "INVITATION_ALREADY_ACCEPTED",
      },
      { status: 409 },
    );
  }

  const profile = getProfile(membership.profiles as ProfileEmbed);
  const email = authUserData.user.email ?? profile?.email;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!email) {
    return jsonError("The invited user does not have an email address", 500);
  }

  if (!siteUrl) {
    return jsonError("Missing NEXT_PUBLIC_SITE_URL", 500);
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name: profile?.full_name ?? undefined },
      redirectTo: buildAuthRedirectUrl(siteUrl, "/auth/reset-password"),
    },
  );

  if (inviteError) {
    console.error("Unable to resend employee invitation", {
      membershipId: membership.id,
      code: inviteError.code,
      message: inviteError.message,
    });
    return jsonError("Unable to resend the invitation email", 500);
  }

  return NextResponse.json({
    message: `Invitation resent to ${email}.`,
  });
}
