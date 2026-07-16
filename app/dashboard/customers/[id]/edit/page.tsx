"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Assignee = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type Customer = {
  id: string;
  company_name: string;
  legal_company_name?: string | null;
  industry?: string | null;
  business_category?: string | null;
  company_type?: string | null;
  business_registration_number?: string | null;
  gst_hst_number?: string | null;
  vendor_number?: string | null;
  assigned_sales_rep_id?: string | null;
  account_manager_id?: string | null;
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
};

type Address = {
  address_type: string;
  same_as_head_office?: boolean | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  province_state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

type CustomerDetail = {
  customer: Customer;
  addresses: Address[];
};

type AddressForm = {
  address_line_1: string;
  address_line_2: string;
  city: string;
  province_state: string;
  postal_code: string;
  country: string;
};

const inputClass =
  "mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";
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

function fromAddress(address: Address | undefined): AddressForm {
  return {
    address_line_1: address?.address_line_1 ?? "",
    address_line_2: address?.address_line_2 ?? "",
    city: address?.city ?? "",
    province_state: address?.province_state ?? "",
    postal_code: address?.postal_code ?? "",
    country: address?.country ?? "Canada",
  };
}

function assigneeName(assignee: Assignee) {
  return assignee.full_name || assignee.email || "Unnamed user";
}

function nullable(value: string | number | boolean | null | undefined) {
  return value ?? "";
}

export default function EditCustomerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = params.id;
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [legalCompanyName, setLegalCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] =
    useState("");
  const [gstHstNumber, setGstHstNumber] = useState("");
  const [vendorNumber, setVendorNumber] = useState("");
  const [headOfficeAddress, setHeadOfficeAddress] = useState<AddressForm>(
    emptyAddress,
  );
  const [billingAddress, setBillingAddress] = useState<AddressForm>(
    emptyAddress,
  );
  const [billingSameAsHeadOffice, setBillingSameAsHeadOffice] = useState(false);
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

  const salesAssignees = useMemo(
    () =>
      assignees.filter((assignee) =>
        ["admin", "sales"].includes(assignee.role),
      ),
    [assignees],
  );

  useEffect(() => {
    async function loadData() {
      setError(null);
      setIsLoading(true);

      try {
        const [customerResponse, assigneesResponse] = await Promise.all([
          fetch(`/api/org/customers/${customerId}`, { cache: "no-store" }),
          fetch("/api/org/customer-assignees", { cache: "no-store" }),
        ]);
        const customerPayload = (await customerResponse
          .json()
          .catch(() => null)) as (CustomerDetail & { error?: string }) | null;
        const assigneesPayload = (await assigneesResponse
          .json()
          .catch(() => null)) as { assignees?: Assignee[]; error?: string } | null;

        if (!customerResponse.ok || !customerPayload?.customer) {
          setError(customerPayload?.error ?? "Unable to load customer.");
          return;
        }

        if (!assigneesResponse.ok) {
          setError(assigneesPayload?.error ?? "Unable to load assignees.");
          return;
        }

        const customer = customerPayload.customer;
        const headOffice = customerPayload.addresses.find(
          (address) => address.address_type === "head_office",
        );
        const billing = customerPayload.addresses.find(
          (address) => address.address_type === "billing",
        );

        setCompanyName(customer.company_name);
        setLegalCompanyName(customer.legal_company_name ?? "");
        setIndustry(customer.industry ?? "");
        setBusinessCategory(customer.business_category ?? "");
        setCompanyType(customer.company_type ?? "");
        setBusinessRegistrationNumber(
          customer.business_registration_number ?? "",
        );
        setGstHstNumber(customer.gst_hst_number ?? "");
        setVendorNumber(customer.vendor_number ?? "");
        setHeadOfficeAddress(fromAddress(headOffice));
        setBillingAddress(fromAddress(billing));
        setBillingSameAsHeadOffice(Boolean(billing?.same_as_head_office));
        setAssignedSalesRepId(customer.assigned_sales_rep_id ?? "");
        setAccountManagerId(customer.account_manager_id ?? "");
        setLeadSource(customer.lead_source ?? "");
        setReferralSource(customer.referral_source ?? "");
        setCustomerSince(customer.customer_since ?? "");
        setCustomerStatus(customer.customer_status);
        setCreditLimit(String(nullable(customer.credit_limit)));
        setCreditTerms(customer.credit_terms ?? "net_30");
        setTaxExempt(Boolean(customer.tax_exempt));
        setCurrency(customer.currency ?? "CAD");
        setPreferredPaymentMethod(customer.preferred_payment_method ?? "");
        setAccountsPayableEmail(customer.accounts_payable_email ?? "");
        setInvoiceEmail(customer.invoice_email ?? "");
        setAssignees(assigneesPayload?.assignees ?? []);
      } catch {
        setError("Unable to load customer.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [customerId]);

  function updateAddress(
    setter: (address: AddressForm) => void,
    current: AddressForm,
    field: keyof AddressForm,
    value: string,
  ) {
    setter({ ...current, [field]: value });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/org/customers/${customerId}`, {
        method: "PATCH",
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
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to update customer.");
        return;
      }

      router.push(`/dashboard/customers/${customerId}`);
    } catch {
      setError("Unable to update customer.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Loading customer editor...
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-6xl pb-24" onSubmit={handleSubmit}>
      <div className="mb-6 flex flex-col gap-3 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Edit Customer
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Update company profile, address, sales, credit, and payment details.
          </p>
        </div>
        <Link
          className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          href={`/dashboard/customers/${customerId}`}
        >
          Back to customer
        </Link>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Company Information
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextField label="Company Name" required value={companyName} onChange={setCompanyName} />
            <TextField label="Legal Company Name" value={legalCompanyName} onChange={setLegalCompanyName} />
            <SelectField label="Industry" value={industry} onChange={setIndustry} options={INDUSTRIES.map((item) => [item, item])} placeholder="Select industry" />
            <SelectField label="Business Category" value={businessCategory} onChange={setBusinessCategory} options={BUSINESS_CATEGORIES.map((item) => [item, item])} placeholder="Select category" />
            <SelectField label="Company Type" value={companyType} onChange={setCompanyType} options={COMPANY_TYPES} placeholder="Select type" />
            <TextField label="Business Registration Number" value={businessRegistrationNumber} onChange={setBusinessRegistrationNumber} />
            <TextField label="GST/HST Number" value={gstHstNumber} onChange={setGstHstNumber} />
            <TextField label="Vendor Number" value={vendorNumber} onChange={setVendorNumber} />
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
                updateAddress(setHeadOfficeAddress, headOfficeAddress, field, value)
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
                      updateAddress(setBillingAddress, billingAddress, field, value)
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
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Sales Information
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SelectField label="Assigned Sales Representative" value={assignedSalesRepId} onChange={setAssignedSalesRepId} options={salesAssignees.map((assignee) => [assignee.id, assigneeName(assignee)])} placeholder="Unassigned" />
            <SelectField label="Account Manager" value={accountManagerId} onChange={setAccountManagerId} options={assignees.map((assignee) => [assignee.id, assigneeName(assignee)])} placeholder="Unassigned" />
            <TextField label="Lead Source" value={leadSource} onChange={setLeadSource} />
            <TextField label="Referral Source" value={referralSource} onChange={setReferralSource} />
            <TextField label="Customer Since" type="date" value={customerSince} onChange={setCustomerSince} />
            <SelectField label="Customer Status" value={customerStatus} onChange={setCustomerStatus} options={CUSTOMER_STATUSES} />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Credit & Payment
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextField label="Credit Limit" min="0" step="0.01" type="number" value={creditLimit} onChange={setCreditLimit} />
            <SelectField label="Credit Terms" value={creditTerms} onChange={setCreditTerms} options={CREDIT_TERMS} />
            <SelectField label="Currency" value={currency} onChange={setCurrency} options={[["CAD", "CAD"], ["USD", "USD"], ["EUR", "EUR"]]} />
            <label className="flex items-center gap-2 pt-8 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                checked={taxExempt}
                onChange={(event) => setTaxExempt(event.target.checked)}
                type="checkbox"
              />
              Tax Exempt
            </label>
            <SelectField label="Preferred Payment Method" value={preferredPaymentMethod} onChange={setPreferredPaymentMethod} options={PAYMENT_METHODS} placeholder="Select payment method" />
            <TextField label="Accounts Payable Email" type="email" value={accountsPayableEmail} onChange={setAccountsPayableEmail} />
            <TextField label="Invoice Email" type="email" value={invoiceEmail} onChange={setInvoiceEmail} />
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            href={`/dashboard/customers/${customerId}`}
          >
            Cancel
          </Link>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input
        className={inputClass}
        min={min}
        required={required}
        step={step}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
  placeholder?: string;
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <select
        className={inputClass}
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
        <TextField
          label="Address Line 1"
          value={address.address_line_1}
          onChange={(value) => onChange("address_line_1", value)}
        />
        <TextField
          label="Address Line 2"
          value={address.address_line_2}
          onChange={(value) => onChange("address_line_2", value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="City"
            value={address.city}
            onChange={(value) => onChange("city", value)}
          />
          <TextField
            label="Province/State"
            value={address.province_state}
            onChange={(value) => onChange("province_state", value)}
          />
          <TextField
            label="Postal Code"
            value={address.postal_code}
            onChange={(value) => onChange("postal_code", value)}
          />
          <TextField
            label="Country"
            value={address.country}
            onChange={(value) => onChange("country", value)}
          />
        </div>
      </div>
    </div>
  );
}
