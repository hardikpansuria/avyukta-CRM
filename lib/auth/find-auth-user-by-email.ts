import type { User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

export async function findAuthUserByEmail(
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
