import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireSupplierPriceSession, validUuid } from "@/lib/supplier-price-library/server";
export async function POST(_request: Request, context: RouteContext<"/api/org/supplier-price-library/suppliers/[supplierId]/restore">) {
  const auth = await requireSupplierPriceSession("admin"); if ("response" in auth) return auth.response; const { supplierId } = await context.params; if (!validUuid(supplierId)) return jsonError("Supplier not found", 404);
  const { data, error } = await createAdminClient().from("supplier_price_suppliers").update({ is_archived: false, archived_at: null, archived_by: null, updated_at: new Date().toISOString(), updated_by: auth.session.user.id }).eq("org_id", auth.session.org_id).eq("id", supplierId).select("id").maybeSingle();
  if (error) return jsonError("Unable to restore supplier", 500); if (!data) return jsonError("Supplier not found", 404); return Response.json({ message: "Supplier restored" });
}
