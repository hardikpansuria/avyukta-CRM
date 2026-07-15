import { createAdminClient } from "@/lib/supabase/admin";

async function getDashboardStats() {
  const admin = createAdminClient();
  const [{ count: organizationCount }, { count: activeMemberCount }] =
    await Promise.all([
      admin.from("organizations").select("*", { count: "exact", head: true }),
      admin
        .from("org_members")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  return {
    organizationCount: organizationCount ?? 0,
    activeMemberCount: activeMemberCount ?? 0,
  };
}

export default async function SuperAdminDashboardPage() {
  const { organizationCount, activeMemberCount } = await getDashboardStats();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">
          System-level organization overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">
            Total organizations
          </p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {organizationCount}
          </p>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">
            Total active org members
          </p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {activeMemberCount}
          </p>
        </section>
      </div>
    </div>
  );
}
