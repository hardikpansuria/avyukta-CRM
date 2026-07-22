import type { jsPDF as JsPdfDocument } from "jspdf";

export type PrintableQuotationDetail = {
  quotation: {
    quotation_number?: string | null;
    quote_date?: string | null;
    expiry_date?: string | null;
    project_name?: string | null;
    project_location?: string | null;
    customer_rfq_number?: string | null;
    revision_number?: number | string | null;
    status?: string | null;
    material_total?: number | string | null;
    material_profit_total?: number | string | null;
    labour_total?: number | string | null;
    scope_additional_charges_total?: number | string | null;
    scopes_discount_total?: number | string | null;
    final_discount_amount?: number | string | null;
    final_additional_charges_total?: number | string | null;
    grand_total_before_tax?: number | string | null;
    tax_name?: string | null;
    tax_rate?: number | string | null;
    tax_amount?: number | string | null;
    grand_total_after_tax?: number | string | null;
    grand_total?: number | string | null;
    customer?: {
      company_name?: string | null;
      customer_code?: string | null;
    } | null;
    prepared_by_profile?: {
      full_name?: string | null;
      email?: string | null;
    } | null;
    sales_rep_profile?: {
      full_name?: string | null;
      email?: string | null;
    } | null;
  };
  contacts?: Array<{
    contact_name_snapshot?: string | null;
    email_snapshot?: string | null;
    phone_snapshot?: string | null;
  }>;
  scopes?: Array<{
    scope_title?: string | null;
    scope_description?: string | null;
    quantity?: number | string | null;
    labour_calculation_method?: string | null;
    regular_hourly_rate?: number | string | null;
    overtime_hourly_rate?: number | string | null;
    material_total?: number | string | null;
    material_profit_total?: number | string | null;
    labour_total?: number | string | null;
    additional_charges_total?: number | string | null;
    scope_subtotal_before_discount?: number | string | null;
    discount_amount?: number | string | null;
    scope_total_after_discount?: number | string | null;
    material_items?: Array<{
      material_description?: string | null;
      material_category?: string | null;
      supplier_name?: string | null;
      supplier_quote_reference?: string | null;
      quantity?: number | string | null;
      unit_cost?: number | string | null;
      material_cost?: number | string | null;
      profit_amount?: number | string | null;
      line_total?: number | string | null;
      supplier_quote_document?: { file_name?: string | null } | null;
    }>;
    labour_items?: Array<{
      labour_description?: string | null;
      calculation_method?: string | null;
      work_type?: string | null;
      regular_hours?: number | string | null;
      overtime_hours?: number | string | null;
      regular_cost?: number | string | null;
      overtime_cost?: number | string | null;
      total_cost?: number | string | null;
    }>;
    scope_charges?: Array<{
      description?: string | null;
      amount?: number | string | null;
      profit_type?: string | null;
      profit_value?: number | string | null;
      profit_amount?: number | string | null;
      line_total?: number | string | null;
      supporting_document?: { file_name?: string | null } | null;
    }>;
  }>;
  final_adjustments?: Array<{
    description?: string | null;
    calculation_type?: string | null;
    value?: number | string | null;
    calculated_amount?: number | string | null;
  }>;
  note_sections?: Array<{
    section_type?: string | null;
    title?: string | null;
    body_text?: string | null;
    visible_to_customer?: boolean | null;
  }>;
};

const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

function money(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(parsed) ? parsed : 0);
}

function plainDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(parsed);
}

