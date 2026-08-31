import type { User } from "@supabase/supabase-js";

type InvitationStatusUser = Pick<
  User,
  "invited_at" | "confirmed_at" | "email_confirmed_at"
>;

export function isPendingInvitation(user: InvitationStatusUser) {
  return Boolean(
    user.invited_at && !user.confirmed_at && !user.email_confirmed_at,
  );
}
