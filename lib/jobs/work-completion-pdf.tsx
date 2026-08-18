import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React, { type ReactNode } from "react";

export type WorkCompletionPdfData = {
  organization: { company_name: string; phone?: string | null; fax?: string | null; footer_text?: string | null };
  logo_data_url?: string | null;
  certificate: {
    number: string;
    revision_number: number;
    completion_date: string;
    status: "completed" | "completed_with_outstanding_items";
    completion_notes?: string | null;
    outstanding_items?: string | null;
  };
  job: { job_number: string; work_order_number: string; project_name: string; job_start_date?: string | null; job_site: string };
  quotation: { number: string; date?: string | null; sales_representative: string };
  purchase_order: { number: string; date?: string | null };
  customer: {
    company_name: string;
    contact_name: string;
    contact_position?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    job_site?: string | null;
  };
  technicians: Array<{ employee_id: string; employee_name: string }>;
  scopes: Array<{ id: string; title: string; description?: string | null }>;
};

const styles = StyleSheet.create({
  page: { paddingTop: 76, paddingRight: 38, paddingBottom: 72, paddingLeft: 38, color: "#18181b", fontFamily: "Helvetica", fontSize: 9, lineHeight: 1.35 },
  header: { position: "absolute", top: 24, left: 38, right: 38, height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#d4d4d8", paddingBottom: 8 },
  logo: { width: 118, height: 34, objectFit: "contain", objectPosition: "left center" },
  companyName: { maxWidth: 260, fontSize: 12, fontFamily: "Helvetica-Bold" },
  headerCompany: { maxWidth: 250, textAlign: "right", fontFamily: "Helvetica-Bold" },
  title: { textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 17, marginBottom: 5 },
  certificateNumber: { textAlign: "center", color: "#52525b", marginBottom: 16 },
  section: { marginBottom: 13 },
  sectionTitle: { backgroundColor: "#f4f4f5", borderBottomWidth: 1, borderBottomColor: "#a1a1aa", padding: 6, fontFamily: "Helvetica-Bold", fontSize: 10 },
  grid: { borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#d4d4d8" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e4e4e7", minHeight: 24 },
  label: { width: "34%", padding: 6, color: "#52525b", backgroundColor: "#fafafa" },
  value: { flex: 1, padding: 6, fontFamily: "Helvetica-Bold" },
  body: { borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#d4d4d8", padding: 8 },
  scope: { marginBottom: 7 },
  scopeTitle: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  statement: { padding: 10, borderWidth: 1, borderColor: "#d4d4d8", backgroundColor: "#fafafa", marginBottom: 13 },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: "#18181b", marginRight: 6, alignItems: "center", justifyContent: "center" },
  checked: { width: 6, height: 6, backgroundColor: "#18181b" },
  signatureGrid: { flexDirection: "row", gap: 22, marginTop: 12 },
  signatureColumn: { flex: 1 },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: "#52525b", height: 24, marginBottom: 3 },
  signatureLabel: { color: "#52525b", fontSize: 7.5, marginBottom: 9 },
  technicianName: { marginBottom: 3 },
  footerRule: { position: "absolute", bottom: 56, left: 38, right: 38, borderTopWidth: 1, borderTopColor: "#d4d4d8" },
  footer: { position: "absolute", bottom: 24, left: 38, right: 38, color: "#52525b", fontSize: 7.2 },
  footerTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3, fontFamily: "Helvetica-Bold" },
  disclaimer: { textAlign: "center" },
});

function formattedDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return <View style={styles.row} wrap={false}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || "-"}</Text></View>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function CheckboxLine({ checked, children }: { checked: boolean; children: ReactNode }) {
  return <View style={styles.checkboxRow}><View style={styles.box}>{checked ? <View style={styles.checked} /> : null}</View><Text>{children}</Text></View>;
}

