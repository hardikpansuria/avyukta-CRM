import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type CustomerActivityInput = {
  org_id: string;
  customer_id: string;
  activity_type: string;
  description: string;
  actor_id: string;
  linked_record_type?: string | null;
  linked_record_id?: string | null;
  linked_record_number?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logCustomerActivity(
  admin: AdminClient,
  input: CustomerActivityInput,
) {
  await admin.from("customer_activities").insert({
    org_id: input.org_id,
    customer_id: input.customer_id,
    activity_type: input.activity_type,
    description: input.description,
    actor_id: input.actor_id,
    linked_record_type: input.linked_record_type ?? null,
    linked_record_id: input.linked_record_id ?? null,
    linked_record_number: input.linked_record_number ?? null,
    metadata: input.metadata ?? {},
  });
}
