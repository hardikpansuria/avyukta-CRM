"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EmployeeDirectoryRole, EmployeeDirectoryStatus } from "@/lib/employees/access";
import type { DirectoryEmployee, EmployeeSkill } from "@/lib/employees/types";

const roleOptions: Array<[EmployeeDirectoryRole, string]> = [
  ["admin", "Admin"],
  ["sales", "Sales"],
  ["accounts", "Accounts"],
  ["worker", "Worker"],
];

type Notice = { tone: "error" | "success"; message: string } | null;

export function EmployeeForm({ employeeId }: { employeeId?: string }) {
  const router = useRouter();
  const [employee, setEmployee] = useState<DirectoryEmployee | null>(null);
  const [skills, setSkills] = useState<EmployeeSkill[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [role, setRole] = useState<EmployeeDirectoryRole>("worker");
  const [status, setStatus] = useState<EmployeeDirectoryStatus>("active");
  const [notes, setNotes] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(employeeId));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(Boolean(employeeId));
      try {
        const requests: Promise<Response>[] = [
          fetch("/api/org/employee-skills?include_inactive=1", { cache: "no-store" }),
        ];
        if (employeeId) {
          requests.push(fetch(`/api/org/employees/${employeeId}`, { cache: "no-store" }));
        }
        const [skillsResponse, employeeResponse] = await Promise.all(requests);
        const skillsPayload = (await skillsResponse.json().catch(() => null)) as
          | { skills?: EmployeeSkill[]; error?: string }
          | null;
        if (!skillsResponse.ok) {
          throw new Error(skillsPayload?.error ?? "Unable to load skills.");
        }
        if (!cancelled) setSkills(skillsPayload?.skills ?? []);

        if (employeeResponse) {
          const payload = (await employeeResponse.json().catch(() => null)) as
            | { employee?: DirectoryEmployee; error?: string }
            | null;
          if (!employeeResponse.ok || !payload?.employee) {
            throw new Error(payload?.error ?? "Unable to load employee.");
          }
          if (!cancelled) {
            const value = payload.employee;
            setEmployee(value);
            setEmployeeName(value.employee_name);
            setEmail(value.email ?? "");
            setContactNumber(value.contact_number ?? "");
            setRole(value.employee_role);
            setStatus(value.employee_status);
            setNotes(value.notes ?? "");
            setSelectedSkillIds(value.skills.map((skill) => skill.id));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({
            tone: "error",
            message: error instanceof Error ? error.message : "Unable to load form.",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const selectedSkills = useMemo(
    () => skills.filter((skill) => selectedSkillIds.includes(skill.id)),
    [selectedSkillIds, skills],
  );

  function toggleSkill(skill: EmployeeSkill, checked: boolean) {
    if (!skill.is_active && !selectedSkillIds.includes(skill.id)) return;
    setSelectedSkillIds((current) =>
      checked
        ? Array.from(new Set([...current, skill.id]))
        : current.filter((id) => id !== skill.id),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setNotice(null);
    try {
      const response = await fetch(
        employeeId ? `/api/org/employees/${employeeId}` : "/api/org/employees",
        {
          method: employeeId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_name: employeeName,
            email,
            contact_number: contactNumber,
            employee_role: role,
            employee_status: status,
            notes,
            skill_ids: selectedSkillIds,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setNotice({ tone: "error", message: payload?.error ?? "Unable to save employee." });
        return;
      }
      setNotice({ tone: "success", message: employeeId ? "Employee updated." : "Employee added." });
      router.push("/dashboard/employees");
      router.refresh();
    } catch {
      setNotice({ tone: "error", message: "Unable to save employee." });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-24 text-muted-foreground">
        <LoaderCircleIcon className="mr-2 size-5 animate-spin" /> Loading employee…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {notice ? <ToastNotice notice={notice} /> : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {employeeId ? "Edit Employee" : "Add Employee"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maintain internal employee information without changing CRM access.
        </p>
      </div>

      {employee?.source_type === "system" ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          This employee also has CRM access. Changes made here affect the Employee Directory only. Manage software access from User Management.
        </div>
      ) : null}

      <form onSubmit={submit}>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Employee details</CardTitle>
            <CardDescription>Fields marked required must be completed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="Employee Name" required>
              <Input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} required />
            </Field>
            <Field label="Email Address">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Contact Number">
              <Input value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} />
            </Field>
            <Field label="Role">
              <Select value={role} onValueChange={(value) => setRole(value as EmployeeDirectoryRole)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent align="start">
                  {roleOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              {role === "worker" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Worker is for internal employee records only and does not provide CRM access.
                </p>
              ) : null}
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(value) => setStatus(value as EmployeeDirectoryStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Skills">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button className="w-full justify-between" type="button" variant="outline" />}>
                  {selectedSkillIds.length ? `${selectedSkillIds.length} selected` : "Select skills"}
                  <ChevronDownIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-80 w-72" align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Employee skills</DropdownMenuLabel>
                    {skills.map((skill) => (
                      <DropdownMenuCheckboxItem
                        key={skill.id}
                        checked={selectedSkillIds.includes(skill.id)}
                        disabled={!skill.is_active && !selectedSkillIds.includes(skill.id)}
                        onCheckedChange={(checked) => toggleSkill(skill, Boolean(checked))}
                      >
                        {skill.skill_name}
                        {!skill.is_active ? <span className="ml-auto text-xs text-muted-foreground">Inactive</span> : null}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedSkills.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedSkills.map((skill) => <Badge key={skill.id} variant="secondary">{skill.skill_name}</Badge>)}
                </div>
              ) : null}
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea className="min-h-28" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </Field>
            </div>
          </CardContent>
          <div className="flex justify-end gap-3 border-t px-6 pt-5">
            <Button nativeButton={false} render={<Link href="/dashboard/employees" />} type="button" variant="outline">Cancel</Button>
            <Button disabled={isSaving || !employeeName.trim()} type="submit">
              {isSaving ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
              {isSaving ? "Saving…" : "Save Employee"}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block">{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      {children}
    </div>
  );
}

function ToastNotice({ notice }: { notice: NonNullable<Notice> }) {
  return (
    <div className={`fixed right-4 top-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`} role="status">
      {notice.message}
    </div>
  );
}
