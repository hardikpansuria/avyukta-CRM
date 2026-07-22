import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { parseDocument } from "htmlparser2";
import type { ReactNode } from "react";

import { sanitizeCustomerQuotationHtml } from "./customer-quotation";

type RichNode = {
  type: string;
  name?: string;
  data?: string;
  children?: RichNode[];
};

type TermsSection = {
  title: string;
  content: RichNode[];
};

export type CustomerQuotationPdfData = {
  organization: {
    company_name: string;
    phone?: string | null;
    fax?: string | null;
    footer_text?: string | null;
    terms_html?: string | null;
    terms_text?: string | null;
  };
  logo_data_url?: string | null;
  document: {
    quotation_date?: string | null;
    quotation_number_snapshot?: string | null;
    revision_number_snapshot?: number | string | null;
    customer_name_snapshot?: string | null;
    address_line_1_snapshot?: string | null;
    city_snapshot?: string | null;
    province_snapshot?: string | null;
    postal_code_snapshot?: string | null;
    attendee_name_snapshot?: string | null;
    attendee_email_snapshot?: string | null;
    delivery_text?: string | null;
    terms_text?: string | null;
    fob_text?: string | null;
    prepared_by_name_snapshot?: string | null;
    subtotal?: number | string | null;
    discount_amount?: number | string | null;
    final_additional_charges_total?: number | string | null;
    grand_total_before_tax?: number | string | null;
    tax_name?: string | null;
    tax_rate?: number | string | null;
    tax_amount?: number | string | null;
    total?: number | string | null;
  };
  items: Array<{
    id?: string;
    scope_title_snapshot?: string | null;
    description_html?: string | null;
    quantity?: number | string | null;
    price_each?: number | string | null;
    price_ext?: number | string | null;
  }>;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 76,
    paddingRight: 38,
    paddingBottom: 58,
    paddingLeft: 38,
    color: "#18181b",
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.4,
  },
  fixedHeader: {
    position: "absolute",
    top: 24,
    left: 38,
    right: 38,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d8",
    paddingBottom: 8,
  },
  logo: {
    width: 118,
    height: 34,
    objectFit: "contain",
    objectPosition: "left center",
  },
  companyName: {
    maxWidth: 250,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  footerRule: {
    position: "absolute",
    bottom: 43,
    left: 38,
    right: 38,
    borderTopWidth: 1,
    borderTopColor: "#d4d4d8",
  },
  footerText: {
    position: "absolute",
    bottom: 24,
    left: 38,
    width: 450,
    color: "#52525b",
    fontSize: 7.5,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 38,
    width: 60,
    textAlign: "right",
    color: "#52525b",
    fontSize: 7.5,
  },
  topGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 28,
    marginBottom: 22,
  },
  customerBlock: {
    width: "58%",
  },
  customerName: {
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  metaBlock: {
    width: "34%",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 4,
  },
  metaLabel: {
    color: "#52525b",
  },
  metaValue: {
    width: 120,
    textAlign: "right",
  },
  quotationNumber: {
    width: 120,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  title: {
    width: "100%",
    marginBottom: 12,
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  table: {
    borderWidth: 1,
    borderColor: "#a1a1aa",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    borderBottomWidth: 1,
    borderBottomColor: "#a1a1aa",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d8",
  },
  qtyCell: {
    width: "10%",
    padding: 6,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#d4d4d8",
  },
  descriptionCell: {
    width: "54%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#d4d4d8",
  },
  moneyCell: {
    width: "18%",
    padding: 6,
    textAlign: "right",
    borderRightWidth: 1,
    borderRightColor: "#d4d4d8",
  },
  lastMoneyCell: {
    width: "18%",
    padding: 6,
    textAlign: "right",
  },
  scopeTitle: {
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  richParagraph: {
    marginBottom: 3,
  },
  richHeading: {
    marginTop: 3,
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  richHeadingLarge: {
    marginTop: 4,
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  listRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 5,
  },
  listMarker: {
    width: 14,
  },
  listBody: {
    flex: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totalBox: {
    width: 180,
    borderTopWidth: 2,
    borderTopColor: "#18181b",
    paddingTop: 7,
    fontSize: 9,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#a1a1aa",
    paddingTop: 4,
    marginTop: 2,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  thankYou: {
    marginTop: 22,
    marginBottom: 14,
  },
  commercialRow: {
    flexDirection: "row",
    marginBottom: 7,
  },
  commercialLabel: {
    width: 58,
    fontFamily: "Helvetica-Bold",
  },
  commercialValue: {
    flex: 1,
  },
  subjectText: {
    marginTop: 15,
    marginBottom: 18,
  },
  signature: {
    marginTop: 5,
  },
  termsTitle: {
    width: "100%",
    marginBottom: 4,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    lineHeight: 1.05,
  },
  termsPage: {
    paddingTop: 42,
    paddingRight: 24,
    paddingBottom: 28,
    paddingLeft: 24,
    color: "#18181b",
    fontFamily: "Helvetica",
    fontSize: 6.5,
    lineHeight: 1.08,
  },
  termsHeader: {
    position: "absolute",
    top: 12,
    left: 24,
    right: 24,
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#a1a1aa",
    paddingBottom: 3,
  },
  termsLogo: {
    width: 58,
    height: 17,
    objectFit: "contain",
    objectPosition: "left center",
    marginRight: 7,
  },
  termsCompanyLine: {
    flex: 1,
    fontSize: 5.75,
    lineHeight: 1,
    textAlign: "right",
  },
  termsIntro: {
    marginBottom: 3,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.05,
  },
  termsTable: {
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderColor: "#a1a1aa",
  },
  termsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#a1a1aa",
  },
  termsSectionCell: {
    width: 86,
    paddingTop: 1.4,
    paddingRight: 2,
    paddingBottom: 1.4,
    paddingLeft: 2,
    borderRightWidth: 0.5,
    borderColor: "#a1a1aa",
    backgroundColor: "#f4f4f5",
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    lineHeight: 1.05,
  },
  termsBodyCell: {
    flex: 1,
    paddingTop: 1.4,
    paddingRight: 2,
    paddingBottom: 1.4,
    paddingLeft: 2,
    borderRightWidth: 0.5,
    borderColor: "#a1a1aa",
    fontSize: 6.5,
    lineHeight: 1.08,
  },
  termsFooterRule: {
    position: "absolute",
    bottom: 20,
    left: 24,
    right: 24,
    borderTopWidth: 0.5,
    borderTopColor: "#a1a1aa",
  },
  termsFooterText: {
    position: "absolute",
    bottom: 10,
    left: 24,
    width: 480,
    color: "#52525b",
    fontSize: 4.8,
    lineHeight: 1,
  },
});

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

function formattedDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function inlineNodes(nodes: RichNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === "text") return node.data ?? "";

    const children = inlineNodes(node.children ?? [], key);

    if (node.name === "strong" || node.name === "b") {
      return (
        <Text key={key} style={{ fontFamily: "Helvetica-Bold" }}>
          {children}
        </Text>
      );
    }

    if (node.name === "em" || node.name === "i") {
      return (
        <Text key={key} style={{ fontFamily: "Helvetica-Oblique" }}>
          {children}
        </Text>
      );
    }

    if (node.name === "u") {
      return (
        <Text key={key} style={{ textDecoration: "underline" }}>
          {children}
        </Text>
      );
    }

    if (node.name === "br") return "\n";

    return <Text key={key}>{children}</Text>;
  });
}

function nodeText(node: RichNode): string {
  if (node.type === "text") return node.data ?? "";
  return (node.children ?? []).map(nodeText).join("");
}

function parseTermsSections(html: string) {
  const sanitized = sanitizeCustomerQuotationHtml(html);
  const document = parseDocument(sanitized);
  const nodes = document.children as unknown as RichNode[];
  const intro: RichNode[] = [];
  const sections: TermsSection[] = [];
  let currentSection: TermsSection | null = null;

  for (const node of nodes) {
    if (node.name === "h2") {
      currentSection = {
        title: nodeText(node).replace(/\s+/g, " ").trim(),
        content: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.content.push(node);
    } else if (
      !nodeText(node)
        .replace(/\s+/g, " ")
        .trim()
        .startsWith("TERMS AND CONDITIONS COVERING THIS QUOTATION")
    ) {
      intro.push(node);
    }
  }

  return { intro, sections };
}

function compactTermsInline(
  nodes: RichNode[],
  keyPrefix: string,
): ReactNode[] {
  const output: ReactNode[] = [];

  nodes.forEach((node, index) => {
    const key = `${keyPrefix}-${index}`;
    const normalizedText = nodeText(node).replace(/\s+/g, " ").trim();

    if (!normalizedText) return;

    if (node.type === "text") {
      output.push(normalizedText, " ");
      return;
    }

    if (node.name === "strong" || node.name === "b") {
      output.push(
        <Text key={key} style={{ fontFamily: "Helvetica-Bold" }}>
          {normalizedText}
        </Text>,
        " ",
      );
      return;
    }

    output.push(
      <Text key={key}>
        {compactTermsInline(node.children ?? [], `${key}-child`)}
      </Text>,
      " ",
    );
  });

  return output;
}

function richBlocks(html: string | null | undefined, prefix: string) {
  const sanitized = sanitizeCustomerQuotationHtml(html);
  const document = parseDocument(sanitized);
  const nodes = document.children as unknown as RichNode[];
  const blocks: ReactNode[] = [];

  nodes.forEach((node, index) => {
    const key = `${prefix}-${index}`;

    if (node.type === "text" && node.data?.trim()) {
      blocks.push(
        <Text key={key} style={styles.richParagraph}>
          {node.data}
        </Text>,
      );
      return;
    }

    if (node.name === "ul" || node.name === "ol") {
      let itemNumber = 0;
      (node.children ?? []).forEach((child, childIndex) => {
        if (child.name !== "li") return;
        itemNumber += 1;
        blocks.push(
          <View key={`${key}-${childIndex}`} style={styles.listRow}>
            <Text style={styles.listMarker}>
              {node.name === "ol" ? `${itemNumber}.` : "-"}
            </Text>
            <Text style={styles.listBody}>
              {inlineNodes(child.children ?? [], `${key}-${childIndex}`)}
            </Text>
          </View>,
        );
      });
      return;
    }

    if (node.name === "h2" || node.name === "h3") {
      blocks.push(
        <Text
          key={key}
          style={
            node.name === "h2" ? styles.richHeadingLarge : styles.richHeading
          }
        >
          {inlineNodes(node.children ?? [], key)}
        </Text>,
      );
      return;
    }

    blocks.push(
      <Text key={key} style={styles.richParagraph}>
        {inlineNodes(node.children ?? [], key)}
      </Text>,
    );
  });

  return blocks;
}

function FixedChrome({
  organization,
  logoDataUrl,
}: {
  organization: CustomerQuotationPdfData["organization"];
  logoDataUrl?: string | null;
}) {
  return (
    <>
      <View fixed style={styles.fixedHeader}>
        {logoDataUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logoDataUrl} style={styles.logo} />
        ) : (
          <Text style={styles.companyName}>{organization.company_name}</Text>
        )}
        <Text>{organization.company_name}</Text>
      </View>
      <View fixed style={styles.footerRule} />
      <Text fixed style={styles.footerText}>
        {organization.footer_text ||
          [
            organization.company_name,
            organization.phone ? `Phone: ${organization.phone}` : null,
            organization.fax ? `Fax: ${organization.fax}` : null,
          ]
            .filter(Boolean)
            .join("  ")}
      </Text>
      <Text
        fixed
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
        style={styles.pageNumber}
      />
    </>
  );
}

