import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireSupplierPriceSession, validUuid } from "@/lib/supplier-price-library/server";
export async function POST(_request: Request, context: RouteContext<"/api/org/supplier-price-library/suppliers/[supplierId]/archive">) {
  const auth = await requireSupplierPriceSession("edit"); if ("response" in auth) return auth.response; const { supplierId } = await context.params; if (!validUuid(supplierId)) return jsonError("Supplier not found", 404);
  const now = new Date().toISOString(); const { data, error } = await createAdminClient().from("supplier_price_suppliers").update({ is_archived: true, archived_at: now, archived_by: auth.session.user.id, updated_at: now, updated_by: auth.session.user.id }).eq("org_id", auth.session.org_id).eq("id", supplierId).select("id").maybeSingle();
  if (error) return jsonError("Unable to archive supplier", 500); if (!data) return jsonError("Supplier not found", 404); return Response.json({ message: "Supplier archived" });
}
