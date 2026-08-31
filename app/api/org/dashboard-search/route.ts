import { NextResponse } from "next/server";

import { getEffectivePermissionKeys } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchResult = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });
  const safe = query.replace(/[,%_()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (safe.length < 2) return NextResponse.json({ results: [] });

  const permissions = await getEffectivePermissionKeys(session);
  const admin = createAdminClient();
  const org = session.org_id;
  const pattern = `%${safe}%`;
  const tasks: Array<PromiseLike<{ data: unknown[] | null; error: unknown }> | Promise<{ data: unknown[]; error: null }>> = [
    permissions.has("customers.view")
      ? admin.from("customers").select("id,company_name,customer_code").eq("org_id", org).neq("record_status", "deleted").or(`company_name.ilike.${pattern},customer_code.ilike.${pattern}`).limit(5)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("quotations.view")
      ? admin.from("quotations").select("id,quotation_number,project_name,status").eq("org_id", org).or(`quotation_number.ilike.${pattern},project_name.ilike.${pattern}`).limit(5)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("purchase_orders.view")
      ? admin.from("job_purchase_orders").select("id,po_number,current_revision_number").eq("org_id", org).ilike("po_number", pattern).limit(5)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("jobs.view")
      ? admin.from("jobs").select("id,job_number,job_status").eq("org_id", org).ilike("job_number", pattern).limit(5)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("invoices.view")
      ? admin.from("job_invoices").select("id,invoice_number,status").eq("org_id", org).ilike("invoice_number", pattern).limit(5)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("employees.view")
      ? admin.from("employee_directory").select("id,employee_name,employee_role").eq("org_id", org).ilike("employee_name", pattern).limit(5)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("supplier_price_library.view")
      ? admin.from("supplier_price_suppliers").select("id,company_name").eq("org_id", org).ilike("company_name", pattern).limit(5)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("purchase_orders.view")
      ? admin.from("job_purchase_order_documents").select("id,file_name,document_type,purchase_order_id").eq("org_id", org).ilike("file_name", pattern).limit(4)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("invoices.view")
      ? admin.from("job_invoice_documents").select("id,file_name,invoice_id").eq("org_id", org).ilike("file_name", pattern).limit(4)
      : Promise.resolve({ data: [], error: null }),
    permissions.has("quotations.view")
      ? admin.from("quotation_generated_documents").select("id,file_name,quotation_id,revision_number").eq("org_id", org).ilike("file_name", pattern).limit(4)
      : Promise.resolve({ data: [], error: null }),
  ];

  const [customers, quotations, purchaseOrders, jobs, invoices, employees, suppliers, poDocuments, invoiceDocuments, quotationDocuments] = await Promise.all(tasks);
  const rows = <T,>(value: { data: unknown[] | null; error: unknown }) => value.error ? [] : (value.data ?? []) as T[];
  const results: SearchResult[] = [];

  rows<{ id: string; company_name: string; customer_code?: string | null }>(customers).forEach((row) => results.push({ id: row.id, kind: "Customer", title: row.company_name, subtitle: row.customer_code ?? "Customer profile", href: `/dashboard/customers/${row.id}` }));
  rows<{ id: string; quotation_number: string; project_name?: string | null; status: string }>(quotations).forEach((row) => results.push({ id: row.id, kind: "Quotation", title: row.quotation_number, subtitle: row.project_name || row.status.replaceAll("_", " "), href: `/dashboard/quotations/${row.id}` }));
  rows<{ id: string; po_number: string; current_revision_number: number }>(purchaseOrders).forEach((row) => results.push({ id: row.id, kind: "Purchase Order", title: row.po_number, subtitle: row.current_revision_number ? `Revision ${row.current_revision_number}` : "Original PO", href: `/dashboard/jobs/purchase-orders/${row.id}` }));
  rows<{ id: string; job_number?: string | null; job_status: string }>(jobs).forEach((row) => results.push({ id: row.id, kind: "Job", title: row.job_number ?? "Pending job number", subtitle: row.job_status.replaceAll("_", " "), href: `/dashboard/jobs/${row.id}` }));
  rows<{ id: string; invoice_number: string; status: string }>(invoices).forEach((row) => results.push({ id: row.id, kind: "Invoice", title: row.invoice_number, subtitle: row.status.replaceAll("_", " "), href: `/dashboard/invoices/${row.id}` }));
  rows<{ id: string; employee_name: string; employee_role: string }>(employees).forEach((row) => results.push({ id: row.id, kind: "Employee", title: row.employee_name, subtitle: row.employee_role.replaceAll("_", " "), href: `/dashboard/employees/${row.id}` }));
  rows<{ id: string; company_name: string }>(suppliers).forEach((row) => results.push({ id: row.id, kind: "Supplier", title: row.company_name, subtitle: "Supplier", href: "/dashboard/supplier-price-library/suppliers" }));
  rows<{ id: string; file_name: string; document_type: string; purchase_order_id: string }>(poDocuments).forEach((row) => results.push({ id: row.id, kind: "Document", title: row.file_name, subtitle: `Purchase order · ${row.document_type.replaceAll("_", " ")}`, href: `/dashboard/jobs/purchase-orders/${row.purchase_order_id}` }));
  rows<{ id: string; file_name: string; invoice_id: string }>(invoiceDocuments).forEach((row) => results.push({ id: row.id, kind: "Document", title: row.file_name, subtitle: "Invoice document", href: `/dashboard/invoices/${row.invoice_id}` }));
  rows<{ id: string; file_name: string; quotation_id: string; revision_number: number }>(quotationDocuments).forEach((row) => results.push({ id: row.id, kind: "Document", title: row.file_name, subtitle: `Quotation document · Revision ${row.revision_number}`, href: `/dashboard/quotations/${row.quotation_id}` }));

  return NextResponse.json({ results: results.slice(0, 20) });
}
