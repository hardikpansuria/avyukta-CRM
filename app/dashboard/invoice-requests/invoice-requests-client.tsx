"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardListIcon, PlusIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InvoiceRequest = {
  id: string;
  request_number: number | string;
  job_number_snapshot?: string | null;
  customer_name_snapshot: string;
  invoice_type: string;
  requested_amount: number | string;
  currency: string;
  status: string;
  created_at: string;
  requester?: { full_name?: string | null; email?: string | null } | null;
};

function title(value: string) {
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Number(value));
}

export function InvoiceRequestsClient({ canCreate }: { canCreate: boolean }) {
  const [requests, setRequests] = useState<InvoiceRequest[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      try {
        const response = await fetch(`/api/org/invoice-requests${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { requests?: InvoiceRequest[]; error?: string }
          | null;
        if (!response.ok) setError(payload?.error ?? "Unable to load invoice requests.");
        else {
          setRequests(payload?.requests ?? []);
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted) setError("Unable to load invoice requests.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [status]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) =>
      [request.job_number_snapshot, request.customer_name_snapshot, request.request_number]
        .some((value) => String(value ?? "").toLowerCase().includes(query)),
    );
  }, [requests, search]);
  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <ClipboardListIcon className="size-4" /> Sales to Accounts
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Invoice Requests</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {pendingCount} request{pendingCount === 1 ? "" : "s"} pending Accounts review.
          </p>
        </div>
        {canCreate ? (
          <Button nativeButton={false} render={<Link href="/dashboard/invoice-requests/new" />}>
            <PlusIcon /> Request Invoice
          </Button>
        ) : null}
      </div>
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input
            aria-label="Search requests"
            placeholder="Search job, customer, or request number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={status} onValueChange={(value) => setStatus(String(value))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {[
                "pending",
                "under_review",
                "invoice_created",
                "sent_to_customer",
                "paid",
                "archived",
              ].map((value) => <SelectItem key={value} value={value}>{title(value)}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead><TableHead>Job</TableHead><TableHead>Customer</TableHead>
                <TableHead>Requested By</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead>
                <TableHead>Status</TableHead><TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">IR-{String(request.request_number).padStart(3, "0")}</TableCell>
                  <TableCell>{request.job_number_snapshot ?? "-"}</TableCell>
                  <TableCell>{request.customer_name_snapshot}</TableCell>
                  <TableCell>{request.requester?.full_name ?? request.requester?.email ?? "-"}</TableCell>
                  <TableCell>{title(request.invoice_type)}</TableCell>
                  <TableCell>{money(request.requested_amount, request.currency)}</TableCell>
                  <TableCell><Badge variant="outline">{title(request.status)}</Badge></TableCell>
                  <TableCell>
                    <Button nativeButton={false} render={<Link href={`/dashboard/invoice-requests/${request.id}`} />} size="sm" variant="outline">Open</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !filtered.length ? (
                <TableRow><TableCell className="py-10 text-center text-zinc-500" colSpan={8}>No invoice requests found.</TableCell></TableRow>
              ) : null}
              {loading ? <TableRow><TableCell className="py-10 text-center text-zinc-500" colSpan={8}>Loading requests...</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
