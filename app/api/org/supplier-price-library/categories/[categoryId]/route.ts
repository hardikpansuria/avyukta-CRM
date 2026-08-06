import { createAdminClient } from "@/lib/supabase/admin";
import { isDuplicateError, jsonError, requireSupplierPriceSession, text, validUuid } from "@/lib/supplier-price-library/server";
export async function PATCH(request: Request, context: RouteContext<"/api/org/supplier-price-library/categories/[categoryId]">) {
  const auth = await requireSupplierPriceSession("edit"); if ("response" in auth) return auth.response; const { categoryId } = await context.params; if (!validUuid(categoryId)) return jsonError("Category not found", 404);
  let body: { category_name?: unknown }; try { body = await request.json(); } catch { return jsonError("Invalid request body", 400); } const name = text(body.category_name, true); if (!name) return jsonError("Category name is required", 400);
  const { data, error } = await createAdminClient().from("supplier_price_categories").update({ category_name: name, updated_by: auth.session.user.id, updated_at: new Date().toISOString() }).eq("org_id", auth.session.org_id).eq("id", categoryId).select("id,category_name,is_archived,created_at,updated_at").maybeSingle();
  if (error) { if (isDuplicateError(error)) return jsonError("A category with this name already exists.", 409); return jsonError("Unable to rename category", 500); } if (!data) return jsonError("Category not found", 404); return Response.json({ category: data });
}