function titleCase(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function profileName(
  profile:
    | { full_name?: string | null; email?: string | null }
    | null
    | undefined,
) {
  return profile?.full_name || profile?.email || "-";
}

function escapeHtml(value: unknown) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlRows(rows: Array<Array<string | number>>) {
  return rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
}

function htmlTable(headers: string[], rows: Array<Array<string | number>>) {
  if (rows.length === 0) {
    return '<p class="empty">No items.</p>';
  }

  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")}</tr></thead><tbody>${htmlRows(rows)}</tbody></table></div>`;
}

function customerVisibleNotes(detail: PrintableQuotationDetail) {
  return (detail.note_sections ?? []).filter(
    (section) =>
      section.visible_to_customer !== false &&
      section.section_type !== "internal_notes" &&
      Boolean(section.body_text?.trim()),
  );
}

function buildPrintHtml(detail: PrintableQuotationDetail) {
  const quotation = detail.quotation;
  const scopes = detail.scopes ?? [];
  const contacts = detail.contacts ?? [];
  const adjustments = detail.final_adjustments ?? [];
  const notes = customerVisibleNotes(detail);
  const documentNumber = quotation.quotation_number ?? "Quotation";

  const scopesHtml = scopes
    .map((scope, index) => {
      const materialRows = (scope.material_items ?? []).map((item) => [
        item.material_description ?? "-",
        item.material_category ?? "-",
        item.supplier_name ?? "-",
        [
          item.supplier_quote_reference,
          item.supplier_quote_document?.file_name
            ? `PDF: ${item.supplier_quote_document.file_name}`
            : null,
        ]
          .filter(Boolean)
          .join(" / ") || "-",
        String(item.quantity ?? 0),
        money(item.unit_cost),
        money(item.material_cost),
        money(item.profit_amount),
        money(item.line_total),
      ]);
      const labourRows = (scope.labour_items ?? []).map((item) => [
        item.labour_description ?? "-",
        titleCase(item.calculation_method),
        titleCase(item.work_type),
        String(item.regular_hours ?? 0),
        String(item.overtime_hours ?? 0),
        money(item.regular_cost),
        money(item.overtime_cost),
        money(item.total_cost),
      ]);
      const chargeRows = (scope.scope_charges ?? []).map((charge) => [
        charge.description ?? "-",
        money(charge.amount),
        titleCase(charge.profit_type),
        charge.profit_type === "percentage"
          ? `${charge.profit_value ?? 0}%`
          : money(charge.profit_value),
        money(charge.profit_amount),
        money(charge.line_total),
        charge.supporting_document?.file_name ?? "-",
      ]);

      return `
        <section class="scope">
          <div class="scope-heading">
            <div><span>Scope ${index + 1}</span><h2>${escapeHtml(scope.scope_title ?? "Scope of Work")}</h2></div>
            <strong>${escapeHtml(money(scope.scope_total_after_discount))}</strong>
          </div>
          ${
            scope.scope_description
              ? `<p class="description">${escapeHtml(scope.scope_description)}</p>`
              : ""
          }
          <div class="rates">
            <div><span>Scope Quantity</span><b>${escapeHtml(scope.quantity ?? 1)}</b></div>
            <div><span>Calculated Unit Price</span><b>${escapeHtml(money(Number(scope.scope_total_after_discount ?? 0) / (Number(scope.quantity ?? 1) || 1)))}</b></div>
            <div><span>Labour Method</span><b>${escapeHtml(titleCase(scope.labour_calculation_method))}</b></div>
            <div><span>Regular Rate</span><b>${escapeHtml(money(scope.regular_hourly_rate))}</b></div>
            <div><span>Overtime Rate</span><b>${escapeHtml(money(scope.overtime_hourly_rate))}</b></div>
          </div>
          <h3>Materials</h3>
          ${htmlTable(
            ["Description", "Category", "Supplier", "Quote Ref", "Quantity", "Unit Cost", "Cost", "Profit", "Line Total"],
            materialRows,
          )}
          <h3>Labour</h3>
          ${htmlTable(
            ["Description", "Method", "Work Type", "Regular Hrs", "OT Hrs", "Regular Cost", "OT Cost", "Total"],
            labourRows,
          )}
          <h3>Additional Charges</h3>
          ${htmlTable(
            ["Description", "Base Amount", "Profit Type", "Profit Value", "Profit Amount", "Line Total", "Supporting PDF"],
            chargeRows,
          )}
          <div class="scope-total">
            <span>Materials <b>${escapeHtml(money(scope.material_total))}</b></span>
            <span>Material Profit <b>${escapeHtml(money(scope.material_profit_total))}</b></span>
            <span>Labour <b>${escapeHtml(money(scope.labour_total))}</b></span>
            <span>Charges <b>${escapeHtml(money(scope.additional_charges_total))}</b></span>
            <span>Subtotal <b>${escapeHtml(money(scope.scope_subtotal_before_discount))}</b></span>
            <span>Discount <b>-${escapeHtml(money(scope.discount_amount))}</b></span>
            <span>Unit Price <b>${escapeHtml(money(Number(scope.scope_total_after_discount ?? 0) / (Number(scope.quantity ?? 1) || 1)))}</b></span>
            <span class="grand">Scope Total <b>${escapeHtml(money(scope.scope_total_after_discount))}</b></span>
          </div>
        </section>`;
    })
    .join("");

  const contactText =
    contacts.length > 0
      ? contacts
          .map((contact) =>
            [
              contact.contact_name_snapshot,
              contact.email_snapshot,
              contact.phone_snapshot,
            ]
              .filter(Boolean)
              .map(escapeHtml)
              .join(" · "),
          )
          .join("<br>")
      : "-";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentNumber)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #18181b; background: #fff; font: 10px/1.45 Arial, Helvetica, sans-serif; }
    .document { max-width: 1120px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; gap: 30px; padding-bottom: 16px; border-bottom: 2px solid #18181b; }
    .kicker, .label, .scope-heading span, .rates span { color: #71717a; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    h1 { margin: 5px 0 0; font-size: 25px; line-height: 1.1; }
    .header-total { text-align: right; }
    .header-total strong { display: block; margin-top: 4px; font-size: 22px; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #d4d4d8; margin-top: 14px; }
    .meta > div { min-height: 52px; padding: 9px 11px; border-right: 1px solid #e4e4e7; border-bottom: 1px solid #e4e4e7; }
    .meta > div:nth-child(4n) { border-right: 0; }
    .meta b { display: block; margin-top: 3px; font-size: 10px; }
    .scope { break-inside: avoid-page; margin-top: 20px; padding-top: 13px; border-top: 1px solid #a1a1aa; }
    .scope-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
    .scope-heading h2 { margin: 2px 0 0; font-size: 16px; }
    .scope-heading > strong { font-size: 15px; }
    .description { white-space: pre-wrap; color: #3f3f46; margin: 8px 0; }
    .rates { display: grid; grid-template-columns: repeat(3, 1fr); margin: 9px 0 12px; background: #f4f4f5; border: 1px solid #e4e4e7; }
    .rates div { padding: 7px 9px; border-right: 1px solid #e4e4e7; }
    .rates div:last-child { border-right: 0; }
    .rates b { display: block; margin-top: 2px; }
    h3 { margin: 12px 0 5px; font-size: 11px; }
    .table-wrap { width: 100%; overflow: hidden; border: 1px solid #d4d4d8; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8px; }
    th { background: #f4f4f5; color: #52525b; text-align: left; font-size: 7px; text-transform: uppercase; }
    th, td { overflow-wrap: anywhere; padding: 5px 6px; border-right: 1px solid #e4e4e7; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
    th:last-child, td:last-child { border-right: 0; }
    tbody tr:last-child td { border-bottom: 0; }
    .empty { color: #71717a; margin: 5px 0 10px; }
    .scope-total { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px 18px; margin-top: 9px; }
    .scope-total span { color: #52525b; }
    .scope-total b { color: #18181b; margin-left: 4px; }
    .scope-total .grand { padding-left: 14px; border-left: 1px solid #a1a1aa; font-size: 11px; }
    .final-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; margin-top: 22px; break-inside: avoid-page; }
    .notes h2, .totals h2 { margin: 0 0 8px; font-size: 15px; }
    .note { margin-bottom: 12px; break-inside: avoid; }
    .note h3 { margin-bottom: 3px; }
    .note p { margin: 0; white-space: pre-wrap; color: #3f3f46; }
    .totals { border: 1px solid #a1a1aa; padding: 13px; align-self: start; }
    .total-row { display: flex; justify-content: space-between; gap: 20px; padding: 4px 0; }
    .total-row.grand { margin-top: 6px; padding-top: 9px; border-top: 2px solid #18181b; font-size: 14px; font-weight: 700; }
    footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #d4d4d8; color: #71717a; text-align: center; }
    @media print { .document { max-width: none; } }
  </style>
</head>
<body>
  <main class="document">
    <header>
      <div><div class="kicker">Quotation</div><h1>${escapeHtml(documentNumber)}</h1><p>${escapeHtml(quotation.project_name ?? "Untitled Project")}</p></div>
      <div class="header-total"><span class="label">Grand Total</span><strong>${escapeHtml(money(quotation.grand_total_after_tax ?? quotation.grand_total_before_tax ?? quotation.grand_total))}</strong><span>${escapeHtml(titleCase(quotation.status))}</span></div>
    </header>
    <section class="meta">
      <div><span class="label">Customer</span><b>${escapeHtml(quotation.customer?.company_name ?? "-")}</b></div>
      <div><span class="label">Customer Code</span><b>${escapeHtml(quotation.customer?.customer_code ?? "-")}</b></div>
      <div><span class="label">Quote Date</span><b>${escapeHtml(plainDate(quotation.quote_date))}</b></div>
      <div><span class="label">Expiry Date</span><b>${escapeHtml(plainDate(quotation.expiry_date))}</b></div>
      <div><span class="label">Project Location</span><b>${escapeHtml(quotation.project_location ?? "-")}</b></div>
      <div><span class="label">Customer RFQ</span><b>${escapeHtml(quotation.customer_rfq_number ?? "-")}</b></div>
      <div><span class="label">Prepared By</span><b>${escapeHtml(profileName(quotation.prepared_by_profile))}</b></div>
      <div><span class="label">Sales Representative</span><b>${escapeHtml(profileName(quotation.sales_rep_profile))}</b></div>
      <div><span class="label">Revision</span><b>${escapeHtml(quotation.revision_number ?? 0)}</b></div>
      <div style="grid-column: span 3"><span class="label">Customer Contact(s)</span><b>${contactText}</b></div>
    </section>
    ${scopesHtml || '<p class="empty">No scopes of work added.</p>'}
    <section class="final-grid">
      <div class="notes">
        <h2>Notes and Terms</h2>
        ${
          notes.length
            ? notes
                .map(
                  (note) =>
                    `<div class="note"><h3>${escapeHtml(note.title ?? titleCase(note.section_type))}</h3><p>${escapeHtml(note.body_text)}</p></div>`,
                )
                .join("")
            : '<p class="empty">No customer notes or terms.</p>'
        }
      </div>
      <div class="totals">
        <h2>Quotation Summary</h2>
        <div class="total-row"><span>Materials</span><b>${escapeHtml(money(quotation.material_total))}</b></div>
        <div class="total-row"><span>Material Profit</span><b>${escapeHtml(money(quotation.material_profit_total))}</b></div>
        <div class="total-row"><span>Labour</span><b>${escapeHtml(money(quotation.labour_total))}</b></div>
        <div class="total-row"><span>Scope Charges</span><b>${escapeHtml(money(quotation.scope_additional_charges_total))}</b></div>
        <div class="total-row"><span>Scope Discounts</span><b>-${escapeHtml(money(quotation.scopes_discount_total))}</b></div>
        <div class="total-row"><span>Final Discount</span><b>-${escapeHtml(money(quotation.final_discount_amount))}</b></div>
        ${adjustments
          .map(
            (adjustment) =>
              `<div class="total-row"><span>${escapeHtml(adjustment.description ?? "Additional Charge")}</span><b>${escapeHtml(money(adjustment.calculated_amount))}</b></div>`,
          )
          .join("")}
        <div class="total-row"><span>Before Tax</span><b>${escapeHtml(money(quotation.grand_total_before_tax))}</b></div>
        <div class="total-row"><span>${escapeHtml(quotation.tax_name ?? "Tax")} (${escapeHtml(quotation.tax_rate ?? 0)}%)</span><b>${escapeHtml(money(quotation.tax_amount))}</b></div>
        <div class="total-row grand"><span>Grand Total</span><b>${escapeHtml(money(quotation.grand_total_after_tax ?? quotation.grand_total_before_tax ?? quotation.grand_total))}</b></div>
      </div>
    </section>
    <footer>${escapeHtml(documentNumber)} · Generated ${escapeHtml(new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date()))}</footer>
  </main>
  <script>window.addEventListener("load", () => { window.focus(); window.print(); });</script>
</body>
</html>`;
}

export function printQuotation(detail: PrintableQuotationDetail) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintHtml(detail));
  printWindow.document.close();
  printWindow.opener = null;
  return true;
}

type AutoTable = (
  document: JsPdfDocument,
  options: {
    head: string[][];
    body: string[][];
    startY?: number;
    margin?: { left: number; right: number; top?: number; bottom?: number };
    theme?: "grid" | "striped" | "plain";
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    columnStyles?: Record<number, Record<string, unknown>>;
  },
) => void;

function lastTableY(document: JsPdfDocument) {
  const withTable = document as JsPdfDocument & {
    lastAutoTable?: { finalY?: number };
  };
  return withTable.lastAutoTable?.finalY ?? 20;
}

export async function downloadQuotationPdf(
  detail: PrintableQuotationDetail,
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default as unknown as AutoTable;
  const document = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const quotation = detail.quotation;
  const scopes = detail.scopes ?? [];
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const left = 12;
  const right = 12;
  const contentWidth = pageWidth - left - right;
  const navy: [number, number, number] = [24, 24, 27];
  const muted: [number, number, number] = [82, 82, 91];
  let y = 14;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      document.addPage();
      y = 14;
    }
  };

  const heading = (text: string, size = 11) => {
    ensureSpace(size + 6);
    document.setTextColor(...navy);
    document.setFont("helvetica", "bold");
    document.setFontSize(size);
    document.text(text, left, y);
    y += size * 0.45 + 3;
  };

  const paragraph = (text: string) => {
    const lines = document.splitTextToSize(text, contentWidth) as string[];
    ensureSpace(lines.length * 4 + 2);
    document.setTextColor(...muted);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.5);
    document.text(lines, left, y);
    y += lines.length * 4 + 2;
  };

  const table = (
    headers: string[],
    rows: string[][],
    columnStyles?: Record<number, Record<string, unknown>>,
  ) => {
    if (rows.length === 0) {
      paragraph("No items.");
      return;
    }

    autoTable(document, {
      head: [headers],
      body: rows,
      startY: y,
      margin: { left, right, top: 12, bottom: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 6.8,
        cellPadding: 1.6,
        textColor: navy,
        lineColor: [212, 212, 216],
        lineWidth: 0.15,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [244, 244, 245],
        textColor: muted,
        fontStyle: "bold",
        fontSize: 6.2,
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles,
    });
    y = lastTableY(document) + 5;
  };

  document.setTextColor(...muted);
  document.setFont("helvetica", "bold");
  document.setFontSize(8);
  document.text("QUOTATION", left, y);
  document.setTextColor(...navy);
  document.setFontSize(21);
  document.text(quotation.quotation_number ?? "Quotation", left, y + 8);
  document.setFontSize(11);
  document.text(
    money(
      quotation.grand_total_after_tax ??
        quotation.grand_total_before_tax ??
        quotation.grand_total,
    ),
    pageWidth - right,
    y + 5,
    { align: "right" },
  );
  document.setTextColor(...muted);
  document.setFont("helvetica", "normal");
  document.setFontSize(8);
  document.text(
    titleCase(quotation.status),
    pageWidth - right,
    y + 10,
    { align: "right" },
  );
  y += 16;
  document.setDrawColor(24, 24, 27);
  document.setLineWidth(0.6);
  document.line(left, y, pageWidth - right, y);
  y += 5;

  table(
    ["Customer", "Project", "Location", "Quote Date", "Expiry Date", "RFQ", "Revision"],
    [[
      quotation.customer?.company_name ?? "-",
      quotation.project_name ?? "-",
      quotation.project_location ?? "-",
      plainDate(quotation.quote_date),
      plainDate(quotation.expiry_date),
      quotation.customer_rfq_number ?? "-",
      String(quotation.revision_number ?? 0),
    ]],
  );
  table(
    ["Customer Contact(s)", "Prepared By", "Sales Representative"],
    [[
      (detail.contacts ?? [])
        .map((contact) =>
          [
            contact.contact_name_snapshot,
            contact.email_snapshot,
            contact.phone_snapshot,
          ]
            .filter(Boolean)
            .join(" / "),
        )
        .join("\n") || "-",
      profileName(quotation.prepared_by_profile),
      profileName(quotation.sales_rep_profile),
    ]],
  );

  scopes.forEach((scope, index) => {
    ensureSpace(28);
    heading(`Scope ${index + 1}: ${scope.scope_title ?? "Scope of Work"}`, 13);
    if (scope.scope_description) paragraph(scope.scope_description);
    table(
      ["Labour Method", "Regular Rate", "Overtime Rate", "Scope Total"],
      [[
        titleCase(scope.labour_calculation_method),
        money(scope.regular_hourly_rate),
        money(scope.overtime_hourly_rate),
        money(scope.scope_total_after_discount),
      ]],
    );

    heading("Materials");
    table(
      ["Description", "Category", "Supplier / Quote Ref", "Quantity", "Unit Cost", "Material Cost", "Profit", "Line Total"],
      (scope.material_items ?? []).map((item) => [
        item.material_description ?? "-",
        item.material_category ?? "-",
        [
          item.supplier_name,
          item.supplier_quote_reference,
          item.supplier_quote_document?.file_name
            ? `PDF: ${item.supplier_quote_document.file_name}`
            : null,
        ]
          .filter(Boolean)
          .join(" / ") || "-",
        String(item.quantity ?? 0),
        money(item.unit_cost),
        money(item.material_cost),
        money(item.profit_amount),
        money(item.line_total),
      ]),
      {
        0: { cellWidth: 39 },
        1: { cellWidth: 28 },
        2: { cellWidth: 45 },
      },
    );

    heading("Labour");
    table(
      ["Description", "Method", "Work Type", "Regular Hrs", "OT Hrs", "Regular Cost", "OT Cost", "Total"],
      (scope.labour_items ?? []).map((item) => [
        item.labour_description ?? "-",
        titleCase(item.calculation_method),
        titleCase(item.work_type),
        String(item.regular_hours ?? 0),
        String(item.overtime_hours ?? 0),
        money(item.regular_cost),
        money(item.overtime_cost),
        money(item.total_cost),
      ]),
      { 0: { cellWidth: 55 } },
    );

    heading("Additional Charges");
    table(
      ["Description", "Base Amount", "Profit Type", "Profit Value", "Profit Amount", "Line Total", "Supporting PDF"],
      (scope.scope_charges ?? []).map((charge) => [
        charge.description ?? "-",
        money(charge.amount),
        titleCase(charge.profit_type),
        charge.profit_type === "percentage"
          ? `${charge.profit_value ?? 0}%`
          : money(charge.profit_value),
        money(charge.profit_amount),
        money(charge.line_total),
        charge.supporting_document?.file_name ?? "-",
      ]),
      { 0: { cellWidth: 62 }, 6: { cellWidth: 48 } },
    );

    heading("Scope Summary");
    table(
      ["Materials", "Material Profit", "Labour", "Charges", "Subtotal", "Discount", "Scope Total"],
      [[
        money(scope.material_total),
        money(scope.material_profit_total),
        money(scope.labour_total),
        money(scope.additional_charges_total),
        money(scope.scope_subtotal_before_discount),
        `-${money(scope.discount_amount)}`,
        money(scope.scope_total_after_discount),
      ]],
    );
  });

  ensureSpace(45);
  heading("Final Quotation Summary", 13);
  const adjustmentRows = (detail.final_adjustments ?? []).map((adjustment) => [
    adjustment.description ?? "Additional Charge",
    money(adjustment.calculated_amount),
  ]);
  table(
    ["Description", "Amount"],
    [
      ["Material Total", money(quotation.material_total)],
      ["Material Profit", money(quotation.material_profit_total)],
      ["Labour Total", money(quotation.labour_total)],
      ["Scope Additional Charges", money(quotation.scope_additional_charges_total)],
      ["Scope Discounts", `-${money(quotation.scopes_discount_total)}`],
      ["Final Discount", `-${money(quotation.final_discount_amount)}`],
      ...adjustmentRows,
      ["Total Before Tax", money(quotation.grand_total_before_tax)],
      [
        `${quotation.tax_name ?? "Tax"} (${quotation.tax_rate ?? 0}%)`,
        money(quotation.tax_amount),
      ],
      [
        "GRAND TOTAL",
        money(
          quotation.grand_total_after_tax ??
            quotation.grand_total_before_tax ??
            quotation.grand_total,
        ),
      ],
    ],
    { 0: { cellWidth: contentWidth - 45 }, 1: { cellWidth: 45 } },
  );

  const notes = customerVisibleNotes(detail);
  if (notes.length > 0) {
    ensureSpace(20);
    heading("Notes and Terms", 13);
    notes.forEach((note) => {
      heading(note.title ?? titleCase(note.section_type), 10);
      paragraph(note.body_text ?? "-");
    });
  }

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setDrawColor(212, 212, 216);
    document.setLineWidth(0.2);
    document.line(left, pageHeight - 10, pageWidth - right, pageHeight - 10);
    document.setTextColor(...muted);
    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    document.text(
      quotation.quotation_number ?? "Quotation",
      left,
      pageHeight - 6,
    );
    document.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - right,
      pageHeight - 6,
      { align: "right" },
    );
  }

  const safeNumber = (quotation.quotation_number ?? "quotation").replace(
    /[^a-z0-9_-]+/gi,
    "-",
  );
  document.setProperties({
    title: quotation.quotation_number ?? "Quotation",
    subject: quotation.project_name ?? "Quotation",
    author: profileName(quotation.prepared_by_profile),
  });
  document.save(`${safeNumber}.pdf`);
}