function TermsChrome({
  organization,
  logoDataUrl,
}: {
  organization: CustomerQuotationPdfData["organization"];
  logoDataUrl?: string | null;
}) {
  const companyLine = [
    organization.company_name,
    organization.phone ? `Phone: ${organization.phone}` : null,
    organization.fax ? `Fax: ${organization.fax}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");

  return (
    <>
      <View fixed style={styles.termsHeader}>
        {logoDataUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logoDataUrl} style={styles.termsLogo} />
        ) : null}
        <Text style={styles.termsCompanyLine}>{companyLine}</Text>
      </View>
      <View fixed style={styles.termsFooterRule} />
      <Text fixed style={styles.termsFooterText}>
        {organization.footer_text || companyLine}
      </Text>
    </>
  );
}

function CustomerQuotationPdf({ data }: { data: CustomerQuotationPdfData }) {
  const { organization, document, items } = data;
  const location = [document.city_snapshot, document.province_snapshot]
    .filter(Boolean)
    .join(", ");
  const termsHtml =
    organization.terms_html ||
    (organization.terms_text
      ? `<p>${organization.terms_text.replace(/\n/g, "<br>")}</p>`
      : "");
  const terms = parseTermsSections(termsHtml);

  return (
    <Document
      author={organization.company_name}
      subject="Customer quotation"
      title={document.quotation_number_snapshot ?? "Quotation"}
    >
      <Page size="A4" style={styles.page} wrap>
        <FixedChrome
          logoDataUrl={data.logo_data_url}
          organization={organization}
        />

        <View style={styles.topGrid}>
          <View style={styles.customerBlock}>
            <Text style={styles.customerName}>
              {document.customer_name_snapshot || "-"}
            </Text>
            <Text>{document.address_line_1_snapshot || ""}</Text>
            <Text>{location}</Text>
            <Text>{document.postal_code_snapshot || ""}</Text>
            <Text style={{ marginTop: 7 }}>
              Attn: {document.attendee_name_snapshot || "-"}
            </Text>
            <Text>{document.attendee_email_snapshot || ""}</Text>
          </View>
          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>
                {formattedDate(document.quotation_date)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Quotation:</Text>
              <Text style={styles.quotationNumber}>
                {document.quotation_number_snapshot || "-"}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Revision:</Text>
              <Text style={styles.metaValue}>
                {String(document.revision_number_snapshot ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.title}>Quotation</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.qtyCell}>Qty.</Text>
            <Text style={styles.descriptionCell}>Description</Text>
            <Text style={styles.moneyCell}>Price Each</Text>
            <Text style={styles.lastMoneyCell}>Price Ext</Text>
          </View>
          {items.map((item, index) => (
            <View
              key={item.id ?? `${item.scope_title_snapshot}-${index}`}
              minPresenceAhead={40}
              style={styles.tableRow}
            >
              <Text style={styles.qtyCell}>{String(item.quantity ?? 0)}</Text>
              <View style={styles.descriptionCell}>
                <Text style={styles.scopeTitle}>
                  {item.scope_title_snapshot || `Scope of Work ${index + 1}`}
                </Text>
                {richBlocks(item.description_html, `item-${index}`)}
              </View>
              <Text style={styles.moneyCell}>{money(item.price_each)}</Text>
              <Text style={styles.lastMoneyCell}>{money(item.price_ext)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow} wrap={false}>
          <View style={styles.totalBox}>
            <View style={styles.summaryLine}>
              <Text>Subtotal</Text>
              <Text>{money(document.subtotal)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text>Discount</Text>
              <Text>{money(-Number(document.discount_amount ?? 0))}</Text>
            </View>
            {Number(document.final_additional_charges_total ?? 0) > 0 ? (
              <View style={styles.summaryLine}>
                <Text>Final Additional Charges</Text>
                <Text>{money(document.final_additional_charges_total)}</Text>
              </View>
            ) : null}
            <View style={styles.summaryLine}>
              <Text>Grand Total Before Tax</Text>
              <Text>{money(document.grand_total_before_tax)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text>
                {document.tax_name || "Tax"} ({String(document.tax_rate ?? 0)}%)
              </Text>
              <Text>{money(document.tax_amount)}</Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text>Grand Total</Text>
              <Text>{money(document.total)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.thankYou}>
          Thank you, for the opportunity to quote on your requirements, please
          call if you require further information.
        </Text>
        <View style={styles.commercialRow}>
          <Text style={styles.commercialLabel}>Delivery:</Text>
          <Text style={styles.commercialValue}>
            {document.delivery_text || "-"}
          </Text>
        </View>
        <View style={styles.commercialRow}>
          <Text style={styles.commercialLabel}>Terms:</Text>
          <Text style={styles.commercialValue}>
            {document.terms_text || "-"}
          </Text>
        </View>
        <View style={styles.commercialRow}>
          <Text style={styles.commercialLabel}>FOB:</Text>
          <Text style={styles.commercialValue}>{document.fob_text || "-"}</Text>
        </View>
        <Text style={styles.subjectText}>
          Order Subject to {organization.company_name} Standard terms and
          conditions of sale.
        </Text>
        <Text>Sincerely,</Text>
        <Text style={styles.signature}>
          {document.prepared_by_name_snapshot || "-"}
        </Text>
      </Page>

      <Page size="A4" style={styles.termsPage} wrap>
        <TermsChrome
          logoDataUrl={data.logo_data_url}
          organization={organization}
        />
        <Text style={styles.termsTitle}>
          TERMS AND CONDITIONS COVERING THIS QUOTATION AND SUBSEQUENT ORDERS
        </Text>
        {terms.intro.length > 0 ? (
          <Text style={styles.termsIntro}>
            {compactTermsInline(terms.intro, "terms-intro")}
          </Text>
        ) : null}
        <View style={styles.termsTable}>
          {terms.sections.map((section, index) => (
            <View
              key={`${section.title}-${index}`}
              style={styles.termsRow}
              wrap={false}
            >
              <Text style={styles.termsSectionCell}>{section.title}</Text>
              <Text style={styles.termsBodyCell}>
                {compactTermsInline(
                  section.content,
                  `terms-section-${index}`,
                )}
              </Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function renderCustomerQuotationPdf(
  data: CustomerQuotationPdfData,
) {
  return renderToBuffer(<CustomerQuotationPdf data={data} />);
}
