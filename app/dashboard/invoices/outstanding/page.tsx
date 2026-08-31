"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  FileDownIcon,
  PrinterIcon,
  SheetIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OutstandingCustomerGroup } from "@/lib/invoices/outstanding";

function money(value: number | string, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(Number(value ?? 0));
}

export default function OutstandingInvoicesPage() {
  const [groups, setGroups] = useState<OutstandingCustomerGroup[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/org/job-invoices/outstanding", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              groups?: OutstandingCustomerGroup[];
              grand_total?: number;
              invoice_count?: number;
              error?: string;
            }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load outstanding invoices.");
          return;
        }
        setGroups(payload?.groups ?? []);
        setGrandTotal(payload?.grand_total ?? 0);
        setInvoiceCount(payload?.invoice_count ?? 0);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load outstanding invoices.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="no-print">
        <Button
          nativeButton={false}
          render={<Link href="/dashboard/invoices" />}
          variant="ghost"
        >
          <ArrowLeftIcon />
          Back to Invoices
        </Button>
      </div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm text-zinc-500">Accounts Receivable</p>
          <h1 className="text-2xl font-semibold">Outstanding Invoices</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Aging begins at the sent timestamp and excludes paid invoices.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <PrinterIcon />
            Print
          </Button>
          <Button
            nativeButton={false}
            render={
              <a href="/api/org/job-invoices/outstanding?format=pdf" download />
            }
            variant="outline"
          >
            <FileDownIcon />
            Export PDF
          </Button>
          <Button
            nativeButton={false}
            render={
              <a href="/api/org/job-invoices/outstanding?format=xls" download />
            }
          >
            <SheetIcon />
            Export Excel
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Grand Outstanding
            </p>
            <p className="mt-2 text-xl font-semibold">
              {money(grandTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Outstanding Invoices
            </p>
            <p className="mt-2 text-xl font-semibold">{invoiceCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Customers
            </p>
            <p className="mt-2 text-xl font-semibold">{groups.length}</p>
          </CardContent>
        </Card>
      </div>
      {error ? (
        <div className="rounded-2xl border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-44" key={index} />
          ))}
        </div>
      ) : null}
      {!loading && !groups.length ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-zinc-500">
            No sent invoices are currently outstanding.
          </CardContent>
        </Card>
      ) : null}
      {!loading
        ? groups.map((group) => (
            <Card key={group.customer_id}>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>{group.customer_name}</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    {group.invoices.length} outstanding invoice
                    {group.invoices.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Customer Total
                  </p>
                  <p className="font-semibold">
                    {money(group.total_outstanding, group.currency)}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Sent Date</TableHead>
                      <TableHead>Invoice Amount</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Aging</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.invoices.map((invoice) => (
                      <TableRow key={invoice.invoice_id}>
                        <TableCell>
                          <Link
                            className="font-medium hover:underline"
                            href={`/dashboard/invoices/${invoice.invoice_id}`}
                          >
                            {invoice.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell>{invoice.job_number ?? "-"}</TableCell>
                        <TableCell>{invoice.po_number ?? "-"}</TableCell>
                        <TableCell>{invoice.invoice_date}</TableCell>
                        <TableCell>
                          {new Date(invoice.sent_at).toLocaleDateString("en-CA")}
                        </TableCell>
                        <TableCell>
                          {money(invoice.invoice_amount, invoice.currency)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {money(
                            invoice.outstanding_balance,
                            invoice.currency,
                          )}
                        </TableCell>
                        <TableCell>{invoice.days_outstanding}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {invoice.aging_bucket}
                          </Badge>
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
