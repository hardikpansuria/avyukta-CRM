import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { verifySuperAdmin } from "@/lib/auth/verify-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

type CreateOrganizationBody = {
  name?: unknown;
  org_code?: unknown;
  admin_email?: unknown;
  admin_full_name?: unknown;
};

type OrganizationRow = {
  id: string;
  name: string;
  org_code: string;
  status: string;
  created_at?: string | null;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function requireSuperAdmin() {
  const session = await verifySuperAdmin();

  if (!session) {
    return null;
  }

  return session;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<User | null> {
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (page <= 100) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (currentUser) => currentUser.email?.toLowerCase() === normalizedEmail,
    );

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }

  return null;
}

export async function GET() {
  const session = await requireSuperAdmin();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return jsonError("Unable to fetch organizations", 500);
  }

  const organizations = (data ?? []).map((organization) => ({
    id: organization.id,
    name: organization.name,
    org_code: organization.org_code,
    status: organization.status,
    created_at:
      "created_at" in organization
        ? (organization.created_at as string | null)
        : null,
  })) satisfies OrganizationRow[];

  return NextResponse.json({ organizations });
}

export async function POST(request: Request) {
  const session = await requireSuperAdmin();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  let body: CreateOrganizationBody;

  try {
    body = (await request.json()) as CreateOrganizationBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const orgCode =
    typeof body.org_code === "string" ? body.org_code.trim().toLowerCase() : "";
  const adminEmail =
    typeof body.admin_email === "string"
      ? body.admin_email.trim().toLowerCase()
      : "";
  const adminFullName =
    typeof body.admin_full_name === "string"
      ? body.admin_full_name.trim()
      : "";

  if (!name || !orgCode || !adminEmail || !adminFullName) {
    return jsonError("All fields are required", 400);
  }

  if (!/^[a-z0-9]+$/.test(orgCode)) {
    return jsonError("Org code must use lowercase letters and numbers only", 400);
  }

  const admin = createAdminClient();
  const { data: existingOrganization, error: existingOrganizationError } =
    await admin
      .from("organizations")
      .select("id")
      .eq("org_code", orgCode)
      .maybeSingle();

  if (existingOrganizationError) {
    return jsonError("Unable to validate org code", 500);
  }

  if (existingOrganization) {
    return jsonError("Org code is already taken", 409);
  }

  const organizationId = crypto.randomUUID();
  const { data: createdOrganization, error: createOrganizationError } =
    await admin
      .from("organizations")
      .insert({
        id: organizationId,
        name,
        org_code: orgCode,
        status: "active",
      })
      .select("id, name, org_code, status")
      .single();

  if (createOrganizationError || !createdOrganization) {
    return jsonError("Unable to create organization", 500);
  }

  let userId: string;

  try {
    const existingUser = await findAuthUserByEmail(admin, adminEmail);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

      if (!siteUrl) {
        return jsonError("Missing NEXT_PUBLIC_SITE_URL", 500);
      }

      const { data: inviteData, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(adminEmail, {
          redirectTo: `${siteUrl}/auth/reset-password`,
          data: {
            full_name: adminFullName,
          },
        });

      if (inviteError || !inviteData.user) {
        return jsonError("Unable to invite first admin", 500);
      }

      userId = inviteData.user.id;
    }
  } catch {
    return jsonError("Unable to check admin user", 500);
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email: adminEmail,
    full_name: adminFullName,
    status: "active",
  });

  if (profileError) {
    return jsonError("Unable to create admin profile", 500);
  }

  const { data: existingMembership, error: existingMembershipError } =
    await admin
      .from("org_members")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", createdOrganization.id)
      .maybeSingle();

  if (existingMembershipError) {
    return jsonError("Unable to validate organization membership", 500);
  }

  if (existingMembership) {
    return jsonError("This user is already a member of this organization", 409);
  }

  const { error: membershipError } = await admin.from("org_members").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    org_id: createdOrganization.id,
    role: "admin",
    status: "active",
  });

  if (membershipError) {
    if (membershipError.code === "23505") {
      return jsonError(
        "This user is already a member of this organization",
        409,
      );
    }

    return jsonError("Unable to create organization admin membership", 500);
  }

  return NextResponse.json(
    {
      organization: createdOrganization,
      message: "Organization created",
    },
    { status: 201 },
  );
}
