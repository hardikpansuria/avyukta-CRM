"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Assignee = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type AddressForm = {
  address_line_1: string;
  address_line_2: string;
  city: string;
  province_state: string;
  postal_code: string;
  country: string;
};

type ContactForm = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string;
  email: string;
  mobile_number: string;
  office_phone: string;
  extension: string;
  is_primary: boolean;
  notes: string;
};

const inputClass =
  "mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";
const textareaClass =
  "mt-2 min-h-24 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";
const labelClass = "text-sm font-medium text-zinc-800 dark:text-zinc-200";

const COMPANY_TYPES = [
  ["manufacturer", "Manufacturer"],
  ["distributor", "Distributor"],
  ["supplier", "Supplier"],
  ["importer", "Importer"],
  ["exporter", "Exporter"],
  ["contractor", "Contractor"],
  ["food_processing", "Food Processing"],
  ["dairy", "Dairy"],
  ["bakery", "Bakery"],
  ["brewery", "Brewery"],
  ["pharmaceutical", "Pharmaceutical"],
  ["chemical", "Chemical"],
  ["packaging", "Packaging"],
  ["engineering", "Engineering"],
  ["other", "Other"],
];
const INDUSTRIES = [
  "Food & Beverage",
  "Dairy",
  "Bakery",
  "Brewery",
  "Pharmaceutical",
  "Chemical",
  "Packaging",
  "Manufacturing",
  "Engineering",
  "Other",
];
const BUSINESS_CATEGORIES = [
  "OEM",
  "End User",
  "Distributor",
  "Supplier",
  "Contractor",
  "Service",
  "Other",
];
const DEPARTMENTS = [
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
const CUSTOMER_STATUSES = [
  ["prospect", "Prospect"],
  ["active", "Active"],
  ["inactive", "Inactive"],
  ["blacklisted", "Blacklisted"],
];
const CREDIT_TERMS = [
  ["due_on_receipt", "Due on Receipt"],
  ["net_15", "Net 15"],
  ["net_30", "Net 30"],
  ["net_45", "Net 45"],
  ["net_60", "Net 60"],
];
const PAYMENT_METHODS = [
  ["eft", "EFT"],
  ["cheque", "Cheque"],
  ["wire_transfer", "Wire Transfer"],
  ["credit_card", "Credit Card"],
];

function emptyAddress(): AddressForm {
  return {
    address_line_1: "",
    address_line_2: "",
    city: "",
    province_state: "",
    postal_code: "",
    country: "Canada",
  };
}

function newContact(): ContactForm {
  return {
    id: crypto.randomUUID(),
    first_name: "",
    last_name: "",
    job_title: "",
    department: "",
    email: "",
    mobile_number: "",
    office_phone: "",
    extension: "",
    is_primary: false,
    notes: "",
  };
}

function hasContactValue(contact: ContactForm) {
  return [
    contact.first_name,
    contact.last_name,
    contact.job_title,
    contact.department,
    contact.email,
    contact.mobile_number,
    contact.office_phone,
    contact.extension,
    contact.notes,
  ].some((value) => value.trim().length > 0);
}

function assigneeName(assignee: Assignee) {
  return assignee.full_name || assignee.email || "Unnamed user";
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [legalCompanyName, setLegalCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] =
    useState("");
  const [gstHstNumber, setGstHstNumber] = useState("");
  const [vendorNumber, setVendorNumber] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [headOfficeAddress, setHeadOfficeAddress] = useState<AddressForm>(
    emptyAddress,
  );
  const [billingAddress, setBillingAddress] = useState<AddressForm>(
    emptyAddress,
  );
  const [billingSameAsHeadOffice, setBillingSameAsHeadOffice] = useState(true);
  const [contacts, setContacts] = useState<ContactForm[]>([]);
  const [assignedSalesRepId, setAssignedSalesRepId] = useState("");
  const [accountManagerId, setAccountManagerId] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [customerSince, setCustomerSince] = useState("");
  const [customerStatus, setCustomerStatus] = useState("prospect");
  const [creditLimit, setCreditLimit] = useState("0");
  const [creditTerms, setCreditTerms] = useState("net_30");
  const [taxExempt, setTaxExempt] = useState(false);
  const [currency, setCurrency] = useState("CAD");
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState("");
  const [accountsPayableEmail, setAccountsPayableEmail] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const salesAssignees = useMemo(
    () =>
      assignees.filter((assignee) =>
        ["admin", "sales"].includes(assignee.role),
      ),
    [assignees],
  );

  useEffect(() => {
    async function loadAssignees() {
      try {
        const response = await fetch("/api/org/customer-assignees", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          assignees?: Assignee[];
          error?: string;
        } | null;

        if (!response.ok) {
          setError(payload?.error ?? "Unable to load assignees.");
          return;
        }

        setAssignees(payload?.assignees ?? []);
      } catch {
        setError("Unable to load assignees.");
      }
    }

    void loadAssignees();
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  function updateAddress(
    setter: (address: AddressForm) => void,
    current: AddressForm,
    field: keyof AddressForm,
    value: string,
  ) {
    setter({ ...current, [field]: value });
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }

    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function addContact() {
    setContacts((currentContacts) => {
      const contact = newContact();
      contact.is_primary = currentContacts.length === 0;
      return [...currentContacts, contact];
    });
  }

  function updateContact(
    contactId: string,
    field: keyof ContactForm,
    value: string | boolean,
  ) {
    setContacts((currentContacts) =>
      currentContacts.map((contact) => {
        if (field === "is_primary") {
          return {
            ...contact,
            is_primary: contact.id === contactId ? Boolean(value) : false,
          };
        }

        return contact.id === contactId ? { ...contact, [field]: value } : contact;
      }),
    );
  }

  function removeContact(contactId: string) {
    setContacts((currentContacts) => {
      const remainingContacts = currentContacts.filter(
        (contact) => contact.id !== contactId,
      );

      if (
        remainingContacts.length > 0 &&
        remainingContacts.every((contact) => !contact.is_primary)
      ) {
        return remainingContacts.map((contact, index) => ({
          ...contact,
          is_primary: index === 0,
        }));
      }

      return remainingContacts;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    const invalidContact = contacts.find(
      (contact) => hasContactValue(contact) && !contact.first_name.trim(),
    );

    if (invalidContact) {
      setError("Each contact with details must include a first name.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/org/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_name: companyName,
          legal_company_name: legalCompanyName,
          industry,
          business_category: businessCategory,
          company_type: companyType,
          business_registration_number: businessRegistrationNumber,
          gst_hst_number: gstHstNumber,
          vendor_number: vendorNumber,
          assigned_sales_rep_id: assignedSalesRepId,
          account_manager_id: accountManagerId,
          lead_source: leadSource,
          referral_source: referralSource,
          customer_since: customerSince,
          customer_status: customerStatus,
          credit_limit: creditLimit,
          credit_terms: creditTerms,
          tax_exempt: taxExempt,
          currency,
          preferred_payment_method: preferredPaymentMethod,
          accounts_payable_email: accountsPayableEmail,
          invoice_email: invoiceEmail,
          addresses: {
            head_office: headOfficeAddress,
            billing: {
              ...billingAddress,
              same_as_head_office: billingSameAsHeadOffice,
            },
          },
          contacts: contacts.map((contact) => ({
            first_name: contact.first_name,
            last_name: contact.last_name,
            job_title: contact.job_title,
            department: contact.department,
            email: contact.email,
            mobile_number: contact.mobile_number,
            office_phone: contact.office_phone,
            extension: contact.extension,
            is_primary: contact.is_primary,
            notes: contact.notes,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        customer?: { id: string; customer_code?: string | null };
        error?: string;
        message?: string;
      } | null;

      if (!response.ok || !payload?.customer) {
        setError(payload?.error ?? "Unable to create customer.");
        return;
      }

      setMessage(
        payload.customer.customer_code
          ? `Customer ${payload.customer.customer_code} created.`
          : "Customer created.",
      );
      router.push(`/dashboard/customers/${payload.customer.id}`);
    } catch {
      setError("Unable to create customer.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="mx-auto max-w-6xl pb-24" onSubmit={handleSubmit}>
      <div className="mb-6 flex flex-col gap-3 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            New Customer
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Create a complete company profile for this organization.
          </p>
        </div>
        <Link
          className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          href="/dashboard/customers"
        >
          Back to customers
        </Link>
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

      <div className="space-y-6">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Company Information
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>Company Name</span>
              <input
                className={inputClass}
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                required
              />
            </label>
            <label>
              <span className={labelClass}>Legal Company Name</span>
              <input
                className={inputClass}
                value={legalCompanyName}
                onChange={(event) => setLegalCompanyName(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Customer Code</span>
              <input
                className={`${inputClass} bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400`}
                readOnly
                value="Generated after save"
              />
            </label>
            <label>
              <span className={labelClass}>Company Logo</span>
              <input
                accept="image/*"
                className={inputClass}
                onChange={handleLogoChange}
                type="file"
              />
            </label>
            {logoPreview ? (
              <div className="md:col-span-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Logo preview"
                  className="h-24 w-24 rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
                  src={logoPreview}
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Logo upload will be saved in the customer detail step.
                </p>
              </div>
            ) : null}
            <label>
              <span className={labelClass}>Industry</span>
              <select
                className={inputClass}
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Business Category</span>
              <select
                className={inputClass}
                value={businessCategory}
                onChange={(event) => setBusinessCategory(event.target.value)}
              >
                <option value="">Select category</option>
                {BUSINESS_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Company Type</span>
              <select
                className={inputClass}
                value={companyType}
                onChange={(event) => setCompanyType(event.target.value)}
              >
                <option value="">Select type</option>
                {COMPANY_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Business Registration Number</span>
              <input
                className={inputClass}
                value={businessRegistrationNumber}
                onChange={(event) =>
                  setBusinessRegistrationNumber(event.target.value)
                }
              />
            </label>
            <label>
              <span className={labelClass}>GST/HST Number</span>
              <input
                className={inputClass}
                value={gstHstNumber}
                onChange={(event) => setGstHstNumber(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Vendor Number</span>
              <input
                className={inputClass}
                value={vendorNumber}
                onChange={(event) => setVendorNumber(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Addresses
          </h2>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <AddressFields
              address={headOfficeAddress}
              onChange={(field, value) =>
                updateAddress(
                  setHeadOfficeAddress,
                  headOfficeAddress,
                  field,
                  value,
                )
              }
              title="Head Office Address"
            />
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Billing Address
                </h3>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    checked={billingSameAsHeadOffice}
                    onChange={(event) =>
                      setBillingSameAsHeadOffice(event.target.checked)
                    }
                    type="checkbox"
                  />
                  Same as Head Office
                </label>
              </div>
              {!billingSameAsHeadOffice ? (
                <div className="mt-4">
                  <AddressFields
                    address={billingAddress}
                    onChange={(field, value) =>
                      updateAddress(
                        setBillingAddress,
                        billingAddress,
                        field,
                        value,
                      )
                    }
                    title=""
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  Billing will use the head office address.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Contacts
            </h2>
            <button
              className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              onClick={addContact}
              type="button"
            >
              Add Contact
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {contacts.length === 0 ? (
              <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                No contacts added yet.
              </p>
            ) : (
              contacts.map((contact, index) => (
                <div
                  className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                  key={contact.id}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      Contact {index + 1}
                    </h3>
                    <button
                      className="text-sm font-medium text-red-600 transition hover:text-red-700 dark:text-red-300"
                      onClick={() => removeContact(contact.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label>
                      <span className={labelClass}>First Name</span>
                      <input
                        className={inputClass}
                        value={contact.first_name}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "first_name",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Last Name</span>
                      <input
                        className={inputClass}
                        value={contact.last_name}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "last_name",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Job Title</span>
                      <input
                        className={inputClass}
                        value={contact.job_title}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "job_title",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Department</span>
                      <select
                        className={inputClass}
                        value={contact.department}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "department",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Select department</option>
                        {DEPARTMENTS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className={labelClass}>Email Address</span>
                      <input
                        className={inputClass}
                        type="email"
                        value={contact.email}
                        onChange={(event) =>
                          updateContact(contact.id, "email", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Mobile Number</span>
                      <input
                        className={inputClass}
                        value={contact.mobile_number}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "mobile_number",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Office Phone</span>
                      <input
                        className={inputClass}
                        value={contact.office_phone}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "office_phone",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Extension</span>
                      <input
                        className={inputClass}
                        value={contact.extension}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "extension",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 pt-8 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        checked={contact.is_primary}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "is_primary",
                            event.target.checked,
                          )
                        }
                        type="radio"
                      />
                      Primary Contact
                    </label>
                    <label className="md:col-span-2">
                      <span className={labelClass}>Notes</span>
                      <textarea
                        className={textareaClass}
                        value={contact.notes}
                        onChange={(event) =>
                          updateContact(contact.id, "notes", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Sales Information
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>Assigned Sales Representative</span>
              <select
                className={inputClass}
                value={assignedSalesRepId}
                onChange={(event) => setAssignedSalesRepId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {salesAssignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assigneeName(assignee)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Account Manager</span>
              <select
                className={inputClass}
                value={accountManagerId}
                onChange={(event) => setAccountManagerId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assigneeName(assignee)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Lead Source</span>
              <input
                className={inputClass}
                value={leadSource}
                onChange={(event) => setLeadSource(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Referral Source</span>
              <input
                className={inputClass}
                value={referralSource}
                onChange={(event) => setReferralSource(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Customer Since</span>
              <input
                className={inputClass}
                type="date"
                value={customerSince}
                onChange={(event) => setCustomerSince(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Customer Status</span>
              <select
                className={inputClass}
                value={customerStatus}
                onChange={(event) => setCustomerStatus(event.target.value)}
              >
                {CUSTOMER_STATUSES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Credit Information
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>Credit Limit</span>
              <input
                className={inputClass}
                min="0"
                step="0.01"
                type="number"
                value={creditLimit}
                onChange={(event) => setCreditLimit(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Credit Terms</span>
              <select
                className={inputClass}
                value={creditTerms}
                onChange={(event) => setCreditTerms(event.target.value)}
              >
                {CREDIT_TERMS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Currency</span>
              <select
                className={inputClass}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-8 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                checked={taxExempt}
                onChange={(event) => setTaxExempt(event.target.checked)}
                type="checkbox"
              />
              Tax Exempt
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Payment Information
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>Preferred Payment Method</span>
              <select
                className={inputClass}
                value={preferredPaymentMethod}
                onChange={(event) =>
                  setPreferredPaymentMethod(event.target.value)
                }
              >
                <option value="">Select payment method</option>
                {PAYMENT_METHODS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Accounts Payable Email</span>
              <input
                className={inputClass}
                type="email"
                value={accountsPayableEmail}
                onChange={(event) => setAccountsPayableEmail(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Invoice Email</span>
              <input
                className={inputClass}
                type="email"
                value={invoiceEmail}
                onChange={(event) => setInvoiceEmail(event.target.value)}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">
            Customer code will be generated after save.
          </p>
          <div className="ml-auto flex gap-3">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              href="/dashboard/customers"
            >
              Cancel
            </Link>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Creating..." : "Create Customer"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function AddressFields({
  address,
  onChange,
  title,
}: {
  address: AddressForm;
  onChange: (field: keyof AddressForm, value: string) => void;
  title: string;
}) {
  return (
    <div>
      {title ? (
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {title}
        </h3>
      ) : null}
      <div className="mt-4 grid gap-4">
        <label>
          <span className={labelClass}>Address Line 1</span>
          <input
            className={inputClass}
            value={address.address_line_1}
            onChange={(event) => onChange("address_line_1", event.target.value)}
          />
        </label>
        <label>
          <span className={labelClass}>Address Line 2</span>
          <input
            className={inputClass}
            value={address.address_line_2}
            onChange={(event) => onChange("address_line_2", event.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>City</span>
            <input
              className={inputClass}
              value={address.city}
              onChange={(event) => onChange("city", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>Province/State</span>
            <input
              className={inputClass}
              value={address.province_state}
              onChange={(event) =>
                onChange("province_state", event.target.value)
              }
            />
          </label>
          <label>
            <span className={labelClass}>Postal Code</span>
            <input
              className={inputClass}
              value={address.postal_code}
              onChange={(event) => onChange("postal_code", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>Country</span>
            <input
              className={inputClass}
              value={address.country}
              onChange={(event) => onChange("country", event.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
