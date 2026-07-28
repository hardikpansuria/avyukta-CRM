import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { getOutstandingReceivables } from "@/lib/invoices/outstanding";
import { renderOutstandingPdf } from "@/lib/invoices/outstanding-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const result = await getOutstandingReceivables(
    createAdminClient(),
    session.org_id,
  );
  if (result.error) {
    return jsonError("Unable to fetch outstanding invoices", 500);
  }
  const format = new URL(request.url).searchParams.get("format") ?? "json";

  if (format === "pdf") {
    const buffer = await renderOutstandingPdf({
      groups: result.groups ?? [],
      grandTotal: result.grand_total ?? 0,
      orgName: session.org_name,
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="outstanding-receivables.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (format === "xls") {
    const xml = (value: unknown) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const cell = (
      value: unknown,
      type: "String" | "Number" | "DateTime" = "String",
      style = "",
    ) =>
      `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="${type}">${xml(
        value,
      )}</Data></Cell>`;
    const headers = [
      "Customer",
      "Invoice Number",
      "Job Number",
      "PO Number",
      "Quotation Number",
      "Invoice Date",
      "Sent Date",
      "Invoice Amount",
      "Outstanding Balance",
      "Days Outstanding",
      "Aging Bucket",
    ];
    const rows = (result.groups ?? []).flatMap((group) =>
      group.invoices.map(
        (invoice) =>
          `<Row>${cell(group.customer_name)}${cell(
            invoice.invoice_number,
          )}${cell(invoice.job_number)}${cell(invoice.po_number)}${cell(
            invoice.quotation_number,
          )}${cell(
            `${invoice.invoice_date}T00:00:00.000`,
            "DateTime",
            "Date",
          )}${cell(
            new Date(invoice.sent_at).toISOString().replace("Z", ""),
            "DateTime",
            "Date",
          )}${cell(
            Number(invoice.invoice_amount ?? 0),
            "Number",
            "Currency",
          )}${cell(
            Number(invoice.outstanding_balance ?? 0),
            "Number",
            "Currency",
          )}${cell(Number(invoice.days_outstanding ?? 0), "Number")}${cell(
            invoice.aging_bucket,
          )}</Row>`,
      ),
    );
    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>${xml(session.org_name)}</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/></Style>
  <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16" ss:Color="#FFFFFF"/><Interior ss:Color="#18181B" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#3F3F46" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Currency"><NumberFormat ss:Format="Currency"/></Style>
  <Style ss:ID="Date"><NumberFormat ss:Format="yyyy-mm-dd"/></Style>
  <Style ss:ID="Total"><Font ss:Bold="1"/><NumberFormat ss:Format="Currency"/></Style>
 </Styles>
 <Worksheet ss:Name="Outstanding Receivables">
  <Table>
   <Column ss:Width="160"/><Column ss:Width="105"/><Column ss:Width="95"/><Column ss:Width="95"/><Column ss:Width="115"/>
   <Column ss:Width="85"/><Column ss:Width="105"/><Column ss:Width="110"/><Column ss:Width="125"/><Column ss:Width="100"/><Column ss:Width="95"/>
   <Row ss:Height="24"><Cell ss:StyleID="Title" ss:MergeAcross="10"><Data ss:Type="String">${xml(
     `${session.org_name} - Outstanding Receivables`,
   )}</Data></Cell></Row>
   <Row>${headers.map((header) => cell(header, "String", "Header")).join("")}</Row>
   ${rows.join("")}
   <Row>${cell("Grand Total")}${Array.from({ length: 7 }, () => cell("")).join(
     "",
   )}${cell(result.grand_total ?? 0, "Number", "Total")}${cell("")}${cell(
     "",
   )}</Row>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>2</SplitHorizontal><TopRowBottomPane>2</TopRowBottomPane></WorksheetOptions>
 </Worksheet>
</Workbook>`;
    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="outstanding-receivables.xls"',
        "Cache-Control": "private, no-store",
      },
    });
  }

  return NextResponse.json({
    groups: result.groups ?? [],
    grand_total: result.grand_total ?? 0,
    invoice_count: result.invoice_count ?? 0,
  });
}
