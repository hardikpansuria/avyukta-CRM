"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FinalAdjustmentInput,
  ScopeInput,
} from "@/lib/quotations/scope-calculations";

import {
  defaultNoteSections,
  FinalSections,
  type NoteSectionInput,
} from "./final-sections";
import {
  PageHeader,
  QuotationStatusBadge,
  quotationStatuses,
  SectionCard,
} from "./quotation-ui";
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
  final_discount_type?: string | null;
  final_discount_value?: number | string | null;
  tax_rate?: number | string | null;
  customer?: CustomerSummary | null;
};

const labelClass = "text-sm font-medium text-zinc-800 dark:text-zinc-200";

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
  const [finalDiscountType, setFinalDiscountType] = useState("none");
  const [finalDiscountValue, setFinalDiscountValue] = useState("");
  const [finalAdjustments, setFinalAdjustments] = useState<
    FinalAdjustmentInput[]
  >([]);
  const [noteSections, setNoteSections] =
    useState<NoteSectionInput[]>(defaultNoteSections);
  const [taxRate, setTaxRate] = useState<number | string | null>(0);
  const [taxWarning, setTaxWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [persistedQuotationId, setPersistedQuotationId] = useState(
    quotationId ?? "",
  );

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
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const isPersisted = Boolean(persistedQuotationId);

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
              final_adjustments?: FinalAdjustmentInput[];
              note_sections?: NoteSectionInput[];
              tax_warning?: string | null;
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
        setFinalDiscountType(quotation.final_discount_type ?? "none");
        setFinalDiscountValue(String(quotation.final_discount_value ?? ""));
        setTaxRate(quotation.tax_rate ?? 0);
        setTaxWarning(payload.tax_warning ?? null);
        setSelectedContactIds(
          (payload.contacts ?? [])
            .map((contact) => contact.customer_contact_id)
            .filter((id): id is string => Boolean(id)),
        );
        setScopes(payload.scopes ?? []);
        setFinalAdjustments(payload.final_adjustments ?? []);
        setNoteSections(
          defaultNoteSections.map((section) => {
            const saved = (payload.note_sections ?? []).find(
              (note) => note.section_type === section.section_type,
            );

            return {
              ...section,
              body_text: saved?.body_text ?? "",
            };
          }),
        );
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
      const headerPayload = {
        customer_id: selectedCustomerId,
        quote_date: quoteDate,
        expiry_date: expiryDate,
        project_name: projectName,
        project_location: projectLocation,
        customer_rfq_number: customerRfqNumber,
        sales_rep_id: salesRepId,
        status,
        contact_ids: selectedContactIds,
      };
      let targetQuotationId = persistedQuotationId;

      if (!targetQuotationId) {
        const createResponse = await fetch("/api/org/quotations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(headerPayload),
        });
        const createPayload = (await createResponse.json().catch(() => null)) as
          | {
              quotation?: { id: string; quotation_number?: string | null };
              error?: string;
            }
          | null;

        if (!createResponse.ok || !createPayload?.quotation) {
          setError(createPayload?.error ?? "Unable to create quotation.");
          return;
        }

        targetQuotationId = createPayload.quotation.id;
        setPersistedQuotationId(targetQuotationId);
        setQuotationNumber(
          createPayload.quotation.quotation_number ?? "Pending",
        );
      }

      const response = await fetch(
        `/api/org/quotations/${targetQuotationId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...headerPayload,
            scopes,
            final_discount_type: finalDiscountType,
            final_discount_value: finalDiscountValue,
            final_adjustments: finalAdjustments,
            note_sections: noteSections,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { quotation?: { id: string; quotation_number?: string | null }; error?: string }
        | null;

      if (!response.ok || !payload?.quotation) {
        setError(
          payload?.error ??
            "Quotation was created, but the complete draft could not be saved. Try Save Draft again.",
        );
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
      <div className="mx-auto max-w-6xl rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Loading quotation editor...
      </div>
    );
  }

  const backHref =
    isPersisted
      ? `/dashboard/quotations/${persistedQuotationId}`
      : "/dashboard/quotations";
  const selectedContacts = contacts.filter((contact) =>
    selectedContactIds.includes(contact.id),
  );

  return (
    <form className="mx-auto max-w-6xl pb-10" onSubmit={handleSubmit}>
      <PageHeader
        description="Build the complete customer quotation and save everything as one draft."
        title={mode === "edit" ? "Edit Quotation" : "Create Quotation"}
      />

      <div className="sticky top-0 z-20 mb-6 rounded-lg border border-zinc-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {quotationNumber}
            </span>
            <QuotationStatusBadge status={status} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              className="h-10 rounded-md"
              nativeButton={false}
              render={<Link href={backHref} />}
              type="button"
              variant="outline"
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back
            </Button>
            <Button
              className="h-10 rounded-md font-semibold"
              disabled={isSaving}
              type="submit"
            >
              <SaveIcon data-icon="inline-start" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <SectionCard
          description="Core quotation dates and identifiers."
          title="Quotation Header"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Quotation Number" value={quotationNumber} />
            <TextField
              label="Quote Date"
              required
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
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={quotationStatuses}
              disabled={!isPersisted}
            />
          </div>
        </SectionCard>

        <SectionCard
          description="Choose the customer and contacts attached to this quotation."
          title="Customer Information"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FieldShell label="Search Customer">
              <Input
                className="h-10 rounded-md border-zinc-300 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900"
                disabled={isPersisted}
                placeholder="Search by company or code"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
              />
            </FieldShell>
            <FieldShell label="Customer" required>
              <Select
                disabled={isPersisted}
                value={selectedCustomerId || "__empty"}
                onValueChange={(value) => {
                  const nextValue = value === "__empty" ? "" : String(value);
                  setSelectedCustomerId(nextValue);
                  setContacts([]);
                  setSelectedContactIds([]);
                }}
              >
                <SelectTrigger className="h-10 w-full rounded-md border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <SelectValue>
                    {selectedCustomer
                      ? `${selectedCustomer.company_name}${
                          selectedCustomer.customer_code
                            ? ` (${selectedCustomer.customer_code})`
                            : ""
                        }`
                      : "Select customer"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="__empty">Select customer</SelectItem>
                  {filteredCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name}
                      {customer.customer_code
                        ? ` (${customer.customer_code})`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Selected Contacts
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Select up to 2 contacts to snapshot onto this quotation.
                </p>
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {selectedContactIds.length}/2 selected
              </p>
            </div>

            {selectedContacts.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedContacts.map((contact) => (
                  <span
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    key={contact.id}
                  >
                    {contactName(contact)}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
              {!selectedCustomerId ? (
                <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  Select a customer to choose contacts.
                </p>
              ) : contacts.length === 0 ? (
                <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  This customer does not have active contacts yet.
                </p>
              ) : (
                contacts.map((contact) => {
                  const selected = selectedContactIds.includes(contact.id);

                  return (
                    <Label
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${
                        selected
                          ? "border-zinc-950 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-900"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                      }`}
                      key={contact.id}
                    >
                      <input
                        checked={selected}
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
                    </Label>
                  );
                })
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          description="Project-specific reference information for the quotation."
          title="Project Information"
        >
          <div className="grid gap-4 md:grid-cols-2">
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
        </SectionCard>

        <SectionCard
          description="Internal owner and assignment details."
          title="Internal Assignment"
        >
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        </SectionCard>

        <ScopeBuilder
          quotationId={persistedQuotationId}
          scopes={scopes}
          onChange={setScopes}
        />
        <FinalSections
          finalAdjustments={finalAdjustments}
          finalDiscountType={finalDiscountType}
          finalDiscountValue={finalDiscountValue}
          noteSections={noteSections}
          scopes={scopes}
          taxRate={taxRate}
          taxWarning={taxWarning}
          onFinalAdjustmentsChange={setFinalAdjustments}
          onFinalDiscountTypeChange={setFinalDiscountType}
          onFinalDiscountValueChange={setFinalDiscountValue}
          onNoteSectionsChange={setNoteSections}
        />
      </div>
    </form>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <FieldShell label={label}>
      <Input
        className="h-10 rounded-md border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
        readOnly
        value={value}
      />
    </FieldShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <FieldShell label={label} required={required}>
      <Input
        className="h-10 rounded-md border-zinc-300 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900"
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
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
  const emptyValue = "__empty";
  const selectedLabel =
    options.find(([optionValue]) => optionValue === value)?.[1] ??
    placeholder ??
    "Select option";

  return (
    <FieldShell label={label}>
      <Select
        disabled={disabled}
        value={value || emptyValue}
        onValueChange={(nextValue) =>
          onChange(nextValue === emptyValue ? "" : String(nextValue ?? ""))
        }
      >
        <SelectTrigger className="h-10 w-full rounded-md border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          {placeholder ? (
            <SelectItem value={emptyValue}>{placeholder}</SelectItem>
          ) : null}
          {options.map(([optionValue, labelText]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {labelText}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

function FieldShell({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className={labelClass}>
        {label}
        {required ? <span className="text-red-600">*</span> : null}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
