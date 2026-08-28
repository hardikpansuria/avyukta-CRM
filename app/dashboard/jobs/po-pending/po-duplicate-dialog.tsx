"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ExistingPo = { id: string; po_number: string };

export function PoDuplicateDialog({
  existingPo,
  jobIds,
  onClose,
}: {
  existingPo: ExistingPo | null;
  jobIds: string[];
  onClose: () => void;
}) {
  const jobs = jobIds.length ? `?jobs=${encodeURIComponent(jobIds.join(","))}` : "";
  return (
    <Dialog open={Boolean(existingPo)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>PO number already exists</DialogTitle>
          <DialogDescription>
            PO No: {existingPo?.po_number} already exists for this customer. The
            system found quotations and jobs associated with this PO.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          If the customer provided a revised PO with additional or changed
          quotations, select Create PO Revision. Otherwise, select Cancel to keep
          the existing PO unchanged.
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          {existingPo ? (
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/dashboard/jobs/purchase-orders/${existingPo.id}/revisions/new${jobs}`}
                />
              }
            >
              Create PO Revision
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
