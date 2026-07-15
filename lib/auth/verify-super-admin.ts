import type { User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SuperAdminSession = {
  user: User;
  email: string;
};

export async function verifySuperAdmin(): Promise<SuperAdminSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const admin = createAdminClient();
  const { data: superAdmin, error: superAdminError } = await admin
    .from("super_admins")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();

  if (superAdminError || !superAdmin) {
    return null;
  }

  return {
    user,
    email: superAdmin.email,
  };
}
