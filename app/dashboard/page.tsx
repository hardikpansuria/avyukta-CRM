import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CircleDollarSignIcon,
  ClockIcon,
  FilePlusIcon,
  FileTextIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  formatCurrency,
  formatPlainDate,
  QuotationStatusBadge,
} from "./quotations/quotation-ui";

type RecentQuotation = {
  id: string;
  quotation_number?: string | null;
  project_name?: string | null;
  status?: string | null;
  quote_date?: string | null;
  expiry_date?: string | null;
  grand_total_after_tax?: number | string | null;
  grand_total_before_tax?: number | string | null;
};

const openStatuses = ["draft", "pending_approval", "sent"];

export default async function DashboardPage() {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const [
    customersResult,
    quotationsResult,
    openQuotesResult,
    acceptedResult,
    recentResult,
  ] = await Promise.all([
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("org_id", session.org_id)
      .neq("record_status", "deleted"),
    admin
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", session.org_id),
    admin
      .from("quotations")
      .select("grand_total_after_tax, grand_total_before_tax")
      .eq("org_id", session.org_id)
      .in("status", openStatuses),
    admin
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", session.org_id)
      .eq("status", "accepted"),
    admin
      .from("quotations")
      .select(
        "id, quotation_number, project_name, status, quote_date, expiry_date, grand_total_after_tax, grand_total_before_tax",
      )
      .eq("org_id", session.org_id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const openQuotes = openQuotesResult.data ?? [];
  const pipelineTotal = openQuotes.reduce(
    (sum, quotation) =>
      sum +
      Number(
        quotation.grand_total_after_tax ??
          quotation.grand_total_before_tax ??
          0,
      ),
    0,
  );
  const recentQuotations = (recentResult.data ?? []) as RecentQuotation[];
  const firstName =
    session.user.user_metadata?.full_name?.split(" ")[0] ??
    session.user.email?.split("@")[0] ??
    "there";

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {session.org_name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Good to see you, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            Here is the current state of your customer and quotation work.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-9 rounded-md"
            nativeButton={false}
            render={<Link href="/dashboard/customers/new" />}
            variant="outline"
          >
            <PlusIcon data-icon="inline-start" />
            New Customer
          </Button>
          <Button
            className="h-9 rounded-md"
            nativeButton={false}
            render={<Link href="/dashboard/quotations/new" />}
          >
            <FilePlusIcon data-icon="inline-start" />
            New Quotation
          </Button>
        </div>
      </div>

      <section
        aria-label="CRM overview"
        className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          description="Active customer records"
          icon={<UsersIcon />}
          label="Customers"
          value={String(customersResult.count ?? 0)}
        />
        <StatCard
          description="Across all statuses"
          icon={<FileTextIcon />}
          label="Total Quotations"
          value={String(quotationsResult.count ?? 0)}
        />
        <StatCard
          description={`${openQuotes.length} open quotations`}
          icon={<CircleDollarSignIcon />}
          label="Open Pipeline"
          value={formatCurrency(pipelineTotal)}
        />
        <StatCard
          description="Accepted quotations"
          icon={<ClockIcon />}
          label="Won Quotes"
          value={String(acceptedResult.count ?? 0)}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Recent Quotations
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Your latest quotation activity.
              </p>
            </div>
            <Button
              className="h-8 rounded-md"
              nativeButton={false}
              render={<Link href="/dashboard/quotations" />}
              size="sm"
              variant="ghost"
            >
              View all
              <ArrowUpRightIcon data-icon="inline-end" />
            </Button>
          </div>

          {recentQuotations.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="flex size-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <FileTextIcon className="size-5" />
              </div>
              <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                No quotations yet
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Create the first quotation to start tracking activity.
              </p>
              <Button
                className="mt-4 h-8 rounded-md"
                nativeButton={false}
                render={<Link href="/dashboard/quotations/new" />}
                size="sm"
              >
                Create Quotation
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Quotation</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Quote Date</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="w-12 px-4 py-3">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {recentQuotations.map((quotation) => (
                      <tr
                        className="transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        key={quotation.id}
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-zinc-950 dark:text-zinc-50">
                            {quotation.quotation_number ?? "Pending"}
                          </p>
                          <p className="mt-0.5 max-w-64 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {quotation.project_name || "No project name"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <QuotationStatusBadge status={quotation.status} />
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                          {formatPlainDate(quotation.quote_date)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
                          {formatCurrency(
                            quotation.grand_total_after_tax ??
                              quotation.grand_total_before_tax,
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            aria-label={`Open quotation ${quotation.quotation_number ?? ""}`}
                            className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                            href={`/dashboard/quotations/${quotation.id}`}
                          >
                            <ArrowRightIcon className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
                {recentQuotations.map((quotation) => (
                  <Link
                    className="block p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    href={`/dashboard/quotations/${quotation.id}`}
                    key={quotation.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-950 dark:text-zinc-50">
                          {quotation.quotation_number ?? "Pending"}
                        </p>
                        <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                          {quotation.project_name || "No project name"}
                        </p>
                      </div>
                      <QuotationStatusBadge status={quotation.status} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {formatPlainDate(quotation.quote_date)}
                      </span>
                      <span className="font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                        {formatCurrency(
                          quotation.grand_total_after_tax ??
                            quotation.grand_total_before_tax,
                        )}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              Quick Actions
            </h2>
            <div className="mt-4 space-y-2">
              <QuickAction
                description="Start a new customer record"
                href="/dashboard/customers/new"
                icon={<UsersIcon />}
                label="Add Customer"
              />
              <QuickAction
                description="Build and price a new quote"
                href="/dashboard/quotations/new"
                icon={<FilePlusIcon />}
                label="Create Quotation"
              />
              <QuickAction
                description="Review active quotation work"
                href="/dashboard/quotations"
                icon={<FileTextIcon />}
                label="Review Pipeline"
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase text-zinc-400">
              Current workspace
            </p>
            <p className="mt-2 text-base font-semibold">{session.org_name}</p>
            <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4 text-sm">
              <span className="text-zinc-400">Your role</span>
              <span className="capitalize text-zinc-100">{session.role}</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            {value}
          </p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600 [&_svg]:size-4 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      className="flex items-center gap-3 rounded-md border border-transparent p-3 transition hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900"
      href={href}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 [&_svg]:size-4 dark:bg-zinc-800 dark:text-zinc-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-zinc-400" />
    </Link>
  );
}
