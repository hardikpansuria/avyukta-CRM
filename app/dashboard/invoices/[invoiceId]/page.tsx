"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  ExternalLinkIcon,
  UploadIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number | string;
  currency: string;
  status: string;
  sent_at?: string | null;
  payment_date?: string | null;
  payment_reference_number?: string | null;
  payment_notes?: string | null;
  remarks?: string | null;
  days_outstanding: number;
  aging_bucket: string;
  outstanding_balance: number;
  job?: { id: string; job_number?: string | null } | null;
  purchase_order?: { id: string; po_number?: string | null } | null;
  customer?: { company_name?: string | null } | null;
  quotation?: { quotation_number?: string | null } | null;
  documents: Array<{ id: string; file_name: string; uploaded_at?: string | null }>;
  status_history: Array<{
    id: string;
    previous_status?: string | null;
    new_status: string;
    changed_at: string;
    payment_date?: string | null;
    payment_reference_number?: string | null;
  }>;
  invoice_request?: {
    id: string;
    request_number: number | string;
    status: string;
  } | null;
};

type InvoicePermissions = {
  can_edit: boolean;
  can_update_status: boolean;
  can_record_payment: boolean;
};

function title(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(Number(value ?? 0));
}

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [permissions, setPermissions] = useState<InvoicePermissions>({
    can_edit: false,
    can_update_status: false,
    can_record_payment: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [pendingStatus, setPendingStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/org/job-invoices/${invoiceId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { invoice?: Invoice; permissions?: InvoicePermissions; error?: string }
          | null;
        if (!response.ok || !payload?.invoice) {
          setError(payload?.error ?? "Unable to load invoice.");
          return;
        }
        setInvoice(payload.invoice);
        setPermissions(
          payload.permissions ?? {
            can_edit: false,
            can_update_status: false,
            can_record_payment: false,
          },
        );
        setError(null);
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load invoice.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [invoiceId, refresh]);

  async function confirmStatus() {
    if (!pendingStatus || updating) return;
    setUpdating(true);
    const response = await fetch(`/api/org/job-invoices/${invoiceId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: pendingStatus,
        payment_date: paymentDate,
        payment_reference_number: paymentReference,
        payment_notes: paymentNotes,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!response.ok) {
      setError(payload?.error ?? "Unable to update invoice status.");
    } else {
      setDialogOpen(false);
      setPendingStatus("");
      setRefresh((value) => value + 1);
    }
    setUpdating(false);
  }

  async function openDocument(
    document: Invoice["documents"][number],
    download = false,
  ) {
    const response = await fetch(
      `/api/org/job-invoices/${invoiceId}/documents/${document.id}${
        download ? "?download=1" : ""
      }`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as
      | { signed_url?: string; error?: string }
      | null;
    if (!response.ok || !payload?.signed_url) {
      setError(payload?.error ?? "Unable to open invoice PDF.");
      return;
    }
    window.open(payload.signed_url, "_blank", "noopener,noreferrer");
  }

  async function upload() {
    if (!uploadFile || uploading) return;
    setUploading(true);
    const form = new FormData();
    form.set("file", uploadFile);
    const response = await fetch(
      `/api/org/job-invoices/${invoiceId}/documents`,
      { method: "POST", body: form },
    );
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!response.ok) {
      setError(payload?.error ?? "Unable to upload invoice PDF.");
    } else {
      setUploadFile(null);
      setRefresh((value) => value + 1);
    }
    setUploading(false);
  }

  if (loading) return <div className="mx-auto max-w-6xl">Loading invoice...</div>;
  if (!invoice) {
    return (
      <Alert>
        <AlertDescription>{error ?? "Invoice not found."}</AlertDescription>
      </Alert>
    );
  }
  const statusOptions =
    invoice.status === "draft"
      ? ["draft", "sent"]
      : invoice.status === "sent"
        ? ["sent", "payment_received"]
        : ["payment_received"];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button
        nativeButton={false}
        render={<Link href="/dashboard/invoices" />}
        variant="ghost"
      >
        <ArrowLeftIcon />
        Back to Invoices
      </Button>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm text-zinc-500">Invoice</p>
          <h1 className="text-2xl font-semibold">{invoice.invoice_number}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {invoice.customer?.company_name ?? "-"} · Job{" "}
            {invoice.job?.job_number ?? "-"}
          </p>
        </div>
        {(invoice.status === "draft" && permissions.can_update_status) ||
        (invoice.status === "sent" && permissions.can_record_payment) ? (
          <Select
            value={invoice.status}
            onValueChange={(value) => {
              const next = String(value ?? "");
              if (next !== invoice.status) {
                setPendingStatus(next);
                setDialogOpen(true);
              }
            }}
          >
            <SelectTrigger className="w-52"><SelectValue>{title(pendingStatus ?? invoice.status)}</SelectValue></SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => <SelectItem key={status} value={status}>{title(status)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline">{title(invoice.status)}</Badge>
        )}
      </div>
      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Invoice Amount", money(invoice.invoice_amount, invoice.currency)],
          ["Status", title(invoice.status)],
          [
            "Outstanding",
            money(invoice.outstanding_balance, invoice.currency),
          ],
          [
            "Days Outstanding",
            invoice.sent_at ? String(invoice.days_outstanding) : "Not Sent",
          ],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {label}
              </p>
              <p className="mt-2 font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Invoice Date", invoice.invoice_date],
              ["Sent Date", invoice.sent_at ? new Date(invoice.sent_at).toLocaleString("en-CA") : "-"],
              ["Payment Date", invoice.payment_date ?? "-"],
              ["Payment Reference", invoice.payment_reference_number ?? "-"],
              ["PO Number", invoice.purchase_order?.po_number ?? "-"],
              ["Job Number", invoice.job?.job_number ?? "-"],
              ["Quotation", invoice.quotation?.quotation_number ?? "-"],
              ["Customer", invoice.customer?.company_name ?? "-"],
              [
                "Invoice Request",
                invoice.invoice_request
                  ? `IR-${String(invoice.invoice_request.request_number).padStart(3, "0")}`
                  : "-",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {invoice.remarks ? (
            <div className="mt-6 border-t pt-5">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Remarks
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{invoice.remarks}</p>
            </div>
          ) : null}
          {invoice.payment_notes ? (
            <div className="mt-6 border-t pt-5">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Payment Notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {invoice.payment_notes}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Invoice Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoice.documents.map((document) => (
            <div
              className="flex items-center justify-between rounded-2xl border p-3"
              key={document.id}
            >
              <p className="truncate text-sm font-medium">{document.file_name}</p>
              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void openDocument(document)}
                >
                  <ExternalLinkIcon />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void openDocument(document, true)}
                >
                  <DownloadIcon />
                </Button>
              </div>
            </div>
          ))}
          {permissions.can_edit ? (
          <div className="grid items-end gap-3 rounded-2xl border border-dashed p-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="invoice-document">Upload Invoice PDF</Label>
              <Input
                accept="application/pdf"
                id="invoice-document"
                type="file"
                onChange={(event) =>
                  setUploadFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
            <Button
              disabled={!uploadFile || uploading}
              onClick={() => void upload()}
            >
              <UploadIcon />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Status History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.status_history.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Previous</TableHead>
                  <TableHead>New Status</TableHead>
                  <TableHead>Changed</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.status_history.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{title(event.previous_status ?? "created")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{title(event.new_status)}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(event.changed_at).toLocaleString("en-CA")}
                    </TableCell>
                    <TableCell>{event.payment_date ?? "-"}</TableCell>
                    <TableCell>
                      {event.payment_reference_number ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-zinc-500">No status changes recorded.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setPendingStatus("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm invoice status</DialogTitle>
            <DialogDescription>
              Change {invoice.invoice_number} from {title(invoice.status)} to{" "}
              {title(pendingStatus)}?
            </DialogDescription>
          </DialogHeader>
          {pendingStatus === "payment_received" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-date" required>Payment Date</Label>
                <Input
                  id="payment-date"
                  required
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-reference">
                  Payment Reference Number
                </Label>
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-notes">Payment Notes</Label>
                <Textarea
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              disabled={updating}
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setPendingStatus("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                updating ||
                !pendingStatus ||
                (pendingStatus === "payment_received" && !paymentDate)
              }
              onClick={() => void confirmStatus()}
            >
              {updating ? "Saving..." : "Yes, Change Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
