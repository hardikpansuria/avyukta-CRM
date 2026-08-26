"use client";

import { FormEvent, useEffect, useState } from "react";

import { RequiredMark } from "@/components/ui/label";

type Employee = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  member_since: string | null;
};

type PermissionDefinition = {
  id: string;
  action_key: string;
  display_name: string;
  sort_order: number;
};

type PermissionModule = {
  id: string;
  module_key: string;
  display_name: string;
  sort_order: number;
  permission_definitions: PermissionDefinition[];
};

type RoleDefault = {
  role_key: string;
  permission_id: string;
  allowed: boolean;
};

type PermissionOverride = {
  user_id: string;
  permission_id: string;
  allowed: boolean;
};

const INVITE_ROLES = ["accountant", "sales"];
const EMPLOYEE_ROLES = ["accountant", "sales"];
const EMPLOYEE_STATUSES = ["active", "inactive"];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function UserManagementClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("accountant");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<RoleDefault[]>([]);
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [savingPermissionId, setSavingPermissionId] = useState<string | null>(null);

  async function loadEmployees() {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/org/user-management", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        employees?: Employee[];
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to load employees.");
        return;
      }

      setEmployees(payload?.employees ?? []);
    } catch {
      setError("Unable to load employees.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPermissions() {
    try {
      const response = await fetch("/api/org/permissions", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        modules?: PermissionModule[];
        role_defaults?: RoleDefault[];
        overrides?: PermissionOverride[];
        error?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Unable to load permissions.");
        return;
      }
      setPermissionModules(payload?.modules ?? []);
      setRoleDefaults(payload?.role_defaults ?? []);
      setOverrides(payload?.overrides ?? []);
    } catch {
      setError("Unable to load permissions.");
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadEmployees();
      void loadPermissions();
    });
  }, []);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsInviting(true);

    try {
      const response = await fetch("/api/org/user-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          role,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to invite employee.");
        return;
      }

      setMessage(payload?.message ?? "Employee invited.");
      setFullName("");
      setEmail("");
      setRole("accountant");
      await loadEmployees();
    } catch {
      setError("Unable to invite employee.");
    } finally {
      setIsInviting(false);
    }
  }

  async function savePermission(
    userId: string,
    permissionId: string,
    allowed: boolean,
  ) {
    setError(null);
    setMessage(null);
    setSavingPermissionId(permissionId);
    try {
      const response = await fetch("/api/org/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, permission_id: permissionId, allowed }),
      });
      const payload = (await response.json().catch(() => null)) as {
        override?: PermissionOverride;
        error?: string;
      } | null;
      if (!response.ok || !payload?.override) {
        setError(payload?.error ?? "Unable to save permission.");
        return;
      }
      setOverrides((current) => [
        ...current.filter(
          (item) =>
            item.user_id !== userId || item.permission_id !== permissionId,
        ),
        payload.override!,
      ]);
      setMessage("Custom permission saved.");
    } catch {
      setError("Unable to save permission.");
    } finally {
      setSavingPermissionId(null);
    }
  }

  async function resetPermissions(userId: string) {
    setError(null);
    setMessage(null);
    const response = await fetch(
      `/api/org/permissions?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    if (!response.ok) {
      setError(payload?.error ?? "Unable to reset permissions.");
      return;
    }
    setOverrides((current) => current.filter((item) => item.user_id !== userId));
    setMessage(payload?.message ?? "Permissions reset to role defaults.");
  }

  async function updateEmployee(
    employeeId: string,
    payload: { role?: string; status?: string },
  ) {
    setError(null);
    setMessage(null);
    setUpdatingId(employeeId);

    try {
      const response = await fetch(`/api/org/user-management/${employeeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responsePayload = (await response.json().catch(() => null)) as {
        employee?: Employee;
        error?: string;
      } | null;

      if (!response.ok || !responsePayload?.employee) {
        setError(responsePayload?.error ?? "Unable to update employee.");
        return;
      }

      setEmployees((currentEmployees) =>
        currentEmployees.map((employee) =>
          employee.id === employeeId
            ? { ...employee, ...responsePayload.employee }
            : employee,
        ),
      );
      setMessage("Employee updated.");
    } catch {
      setError("Unable to update employee.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Invite employees and manage CRM access for this organization.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Invite employee</h2>
        <form
          className="mt-5 grid gap-4 md:grid-cols-2"
          onSubmit={handleInvite}
        >
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              Full Name <RequiredMark />
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              Email <RequiredMark />
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              Role <RequiredMark />
            </span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {INVITE_ROLES.map((inviteRole) => (
                <option key={inviteRole} value={inviteRole}>
                  {inviteRole}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              className="flex h-11 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              type="submit"
              disabled={isInviting}
            >
              {isInviting ? "Inviting..." : "Invite employee"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold">CRM users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Full Name</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Member Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-6 text-zinc-500" colSpan={5}>
                    Loading employees...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-zinc-500" colSpan={5}>
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 font-medium text-zinc-950">
                      {employee.full_name ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-zinc-700">
                      {employee.email ?? "-"}
                    </td>
                    <td className="px-6 py-4">
                      {employee.role === "admin" ? (
                        <span className="capitalize text-zinc-700">
                          {employee.role}
                        </span>
                      ) : (
                        <select
                          className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60"
                          value={employee.role}
                          disabled={updatingId === employee.id}
                          onChange={(event) =>
                            void updateEmployee(employee.id, {
                              role: event.target.value,
                            })
                          }
                        >
                          {EMPLOYEE_ROLES.map((employeeRole) => (
                            <option key={employeeRole} value={employeeRole}>
                              {employeeRole}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60"
                        value={employee.status}
                        disabled={updatingId === employee.id}
                        onChange={(event) =>
                          void updateEmployee(employee.id, {
                            status: event.target.value,
                          })
                        }
                      >
                        {EMPLOYEE_STATUSES.map((employeeStatus) => (
                          <option key={employeeStatus} value={employeeStatus}>
                            {employeeStatus}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-zinc-700">
                      {formatDate(employee.member_since)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Module permissions</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Inherit role defaults, or create an explicit grant or denial for a user.
            </p>
          </div>
          <select
            className="h-10 min-w-64 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            <option value="">Select a user</option>
            {employees.map((employee) => (
              <option key={employee.user_id} value={employee.user_id}>
                {employee.full_name ?? employee.email ?? employee.user_id} ({employee.role})
              </option>
            ))}
          </select>
        </div>

        {selectedUserId ? (
          <PermissionEditor
            employee={employees.find((employee) => employee.user_id === selectedUserId)!}
            modules={permissionModules}
            roleDefaults={roleDefaults}
            overrides={overrides}
            savingPermissionId={savingPermissionId}
            onSave={savePermission}
            onReset={resetPermissions}
          />
        ) : (
          <p className="mt-6 rounded-md bg-zinc-50 p-4 text-sm text-zinc-600">
            Select a user to review effective permissions.
          </p>
        )}
      </section>
    </div>
  );
}

function PermissionEditor({
  employee,
  modules,
  roleDefaults,
  overrides,
  savingPermissionId,
  onSave,
  onReset,
}: {
  employee: Employee;
  modules: PermissionModule[];
  roleDefaults: RoleDefault[];
  overrides: PermissionOverride[];
  savingPermissionId: string | null;
  onSave: (userId: string, permissionId: string, allowed: boolean) => Promise<void>;
  onReset: (userId: string) => Promise<void>;
}) {
  const defaults = new Map(
    roleDefaults
      .filter((item) => item.role_key === employee.role)
      .map((item) => [item.permission_id, item.allowed]),
  );
  const userOverrides = new Map(
    overrides
      .filter((item) => item.user_id === employee.user_id)
      .map((item) => [item.permission_id, item.allowed]),
  );

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-zinc-50 p-3 text-sm">
        <span>
          Role: <strong className="capitalize">{employee.role}</strong>. Green/Red choices are custom overrides.
        </span>
        <button
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-medium hover:bg-zinc-100"
          onClick={() => void onReset(employee.user_id)}
          type="button"
        >
          Reset to Role Defaults
        </button>
      </div>
      {modules.map((module) => (
        <div className="rounded-md border border-zinc-200 p-4" key={module.id}>
          <h3 className="font-semibold">{module.display_name}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {module.permission_definitions.map((permission) => {
              const inherited = defaults.get(permission.id) ?? false;
              const custom = userOverrides.get(permission.id);
              const effective = custom ?? inherited;
              return (
                <div className="rounded-md bg-zinc-50 p-3" key={permission.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{permission.display_name}</span>
                    <span className={effective ? "text-xs text-emerald-700" : "text-xs text-red-700"}>
                      {effective ? "Allowed" : "Denied"}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <span className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-center text-xs">
                      {custom === undefined ? `Inherited: ${inherited ? "allow" : "deny"}` : "Inherited"}
                    </span>
                    <button
                      className={`rounded border px-2 py-1 text-xs ${custom === true ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-white"}`}
                      disabled={savingPermissionId === permission.id}
                      onClick={() => void onSave(employee.user_id, permission.id, true)}
                      type="button"
                    >
                      Grant
                    </button>
                    <button
                      className={`rounded border px-2 py-1 text-xs ${custom === false ? "border-red-600 bg-red-50 text-red-800" : "border-zinc-200 bg-white"}`}
                      disabled={savingPermissionId === permission.id}
                      onClick={() => void onSave(employee.user_id, permission.id, false)}
                      type="button"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
