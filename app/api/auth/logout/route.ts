import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function clearContextCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  name: string,
) {
  cookieStore.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  clearContextCookie(cookieStore, "org_context");
  clearContextCookie(cookieStore, "sa_context");

  return NextResponse.json({ success: true });
}
