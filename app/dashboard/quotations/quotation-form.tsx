"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { ScopeInput } from "@/lib/quotations/scope-calculations";

import { ScopeBuilder } from "./scope-builder";

type Profile = {
  full_name?: string | null;
  email?: string | null;
};

type Assignee = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type CustomerSummary = {
  id: string;
  company_name: string;
  customer_code?: string | null;
};

type CustomerContact = {
  id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  office_phone?: string | null;
  mobile_number?: string | null;
  status?: string | null;
};

type QuotationContact = {
  customer_contact_id?: string | null;
};

type Quotation = {
  id: string;
  quotation_number?: string | null;
  customer_id: string;
  quote_date?: string | null;
  expiry_date?: string | null;
  project_name?: string | null;
  project_location?: string | null;
  customer_rfq_number?: string | null;
  revision_number?: number | string | null;
  prepared_by_profile?: Profile | null;
  sales_rep_id?: string | null;
  status?: string | null;
  customer?: CustomerSummary | null;
};

const inputClass =
  "mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";
const labelClass = "text-sm font-medium text-zinc-800 dark:text-zinc-200";
const cardClass =
  "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";
const statuses = [
  ["draft", "Draft"],
  ["sent", "Sent"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["expired", "Expired"],
  ["converted", "Converted"],
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function profileName(profile: Profile | null | undefined) {
  if (!profile) {
    return "-";
  }

  return profile.full_name || profile.email || "-";
}

function assigneeName(assignee: Assignee) {
  return assignee.full_name || assignee.email || "Unnamed user";
}

function contactName(contact: CustomerContact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

function contactPhone(contact: CustomerContact) {
  return contact.office_phone || contact.mobile_number || "-";
}

export function QuotationForm({
  mode,
  quotationId,
  currentUserName,
}: {
  mode: "new" | "edit";
  quotationId?: string;
  currentUserName: string;
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [quotationNumber, setQuotationNumber] = useState("Generated after save");
  const [quoteDate, setQuoteDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [customerRfqNumber, setCustomerRfqNumber] = useState("");
  const [revisionNumber, setRevisionNumber] = useState("0");
  const [preparedBy, setPreparedBy] = useState(currentUserName);
  const [salesRepId, setSalesRepId] = useState("");
  const [status, setStatus] = useState("draft");
  const [scopes, setScopes] = useState<ScopeInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);

  const salesAssignees = useMemo(
    () =>
      assignees.filter((assignee) =>
        ["admin", "sales"].includes(assignee.role),
      ),
    [assignees],
  );

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();

    if (!search) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.company_name, customer.customer_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [customerSearch, customers]);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [customersResponse, assigneesResponse] = await Promise.all([
          fetch("/api/org/customers", { cache: "no-store" }),
          fetch("/api/org/customer-assignees", { cache: "no-store" }),
        ]);
        const customersPayload = (await customersResponse
          .json()
          .catch(() => null)) as
          | { customers?: CustomerSummary[]; error?: string }
          | null;
        const assigneesPayload = (await assigneesResponse
          .json()
          .catch(() => null)) as { assignees?: Assignee[]; error?: string } | null;

        if (!customersResponse.ok) {
          setError(customersPayload?.error ?? "Unable to load customers.");
          return;
        }

        if (!assigneesResponse.ok) {
          setError(assigneesPayload?.error ?? "Unable to load users.");
          return;
        }

        setCustomers(customersPayload?.customers ?? []);
        setAssignees(assigneesPayload?.assignees ?? []);
      } catch {
        setError("Unable to load quotation lookups.");
      }
    }

    void loadLookups();
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !quotationId) {
      return;
    }

    async function loadQuotation() {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(`/api/org/quotations/${quotationId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              quotation?: Quotation;
              contacts?: QuotationContact[];
              scopes?: ScopeInput[];
              error?: string;
            }
          | null;

        if (!response.ok || !payload?.quotation) {
          setError(payload?.error ?? "Unable to load quotation.");
          return;
        }

        const quotation = payload.quotation;
        setQuotationNumber(quotation.quotation_number ?? "Pending");
        setSelectedCustomerId(quotation.customer_id);
        setCustomerSearch(quotation.customer?.company_name ?? "");
        setQuoteDate(quotation.quote_date ?? today());
        setExpiryDate(quotation.expiry_date ?? "");
        setProjectName(quotation.project_name ?? "");
        setProjectLocation(quotation.project_location ?? "");
        setCustomerRfqNumber(quotation.customer_rfq_number ?? "");
        setRevisionNumber(String(quotation.revision_number ?? 0));
        setPreparedBy(profileName(quotation.prepared_by_profile));
        setSalesRepId(quotation.sales_rep_id ?? "");
        setStatus(quotation.status ?? "draft");
        setSelectedContactIds(
          (payload.contacts ?? [])
            .map((contact) => contact.customer_contact_id)
            .filter((id): id is string => Boolean(id)),
        );
        setScopes(payload.scopes ?? []);
      } catch {
        setError("Unable to load quotation.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadQuotation();
  }, [mode, quotationId]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setContacts([]);
      setSelectedContactIds([]);
      return;
    }

    async function loadContacts() {
      try {
        const response = await fetch(`/api/org/customers/${selectedCustomerId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { contacts?: CustomerContact[]; error?: string }
          | null;

        if (!response.ok) {
          setError(payload?.error ?? "Unable to load customer contacts.");
          return;
        }

        const activeContacts = (payload?.contacts ?? []).filter(
          (contact) => contact.status !== "deleted",
        );
        setContacts(activeContacts);
        setSelectedContactIds((currentIds) =>
          currentIds.filter((id) =>
            activeContacts.some((contact) => contact.id === id),
          ),
        );
      } catch {
        setError("Unable to load customer contacts.");
      }
    }

    void loadContacts();
  }, [selectedCustomerId]);

  function toggleContact(contactId: string) {
    setSelectedContactIds((currentIds) => {
      if (currentIds.includes(contactId)) {
        return currentIds.filter((id) => id !== contactId);
      }

      if (currentIds.length >= 2) {
        setError("Select up to 2 customer contacts.");
        return currentIds;
      }

      setError(null);
      return [...currentIds, contactId];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setError(null);

    if (!selectedCustomerId) {
      setError("Customer is required.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        mode === "edit" && quotationId
          ? `/api/org/quotations/${quotationId}`
          : "/api/org/quotations",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_id: selectedCustomerId,
            quote_date: quoteDate,
            expiry_date: expiryDate,
            project_name: projectName,
            project_location: projectLocation,
            customer_rfq_number: customerRfqNumber,
            sales_rep_id: salesRepId,
            status,
            contact_ids: selectedContactIds,
            ...(mode === "edit" ? { scopes } : {}),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { quotation?: { id: string; quotation_number?: string | null }; error?: string }
        | null;

      if (!response.ok || !payload?.quotation) {
        setError(payload?.error ?? "Unable to save quotation.");
        return;
      }

      router.push(`/dashboard/quotations/${payload.quotation.id}`);
    } catch {
      setError("Unable to save quotation.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Loading quotation editor...
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-6xl pb-24" onSubmit={handleSubmit}>
      <div className="mb-6 flex flex-col gap-3 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {mode === "edit" ? "Edit Quotation" : "Create Quotation"}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Save the quotation header as a draft before building scope and
            totals.
          </p>
        </div>
        <Link
          className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          href={
            mode === "edit" && quotationId
              ? `/dashboard/quotations/${quotationId}`
              : "/dashboard/quotations"
          }
        >
          {mode === "edit" ? "Back to quotation" : "Back to quotations"}
        </Link>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Quotation Header
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Quotation Number" value={quotationNumber} />
            <TextField
              label="Quote Date"
              type="date"
              value={quoteDate}
              onChange={setQuoteDate}
            />
            <TextField
              label="Expiry Date"
              type="date"
              value={expiryDate}
              onChange={setExpiryDate}
            />
            <ReadOnlyField label="Revision Number" value={revisionNumber} />
            <ReadOnlyField label="Prepared By" value={preparedBy} />
            <SelectField
              label="Sales Representative"
              value={salesRepId}
              onChange={setSalesRepId}
              options={salesAssignees.map((assignee) => [
                assignee.id,
                assigneeName(assignee),
              ])}
              placeholder="Unassigned"
            />
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={statuses}
              disabled={mode === "new"}
            />
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Customer
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>Search Customer</span>
              <input
                className={inputClass}
                disabled={mode === "edit"}
                placeholder="Search by company or code"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Customer</span>
              <select
                className={inputClass}
                disabled={mode === "edit"}
                required
                value={selectedCustomerId}
                onChange={(event) => {
                  setSelectedCustomerId(event.target.value);
                  setSelectedContactIds([]);
                }}
              >
                <option value="">Select customer</option>
                {filteredCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company_name}
                    {customer.customer_code ? ` (${customer.customer_code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Project Name"
              value={projectName}
              onChange={setProjectName}
            />
            <TextField
              label="Project Location"
              value={projectLocation}
              onChange={setProjectLocation}
            />
            <TextField
              label="Customer RFQ Number"
              value={customerRfqNumber}
              onChange={setCustomerRfqNumber}
            />
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Customer Contacts
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Select up to 2 contacts to snapshot onto this quotation.
              </p>
            </div>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {selectedContactIds.length}/2 selected
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {!selectedCustomerId ? (
              <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                Select a customer to choose contacts.
              </p>
            ) : contacts.length === 0 ? (
              <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                This customer does not have active contacts yet.
              </p>
            ) : (
              contacts.map((contact) => (
                <label
                  className="flex gap-3 rounded-md border border-zinc-200 p-3 text-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  key={contact.id}
                >
                  <input
                    checked={selectedContactIds.includes(contact.id)}
                    className="mt-1"
                    type="checkbox"
                    onChange={() => toggleContact(contact.id)}
                  />
                  <span>
                    <span className="font-medium text-zinc-950 dark:text-zinc-50">
                      {contactName(contact)}
                    </span>
                    <span className="mt-1 block text-zinc-600 dark:text-zinc-400">
                      {contact.email || "-"} · {contactPhone(contact)}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </section>

        {mode === "edit" ? (
          <ScopeBuilder scopes={scopes} onChange={setScopes} />
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            href={
              mode === "edit" && quotationId
                ? `/dashboard/quotations/${quotationId}`
                : "/dashboard/quotations"
            }
          >
            Cancel
          </Link>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? "Saving..."
              : mode === "edit"
                ? "Save Changes"
                : "Save Draft"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input
        className={`${inputClass} bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400`}
        readOnly
        value={value}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input
        className={inputClass}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <select
        className={inputClass}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
