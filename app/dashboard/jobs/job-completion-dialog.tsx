"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DirectoryEmployee, EmployeeListResponse } from "@/lib/employees/types";

export type CompletedCertificate = {
  id: string;
  certificate_number: string;
  revision_number: number;
  completion_date: string;
  certificate_generated_at: string;
  signed_url?: string | null;
};

export type EditableCompletion = {
  id: string;
  completion_date: string;
  completion_status: "completed" | "completed_with_outstanding_items";
  completion_notes?: string | null;
  outstanding_items?: string | null;
  technicians: Array<{ employee_id: string; employee_name: string }>;
};

type Props = {
  jobId: string;
  jobNumber?: string | null;
  open: boolean;
  initialCompletion?: EditableCompletion | null;
  onOpenChange: (open: boolean) => void;
  onCompleted: (completion: CompletedCertificate) => void;
};

export function JobCompletionDialog({ jobId, jobNumber, open, initialCompletion, onOpenChange, onCompleted }: Props) {
  const correcting = Boolean(initialCompletion);
  const [completionDate, setCompletionDate] = useState(() => initialCompletion?.completion_date ?? new Date().toISOString().slice(0, 10));
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [technicianIds, setTechnicianIds] = useState<string[]>(() => initialCompletion?.technicians.map((technician) => technician.employee_id) ?? []);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState(() => initialCompletion?.completion_notes ?? "");
  const [outstandingItems, setOutstandingItems] = useState(() => initialCompletion?.outstanding_items ?? "");
  const [completionStatus, setCompletionStatus] = useState<"completed" | "completed_with_outstanding_items">(() => initialCompletion?.completion_status ?? "completed");
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function loadEmployees() {
      try {
        const response = await fetch("/api/org/employees?status=active&pageSize=100&sort=employee_name&direction=asc", { cache: "no-store", signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as (EmployeeListResponse & { error?: string }) | null;
        if (!response.ok) setError(payload?.error ?? "Unable to load Technicians from the Employee List.");
        else setEmployees(payload?.employees ?? []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") setError("Unable to load Technicians from the Employee List.");
      } finally {
        if (!controller.signal.aborted) setLoadingEmployees(false);
      }
    }
    void loadEmployees();
    return () => controller.abort();
  }, [open]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => [employee.employee_name, employee.email, employee.contact_number]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(query)));
  }, [employees, search]);

  async function completeJob() {
    if (submitting) return;
    setError(null);
    if (!completionDate) return setError("Completion Date is required.");
    if (!technicianIds.length) return setError("Select at least one Technician.");
    if (completionStatus === "completed_with_outstanding_items" && !outstandingItems.trim()) {
      return setError("Outstanding Items are required for this completion status.");
    }
    setSubmitting(true);
    try {
      const endpoint = correcting && initialCompletion
        ? `/api/org/jobs/${jobId}/completion-certificates/${initialCompletion.id}/correct`
        : `/api/org/jobs/${jobId}/complete`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completion_date: completionDate,
          technician_ids: technicianIds,
          completion_notes: notes,
          outstanding_items: outstandingItems,
          completion_status: completionStatus,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { completion?: CompletedCertificate; error?: string } | null;
      if (!response.ok || !payload?.completion) {
        setError(payload?.error ?? (correcting ? "Unable to correct the completion information." : "Unable to complete the job."));
        return;
      }
      onCompleted(payload.completion);
      onOpenChange(false);
    } catch {
      setError(correcting ? "Unable to correct the completion information." : "Unable to complete the job.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{correcting ? "Edit Completion Information" : "Complete Job"}</DialogTitle>
          <DialogDescription>{correcting
            ? `Correct ${jobNumber || "this job"} and generate the replacement certificate. The previous certificate will be removed after the replacement is saved.`
            : `${jobNumber || "This job"} will move to Job Completed after its acknowledgement PDF is generated.`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-4">
            <div><h3 className="text-sm font-semibold">Required Information</h3><p className="text-xs text-zinc-500">All required fields must be completed.</p></div>
            <div className="space-y-2"><Label htmlFor={`completion-date-${jobId}`} required>Completion Date</Label><Input id={`completion-date-${jobId}`} max={new Date().toISOString().slice(0, 10)} required type="date" value={completionDate} onChange={(event) => setCompletionDate(event.target.value)} /></div>
            <div className="space-y-2">
              <Label required>Technician(s)</Label>
              <div className="relative"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input className="pl-9" placeholder="Search Employee List" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                {loadingEmployees ? <p className="p-2 text-sm text-zinc-500">Loading employees...</p> : null}
                {!loadingEmployees && filteredEmployees.map((employee) => (
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900" key={employee.id}>
                    <Checkbox checked={technicianIds.includes(employee.id)} onChange={(event) => setTechnicianIds((current) => event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id))} />
                    <span><span className="block font-medium">{employee.employee_name}</span>{employee.email ? <span className="block text-xs text-zinc-500">{employee.email}</span> : null}</span>
                  </label>
                ))}
                {!loadingEmployees && !filteredEmployees.length ? <p className="p-2 text-sm text-zinc-500">No active employees found.</p> : null}
              </div>
              <p className="text-xs text-zinc-500">{technicianIds.length} selected. Employee IDs are stored with the completion.</p>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <h3 className="text-sm font-semibold">Optional Information</h3>
            <div className="space-y-2"><Label htmlFor={`completion-notes-${jobId}`}>Completion Notes</Label><Textarea className="min-h-24" id={`completion-notes-${jobId}`} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor={`outstanding-items-${jobId}`} required={completionStatus === "completed_with_outstanding_items"}>Outstanding Items</Label><Textarea className="min-h-24" id={`outstanding-items-${jobId}`} required={completionStatus === "completed_with_outstanding_items"} value={outstandingItems} onChange={(event) => setOutstandingItems(event.target.value)} /></div>
            <div className="space-y-2"><Label required>Completion Status</Label><Select value={completionStatus} onValueChange={(value) => setCompletionStatus(value === "completed_with_outstanding_items" ? value : "completed")}><SelectTrigger className="w-full"><SelectValue>{completionStatus === "completed_with_outstanding_items" ? "Completed with Outstanding Items" : "Completed"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="completed">Completed</SelectItem><SelectItem value="completed_with_outstanding_items">Completed with Outstanding Items</SelectItem></SelectContent></Select></div>
          </section>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </div>

        <DialogFooter>
          <Button disabled={submitting} type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={submitting || loadingEmployees} type="button" onClick={() => void completeJob()}>{submitting ? "Generating Certificate..." : correcting ? "Save & Replace Certificate" : "Complete Job & Generate Certificate"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
