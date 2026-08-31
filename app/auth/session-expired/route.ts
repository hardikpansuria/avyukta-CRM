import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { shouldClearExpiredSessionCookie } from "@/lib/auth/session-cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Invalid or incomplete refresh-token state can make signOut fail. The
    // explicit cookie expiry below is the authoritative local cleanup.
  }

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (!shouldClearExpiredSessionCookie(cookie.name)) continue;
    cookieStore.set(cookie.name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  const requestUrl = new URL(request.url);
  const loginPath =
    requestUrl.searchParams.get("area") === "super-admin"
      ? "/super-admin/login"
      : "/login";
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set("reason", "session_expired");
  return NextResponse.redirect(loginUrl, 303);
}
