"use client";

import { FormEvent, useEffect, useState } from "react";

import { RequiredMark } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CompanyBrandingSettings } from "./company-branding-settings";

type Employee = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  member_since: string | null;
  invitation_pending: boolean;
  invited_at: string | null;
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
const EMPLOYEE_ROLES = ["admin", "accountant", "sales"];
const EMPLOYEE_STATUSES = ["active", "inactive"];
const ADMIN_ROLE_CONFIRMATION = "admin role";

type EmployeeUpdate = { role?: string; status?: string };

type EmployeeUpdatePayload = EmployeeUpdate & {
  transfer_to_member_id?: string;
  admin_confirmation?: string;
  admin_demotion_confirmed?: boolean;
};

type TransferRequest = {
  employee: Employee;
  update: EmployeeUpdatePayload;
};

type AdminPromotionRequest = {
  employee: Employee;
};

type AdminDemotionRequest = {
  employee: Employee;
  role: string;
};

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
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteInviteRequest, setDeleteInviteRequest] =
    useState<Employee | null>(null);
  const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<RoleDefault[]>([]);
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [savingPermissionId, setSavingPermissionId] = useState<string | null>(null);
  const [transferRequest, setTransferRequest] = useState<TransferRequest | null>(null);
  const [successorMemberId, setSuccessorMemberId] = useState("");
  const [adminPromotionRequest, setAdminPromotionRequest] =
    useState<AdminPromotionRequest | null>(null);
  const [adminConfirmation, setAdminConfirmation] = useState("");
  const [adminDemotionRequest, setAdminDemotionRequest] =
    useState<AdminDemotionRequest | null>(null);

  async function loadEmployees() {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/org/user-management", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        employees?: Employee[];
        can_manage_admins?: boolean;
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to load employees.");
        return;
      }

      setEmployees(payload?.employees ?? []);
      setCanManageAdmins(payload?.can_manage_admins === true);
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
    payload: EmployeeUpdatePayload,
  ): Promise<boolean> {
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
        code?: string;
        message?: string;
      } | null;

      if (!response.ok || !responsePayload?.employee) {
        if (
          responsePayload?.code === "ADMIN_TRANSFER_REQUIRED" &&
          !payload.transfer_to_member_id
        ) {
          const employee = employees.find((item) => item.id === employeeId);

          if (employee) {
            setSuccessorMemberId("");
            setTransferRequest({ employee, update: payload });
            return false;
          }
        }

        setError(responsePayload?.error ?? "Unable to update employee.");
        return false;
      }

      setEmployees((currentEmployees) =>
        currentEmployees.map((employee) =>
          employee.id === employeeId
            ? { ...employee, ...responsePayload.employee }
            : employee,
        ),
      );
      setMessage(responsePayload.message ?? "Employee updated.");
      return true;
    } catch {
      setError("Unable to update employee.");
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function resendInvitation(employee: Employee) {
    setError(null);
    setMessage(null);
    setResendingId(employee.id);

    try {
      const response = await fetch(
        `/api/org/user-management/${employee.id}/resend-invite`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to resend the invitation.");
        if (response.status === 409) await loadEmployees();
        return;
      }

      setMessage(payload?.message ?? "Invitation resent.");
      await loadEmployees();
    } catch {
      setError("Unable to resend the invitation.");
    } finally {
      setResendingId(null);
    }
  }

  async function deletePendingInvitation() {
    if (!deleteInviteRequest) return;

    const employee = deleteInviteRequest;
    setError(null);
    setMessage(null);
    setDeletingId(employee.id);

    try {
      const response = await fetch(`/api/org/user-management/${employee.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to delete the pending invitation.");
        if (response.status === 409) await loadEmployees();
        return;
      }

      setDeleteInviteRequest(null);
      setMessage(payload?.message ?? "Pending invitation deleted.");
      await loadEmployees();
      await loadPermissions();
    } catch {
      setError("Unable to delete the pending invitation.");
    } finally {
      setDeletingId(null);
    }
  }

  function requestEmployeeUpdate(employee: Employee, update: EmployeeUpdate) {
    if (employee.role !== "admin" && update.role === "admin") {
      setError(null);
      setMessage(null);
      setAdminConfirmation("");
      setAdminPromotionRequest({ employee });
      return;
    }

    if (
      employee.role === "admin" &&
      update.role !== undefined &&
      update.role !== "admin"
    ) {
      setError(null);
      setMessage(null);
      setAdminDemotionRequest({ employee, role: update.role });
      return;
    }

    continueEmployeeUpdate(employee, update);
  }

  function continueEmployeeUpdate(
    employee: Employee,
    update: EmployeeUpdatePayload,
  ) {
    const removesActiveAdmin =
      employee.role === "admin" &&
      employee.status === "active" &&
      ((update.role !== undefined && update.role !== "admin") ||
        (update.status !== undefined && update.status !== "active"));
    const otherActiveAdminExists = employees.some(
      (candidate) =>
        candidate.id !== employee.id &&
        candidate.role === "admin" &&
        candidate.status === "active",
    );

    if (removesActiveAdmin && !otherActiveAdminExists) {
      setError(null);
      setMessage(null);
      setSuccessorMemberId("");
      setTransferRequest({ employee, update });
      return;
    }

    void updateEmployee(employee.id, update);
  }

  function confirmAdminDemotion() {
    if (!adminDemotionRequest) return;

    const { employee, role: nextRole } = adminDemotionRequest;
    setAdminDemotionRequest(null);
    continueEmployeeUpdate(employee, {
      role: nextRole,
      admin_demotion_confirmed: true,
    });
  }

  async function confirmAdminPromotion() {
    if (
      !adminPromotionRequest ||
      adminConfirmation !== ADMIN_ROLE_CONFIRMATION
    ) {
      return;
    }

    const completed = await updateEmployee(adminPromotionRequest.employee.id, {
      role: "admin",
      admin_confirmation: adminConfirmation,
    });

    if (completed) {
      setAdminPromotionRequest(null);
      setAdminConfirmation("");
    }
  }

  async function confirmTransfer() {
    if (!transferRequest || !successorMemberId) return;

    const completed = await updateEmployee(transferRequest.employee.id, {
      ...transferRequest.update,
      transfer_to_member_id: successorMemberId,
    });

    if (completed) {
      setTransferRequest(null);
      setSuccessorMemberId("");
      await loadEmployees();
    }
  }

  const transferCandidates = transferRequest
    ? employees.filter(
        (employee) =>
          employee.id !== transferRequest.employee.id &&
          employee.status === "active" &&
          !employee.invitation_pending,
      )
    : [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Manage company branding, employees, roles, and CRM access for this organization.
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

      {canManageAdmins ? (
        <CompanyBrandingSettings
          onMessage={(brandingMessage) => {
            setError(null);
            setMessage(brandingMessage);
          }}
        />
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
          <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Full Name</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Member Since</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-6 text-zinc-500" colSpan={6}>
                    Loading employees...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-zinc-500" colSpan={6}>
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
                      <div>{employee.email ?? "-"}</div>
                      {employee.invitation_pending ? (
                        <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Invitation pending
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60"
                        value={employee.role}
                        disabled={
                          updatingId === employee.id ||
                          (!canManageAdmins && employee.role === "admin")
                        }
                        onChange={(event) =>
                          requestEmployeeUpdate(employee, {
                            role: event.target.value,
                          })
                        }
                      >
                        {EMPLOYEE_ROLES.filter(
                          (employeeRole) =>
                            canManageAdmins ||
                            employee.role === "admin" ||
                            employeeRole !== "admin",
                        ).map((employeeRole) => (
                          <option key={employeeRole} value={employeeRole}>
                            {employeeRole}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60"
                        value={employee.status}
                        disabled={
                          updatingId === employee.id ||
                          (!canManageAdmins && employee.role === "admin")
                        }
                        onChange={(event) =>
                          requestEmployeeUpdate(employee, {
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
                    <td className="px-6 py-4">
                      {employee.invitation_pending ? (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              resendingId === employee.id ||
                              deletingId === employee.id
                            }
                            onClick={() => void resendInvitation(employee)}
                          >
                            {resendingId === employee.id
                              ? "Sending..."
                              : "Resend Invite"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={
                              resendingId === employee.id ||
                              deletingId === employee.id
                            }
                            onClick={() => setDeleteInviteRequest(employee)}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={Boolean(deleteInviteRequest)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteInviteRequest(null);
        }}
      >
        <DialogContent showCloseButton={!deletingId}>
          <DialogHeader>
            <DialogTitle>Delete pending invitation?</DialogTitle>
            <DialogDescription>
              Delete the invitation for{" "}
              {deleteInviteRequest?.email ?? "this email address"}? Use this
              when the email address was entered incorrectly. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            The user will be removed from this organization. If this is their
            only organization membership, their unaccepted Supabase account
            will also be deleted.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(deletingId)}
              onClick={() => setDeleteInviteRequest(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(deletingId)}
              onClick={() => void deletePendingInvitation()}
            >
              {deletingId ? "Deleting..." : "Delete invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(transferRequest)}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setTransferRequest(null);
            setSuccessorMemberId("");
          }
        }}
      >
        <DialogContent showCloseButton={!updatingId}>
          <DialogHeader>
            <DialogTitle>Transfer administrator access</DialogTitle>
            <DialogDescription>
              {transferRequest?.employee.full_name ?? "This user"} is the last
              active administrator. Choose another active user who has accepted
              their invitation to become an administrator before continuing.
            </DialogDescription>
          </DialogHeader>

          {transferCandidates.length > 0 ? (
            <label className="block">
              <span className="text-sm font-medium text-zinc-800">
                New administrator <RequiredMark />
              </span>
              <select
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                value={successorMemberId}
                onChange={(event) => setSuccessorMemberId(event.target.value)}
              >
                <option value="">Select a user</option>
                {transferCandidates.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name ?? employee.email ?? "Unnamed user"} ({
                      employee.role
                    })
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              There is no other active user available. Invite or reactivate a
              user before deactivating the last administrator.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(updatingId)}
              onClick={() => setTransferRequest(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!successorMemberId || Boolean(updatingId)}
              onClick={() => void confirmTransfer()}
            >
              {updatingId ? "Transferring..." : "Transfer and continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(adminDemotionRequest)}
        onOpenChange={(open) => {
          if (!open) setAdminDemotionRequest(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove administrator access?</DialogTitle>
            <DialogDescription>
              Are you sure you want to change{" "}
              {adminDemotionRequest?.employee.full_name ?? "this user"} from
              Admin to {adminDemotionRequest?.role ?? "another role"}? They will
              lose organization administration capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This changes the user&apos;s access immediately. Their custom
            permission overrides, if any, remain unchanged.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdminDemotionRequest(null)}
            >
              No, keep Admin
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmAdminDemotion}
            >
              Yes, change role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(adminPromotionRequest)}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setAdminPromotionRequest(null);
            setAdminConfirmation("");
          }
        }}
      >
        <DialogContent showCloseButton={!updatingId}>
          <DialogHeader>
            <DialogTitle>Grant administrator access?</DialogTitle>
            <DialogDescription>
              You are making {adminPromotionRequest?.employee.full_name ?? "this user"}
              {" "}an administrator of this organization. Administrators can manage
              users, roles, permissions, and organization-wide CRM data.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This is a high-privilege role. Only continue if this user should have
            full administrative access.
          </div>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              Type <strong>{ADMIN_ROLE_CONFIRMATION}</strong> to confirm
            </span>
            <input
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              value={adminConfirmation}
              onChange={(event) => setAdminConfirmation(event.target.value)}
              placeholder={ADMIN_ROLE_CONFIRMATION}
              spellCheck={false}
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(updatingId)}
              onClick={() => {
                setAdminPromotionRequest(null);
                setAdminConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                adminConfirmation !== ADMIN_ROLE_CONFIRMATION ||
                Boolean(updatingId)
              }
              onClick={() => void confirmAdminPromotion()}
            >
              {updatingId ? "Granting access..." : "Make administrator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