function WorkCompletionPdf({ data }: { data: WorkCompletionPdfData }) {
  const completedWithOutstanding = data.certificate.status === "completed_with_outstanding_items";
  return (
    <Document author={data.organization.company_name} subject="Work Completion Acknowledgement" title={data.certificate.number}>
      <Page size="A4" style={styles.page} wrap>
        <View fixed style={styles.header}>
          {data.logo_data_url ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.logo_data_url} style={styles.logo} />
          ) : <Text style={styles.companyName}>{data.organization.company_name}</Text>}
          <Text style={styles.headerCompany}>{data.organization.company_name}</Text>
        </View>
        <Text style={styles.title}>WORK COMPLETION ACKNOWLEDGEMENT</Text>
        <Text style={styles.certificateNumber}>{data.certificate.number}{data.certificate.revision_number > 1 ? ` - Revision ${data.certificate.revision_number}` : ""}</Text>

        <Section title="Job Information"><View style={styles.grid}>
          <InfoRow label="Work Completion No." value={data.certificate.number} />
          <InfoRow label="Job Number" value={data.job.job_number} />
          <InfoRow label="Work Order Number" value={data.job.work_order_number} />
          <InfoRow label="Quotation Number" value={data.quotation.number} />
          <InfoRow label="Customer PO Number" value={data.purchase_order.number} />
          <InfoRow label="Project / Job Name" value={data.job.project_name} />
          <InfoRow label="Completion Date" value={formattedDate(data.certificate.completion_date)} />
          <InfoRow label="Sales Representative" value={data.quotation.sales_representative} />
        </View></Section>

        <Section title="Customer Information"><View style={styles.grid}>
          <InfoRow label="Customer Company" value={data.customer.company_name} />
          <InfoRow label="Customer Contact" value={data.customer.contact_name} />
          <InfoRow label="Phone" value={data.customer.phone} />
          <InfoRow label="Email" value={data.customer.email} />
          <InfoRow label="Job Site" value={data.customer.job_site || data.job.job_site} />
        </View></Section>

        <Section title="Scope of Work Completed"><View style={styles.body}>
          {data.scopes.map((scope) => <View key={scope.id} style={styles.scope} wrap={false}><Text style={styles.scopeTitle}>{scope.title}</Text>{scope.description ? <Text>{scope.description}</Text> : null}</View>)}
        </View></Section>

        <Text style={styles.statement}>This is to acknowledge that the work described above has been completed by {data.organization.company_name} on the completion date indicated above.</Text>

        <Section title="Completion Status"><View style={styles.body}>
          <CheckboxLine checked={!completedWithOutstanding}>Completed as per agreed scope</CheckboxLine>
          <CheckboxLine checked={completedWithOutstanding}>Completed with Outstanding Items</CheckboxLine>
          {data.certificate.completion_notes ? <Text style={{ marginTop: 6 }}>Completion Notes: {data.certificate.completion_notes}</Text> : null}
        </View></Section>

        {completedWithOutstanding ? <Section title="Outstanding Items / Comments"><View style={styles.body}><Text>{data.certificate.outstanding_items}</Text></View></Section> : null}

        <Section title="Customer Acknowledgement"><View style={styles.body}>
          <Text>I acknowledge that the work described above has been completed. Any outstanding items, if applicable, are noted above.</Text>
          <View style={styles.signatureGrid}>
            <View style={styles.signatureColumn}><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Customer Representative Name</Text><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Position</Text></View>
            <View style={styles.signatureColumn}><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Signature</Text><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Date</Text></View>
          </View>
        </View></Section>

        <Section title={`${data.organization.company_name} Confirmation`}><View style={styles.body}>
          <Text style={styles.scopeTitle}>Technician(s)</Text>
          {data.technicians.map((technician) => <Text key={technician.employee_id} style={styles.technicianName}>{technician.employee_name}</Text>)}
          <View style={styles.signatureGrid}>
            <View style={styles.signatureColumn}><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Technician Signature(s)</Text><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Date</Text></View>
            <View style={styles.signatureColumn}><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Supervisor / Authorized Representative</Text><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Signature / Date</Text></View>
          </View>
        </View></Section>

        <View fixed style={styles.footerRule} />
        <View fixed style={styles.footer}>
          <View style={styles.footerTop}><Text>{data.organization.company_name}</Text><Text>Work Completion Acknowledgement No.: {data.certificate.number}</Text></View>
          <Text style={styles.disclaimer}>This document confirms completion of the work identified above. It does not constitute an invoice or payment receipt.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderWorkCompletionPdf(data: WorkCompletionPdfData) {
  return renderToBuffer(<WorkCompletionPdf data={data} />);
}
