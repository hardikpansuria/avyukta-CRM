"use client";

import { FormEvent, useEffect, useState } from "react";

type Organization = {
  id: string;
  name: string;
  org_code: string;
  status: string;
  created_at?: string | null;
};

const ORGANIZATION_STATUSES = ["active", "paused", "deleted"];

function formatDate(value: string | null | undefined) {
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

export default function SuperAdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadOrganizations() {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/super-admin/organizations", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        organizations?: Organization[];
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to load organizations.");
        return;
      }

      setOrganizations(payload?.organizations ?? []);
    } catch {
      setError("Unable to load organizations.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrganizations();
    });
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsCreating(true);

    try {
      const response = await fetch("/api/super-admin/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          org_code: orgCode,
          admin_email: adminEmail,
          admin_full_name: adminFullName,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to create organization.");
        return;
      }

      setMessage(payload?.message ?? "Organization created.");
      setName("");
      setOrgCode("");
      setAdminEmail("");
      setAdminFullName("");
      await loadOrganizations();
    } catch {
      setError("Unable to create organization.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleStatusChange(organizationId: string, status: string) {
    setError(null);
    setMessage(null);
    setUpdatingId(organizationId);

    try {
      const response = await fetch(
        `/api/super-admin/organizations/${organizationId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        organization?: Organization;
        error?: string;
      } | null;

      if (!response.ok || !payload?.organization) {
        setError(payload?.error ?? "Unable to update organization.");
        return;
      }

      setOrganizations((currentOrganizations) =>
        currentOrganizations.map((organization) =>
          organization.id === organizationId
            ? { ...organization, status: payload.organization!.status }
            : organization,
        ),
      );
      setMessage("Organization status updated.");
    } catch {
      setError("Unable to update organization.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Create organizations and manage their status.
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
        <h2 className="text-lg font-semibold">Create organization</h2>
        <form
          className="mt-5 grid gap-4 md:grid-cols-2"
          onSubmit={handleCreate}
        >
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              Organization Name
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800">Org Code</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              pattern="[a-z0-9]+"
              value={orgCode}
              onChange={(event) => setOrgCode(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              First Admin Email
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              First Admin Full Name
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              value={adminFullName}
              onChange={(event) => setAdminFullName(event.target.value)}
              required
            />
          </label>

          <div className="md:col-span-2">
            <button
              className="flex h-11 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              type="submit"
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create organization"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold">Organizations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Org Code</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-6 text-zinc-500" colSpan={4}>
                    Loading organizations...
                  </td>
                </tr>
              ) : organizations.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-zinc-500" colSpan={4}>
                    No organizations found.
                  </td>
                </tr>
              ) : (
                organizations.map((organization) => (
                  <tr key={organization.id}>
                    <td className="px-6 py-4 font-medium text-zinc-950">
                      {organization.name}
                    </td>
                    <td className="px-6 py-4 text-zinc-700">
                      {organization.org_code}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60"
                        value={organization.status}
                        disabled={updatingId === organization.id}
                        onChange={(event) =>
                          void handleStatusChange(
                            organization.id,
                            event.target.value,
                          )
                        }
                      >
                        {ORGANIZATION_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-zinc-700">
                      {formatDate(organization.created_at)}
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
