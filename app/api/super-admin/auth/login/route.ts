import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonError("Email and password are required", 400);
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
  const { data: superAdmin, error: superAdminError } = await admin
    .from("super_admins")
    .select("id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (superAdminError || !superAdmin) {
    await supabase.auth.signOut();
    return jsonError("Not authorized as super admin", 403);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "sa_context",
    JSON.stringify({
      is_super_admin: true,
      email,
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
