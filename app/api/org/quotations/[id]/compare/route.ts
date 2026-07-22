import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { getQuotationDetail } from "@/lib/quotations/api";
import { getCustomerQuotationData } from "@/lib/quotations/customer-quotation";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = Record<string, unknown>;
type Change = { section: string; label: string; status: "added" | "removed" | "modified" | "unchanged"; revisionA: unknown; revisionB: unknown };

function normalized(value: unknown) {
  if (typeof value === "number") return Math.round(value * 10000) / 10000;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Math.round(Number(value) * 10000) / 10000;
  return value ?? null;
}

function compareValue(section: string, label: string, a: unknown, b: unknown): Change {
  const left = normalized(a);
  const right = normalized(b);
  return { section, label, status: JSON.stringify(left) === JSON.stringify(right) ? "unchanged" : "modified", revisionA: left, revisionB: right };
}

function rowKey(row: Row, titleField: string, index: number) {
  return `${String(row._scope_key ?? "")}|${String(row[titleField] ?? "").trim().toLowerCase()}|${String(row.sort_order ?? index + 1)}`;
}

function compareRows(section: string, aRows: Row[], bRows: Row[], titleField: string, fields: string[]) {
  const aMap = new Map(aRows.map((row, index) => [rowKey(row, titleField, index), row]));
  const bMap = new Map(bRows.map((row, index) => [rowKey(row, titleField, index), row]));
  const keys = Array.from(new Set([...aMap.keys(), ...bMap.keys()]));
  return keys.map((key): Change => {
    const a = aMap.get(key);
    const b = bMap.get(key);
    const label = String(b?.[titleField] ?? a?.[titleField] ?? "Item");
    if (!a) return { section, label, status: "added", revisionA: null, revisionB: b };
    if (!b) return { section, label, status: "removed", revisionA: a, revisionB: null };
    const pick = (row: Row) => Object.fromEntries(fields.map((field) => [field, normalized(row[field])]));
    return { section, label, status: JSON.stringify(pick(a)) === JSON.stringify(pick(b)) ? "unchanged" : "modified", revisionA: pick(a), revisionB: pick(b) };
  });
}

function flatten(detail: Awaited<ReturnType<typeof getQuotationDetail>>) {
  const scopes: Row[] = ((detail.scopes ?? []) as Row[]).map((scope) => ({
    ...scope,
    calculated_unit_price:
      Number(scope.scope_total_after_discount ?? 0) /
      (Number(scope.quantity ?? 1) || 1),
  }));
  const withScope = (scope: Row, rows: Row[]) => rows.map((row) => ({
    ...row,
    _scope_key: `${String(scope.scope_title ?? "").trim().toLowerCase()}|${String(scope.sort_order ?? "")}`,
  }));
  return {
    scopes,
    materials: scopes.flatMap((scope) => withScope(scope, (scope.material_items as Row[] | undefined) ?? [])),
    labour: scopes.flatMap((scope) => withScope(scope, (scope.labour_items as Row[] | undefined) ?? [])),
    charges: scopes.flatMap((scope) => withScope(scope, (scope.scope_charges as Row[] | undefined) ?? [])),
  };
}

export async function GET(request: Request, context: RouteContext<"/api/org/quotations/[id]/compare">) {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const url = new URL(request.url);
  const revisionA = url.searchParams.get("revisionA") ?? id;
  const revisionB = url.searchParams.get("revisionB") ?? "";
  if (!revisionA || !revisionB || revisionA === revisionB) return NextResponse.json({ error: "Select two different revisions" }, { status: 400 });
  const admin = createAdminClient();
  const { data: quotations, error } = await admin
    .from("quotations").select("id,quotation_series_id").eq("org_id", session.org_id).in("id", [revisionA, revisionB]);
  if (error) return NextResponse.json({ error: "Unable to validate revisions" }, { status: 500 });
  if ((quotations ?? []).length !== 2) return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  if (quotations![0].quotation_series_id !== quotations![1].quotation_series_id) return NextResponse.json({ error: "Revisions must belong to the same quotation series" }, { status: 400 });

  const [a, b, customerA, customerB] = await Promise.all([
    getQuotationDetail(admin, session.org_id, revisionA), getQuotationDetail(admin, session.org_id, revisionB),
    getCustomerQuotationData(admin, session.org_id, revisionA), getCustomerQuotationData(admin, session.org_id, revisionB),
  ]);
  if (a.error || b.error || !a.quotation || !b.quotation) return NextResponse.json({ error: "Unable to load revision data" }, { status: 500 });
  const fa = flatten(a); const fb = flatten(b);
  const aq = a.quotation as Row; const bq = b.quotation as Row;
  const changes: Change[] = [
    ...["project_name","project_location","customer_rfq_number","status","material_total","material_profit_total","labour_total","scope_additional_charges_total","scopes_discount_total","final_discount_amount","final_additional_charges_total","tax_rate","tax_amount","grand_total_after_tax"].map((field) => compareValue("Quotation", field.replaceAll("_", " "), aq[field], bq[field])),
    ...compareRows("Scope of Work", fa.scopes, fb.scopes, "scope_title", ["scope_title","scope_description","quantity","calculated_unit_price","discount_type","discount_value","scope_total_after_discount"]),
    ...compareRows("Materials", fa.materials, fb.materials, "material_description", ["material_description","quantity","unit_cost","material_cost","profit_type","profit_value","line_total"]),
    ...compareRows("Labour", fa.labour, fb.labour, "labour_description", ["labour_description","total_hours","number_of_workers","number_of_days","hours_per_day","regular_rate","overtime_rate","total_cost"]),
    ...compareRows("Additional Charges", fa.charges, fb.charges, "description", ["description","amount","profit_type","profit_value","line_total"]),
    ...compareRows("Final Adjustments", (a.final_adjustments ?? []) as Row[], (b.final_adjustments ?? []) as Row[], "description", ["description","calculation_type","value","calculated_amount"]),
    ...compareRows("Notes and Terms", (a.note_sections ?? []) as Row[], (b.note_sections ?? []) as Row[], "title", ["section_type","title","body_text","visible_to_customer"]),
    ...compareRows("Customer Quotation", (customerA.value?.items ?? []) as Row[], (customerB.value?.items ?? []) as Row[], "scope_title_snapshot", ["scope_title_snapshot","description_text","estimation_quantity","quantity","price_each","price_ext"]),
    compareValue("Customer Quotation", "customer quotation total", customerA.value?.document.total, customerB.value?.document.total),
    compareValue("Customer Quotation", "payment terms", customerA.value?.document.terms_text, customerB.value?.document.terms_text),
  ];
  return NextResponse.json({ revisionA: a, revisionB: b, changes });
}
