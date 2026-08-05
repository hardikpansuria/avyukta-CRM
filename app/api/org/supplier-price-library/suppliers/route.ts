import { createAdminClient } from "@/lib/supabase/admin";
import { isDuplicateError, jsonError, logDatabaseError, pagination, positiveInteger, requireSupplierPriceSession, safeSearch, text } from "@/lib/supplier-price-library/server";

type SupplierBody = { company_name?: unknown; contact_person?: unknown; company_address?: unknown; email_address?: unknown; contact_number?: unknown };

export async function GET(request: Request) {
  const auth = await requireSupplierPriceSession("view");
  if ("response" in auth) return auth.response;
  const params = new URL(request.url).searchParams;
  const search = safeSearch(params.get("search") ?? "");
  const status = params.get("status") ?? "active";
  const sort = ["company_name", "created_at", "updated_at"].includes(params.get("sort") ?? "") ? params.get("sort")! : "company_name";
  const ascending = params.get("direction") !== "desc";
  const page = positiveInteger(params.get("page"), 1);
  const pageSize = Math.min(positiveInteger(params.get("pageSize"), 20), 100);
  const start = (page - 1) * pageSize;
  if (!["active", "archived", "all"].includes(status)) return jsonError("Invalid status filter", 400);

  let query = createAdminClient().from("supplier_price_suppliers").select("id,company_name,contact_person,company_address,email_address,contact_number,is_archived,created_at,updated_at", { count: "exact" }).eq("org_id", auth.session.org_id);
  if (search) query = query.or(`company_name.ilike.%${search}%,contact_person.ilike.%${search}%,email_address.ilike.%${search}%`);
  if (status !== "all") query = query.eq("is_archived", status === "archived");
  const { data, error, count } = await query.order(sort, { ascending, nullsFirst: false }).order("id", { ascending: true }).range(start, start + pageSize - 1);
  if (error) { logDatabaseError("Unable to fetch suppliers", error); return jsonError("Unable to fetch suppliers", 500); }
  return Response.json({ suppliers: data ?? [], pagination: pagination(page, pageSize, count ?? 0) });
}

export async function POST(request: Request) {
  const auth = await requireSupplierPriceSession("admin");
  if ("response" in auth) return auth.response;
  let body: SupplierBody;
  try { body = await request.json() as SupplierBody; } catch { return jsonError("Invalid request body", 400); }
  const companyName = text(body.company_name, true);
  const email = text(body.email_address);
  if (!companyName) return jsonError("Company name is required", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Enter a valid email address", 400);
  const admin = createAdminClient();
  const { data, error } = await admin.from("supplier_price_suppliers").insert({ org_id: auth.session.org_id, company_name: companyName, contact_person: text(body.contact_person), company_address: text(body.company_address), email_address: email, contact_number: text(body.contact_number), created_by: auth.session.user.id, updated_by: auth.session.user.id }).select("id,company_name,contact_person,company_address,email_address,contact_number,is_archived,created_at,updated_at").single();
  if (error) {
    if (isDuplicateError(error)) return jsonError("A supplier with this company name already exists in your organization.", 409);
    logDatabaseError("Unable to create supplier", error); return jsonError("Unable to create supplier", 500);
  }
  return Response.json({ supplier: data }, { status: 201 });
}
