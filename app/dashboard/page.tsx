import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";

const comingSoonCards = ["Customers", "Deals", "Tasks"];

export default async function DashboardPage() {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          Welcome to {session.org_name}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {session.user.email} · <span className="capitalize">{session.role}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {comingSoonCards.map((card) => (
          <section
            className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
            key={card}
          >
            <p className="text-lg font-semibold text-zinc-950">{card}</p>
            <p className="mt-2 text-sm text-zinc-500">Coming soon</p>
          </section>
        ))}
      </div>
    </div>
  );
}
