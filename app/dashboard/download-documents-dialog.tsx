"use client";

import { useState } from "react";
import { DownloadIcon, LoaderCircleIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";

type Props = {
  canDateRangeExport: boolean;
  canFullBackup: boolean;
};

function responseFilename(response: Response) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return "document-backup.zip";
    }
  }
  return disposition.match(/filename="([^"]+)"/i)?.[1] ?? "document-backup.zip";
}

export function DownloadDocumentsDialog({ canDateRangeExport, canFullBackup }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"full" | "date_range">(
    canDateRangeExport ? "date_range" : "full",
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  async function downloadBackup() {
    setError("");
    if (type === "date_range" && (!from || !to)) {
      setError("Choose both From and To dates.");
      return;
    }
    if (type === "date_range" && from > to) {
      setError("From date cannot be after To date.");
      return;
    }
    setDownloading(true);
    try {
      const response = await fetch("/api/org/document-exports/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "full" ? { type } : { type, from, to },
        ),
      });
      if (!response.ok) {
        if (response.status === 504) {
          throw new Error("The backup exceeded the server download time. Try a smaller date range or contact an administrator.");
        }
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to download the backup.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = responseFilename(response);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download the backup.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-9 rounded-md" variant="outline" />}>
        <DownloadIcon data-icon="inline-start" />
        Download Documents
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" aria-busy={downloading}>
        <DialogHeader>
          <DialogTitle>Download Documents</DialogTitle>
          <DialogDescription>
            Download your organization&apos;s CRM business documents in a structured ZIP backup.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3" disabled={downloading}>
          <legend className="mb-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">
            Backup type <RequiredMark />
          </legend>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <input
              checked={type === "date_range"}
              disabled={!canDateRangeExport}
              name="document-export-type"
              onChange={() => setType("date_range")}
              type="radio"
            />
            <span>
              <span className="block font-medium">Date Range</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Documents uploaded, created, or generated during an inclusive UTC date range.
                {!canDateRangeExport ? " Permission required." : ""}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <input
              checked={type === "full"}
              disabled={!canFullBackup}
              name="document-export-type"
              onChange={() => setType("full")}
              type="radio"
            />
            <span>
              <span className="block font-medium">Full Backup</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Every eligible organization document available at the export snapshot.
                {!canFullBackup ? " Permission required." : ""}
              </span>
            </span>
          </label>
        </fieldset>

        {type === "date_range" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document-export-from" required>From Date</Label>
              <Input id="document-export-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={downloading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-export-to" required>To Date</Label>
              <Input id="document-export-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} disabled={downloading} />
            </div>
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={downloading} />}>Cancel</DialogClose>
          <Button onClick={downloadBackup} disabled={downloading}>
            {downloading ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
            {downloading ? "Preparing Backup…" : "Download Backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
