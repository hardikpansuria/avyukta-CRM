import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getEffectiveOrganizationBranding } from "@/lib/organizations/branding";
import { isOrgScopedStoragePath } from "@/lib/supabase/storage-path";

import type { WorkCompletionPdfData } from "./work-completion-pdf";

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function addressLine(address: Record<string, unknown> | null | undefined) {
  if (!address) return null;
  return [
    text(address.address_line_1),
    text(address.address_line_2),
    [text(address.city), text(address.province_state)].filter(Boolean).join(", "),
    text(address.postal_code),
  ].filter(Boolean).join(", ") || null;
}

async function organizationLogo(
  admin: SupabaseClient,
  orgId: string,
  storagePath: unknown,
) {
  const path = text(storagePath);
  if (!path || !isOrgScopedStoragePath(path, orgId)) return null;
  const { data, error } = await admin.storage.from("crm-assets").download(path);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  return `data:${data.type || "image/png"};base64,${bytes.toString("base64")}`;
}

export async function getWorkCompletionPdfData(
  admin: SupabaseClient,
  orgId: string,
  jobId: string,
  completionId: string,
): Promise<{ data?: WorkCompletionPdfData; error?: unknown; notFound?: boolean }> {
  const [jobResult, completionResult, organizationResult] = await Promise.all([
    admin.from("jobs").select("*").eq("id", jobId).eq("org_id", orgId).maybeSingle(),
    admin.from("job_work_completions").select("*").eq("id", completionId).eq("job_id", jobId).eq("org_id", orgId).maybeSingle(),
    admin.from("organizations").select("name,logo_storage_path,quotation_company_name,quotation_phone,quotation_fax,quotation_footer_text").eq("id", orgId).maybeSingle(),
  ]);
  const firstError = jobResult.error ?? completionResult.error ?? organizationResult.error;
  if (firstError) return { error: firstError };
  if (!jobResult.data || !completionResult.data || !organizationResult.data) return { notFound: true };

  const job = jobResult.data;
  const completion = completionResult.data;
  const brandingResult = await getEffectiveOrganizationBranding(
    admin,
    orgId,
    String(completion.completion_date).slice(0, 10),
    organizationResult.data,
  );
  if (!brandingResult.data) return { error: brandingResult.error };
  const branding = brandingResult.data;
  const [quotationResult, customerResult, allocationResult, techniciansResult, scopesResult] = await Promise.all([
    admin.from("quotations").select("id,quotation_number,quote_date,project_name,project_location,sales_rep_id").eq("id", job.latest_accepted_quotation_id).eq("org_id", orgId).maybeSingle(),
    admin.from("customers").select("id,company_name").eq("id", job.customer_id).eq("org_id", orgId).maybeSingle(),
    admin.from("job_purchase_order_allocations").select("purchase_order_id,quotation_number_snapshot").eq("job_id", jobId).eq("org_id", orgId).maybeSingle(),
    admin.from("job_work_completion_technicians").select("employee_id,employee_name_snapshot,sort_order").eq("completion_id", completionId).eq("org_id", orgId).order("sort_order", { ascending: true }),
    admin.from("job_work_completion_scopes").select("scope_id,scope_title_snapshot,scope_description_snapshot,sort_order").eq("completion_id", completionId).eq("org_id", orgId).order("sort_order", { ascending: true }),
  ]);
  const relatedError = quotationResult.error ?? customerResult.error ?? allocationResult.error ?? techniciansResult.error ?? scopesResult.error;
  if (relatedError) return { error: relatedError };
  if (!quotationResult.data || !customerResult.data || !allocationResult.data) return { notFound: true };

  const technicianIds = (techniciansResult.data ?? []).map((row) => row.employee_id);
  const [purchaseOrderResult, contactsResult, addressesResult, employeesResult, salespersonResult] = await Promise.all([
    admin.from("job_purchase_orders").select("id,po_number,po_received_date").eq("id", allocationResult.data.purchase_order_id).eq("org_id", orgId).maybeSingle(),
    admin.from("customer_contacts").select("first_name,last_name,job_title,email,mobile_number,office_phone,is_primary").eq("customer_id", job.customer_id).eq("org_id", orgId).eq("status", "active").order("is_primary", { ascending: false }).limit(1),
    admin.from("customer_addresses").select("address_type,address_line_1,address_line_2,city,province_state,postal_code").eq("customer_id", job.customer_id).eq("org_id", orgId).eq("status", "active"),
    technicianIds.length
      ? admin.from("employee_directory").select("id,employee_name").eq("org_id", orgId).in("id", technicianIds)
      : Promise.resolve({ data: [], error: null }),
    job.salesperson_id
      ? admin.from("profiles").select("full_name,email").eq("id", job.salesperson_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const detailError = purchaseOrderResult.error ?? contactsResult.error ?? addressesResult.error ?? employeesResult.error ?? salespersonResult.error;
  if (detailError) return { error: detailError };
  if (!purchaseOrderResult.data) return { notFound: true };

  const contact = contactsResult.data?.[0] ?? null;
  const addresses = (addressesResult.data ?? []) as Array<Record<string, unknown>>;
  const shipping = addresses.find((row) => row.address_type === "shipping");
  const headOffice = addresses.find((row) => row.address_type === "head_office");
  const employeeNames = new Map((employeesResult.data ?? []).map((row) => [row.id, row.employee_name]));
  const logoDataUrl = await organizationLogo(
    admin,
    orgId,
    branding.logo_storage_path,
  );

  return {
    data: {
      organization: {
        company_name: branding.company_name,
        phone: branding.phone,
        fax: branding.fax,
        footer_text: branding.footer_text,
      },
      logo_data_url: logoDataUrl,
      certificate: {
        number: completion.certificate_number,
        revision_number: Number(completion.revision_number ?? 1),
        completion_date: completion.completion_date,
        status: completion.completion_status,
        completion_notes: text(completion.completion_notes),
        outstanding_items: text(completion.outstanding_items),
      },
      job: {
        job_number: text(job.job_number) || "-",
        work_order_number: text(job.work_order_number) || text(job.job_number) || "-",
        project_name: text(quotationResult.data.project_name) || "-",
        job_start_date: text(purchaseOrderResult.data.po_received_date) || text(job.accepted_at),
        job_site: text(quotationResult.data.project_location) || addressLine(shipping ?? headOffice) || "-",
      },
      quotation: {
        number: text(quotationResult.data.quotation_number) || text(allocationResult.data.quotation_number_snapshot) || "-",
        date: text(quotationResult.data.quote_date),
        sales_representative: text(salespersonResult.data?.full_name) || text(salespersonResult.data?.email) || "-",
      },
      purchase_order: {
        number: text(purchaseOrderResult.data.po_number) || "-",
        date: text(purchaseOrderResult.data.po_received_date),
      },
      customer: {
        company_name: text(customerResult.data.company_name) || "-",
        contact_name: contact ? [text(contact.first_name), text(contact.last_name)].filter(Boolean).join(" ") || "-" : "-",
        contact_position: text(contact?.job_title),
        phone: text(contact?.office_phone) || text(contact?.mobile_number),
        email: text(contact?.email),
        address: addressLine(headOffice),
        job_site: text(quotationResult.data.project_location) || addressLine(shipping ?? headOffice),
      },
      technicians: (techniciansResult.data ?? []).map((row) => ({
        employee_id: row.employee_id,
        employee_name: employeeNames.get(row.employee_id) || row.employee_name_snapshot,
      })),
      scopes: (scopesResult.data ?? []).map((row) => ({
        id: row.scope_id,
        title: row.scope_title_snapshot,
        description: text(row.scope_description_snapshot),
      })),
    },
  };
}
