import { createAdminClient } from "@/lib/supabase/admin";
import { isDuplicateError, jsonError, logDatabaseError, requireSupplierPriceSession, text, validUuid } from "@/lib/supplier-price-library/server";

type SupplierBody = { company_name?: unknown; contact_person?: unknown; company_address?: unknown; email_address?: unknown; contact_number?: unknown };

export async function GET(_request: Request, context: RouteContext<"/api/org/supplier-price-library/suppliers/[supplierId]">) {
  const auth = await requireSupplierPriceSession("view"); if ("response" in auth) return auth.response;
  const { supplierId } = await context.params; if (!validUuid(supplierId)) return jsonError("Supplier not found", 404);
  const { data, error } = await createAdminClient().from("supplier_price_suppliers").select("id,company_name,contact_person,company_address,email_address,contact_number,is_archived,created_at,updated_at").eq("org_id", auth.session.org_id).eq("id", supplierId).maybeSingle();
  if (error) return jsonError("Unable to fetch supplier", 500); if (!data) return jsonError("Supplier not found", 404); return Response.json({ supplier: data });
}

export async function PATCH(request: Request, context: RouteContext<"/api/org/supplier-price-library/suppliers/[supplierId]">) {
  const auth = await requireSupplierPriceSession("admin"); if ("response" in auth) return auth.response;
  const { supplierId } = await context.params; if (!validUuid(supplierId)) return jsonError("Supplier not found", 404);
  let body: SupplierBody; try { body = await request.json() as SupplierBody; } catch { return jsonError("Invalid request body", 400); }
  const companyName = text(body.company_name, true); const email = text(body.email_address);
  if (!companyName) return jsonError("Company name is required", 400); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Enter a valid email address", 400);
  const { data, error } = await createAdminClient().from("supplier_price_suppliers").update({ company_name: companyName, contact_person: text(body.contact_person), company_address: text(body.company_address), email_address: email, contact_number: text(body.contact_number), updated_by: auth.session.user.id, updated_at: new Date().toISOString() }).eq("org_id", auth.session.org_id).eq("id", supplierId).select("id,company_name,contact_person,company_address,email_address,contact_number,is_archived,created_at,updated_at").maybeSingle();
  if (error) { if (isDuplicateError(error)) return jsonError("A supplier with this company name already exists in your organization.", 409); logDatabaseError("Unable to update supplier", error); return jsonError("Unable to update supplier", 500); }
  if (!data) return jsonError("Supplier not found", 404); return Response.json({ supplier: data });
}
