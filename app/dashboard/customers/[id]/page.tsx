"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Profile = {
  full_name?: string | null;
  email?: string | null;
};

type Customer = {
  id: string;
  company_name: string;
  legal_company_name?: string | null;
  customer_code?: string | null;
  logo_storage_path?: string | null;
  logo_signed_url?: string | null;
  industry?: string | null;
  business_category?: string | null;
  company_type?: string | null;
  business_registration_number?: string | null;
  gst_hst_number?: string | null;
  vendor_number?: string | null;
  assigned_sales_rep?: Profile | null;
  account_manager?: Profile | null;
  lead_source?: string | null;
  referral_source?: string | null;
  customer_since?: string | null;
  customer_status: string;
  credit_limit?: number | string | null;
  credit_terms?: string | null;
  tax_exempt?: boolean | null;
  currency?: string | null;
  preferred_payment_method?: string | null;
  accounts_payable_email?: string | null;
  invoice_email?: string | null;
  record_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Address = {
  id: string;
  address_type: string;
  same_as_head_office: boolean;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  province_state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

type Contact = {
  id: string;
  first_name: string;
  last_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  office_phone?: string | null;
  extension?: string | null;
  is_primary: boolean;
  notes?: string | null;
  status: string;
};

type Note = {
  id: string;
  body_text?: string | null;
  body_html?: string | null;
  is_pinned: boolean;
  status: string;
  author?: Profile | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Activity = {
  id: string;
  activity_type: string;
  description: string;
  linked_record_type?: string | null;
  linked_record_number?: string | null;
  actor?: Profile | null;
  occurred_at?: string | null;
};

type Tag = {
  id: string;
  name: string;
  color: string;
};

type CustomerDetail = {
  customer: Customer;
  addresses: Address[];
  contacts: Contact[];
  notes: Note[];
  activities: Activity[];
  tags: Tag[];
};

const cardClass =
  "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";
const labelClass =
  "text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
const valueClass = "mt-1 text-sm text-zinc-950 dark:text-zinc-50";
const inputClass =
  "h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const buttonClass =
  "h-10 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200";
const secondaryButtonClass =
  "h-10 rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900";
const suggestedTags = [
  "Food Industry",
  "Dairy",
  "Bakery",
  "Brewery",
  "Pharmaceutical",
  "Packaging",
  "OEM",
  "Stainless Steel",
  "Fabrication",
  "Repair",
  "Repeat Customer",
  "Priority Customer",
  "High Value Customer",
];
const contactDepartments = [
  ["", "No department"],
  ["purchasing", "Purchasing"],
  ["engineering", "Engineering"],
  ["production", "Production"],
  ["operations", "Operations"],
  ["maintenance", "Maintenance"],
  ["finance", "Finance"],
  ["accounts_payable", "Accounts Payable"],
  ["accounts_receivable", "Accounts Receivable"],
  ["shipping", "Shipping"],
  ["receiving", "Receiving"],
  ["quality", "Quality"],
  ["administration", "Administration"],
  ["other", "Other"],
];

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

function formatPlainDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

function formatCurrency(value: number | string | null | undefined, currency?: string | null) {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(numberValue);
}

function profileName(profile: Profile | null | undefined) {
  if (!profile) {
    return "-";
  }

  return profile.full_name || profile.email || "-";
}

function fullName(contact: Contact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

function addressTitle(type: string) {
  return formatLabel(type);
}

function addressLines(address: Address) {
  const cityLine = [
    address.city,
    address.province_state,
    address.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    address.address_line_1,
    address.address_line_2,
    cityLine,
    address.country,
  ].filter(Boolean);
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = params.id;
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contactSearch, setContactSearch] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [activityType, setActivityType] = useState("");
  const [activityDateFrom, setActivityDateFrom] = useState("");
  const [activityDateTo, setActivityDateTo] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactPrimary, setContactPrimary] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingContactFirstName, setEditingContactFirstName] = useState("");
  const [editingContactLastName, setEditingContactLastName] = useState("");
  const [editingContactJobTitle, setEditingContactJobTitle] = useState("");
  const [editingContactDepartment, setEditingContactDepartment] = useState("");
  const [editingContactEmail, setEditingContactEmail] = useState("");
  const [editingContactMobile, setEditingContactMobile] = useState("");
  const [editingContactOffice, setEditingContactOffice] = useState("");
  const [editingContactExtension, setEditingContactExtension] = useState("");
  const [editingContactNotes, setEditingContactNotes] = useState("");
  const [tagName, setTagName] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomer() {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(`/api/org/customers/${customerId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | (CustomerDetail & { error?: string })
          | null;

        if (!response.ok || !payload?.customer) {
          setError(payload?.error ?? "Unable to load customer.");
          return;
        }

        setDetail(payload);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load customer.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadCustomer();

    return () => {
      controller.abort();
    };
  }, [customerId, refreshKey]);

  function refreshCustomer() {
    setRefreshKey((currentKey) => currentKey + 1);
  }

  async function mutate(
    url: string,
    options: RequestInit,
    fallbackError: string,
  ) {
    setError(null);
    setMessage(null);
    setIsWorking(true);

    try {
      const response = await fetch(url, options);
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? fallbackError);
        return false;
      }

      setMessage(payload?.message ?? "Customer updated.");
      refreshCustomer();
      return true;
    } catch {
      setError(fallbackError);
      return false;
    } finally {
      setIsWorking(false);
    }
  }

  async function handleArchiveCustomer() {
    if (!window.confirm("Archive this customer profile?")) {
      return;
    }

    const success = await mutate(
      `/api/org/customers/${customerId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_status: "archived" }),
      },
      "Unable to archive customer.",
    );

    if (success) {
      router.push("/dashboard/customers");
    }
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsLogoUploading(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch(`/api/org/customers/${customerId}/logo`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to upload logo.");
        return;
      }

      setMessage(payload?.message ?? "Logo uploaded.");
      refreshCustomer();
    } catch {
      setError("Unable to upload logo.");
    } finally {
      setIsLogoUploading(false);
      event.target.value = "";
    }
  }

  async function handleAddNote() {
    if (!noteBody.trim()) {
      setError("Note body is required.");
      return;
    }

    const success = await mutate(
      `/api/org/customers/${customerId}/notes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body_text: noteBody,
          body_html: noteBody,
          is_pinned: notePinned,
        }),
      },
      "Unable to add note.",
    );

    if (success) {
      setNoteBody("");
      setNotePinned(false);
    }
  }

  async function handleAddContact() {
    if (!contactFirstName.trim()) {
      setError("Contact first name is required.");
      return;
    }

    const success = await mutate(
      `/api/org/customers/${customerId}/contacts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: contactFirstName,
          last_name: contactLastName,
          email: contactEmail,
          office_phone: contactPhone,
          is_primary: contactPrimary,
        }),
      },
      "Unable to add contact.",
    );

    if (success) {
      setContactFirstName("");
      setContactLastName("");
      setContactEmail("");
      setContactPhone("");
      setContactPrimary(false);
    }
  }

  async function updateContact(contactId: string, payload: Record<string, unknown>) {
    await mutate(
      `/api/org/customers/${customerId}/contacts/${contactId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      "Unable to update contact.",
    );
  }

  function startEditingContact(contact: Contact) {
    setEditingContactId(contact.id);
    setEditingContactFirstName(contact.first_name);
    setEditingContactLastName(contact.last_name ?? "");
    setEditingContactJobTitle(contact.job_title ?? "");
    setEditingContactDepartment(contact.department ?? "");
    setEditingContactEmail(contact.email ?? "");
    setEditingContactMobile(contact.mobile_number ?? "");
    setEditingContactOffice(contact.office_phone ?? "");
    setEditingContactExtension(contact.extension ?? "");
    setEditingContactNotes(contact.notes ?? "");
  }

  async function saveEditingContact() {
    if (!editingContactId) {
      return;
    }

    if (!editingContactFirstName.trim()) {
      setError("Contact first name is required.");
      return;
    }

    const success = await mutate(
      `/api/org/customers/${customerId}/contacts/${editingContactId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: editingContactFirstName,
          last_name: editingContactLastName,
          job_title: editingContactJobTitle,
          department: editingContactDepartment,
          email: editingContactEmail,
          mobile_number: editingContactMobile,
          office_phone: editingContactOffice,
          extension: editingContactExtension,
          notes: editingContactNotes,
        }),
      },
      "Unable to update contact.",
    );

    if (success) {
      setEditingContactId(null);
    }
  }

  async function updateNote(noteId: string, payload: Record<string, unknown>) {
    await mutate(
      `/api/org/customers/${customerId}/notes/${noteId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      "Unable to update note.",
    );
  }

  function startEditingNote(note: Note) {
    setEditingNoteId(note.id);
    setEditingNoteBody(note.body_text || note.body_html || "");
  }

  async function saveEditingNote() {
    if (!editingNoteId) {
      return;
    }

    if (!editingNoteBody.trim()) {
      setError("Note body is required.");
      return;
    }

    const success = await mutate(
      `/api/org/customers/${customerId}/notes/${editingNoteId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body_text: editingNoteBody,
          body_html: editingNoteBody,
        }),
      },
      "Unable to update note.",
    );

    if (success) {
      setEditingNoteId(null);
      setEditingNoteBody("");
    }
  }

  async function handleAddTag(selectedTagName?: string) {
    const name = (selectedTagName ?? tagName).trim();

    if (!name) {
      setError("Tag name is required.");
      return;
    }

    const success = await mutate(
      `/api/org/customers/${customerId}/tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
      "Unable to add tag.",
    );

    if (success) {
      setTagName("");
    }
  }

  async function handleRemoveTag(tagId: string) {
    await mutate(
      `/api/org/customers/${customerId}/tags/${tagId}`,
      { method: "DELETE" },
      "Unable to remove tag.",
    );
  }

  const filteredContacts = useMemo(() => {
    if (!detail) {
      return [];
    }

    const search = contactSearch.trim().toLowerCase();

    if (!search) {
      return detail.contacts;
    }

    return detail.contacts.filter((contact) =>
      [
        fullName(contact),
        contact.job_title,
        contact.department,
        contact.email,
        contact.mobile_number,
        contact.office_phone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }, [contactSearch, detail]);

  const filteredNotes = useMemo(() => {
    if (!detail) {
      return [];
    }

    const search = noteSearch.trim().toLowerCase();

    if (!search) {
      return detail.notes;
    }

    return detail.notes.filter((note) =>
      String(note.body_text || note.body_html || "")
        .toLowerCase()
        .includes(search),
    );
  }, [detail, noteSearch]);

  const filteredActivities = useMemo(() => {
    if (!detail) {
      return [];
    }

    return detail.activities.filter((activity) => {
      if (activityType && activity.activity_type !== activityType) {
        return false;
      }

      if (!activity.occurred_at) {
        return !activityDateFrom && !activityDateTo;
      }

      const activityTime = new Date(activity.occurred_at).getTime();

      if (activityDateFrom) {
        const fromTime = new Date(`${activityDateFrom}T00:00:00`).getTime();

        if (activityTime < fromTime) {
          return false;
        }
      }

      if (activityDateTo) {
        const toTime = new Date(`${activityDateTo}T23:59:59`).getTime();

        if (activityTime > toTime) {
          return false;
        }
      }

      return true;
    });
  }, [activityDateFrom, activityDateTo, activityType, detail]);

  const activityTypes = useMemo(() => {
    if (!detail) {
      return [];
    }

    return Array.from(
      new Set(detail.activities.map((activity) => activity.activity_type)),
    ).sort();
  }, [detail]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Loading customer profile...
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error ?? "Customer not found."}
        </div>
        <Link
          className="mt-4 inline-flex text-sm font-medium text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
          href="/dashboard/customers"
        >
          Back to customers
        </Link>
      </div>
    );
  }

  const { customer } = detail;

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-6 flex flex-col gap-5 border-b border-zinc-200 pb-6 dark:border-zinc-800 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-xl font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {customer.logo_signed_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${customer.company_name} logo`}
                  className="h-full w-full object-contain"
                  src={customer.logo_signed_url}
                />
              ) : (
                customer.company_name.slice(0, 1).toUpperCase()
              )}
            </div>
            <label className="mt-2 block cursor-pointer text-center text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
              {isLogoUploading ? "Uploading..." : "Upload logo"}
              <input
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="sr-only"
                disabled={isLogoUploading}
                onChange={handleLogoUpload}
                type="file"
              />
            </label>
          </div>
          <div>
            <div className="mb-2">
              <Link
                className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                href="/dashboard/customers"
              >
                Customers
              </Link>
            </div>
            <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {customer.company_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-mono">
                {customer.customer_code ?? "Code pending"}
              </span>
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                {formatLabel(customer.customer_status)}
              </span>
              <span>Updated {formatDate(customer.updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className={secondaryButtonClass}
            href={`/dashboard/customers/${customerId}/edit`}
          >
            Edit
          </Link>
          <button
            className={secondaryButtonClass}
            disabled={isWorking}
            onClick={handleArchiveCustomer}
            type="button"
          >
            Archive
          </button>
          <button
            className={secondaryButtonClass}
            disabled={isWorking}
            onClick={() =>
              document.getElementById("customer-note-box")?.focus()
            }
            type="button"
          >
            Add Note
          </button>
          <button
            className={secondaryButtonClass}
            disabled={isWorking}
            onClick={() =>
              document.getElementById("customer-contact-first-name")?.focus()
            }
            type="button"
          >
            Add Contact
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Company Information
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Field label="Legal Name" value={customer.legal_company_name} />
              <Field label="Industry" value={customer.industry} />
              <Field
                label="Business Category"
                value={customer.business_category}
              />
              <Field
                label="Company Type"
                value={formatLabel(customer.company_type)}
              />
              <Field
                label="Business Registration"
                value={customer.business_registration_number}
              />
              <Field label="GST/HST Number" value={customer.gst_hst_number} />
              <Field label="Vendor Number" value={customer.vendor_number} />
              <Field
                label="Record Status"
                value={formatLabel(customer.record_status)}
              />
              <Field label="Created" value={formatDate(customer.created_at)} />
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Addresses
            </h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {detail.addresses.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No addresses saved.
                </p>
              ) : (
                detail.addresses.map((address) => (
                  <div
                    className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                    key={address.id}
                  >
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {addressTitle(address.address_type)}
                    </h3>
                    {address.same_as_head_office ? (
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Same as head office
                      </p>
                    ) : null}
                    <div className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {addressLines(address).length > 0 ? (
                        addressLines(address).map((line) => (
                          <p key={line}>{line}</p>
                        ))
                      ) : (
                        <p>-</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Contacts
              </h2>
              <input
                className={inputClass}
                placeholder="Search contacts"
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
              />
            </div>
            <div className="mt-5 grid gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2 xl:grid-cols-4">
              <input
                className={inputClass}
                id="customer-contact-first-name"
                placeholder="First name"
                value={contactFirstName}
                onChange={(event) => setContactFirstName(event.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Last name"
                value={contactLastName}
                onChange={(event) => setContactLastName(event.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Office phone"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  checked={contactPrimary}
                  onChange={(event) => setContactPrimary(event.target.checked)}
                  type="checkbox"
                />
                Primary contact
              </label>
              <button
                className={buttonClass}
                disabled={isWorking}
                onClick={handleAddContact}
                type="button"
              >
                Add Contact
              </button>
            </div>
            {editingContactId ? (
              <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    Edit Contact
                  </h3>
                  <button
                    className="text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                    onClick={() => setEditingContactId(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input
                    className={inputClass}
                    placeholder="First name"
                    value={editingContactFirstName}
                    onChange={(event) =>
                      setEditingContactFirstName(event.target.value)
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Last name"
                    value={editingContactLastName}
                    onChange={(event) =>
                      setEditingContactLastName(event.target.value)
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Job title"
                    value={editingContactJobTitle}
                    onChange={(event) =>
                      setEditingContactJobTitle(event.target.value)
                    }
                  />
                  <select
                    className={inputClass}
                    value={editingContactDepartment}
                    onChange={(event) =>
                      setEditingContactDepartment(event.target.value)
                    }
                  >
                    {contactDepartments.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    placeholder="Email"
                    type="email"
                    value={editingContactEmail}
                    onChange={(event) =>
                      setEditingContactEmail(event.target.value)
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Mobile"
                    value={editingContactMobile}
                    onChange={(event) =>
                      setEditingContactMobile(event.target.value)
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Office phone"
                    value={editingContactOffice}
                    onChange={(event) =>
                      setEditingContactOffice(event.target.value)
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Extension"
                    value={editingContactExtension}
                    onChange={(event) =>
                      setEditingContactExtension(event.target.value)
                    }
                  />
                  <textarea
                    className="min-h-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 md:col-span-2 xl:col-span-4"
                    placeholder="Notes"
                    value={editingContactNotes}
                    onChange={(event) =>
                      setEditingContactNotes(event.target.value)
                    }
                  />
                  <button
                    className={buttonClass}
                    disabled={isWorking}
                    onClick={saveEditingContact}
                    type="button"
                  >
                    Save Contact
                  </button>
                </div>
              </div>
            ) : null}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-6 text-zinc-500 dark:text-zinc-400"
                        colSpan={7}
                      >
                        No contacts found.
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact) => (
                      <tr key={contact.id}>
                        <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-50">
                          {fullName(contact)}
                          {contact.is_primary ? (
                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                              Primary
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {contact.job_title || "-"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {formatLabel(contact.department)}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {contact.email || "-"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {contact.office_phone ||
                            contact.mobile_number ||
                            "-"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {formatLabel(contact.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="text-xs font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
                              disabled={isWorking}
                              onClick={() => startEditingContact(contact)}
                              type="button"
                            >
                              Edit
                            </button>
                            {!contact.is_primary ? (
                              <button
                                className="text-xs font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
                                disabled={isWorking}
                                onClick={() =>
                                  updateContact(contact.id, {
                                    is_primary: true,
                                  })
                                }
                                type="button"
                              >
                                Primary
                              </button>
                            ) : null}
                            <button
                              className="text-xs font-medium text-red-600 underline-offset-4 hover:underline dark:text-red-300"
                              disabled={isWorking}
                              onClick={() =>
                                updateContact(contact.id, {
                                  status: "archived",
                                })
                              }
                              type="button"
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Internal Notes
              </h2>
              <input
                className={inputClass}
                placeholder="Search notes"
                value={noteSearch}
                onChange={(event) => setNoteSearch(event.target.value)}
              />
            </div>
            <textarea
              className="mt-5 min-h-24 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              id="customer-note-box"
              placeholder="Add an internal note..."
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  checked={notePinned}
                  onChange={(event) => setNotePinned(event.target.checked)}
                  type="checkbox"
                />
                Pin note
              </label>
              <button
                className={buttonClass}
                disabled={isWorking}
                onClick={handleAddNote}
                type="button"
              >
                Add Note
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {filteredNotes.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No notes found.
                </p>
              ) : (
                filteredNotes.map((note) => (
                  <article
                    className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                    key={note.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                        {profileName(note.author)}
                      </p>
                      <div className="flex items-center gap-2">
                        {note.is_pinned ? (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            Pinned
                          </span>
                        ) : null}
                        <button
                          className="text-xs font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
                          disabled={isWorking}
                          onClick={() => startEditingNote(note)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
                          disabled={isWorking}
                          onClick={() =>
                            updateNote(note.id, { is_pinned: !note.is_pinned })
                          }
                          type="button"
                        >
                          {note.is_pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          className="text-xs font-medium text-red-600 underline-offset-4 hover:underline dark:text-red-300"
                          disabled={isWorking}
                          onClick={() =>
                            updateNote(note.id, { status: "archived" })
                          }
                          type="button"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="mt-3 space-y-3">
                        <textarea
                          className="min-h-24 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                          value={editingNoteBody}
                          onChange={(event) =>
                            setEditingNoteBody(event.target.value)
                          }
                        />
                        <div className="flex gap-2">
                          <button
                            className={buttonClass}
                            disabled={isWorking}
                            onClick={saveEditingNote}
                            type="button"
                          >
                            Save Note
                          </button>
                          <button
                            className={secondaryButtonClass}
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteBody("");
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                        {note.body_text || note.body_html || "-"}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(note.updated_at ?? note.created_at)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Tags
            </h2>
            <div className="mt-4 flex gap-2">
              <input
                className={inputClass}
                placeholder="Custom tag"
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
              />
              <button
                className={buttonClass}
                disabled={isWorking}
                onClick={() => void handleAddTag()}
                type="button"
              >
                Add
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedTags.map((tag) => (
                <button
                  className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  disabled={isWorking}
                  key={tag}
                  onClick={() => void handleAddTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.tags.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No tags assigned.
                </p>
              ) : (
                detail.tags.map((tag) => (
                  <button
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                    disabled={isWorking}
                    key={tag.id}
                    onClick={() => void handleRemoveTag(tag.id)}
                    style={{ backgroundColor: tag.color }}
                    title="Remove tag"
                    type="button"
                  >
                    {tag.name} x
                  </button>
                ))
              )}
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Sales Information
            </h2>
            <div className="mt-5 space-y-4">
              <Field
                label="Assigned Sales Rep"
                value={profileName(customer.assigned_sales_rep)}
              />
              <Field
                label="Account Manager"
                value={profileName(customer.account_manager)}
              />
              <Field label="Lead Source" value={customer.lead_source} />
              <Field label="Referral Source" value={customer.referral_source} />
              <Field
                label="Customer Since"
                value={formatPlainDate(customer.customer_since)}
              />
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Credit Information
            </h2>
            <div className="mt-5 space-y-4">
              <Field
                label="Credit Limit"
                value={formatCurrency(customer.credit_limit, customer.currency)}
              />
              <Field
                label="Credit Terms"
                value={formatLabel(customer.credit_terms)}
              />
              <Field label="Currency" value={customer.currency} />
              <Field
                label="Tax Exempt"
                value={customer.tax_exempt ? "Yes" : "No"}
              />
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Payment Information
            </h2>
            <div className="mt-5 space-y-4">
              <Field
                label="Payment Method"
                value={formatLabel(customer.preferred_payment_method)}
              />
              <Field
                label="Accounts Payable Email"
                value={customer.accounts_payable_email}
              />
              <Field label="Invoice Email" value={customer.invoice_email} />
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Activity Timeline
              </h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  className={inputClass}
                  value={activityType}
                  onChange={(event) => setActivityType(event.target.value)}
                >
                  <option value="">All activity</option>
                  {activityTypes.map((type) => (
                    <option key={type} value={type}>
                      {formatLabel(type)}
                    </option>
                  ))}
                </select>
                <input
                  className={inputClass}
                  type="date"
                  value={activityDateFrom}
                  onChange={(event) => setActivityDateFrom(event.target.value)}
                />
                <input
                  className={inputClass}
                  type="date"
                  value={activityDateTo}
                  onChange={(event) => setActivityDateTo(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {filteredActivities.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No activity yet.
                </p>
              ) : (
                filteredActivities.map((activity) => (
                  <article
                    className="border-l border-zinc-200 pl-4 dark:border-zinc-800"
                    key={activity.id}
                  >
                    <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                      {activity.description}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(activity.occurred_at)} by{" "}
                      {profileName(activity.actor)}
                    </p>
                    {activity.linked_record_type ||
                    activity.linked_record_number ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatLabel(activity.linked_record_type)}{" "}
                        {activity.linked_record_number ?? ""}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className={valueClass}>{value || "-"}</p>
    </div>
  );
}
