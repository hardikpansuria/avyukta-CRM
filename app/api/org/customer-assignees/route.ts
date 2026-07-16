import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

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
  user_id: string;
  role: string;
  profiles?: ProfileEmbed;
};

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
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("org_members")
    .select("user_id, role, profiles(email, full_name)")
    .eq("org_id", session.org_id)
    .eq("status", "active")
    .order("role", { ascending: true });

  if (error) {
    return jsonError("Unable to fetch assignees", 500);
  }

  const assignees = ((data ?? []) as MembershipRow[]).map((membership) => {
    const profile = getProfile(membership.profiles ?? null);

    return {
      id: membership.user_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      role: membership.role,
    };
  });

  return NextResponse.json({ assignees });
}
