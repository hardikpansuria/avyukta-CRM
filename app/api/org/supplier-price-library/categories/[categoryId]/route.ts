import { createAdminClient } from "@/lib/supabase/admin";
import { isDuplicateError, jsonError, logDatabaseError, requireSupplierPriceSession, text, validUuid } from "@/lib/supplier-price-library/server";

export async function GET(_request: Request, context: RouteContext<"/api/org/supplier-price-library/categories/[categoryId]">) {
  const auth = await requireSupplierPriceSession("view");
  if ("response" in auth) return auth.response;
  const { categoryId } = await context.params;
  if (!validUuid(categoryId)) return jsonError("Category not found", 404);

  const admin = createAdminClient();
  const [categoryResult, materialResult] = await Promise.all([
    admin
      .from("supplier_price_categories")
      .select("id,category_name,is_archived,created_at,updated_at")
      .eq("org_id", auth.session.org_id)
      .eq("id", categoryId)
      .maybeSingle(),
    admin
      .from("supplier_price_materials")
      .select(
        "id,material_code,category_id,material_description,size_specification,grade_material_type,unit_of_measure,is_archived,created_at,updated_at",
      )
      .eq("org_id", auth.session.org_id)
      .eq("category_id", categoryId)
      .order("material_code", { ascending: true }),
  ]);

  if (categoryResult.error || materialResult.error) {
    logDatabaseError(
      "Unable to fetch category detail",
      categoryResult.error ?? materialResult.error,
    );
    return jsonError("Unable to fetch category", 500);
  }
  if (!categoryResult.data) return jsonError("Category not found", 404);

  return Response.json({
    category: categoryResult.data,
    materials: materialResult.data ?? [],
  });
}

export async function PATCH(request: Request, context: RouteContext<"/api/org/supplier-price-library/categories/[categoryId]">) {
  const auth = await requireSupplierPriceSession("edit"); if ("response" in auth) return auth.response; const { categoryId } = await context.params; if (!validUuid(categoryId)) return jsonError("Category not found", 404);
  let body: { category_name?: unknown }; try { body = await request.json(); } catch { return jsonError("Invalid request body", 400); } const name = text(body.category_name, true); if (!name) return jsonError("Category name is required", 400);
  const { data, error } = await createAdminClient().from("supplier_price_categories").update({ category_name: name, updated_by: auth.session.user.id, updated_at: new Date().toISOString() }).eq("org_id", auth.session.org_id).eq("id", categoryId).select("id,category_name,is_archived,created_at,updated_at").maybeSingle();
  if (error) { if (isDuplicateError(error)) return jsonError("A category with this name already exists.", 409); return jsonError("Unable to rename category", 500); } if (!data) return jsonError("Category not found", 404); return Response.json({ category: data });
}
