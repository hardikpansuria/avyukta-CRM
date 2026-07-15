import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginBody = {
  org_code?: unknown;
  email?: unknown;
  password?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function clearOrgContextCookie() {
  const cookieStore = await cookies();
  cookieStore.set("org_context", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const orgCode =
    typeof body.org_code === "string" ? body.org_code.trim().toLowerCase() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!orgCode || !email || !password) {
    return jsonError("Org code, email, and password are required", 400);
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    return jsonError("Invalid email or password", 401);
  }

  const admin = createAdminClient();
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, org_code, name")
    .eq("org_code", orgCode)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError || !organization) {
    await supabase.auth.signOut();
    await clearOrgContextCookie();
    return jsonError("Invalid org code", 401);
  }

  const { data: membership, error: membershipError } = await admin
    .from("org_members")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("org_id", organization.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    await supabase.auth.signOut();
    await clearOrgContextCookie();
    return jsonError("You are not a member of this organization", 403);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "org_context",
    JSON.stringify({
      org_id: organization.id,
      org_code: organization.org_code,
      org_name: organization.name,
      role: membership.role,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  );

  return NextResponse.json({ success: true });
}
