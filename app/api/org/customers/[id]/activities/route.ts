import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type ActivityRow = {
  actor_id?: string | null;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/org/customers/[id]/activities">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const activityType = searchParams.get("activity_type")?.trim() ?? "";
  const dateFrom = searchParams.get("date_from")?.trim() ?? "";
  const dateTo = searchParams.get("date_to")?.trim() ?? "";

  const admin = createAdminClient();
  let query = admin
    .from("customer_activities")
    .select("*")
    .eq("org_id", session.org_id)
    .eq("customer_id", id)
    .order("occurred_at", { ascending: false });

  if (activityType) {
    query = query.eq("activity_type", activityType);
  }

  if (dateFrom) {
    query = query.gte("occurred_at", `${dateFrom}T00:00:00.000Z`);
  }

  if (dateTo) {
    query = query.lte("occurred_at", `${dateTo}T23:59:59.999Z`);
  }

  const { data: activities, error } = await query;

  if (error) {
    return jsonError("Unable to fetch activities", 500);
  }

  const actorIds = Array.from(
    new Set(
      ((activities ?? []) as ActivityRow[])
        .map((activity) => activity.actor_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const { data: profiles, error: profilesError } =
    actorIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", actorIds)
      : { data: [], error: null };

  if (profilesError) {
    return jsonError("Unable to fetch activity users", 500);
  }

  const profilesById = new Map<string, ProfileRow>();
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    profilesById.set(profile.id, profile);
  }

  return NextResponse.json({
    activities: (activities ?? []).map((activity) => ({
      ...activity,
      actor: activity.actor_id
        ? (profilesById.get(activity.actor_id as string) ?? null)
        : null,
    })),
  });
}
