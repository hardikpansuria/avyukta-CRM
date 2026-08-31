import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { OutstandingCustomerGroup } from "@/lib/invoices/outstanding";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#18181b",
  },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 3 },
  subtitle: { color: "#71717a", marginBottom: 14 },
  customer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#f4f4f5",
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #e4e4e7",
    paddingVertical: 5,
  },
  header: { fontWeight: 700, backgroundColor: "#fafafa" },
  cInvoice: { width: "13%" },
  cJob: { width: "12%" },
  cPo: { width: "12%" },
  cDate: { width: "12%" },
  cSent: { width: "14%" },
  cAmount: { width: "14%", textAlign: "right" },
  cDays: { width: "9%", textAlign: "right" },
  cAging: { width: "14%", paddingLeft: 5 },
  grand: {
    marginTop: 16,
    paddingTop: 8,
    borderTop: "2 solid #18181b",
    fontSize: 11,
    fontWeight: 700,
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    color: "#71717a",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function currency(value: number | string, code: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: code,
  }).format(Number(value ?? 0));
}

function OutstandingPdf({
  groups,
  grandTotal,
  orgName,
}: {
  groups: OutstandingCustomerGroup[];
  grandTotal: number;
  orgName: string;
}) {
  return (
    <Document>
      <Page orientation="landscape" size="LETTER" style={styles.page}>
        <Text style={styles.title}>Outstanding Receivables</Text>
        <Text style={styles.subtitle}>
          {orgName} - Generated {new Date().toLocaleString("en-CA")}
        </Text>
        <View style={[styles.row, styles.header]} fixed>
          <Text style={styles.cInvoice}>Invoice</Text>
          <Text style={styles.cJob}>Job</Text>
          <Text style={styles.cPo}>PO</Text>
          <Text style={styles.cDate}>Invoice Date</Text>
          <Text style={styles.cSent}>Sent Date</Text>
          <Text style={styles.cAmount}>Outstanding</Text>
          <Text style={styles.cDays}>Days</Text>
          <Text style={styles.cAging}>Aging</Text>
        </View>
        {groups.map((group) => (
          <View key={group.customer_id} wrap={false}>
            <View style={styles.customer}>
              <Text>{group.customer_name}</Text>
              <Text>
                Customer Total:{" "}
                {currency(group.total_outstanding, group.currency)}
              </Text>
            </View>
            {group.invoices.map((invoice) => (
              <View key={invoice.invoice_id} style={styles.row}>
                <Text style={styles.cInvoice}>{invoice.invoice_number}</Text>
                <Text style={styles.cJob}>{invoice.job_number ?? "-"}</Text>
                <Text style={styles.cPo}>{invoice.po_number ?? "-"}</Text>
                <Text style={styles.cDate}>{invoice.invoice_date}</Text>
                <Text style={styles.cSent}>
                  {new Date(invoice.sent_at).toLocaleDateString("en-CA")}
                </Text>
                <Text style={styles.cAmount}>
                  {currency(invoice.outstanding_balance, invoice.currency)}
                </Text>
                <Text style={styles.cDays}>{invoice.days_outstanding}</Text>
                <Text style={styles.cAging}>{invoice.aging_bucket}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.grand}>
          Grand Outstanding Total: {currency(grandTotal, "CAD")}
        </Text>
        <View style={styles.footer} fixed>
          <Text>Confidential - Accounts Receivable</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export function renderOutstandingPdf(args: {
  groups: OutstandingCustomerGroup[];
  grandTotal: number;
  orgName: string;
}) {
  return renderToBuffer(<OutstandingPdf {...args} />);
}

