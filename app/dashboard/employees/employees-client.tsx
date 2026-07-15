"use client";

import { FormEvent, useEffect, useState } from "react";

type Employee = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  member_since: string | null;
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

export function EmployeesClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("accountant");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadEmployees() {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/org/employees", {
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

  useEffect(() => {
    queueMicrotask(() => {
      void loadEmployees();
    });
  }, []);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsInviting(true);

    try {
      const response = await fetch("/api/org/employees", {
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

  async function updateEmployee(
    employeeId: string,
    payload: { role?: string; status?: string },
  ) {
    setError(null);
    setMessage(null);
    setUpdatingId(employeeId);

    try {
      const response = await fetch(`/api/org/employees/${employeeId}`, {
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
        <h1 className="text-2xl font-semibold">Employees</h1>
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
              Full Name
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800">Email</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800">Role</span>
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
          <h2 className="text-lg font-semibold">Employee list</h2>
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
    </div>
  );
}
