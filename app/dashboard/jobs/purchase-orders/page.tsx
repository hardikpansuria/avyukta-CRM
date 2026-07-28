"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchIcon, WorkflowIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PurchaseOrder = {
  id: string;
  po_number: string;
  po_received_date: string;
  currency: string;
  combined_quotation_total: number | string;
  combined_po_total: number | string;
  difference_amount: number | string;
  job_count: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  customer?: { company_name?: string | null } | null;
  production_summary: Array<{ status: string; count: number }>;
};

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(Number(value ?? 0));
}

function title(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PurchaseOrdersPage() {
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (debounced) params.set("search", debounced);
    return params.toString();
  }, [debounced, page]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/org/job-purchase-orders?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              purchase_orders?: PurchaseOrder[];
              pagination?: { totalPages: number };
              error?: string;
            }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load purchase orders.");
          return;
        }
        setItems(payload?.purchase_orders ?? []);
        setTotalPages(payload?.pagination?.totalPages ?? 1);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load purchase orders.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <WorkflowIcon className="size-4" />
          Job on the Go
        </div>
        <h1 className="mt-1 text-2xl font-semibold">PO Received</h1>
        <p className="mt-1 text-sm text-zinc-500">
          One row per customer purchase order, including all allocated jobs.
        </p>
      </div>
      <div className="flex gap-2 border-b pb-3">
        <Button
          nativeButton={false}
          render={<Link href="/dashboard/jobs/po-pending" />}
          variant="ghost"
        >
          PO Pending
        </Button>
        <Button variant="secondary">PO Received</Button>
      </div>
      <Card>
        <CardContent className="space-y-4">
          <label className="relative block max-w-xl">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="pl-9"
              placeholder="Search PO, job, quotation, customer, or project"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {error ? (
            <div className="rounded-2xl border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton className="h-16" key={index} />
              ))}
            </div>
          ) : null}
          {!loading && !items.length ? (
            <div className="min-h-52 rounded-2xl border border-dashed p-10 text-center text-sm text-zinc-500">
              No purchase orders found.
            </div>
          ) : null}
          {!loading && items.length ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>PO Date</TableHead>
                      <TableHead>Jobs</TableHead>
                      <TableHead>Quotation Total</TableHead>
                      <TableHead>PO Total</TableHead>
                      <TableHead>Difference</TableHead>
                      <TableHead>Production</TableHead>
                      <TableHead>Invoices</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">
                          <Link
                            className="hover:underline"
                            href={`/dashboard/jobs/purchase-orders/${po.id}`}
                          >
                            {po.po_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {po.customer?.company_name ?? "-"}
                        </TableCell>
                        <TableCell>{po.po_received_date}</TableCell>
                        <TableCell>{po.job_count}</TableCell>
                        <TableCell>
                          {money(po.combined_quotation_total, po.currency)}
                        </TableCell>
                        <TableCell>
                          {money(po.combined_po_total, po.currency)}
                        </TableCell>
                        <TableCell>
                          {money(po.difference_amount, po.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {po.production_summary.map((item) => (
                              <Badge key={item.status} variant="outline">
                                {item.count} {title(item.status)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p>Invoiced {money(po.invoiced, po.currency)}</p>
                          <p className="text-zinc-500">
                            Outstanding {money(po.outstanding, po.currency)}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {items.map((po) => (
                  <Link
                    href={`/dashboard/jobs/purchase-orders/${po.id}`}
                    key={po.id}
                  >
                    <Card className="transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <CardContent className="space-y-3">
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-semibold">{po.po_number}</p>
                            <p className="text-sm text-zinc-500">
                              {po.customer?.company_name ?? "-"}
                            </p>
                          </div>
                          <Badge variant="outline">{po.job_count} Jobs</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-zinc-500">PO Total</p>
                            <p>{money(po.combined_po_total, po.currency)}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Outstanding</p>
                            <p>{money(po.outstanding, po.currency)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
          {totalPages > 1 ? (
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                disabled={page === 1}
                size="sm"
                variant="outline"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <span className="py-1 text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                disabled={page >= totalPages}
                size="sm"
                variant="outline"
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

