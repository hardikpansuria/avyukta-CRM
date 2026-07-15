import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OrgContext = {
  org_id: string;
};

type OrgSession = {
  user: User;
  org_id: string;
  role: string;
  org_code: string;
  org_name: string;
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

export async function verifyOrgSession(): Promise<OrgSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const cookieStore = await cookies();
  const orgContext = parseOrgContext(cookieStore.get("org_context")?.value);

  if (!orgContext) {
    return null;
  }

  const admin = createAdminClient();
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

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, org_code, name")
    .eq("id", orgContext.org_id)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError || !organization) {
    return null;
  }

  return {
    user,
    org_id: membership.org_id,
    role: membership.role,
    org_code: organization.org_code,
    org_name: organization.name,
  };
}
