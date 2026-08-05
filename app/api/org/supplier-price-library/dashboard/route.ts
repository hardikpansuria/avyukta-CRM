import { createAdminClient } from "@/lib/supabase/admin";
import {
  jsonError,
  logDatabaseError,
  requireSupplierPriceSession,
} from "@/lib/supplier-price-library/server";
import { supplierPricePermissions } from "@/lib/supplier-price-library/access";

export async function GET() {
  const auth = await requireSupplierPriceSession("view");
  if ("response" in auth) return auth.response;
  const { session } = auth;
  const admin = createAdminClient();

  const [suppliers, categories, materials, prices, recentPrices, recentMaterials] =
    await Promise.all([
      admin.from("supplier_price_suppliers").select("id", { count: "exact", head: true }).eq("org_id", session.org_id).eq("is_archived", false),
      admin.from("supplier_price_categories").select("id", { count: "exact", head: true }).eq("org_id", session.org_id).eq("is_archived", false),
      admin.from("supplier_price_materials").select("id", { count: "exact", head: true }).eq("org_id", session.org_id).eq("is_archived", false),
      admin.from("supplier_price_records").select("id", { count: "exact", head: true }).eq("org_id", session.org_id).neq("record_status", "archived"),
      admin.from("supplier_price_records").select("id,material_id,supplier_id,unit_price,currency,quote_date,created_at").eq("org_id", session.org_id).neq("record_status", "archived").order("created_at", { ascending: false }).limit(8),
      admin.from("supplier_price_materials").select("id,material_code,material_description,category_id,updated_at,updated_by").eq("org_id", session.org_id).eq("is_archived", false).order("updated_at", { ascending: false }).limit(8),
    ]);

  const results = [suppliers, categories, materials, prices, recentPrices, recentMaterials];
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    logDatabaseError("Unable to load supplier price dashboard", failed.error);
    return jsonError("Unable to load Supplier Price Library dashboard", 500);
  }

  const materialIds = Array.from(new Set((recentPrices.data ?? []).map((row) => row.material_id)));
  const supplierIds = Array.from(new Set((recentPrices.data ?? []).map((row) => row.supplier_id)));
  const categoryIds = Array.from(new Set((recentMaterials.data ?? []).map((row) => row.category_id)));
  const userIds = Array.from(new Set((recentMaterials.data ?? []).map((row) => row.updated_by).filter(Boolean))) as string[];

  const [materialNames, supplierNames, categoryNames, profiles] = await Promise.all([
    materialIds.length ? admin.from("supplier_price_materials").select("id,material_code,material_description,unit_of_measure").eq("org_id", session.org_id).in("id", materialIds) : Promise.resolve({ data: [], error: null }),
    supplierIds.length ? admin.from("supplier_price_suppliers").select("id,company_name").eq("org_id", session.org_id).in("id", supplierIds) : Promise.resolve({ data: [], error: null }),
    categoryIds.length ? admin.from("supplier_price_categories").select("id,category_name").eq("org_id", session.org_id).in("id", categoryIds) : Promise.resolve({ data: [], error: null }),
    userIds.length ? admin.from("profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [], error: null }),
  ]);

  const materialMap = new Map((materialNames.data ?? []).map((row) => [row.id, row]));
  const supplierMap = new Map((supplierNames.data ?? []).map((row) => [row.id, row]));
  const categoryMap = new Map((categoryNames.data ?? []).map((row) => [row.id, row]));
  const profileMap = new Map((profiles.data ?? []).map((row) => [row.id, row]));

  return Response.json({
    counts: { suppliers: suppliers.count ?? 0, categories: categories.count ?? 0, materials: materials.count ?? 0, prices: prices.count ?? 0 },
    recentPrices: (recentPrices.data ?? []).map((row) => ({ ...row, material: materialMap.get(row.material_id) ?? null, supplier: supplierMap.get(row.supplier_id) ?? null })),
    recentMaterials: (recentMaterials.data ?? []).map((row) => ({ ...row, category: categoryMap.get(row.category_id) ?? null, updatedBy: row.updated_by ? profileMap.get(row.updated_by) ?? null : null })),
    permissions: supplierPricePermissions(session.role),
  });
}
