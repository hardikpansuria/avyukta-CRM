"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardListIcon,
  FilePlus2Icon,
  ReceiptTextIcon,
  SearchIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number | string;
  currency: string;
  status: string;
  sent_at?: string | null;
  days_outstanding: number;
  aging_bucket: string;
  job?: { job_number?: string | null } | null;
};

type Group = {
  purchase_order: {
    id: string;
    po_number: string;
    currency: string;
    combined_po_total: number | string;
    current_po_total: number | string;
  };
  customer?: { company_name?: string | null } | null;
  invoices: Invoice[];
  invoiced: number;
  paid: number;
  outstanding: number;
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

export default function InvoicesPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [filters, setFilters] = useState({
    customer: "",
    po: "",
    job: "",
    invoice: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    aging: "",
  });
  const [debounced, setDebounced] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [canViewRequests, setCanViewRequests] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(filters), 350);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(debounced).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [debounced]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/org/job-invoices${query ? `?${query}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              groups?: Group[];
              permissions?: {
                can_create?: boolean;
                can_view_requests?: boolean;
              };
              error?: string;
            }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load invoices.");
          return;
        }
        setGroups(payload?.groups ?? []);
        setCanCreate(payload?.permissions?.can_create === true);
        setCanViewRequests(
          payload?.permissions?.can_view_requests === true,
        );
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load invoices.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query]);

  const update = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <ReceiptTextIcon className="size-4" />
            Accounts Receivable
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Invoices</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Invoices grouped by customer purchase order.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewRequests ? (
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/invoice-requests" />}
              variant="outline"
            >
              <ClipboardListIcon />
              Invoice Requests
            </Button>
          ) : null}
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/invoices/outstanding" />}
            variant="outline"
          >
            Outstanding
          </Button>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/invoices/new" />}
            >
              <FilePlus2Icon />
              Upload Invoice
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["customer", "Customer"],
            ["po", "PO Number"],
            ["job", "Job Number"],
            ["invoice", "Invoice Number"],
          ].map(([key, placeholder]) => (
            <label className="relative" key={key}>
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                className="pl-9"
                placeholder={placeholder}
                value={filters[key as keyof typeof filters]}
                onChange={(event) =>
                  update(key as keyof typeof filters, event.target.value)
                }
              />
            </label>
          ))}
          <Select
            value={filters.status || "all"}
            onValueChange={(value) =>
              update("status", value === "all" ? "" : String(value))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="payment_received">Payment Received</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.aging || "all"}
            onValueChange={(value) =>
              update("aging", value === "all" ? "" : String(value))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All aging buckets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All aging buckets</SelectItem>
              <SelectItem value="current">Current / Not Sent</SelectItem>
              <SelectItem value="1_30">1–30 days</SelectItem>
              <SelectItem value="31_60">31–60 days</SelectItem>
              <SelectItem value="61_90">61–90 days</SelectItem>
              <SelectItem value="91_plus">91+ days</SelectItem>
            </SelectContent>
          </Select>
          <Input
            aria-label="Invoice date from"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => update("dateFrom", event.target.value)}
          />
          <Input
            aria-label="Invoice date to"
            type="date"
            value={filters.dateTo}
            onChange={(event) => update("dateTo", event.target.value)}
          />
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-2xl border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-40" key={index} />
          ))}
        </div>
      ) : null}
      {!loading && !groups.length ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-zinc-500">
            No invoices match the selected filters.
          </CardContent>
        </Card>
      ) : null}
      {!loading
        ? groups.map((group) => (
            <Card key={group.purchase_order.id}>
              <CardHeader>
                <div className="flex flex-col justify-between gap-3 sm:flex-row">
                  <div>
                    <CardTitle>{group.purchase_order.po_number}</CardTitle>
                    <p className="mt-1 text-sm text-zinc-500">
                      {group.customer?.company_name ?? "-"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-zinc-500">PO Total</p>
                      <p className="font-medium">
                        {money(
                          group.purchase_order.current_po_total,
                          group.purchase_order.currency,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Invoiced</p>
                      <p className="font-medium">
                        {money(group.invoiced, group.purchase_order.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Paid</p>
                      <p className="font-medium">
                        {money(group.paid, group.purchase_order.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Outstanding</p>
                      <p className="font-medium">
                        {money(
                          group.outstanding,
                          group.purchase_order.currency,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Number</TableHead>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Days Outstanding</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{invoice.job?.job_number ?? "-"}</TableCell>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>{invoice.invoice_date}</TableCell>
                        <TableCell>
                          {money(invoice.invoice_amount, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {title(invoice.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.sent_at ? invoice.days_outstanding : "Not sent"}
                        </TableCell>
                        <TableCell>
                          <Button
                            nativeButton={false}
                            render={
                              <Link href={`/dashboard/invoices/${invoice.id}`} />
                            }
                            size="sm"
                            variant="outline"
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        : null}
    </div>
  );
}
