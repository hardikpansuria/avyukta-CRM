import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OrgContext = {
  org_id: string;
};

export type OrgSession = {
  user: User;
  org_id: string;
  role: string;
  org_code: string;
  org_name: string;
  logo_storage_path?: string | null;
};

function parseOrgContext(value: string | undefined): OrgContext | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<OrgContext>;

    if (typeof parsed.org_id !== "string" || parsed.org_id.length === 0) {
      return null;
    }

    return { org_id: parsed.org_id };
  } catch {
    return null;
  }
}

async function verifyOrgSessionUncached(): Promise<OrgSession | null> {
  const cookieStore = await cookies();
  const orgContext = parseOrgContext(cookieStore.get("org_context")?.value);

  if (!orgContext) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();
  const [userResult, organizationResult] = await Promise.all([
    supabase.auth.getUser(),
    admin
      .from("organizations")
      .select("id, org_code, name, logo_storage_path")
      .eq("id", orgContext.org_id)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  const {
    data: { user },
    error: userError,
  } = userResult;

  if (userError || !user) {
    return null;
  }

  const { data: organization, error: organizationError } = organizationResult;

  if (organizationError || !organization) {
    return null;
  }

  const { data: membership, error: membershipError } = await admin
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("org_id", orgContext.org_id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    return null;
  }

  return {
    user,
    org_id: membership.org_id,
    role: membership.role,
    org_code: organization.org_code,
    org_name: organization.name,
    logo_storage_path: organization.logo_storage_path,
  };
}

// Layouts and pages frequently verify the same session during one render pass.
// React cache keeps that authorization work request-scoped and avoids duplicate
// Auth and database round trips without persisting session data between users.
export const verifyOrgSession = cache(verifyOrgSessionUncached);
