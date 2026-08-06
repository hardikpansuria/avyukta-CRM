import { createAdminClient } from "@/lib/supabase/admin";
import { isDuplicateError, jsonError, logDatabaseError, requireSupplierPriceSession, safeSearch, text } from "@/lib/supplier-price-library/server";

export async function GET(request: Request) {
  const auth = await requireSupplierPriceSession("view"); if ("response" in auth) return auth.response;
  const params = new URL(request.url).searchParams; const search = safeSearch(params.get("search") ?? ""); const status = params.get("status") ?? "active"; const sort = ["category_name", "created_at", "updated_at"].includes(params.get("sort") ?? "") ? params.get("sort")! : "category_name"; const ascending = params.get("direction") !== "desc";
  if (!["active", "archived", "all"].includes(status)) return jsonError("Invalid status filter", 400);
  const admin = createAdminClient(); let query = admin.from("supplier_price_categories").select("id,category_name,is_archived,created_at,updated_at").eq("org_id", auth.session.org_id);
  if (search) query = query.ilike("category_name", `%${search}%`); if (status !== "all") query = query.eq("is_archived", status === "archived");
  const { data, error } = await query.order(sort, { ascending, nullsFirst: false }).order("id", { ascending: true }); if (error) { logDatabaseError("Unable to fetch categories", error); return jsonError("Unable to fetch categories", 500); }
  const ids = (data ?? []).map((row) => row.id); const counts = new Map<string, number>();
  if (ids.length) { const { data: materials, error: countError } = await admin.from("supplier_price_materials").select("category_id").eq("org_id", auth.session.org_id).in("category_id", ids); if (countError) return jsonError("Unable to count category materials", 500); for (const row of materials ?? []) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1); }
  return Response.json({ categories: (data ?? []).map((row) => ({ ...row, material_count: counts.get(row.id) ?? 0 })) });
}

export async function POST(request: Request) {
  const auth = await requireSupplierPriceSession("edit"); if ("response" in auth) return auth.response; let body: { category_name?: unknown }; try { body = await request.json(); } catch { return jsonError("Invalid request body", 400); }
  const name = text(body.category_name, true); if (!name) return jsonError("Category name is required", 400);
  const { data, error } = await createAdminClient().from("supplier_price_categories").insert({ org_id: auth.session.org_id, category_name: name, created_by: auth.session.user.id, updated_by: auth.session.user.id }).select("id,category_name,is_archived,created_at,updated_at").single();
  if (error) { if (isDuplicateError(error)) return jsonError("A category with this name already exists.", 409); logDatabaseError("Unable to create category", error); return jsonError("Unable to create category", 500); }
  return Response.json({ category: { ...data, material_count: 0 } }, { status: 201 });
}
