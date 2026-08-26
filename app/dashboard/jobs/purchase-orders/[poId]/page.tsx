"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  UploadIcon,
  PlusIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Document = {
  id: string;
  document_type: "purchase_order" | "supporting_document" | "po_revision";
  file_name: string;
  file_size?: number | string | null;
  mime_type?: string | null;
  uploaded_at?: string | null;
};

type Allocation = {
  id: string;
  job_id: string;
  quotation_number_snapshot: string;
  revision_number_snapshot: number | string;
  project_name_snapshot?: string | null;
  quotation_total: number | string;
  total_po_amount: number | string;
  difference_amount: number | string;
  invoiced: number;
  paid: number;
  outstanding: number;
  is_currently_included: boolean;
  job?: {
    id: string;
    job_number?: string | null;
    job_status: string;
  } | null;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  po_received_date: string;
  currency: string;
  combined_quotation_total: number | string;
  combined_po_total: number | string;
  difference_amount: number | string;
  current_revision_number: number | string;
  current_po_total: number | string;
  internal_remarks?: string | null;
  customer?: { company_name?: string | null } | null;
  allocations: Allocation[];
  documents: Document[];
  invoiced: number;
  paid: number;
  outstanding: number;
  revisions: Array<{
    id: string;
    revision_number: number | string;
    revision_date: string;
    previous_po_amount: number | string;
    revised_po_amount: number | string;
    difference_amount: number | string;
    change_percentage?: number | string | null;
    created_by_profile?: { full_name?: string | null; email?: string | null } | null;
    document?: Document | null;
    items: Array<{
      allocation_id: string;
      quotation_number_snapshot: string;
      project_name_snapshot?: string | null;
      po_amount_snapshot: number | string;
      change_type: "original" | "carried" | "added" | "removed";
      is_included: boolean;
    }>;
  }>;
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

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="mt-2 font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function PurchaseOrderDetailPage() {
  const { poId } = useParams<{ poId: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] =
    useState<"purchase_order" | "supporting_document">("supporting_document");
  const [uploading, setUploading] = useState(false);
  const [viewingRevisionId, setViewingRevisionId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/org/job-purchase-orders/${poId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { purchase_order?: PurchaseOrder; error?: string }
          | null;
        if (!response.ok || !payload?.purchase_order) {
          setError(payload?.error ?? "Unable to load purchase order.");
          return;
        }
        setPo(payload.purchase_order);
        setError(null);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load purchase order.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [poId, refresh]);

  async function openDocument(document: Document, download = false) {
    setError(null);
    const response = await fetch(
      `/api/org/job-purchase-orders/${poId}/documents/${document.id}${
        download ? "?download=1" : ""
      }`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as
      | { signed_url?: string; error?: string }
      | null;
    if (!response.ok || !payload?.signed_url) {
      setError(payload?.error ?? "Unable to open document.");
      return;
    }
    window.open(payload.signed_url, "_blank", "noopener,noreferrer");
  }

  const viewingRevision = po?.revisions.find((revision) => revision.id === viewingRevisionId);
  const currentAllocations = po?.allocations.filter(
    (allocation) => allocation.is_currently_included,
  ) ?? [];

  async function upload() {
    if (!uploadFile || uploading) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.set("file", uploadFile);
    form.set("document_type", uploadType);
    try {
      const response = await fetch(
        `/api/org/job-purchase-orders/${poId}/documents`,
        { method: "POST", body: form },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(payload?.error ?? "Unable to upload document.");
        return;
      }
      setUploadFile(null);
      setRefresh((value) => value + 1);
    } catch {
      setError("Unable to upload document.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-7xl">Loading PO...</div>;
  if (!po) {
    return (
      <div className="mx-auto max-w-7xl">
        <Alert>
          <AlertDescription>{error ?? "Purchase order not found."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Button
        nativeButton={false}
        render={<Link href="/dashboard/jobs/purchase-orders" />}
        variant="ghost"
      >
        <ArrowLeftIcon />
        Back to PO Received
      </Button>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm text-zinc-500">Purchase Order</p>
          <h1 className="text-2xl font-semibold">{po.po_number}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {po.customer?.company_name ?? "-"} · Received {po.po_received_date}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {Number(po.current_revision_number) > 0
              ? `Revision ${po.current_revision_number}`
              : "Original"}
          </Badge>
          <Button
            nativeButton={false}
            render={<Link href={`/dashboard/jobs/purchase-orders/${po.id}/revisions/new`} />}
            size="sm"
          >
            <PlusIcon /> Create PO Revision
          </Button>
        </div>
      </div>
      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Summary
          label="Current PO Amount"
          value={money(po.current_po_total, po.currency)}
        />
        <Summary
          label="Difference"
          value={money(po.difference_amount, po.currency)}
        />
        <Summary label="Invoiced" value={money(po.invoiced, po.currency)} />
        <Summary label="Paid" value={money(po.paid, po.currency)} />
        <Summary
          label="Outstanding"
          value={money(po.outstanding, po.currency)}
        />
      </div>
      {po.internal_remarks ? (
        <Card>
          <CardHeader>
            <CardTitle>Internal Remarks</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
            {po.internal_remarks}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {po.documents.map((document) => (
              <div
                className="flex items-center justify-between gap-3 rounded-2xl border p-3"
                key={document.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {document.file_name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {document.document_type === "purchase_order"
                      ? "Original PO"
                      : document.document_type === "po_revision"
                        ? "PO Revision"
                        : "Supporting Document"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    aria-label={`View ${document.file_name}`}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void openDocument(document)}
                  >
                    <ExternalLinkIcon />
                  </Button>
                  <Button
                    aria-label={`Download ${document.file_name}`}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void openDocument(document, true)}
                  >
                    <DownloadIcon />
                  </Button>
                </div>
              </div>
            ))}
            {!po.documents.length ? (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed p-4 text-sm text-zinc-500">
                <FileIcon className="size-4" />
                No documents uploaded.
              </div>
            ) : null}
          </div>
          <div className="grid items-end gap-3 rounded-2xl border border-dashed p-4 sm:grid-cols-[180px_1fr_auto]">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select
                value={uploadType}
                onValueChange={(value) =>
                  setUploadType(
                    value === "purchase_order"
                      ? "purchase_order"
                      : "supporting_document",
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase_order">PO PDF</SelectItem>
                  <SelectItem value="supporting_document">
                    Supporting
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="additional-po-document">Document</Label>
              <Input
                accept={
                  uploadType === "purchase_order"
                    ? "application/pdf"
                    : ".pdf,.jpg,.jpeg,.png,.docx,.xlsx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
                id="additional-po-document"
                type="file"
                onChange={(event) =>
                  setUploadFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
            <Button
              disabled={!uploadFile || uploading}
              type="button"
              onClick={() => void upload()}
            >
              <UploadIcon />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>PO Revision History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Revision</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Added Quotation(s)</TableHead>
                <TableHead>Removed Quotation(s)</TableHead>
                <TableHead>PO Amount</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.revisions.map((revision) => (
                <TableRow key={revision.id}>
                  <TableCell className="font-medium">
                    {Number(revision.revision_number) === 0
                      ? "Original"
                      : `Rev. ${revision.revision_number}`}
                  </TableCell>
                  <TableCell>{revision.revision_date}</TableCell>
                  <TableCell>
                    {revision.items.filter((item) => item.change_type === "added").map((item) => item.quotation_number_snapshot).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    {revision.items.filter((item) => item.change_type === "removed").map((item) => item.quotation_number_snapshot).join(", ") || "—"}
                  </TableCell>
                  <TableCell>{money(revision.revised_po_amount, po.currency)}</TableCell>
                  <TableCell>{Number(revision.revision_number) === 0 ? "—" : `${Number(revision.difference_amount) > 0 ? "+" : ""}${money(revision.difference_amount, po.currency)}`}</TableCell>
                  <TableCell>{revision.created_by_profile?.full_name ?? revision.created_by_profile?.email ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setViewingRevisionId(revision.id)}>View Revision</Button>
                      {revision.document ? <Button size="sm" variant="ghost" onClick={() => void openDocument(revision.document!)}>View PO Document</Button> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {viewingRevision ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{Number(viewingRevision.revision_number) === 0 ? "Original PO Snapshot" : `PO Revision ${viewingRevision.revision_number}`}</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setViewingRevisionId(null)}>Close</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Summary label="Previous PO Amount" value={money(viewingRevision.previous_po_amount, po.currency)} />
              <Summary label="Revised PO Amount" value={money(viewingRevision.revised_po_amount, po.currency)} />
              <Summary label="PO Revision Impact" value={`${Number(viewingRevision.difference_amount) > 0 ? "+" : ""}${money(viewingRevision.difference_amount, po.currency)}`} />
            </div>
            <Table><TableHeader><TableRow><TableHead>Quotation</TableHead><TableHead>Project</TableHead><TableHead>PO Amount</TableHead><TableHead>Change</TableHead><TableHead>Included</TableHead></TableRow></TableHeader><TableBody>
              {viewingRevision.items.map((item) => <TableRow key={item.allocation_id}><TableCell>{item.quotation_number_snapshot}</TableCell><TableCell>{item.project_name_snapshot ?? "—"}</TableCell><TableCell>{money(item.po_amount_snapshot, po.currency)}</TableCell><TableCell><Badge variant="outline">{title(item.change_type)}</Badge></TableCell><TableCell>{item.is_included ? "Yes" : "No"}</TableCell></TableRow>)}
            </TableBody></Table>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Currently Included Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Number</TableHead>
                <TableHead>Quotation</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Quotation Total</TableHead>
                <TableHead>Allocated PO Total</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentAllocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell className="font-medium">
                    <Link
                      className="hover:underline"
                      href={`/dashboard/jobs/${allocation.job_id}`}
                    >
                      {allocation.job?.job_number ?? "-"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {allocation.quotation_number_snapshot}
                  </TableCell>
                  <TableCell>
                    {allocation.revision_number_snapshot}
                  </TableCell>
                  <TableCell>
                    {allocation.project_name_snapshot ?? "-"}
                  </TableCell>
                  <TableCell>
                    {money(allocation.quotation_total, po.currency)}
                  </TableCell>
                  <TableCell>
                    {money(allocation.total_po_amount, po.currency)}
                  </TableCell>
                  <TableCell>
                    {money(allocation.difference_amount, po.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {title(allocation.job?.job_status ?? "unknown")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {money(allocation.invoiced, po.currency)}
                  </TableCell>
                  <TableCell>
                    {money(allocation.paid, po.currency)}
                  </TableCell>
                  <TableCell>
                    {money(allocation.outstanding, po.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
