"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownAZIcon, ArrowUpAZIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, SearchIcon, Settings2Icon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EmployeeDirectoryRole, EmployeeDirectoryStatus } from "@/lib/employees/access";
import type { DirectoryEmployee, EmployeeListResponse } from "@/lib/employees/types";

import { SkillsManager } from "./skills-manager";

const roleLabels: Record<EmployeeDirectoryRole, string> = { admin: "Admin", sales: "Sales", accounts: "Accounts", worker: "Worker" };
const statusLabels: Record<EmployeeDirectoryStatus, string> = { active: "Active", inactive: "Inactive" };

export function EmployeesClient() {
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [pagination, setPagination] = useState<EmployeeListResponse["pagination"]>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"employee_name" | "created_at">("employee_name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: "20", sort, direction });
    if (search) params.set("search", search);
    if (role !== "all") params.set("role", role);
    if (status !== "all") params.set("status", status);
    try {
      const response = await fetch(`/api/org/employees?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as (EmployeeListResponse & { error?: string }) | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? "Unable to load employees.");
      setEmployees(payload.employees);
      setPagination(payload.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load employees.");
    } finally {
      setIsLoading(false);
    }
  }, [direction, page, role, search, sort, status]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadEmployees();
    });
  }, [loadEmployees, refreshKey]);

  function resetPage(update: () => void) { update(); setPage(1); }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employee List</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage internal directory records, skills, and workforce status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSkillsOpen(true)}><Settings2Icon /> Manage Skills</Button>
          <Button nativeButton={false} render={<Link href="/dashboard/employees/new" />}><PlusIcon /> Add Employee</Button>
        </div>
      </div>

      <Card className="rounded-xl" size="sm">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search employee name or email" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          </div>
          <Select value={role} onValueChange={(value) => resetPage(() => setRole(String(value)))}>
            <SelectTrigger className="w-full"><SelectValue>{role === "all" ? "All roles" : roleLabels[role as EmployeeDirectoryRole]}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="all">All roles</SelectItem>{Object.entries(roleLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => resetPage(() => setStatus(String(value)))}>
            <SelectTrigger className="w-full"><SelectValue>{status === "all" ? "All statuses" : statusLabels[status as EmployeeDirectoryStatus]}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => resetPage(() => setSort(value as "employee_name" | "created_at"))}>
            <SelectTrigger className="w-full"><SelectValue>{sort === "employee_name" ? "Employee name" : "Date added"}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="employee_name"><ArrowDownAZIcon /> Employee name</SelectItem><SelectItem value="created_at"><CalendarDaysIcon /> Date added</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" onClick={() => resetPage(() => setDirection((current) => current === "asc" ? "desc" : "asc"))}>
            {direction === "asc" ? <ArrowUpAZIcon /> : <ArrowDownAZIcon />} {direction === "asc" ? "Ascending" : "Descending"}
          </Button>
        </CardContent>
      </Card>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}

      <Card className="hidden rounded-xl md:block">
        <CardContent className="px-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee Name</TableHead><TableHead>Email Address</TableHead><TableHead>Contact Number</TableHead><TableHead>Role</TableHead><TableHead>Skills</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead><TableHead>Date Added</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : null}
              {!isLoading && employees.length === 0 ? <TableRow><TableCell className="py-12 text-center text-muted-foreground" colSpan={9}>No employees match the current filters.</TableCell></TableRow> : null}
              {!isLoading ? employees.map((employee) => <EmployeeRow employee={employee} key={employee.id} />) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:hidden">
        {isLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-48 rounded-xl" key={index} />) : null}
        {!isLoading && employees.length === 0 ? <Card className="rounded-xl"><CardContent className="py-10 text-center text-muted-foreground">No employees match the current filters.</CardContent></Card> : null}
        {!isLoading ? employees.map((employee) => <EmployeeCard employee={employee} key={employee.id} />) : null}
      </div>

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">{pagination.total} employee{pagination.total === 1 ? "" : "s"} · Page {pagination.page} of {pagination.totalPages}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={isLoading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeftIcon /> Previous</Button>
          <Button variant="outline" disabled={isLoading || page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next <ChevronRightIcon /></Button>
        </div>
      </div>

      <SkillsManager open={skillsOpen} onOpenChange={setSkillsOpen} onChanged={() => setRefreshKey((key) => key + 1)} />
    </div>
  );
}

function EmployeeRow({ employee }: { employee: DirectoryEmployee }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{employee.employee_name}</TableCell>
      <TableCell>{employee.email ?? "—"}</TableCell><TableCell>{employee.contact_number ?? "—"}</TableCell>
      <TableCell><RoleBadge role={employee.employee_role} /></TableCell>
      <TableCell><SkillBadges employee={employee} /></TableCell>
      <TableCell><StatusBadge status={employee.employee_status} /></TableCell>
      <TableCell><Badge variant="outline">{employee.source_type === "system" ? "CRM User" : "Directory Only"}</Badge></TableCell>
      <TableCell>{formatDate(employee.created_at)}</TableCell>
      <TableCell className="text-right"><Button nativeButton={false} size="icon-sm" variant="ghost" aria-label={`Edit ${employee.employee_name}`} render={<Link href={`/dashboard/employees/${employee.id}/edit`} />}><PencilIcon /></Button></TableCell>
    </TableRow>
  );
}

function EmployeeCard({ employee }: { employee: DirectoryEmployee }) {
  return <Card className="rounded-xl" size="sm"><CardContent className="space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{employee.employee_name}</p><p className="mt-1 text-sm text-muted-foreground">{employee.email ?? "No email"}</p></div><Button nativeButton={false} size="icon-sm" variant="ghost" aria-label={`Edit ${employee.employee_name}`} render={<Link href={`/dashboard/employees/${employee.id}/edit`} />}><PencilIcon /></Button></div><div className="flex flex-wrap gap-2"><RoleBadge role={employee.employee_role} /><StatusBadge status={employee.employee_status} /><Badge variant="outline">{employee.source_type === "system" ? "CRM User" : "Directory Only"}</Badge></div><div><p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Skills</p><SkillBadges employee={employee} /></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Contact</p><p>{employee.contact_number ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">Date Added</p><p>{formatDate(employee.created_at)}</p></div></div></CardContent></Card>;
}

function RoleBadge({ role }: { role: EmployeeDirectoryRole }) { return <Badge variant="secondary">{roleLabels[role]}</Badge>; }
function StatusBadge({ status }: { status: EmployeeDirectoryStatus }) { return <Badge className={status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : ""} variant={status === "active" ? "secondary" : "outline"}>{statusLabels[status]}</Badge>; }
function SkillBadges({ employee }: { employee: DirectoryEmployee }) { return employee.skills.length ? <div className="flex max-w-80 flex-wrap gap-1">{employee.skills.slice(0, 3).map((skill) => <Badge key={skill.id} variant="outline">{skill.skill_name}</Badge>)}{employee.skills.length > 3 ? <Badge variant="outline">+{employee.skills.length - 3}</Badge> : null}</div> : <span className="text-muted-foreground">—</span>; }
function formatDate(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(date); }
