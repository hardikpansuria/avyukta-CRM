"use client";

import Image from "next/image";

type PreviewData = {
  organization: {
    company_name: string;
    phone?: string | null;
    fax?: string | null;
    footer_text?: string | null;
    terms_html?: string | null;
    terms_text?: string | null;
    logo_signed_url?: string | null;
  };
  document: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
};

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

function dateText(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(parsed);
}

export function CustomerQuotationPreview({
  data,
}: {
  data: PreviewData;
}) {
  const { organization, document, items } = data;
  const footer =
    organization.footer_text ||
    [
      organization.company_name,
      organization.phone ? `Phone: ${organization.phone}` : null,
      organization.fax ? `Fax: ${organization.fax}` : null,
    ]
      .filter(Boolean)
      .join("  ");

  return (
    <div className="space-y-5">
      <section className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-[12mm] text-zinc-950 shadow-lg ring-1 ring-zinc-200">
        <header className="flex min-h-14 items-center justify-between gap-6 border-b border-zinc-300 pb-3">
          {organization.logo_signed_url ? (
            <Image
              unoptimized
              alt={organization.company_name}
              className="h-12 w-auto max-w-48 object-contain object-left"
              height={48}
              src={organization.logo_signed_url}
              width={192}
            />
          ) : (
            <p className="text-lg font-bold">{organization.company_name}</p>
          )}
          <p className="text-right text-xs font-semibold">
            {organization.company_name}
          </p>
        </header>

        <div className="mt-6 grid grid-cols-[1fr_230px] gap-10 text-xs leading-5">
          <div>
            <p className="font-bold">
              {String(document.customer_name_snapshot || "-")}
            </p>
            <p>{String(document.address_line_1_snapshot || "")}</p>
            <p>
              {[document.city_snapshot, document.province_snapshot]
                .filter(Boolean)
                .join(", ")}
            </p>
            <p>{String(document.postal_code_snapshot || "")}</p>
            <p className="mt-2">
              Attn: {String(document.attendee_name_snapshot || "-")}
            </p>
            <p>{String(document.attendee_email_snapshot || "")}</p>
          </div>
          <dl className="grid grid-cols-[80px_1fr] content-start gap-y-1">
            <dt>Date:</dt>
            <dd className="text-right">
              {dateText(document.quotation_date)}
            </dd>
            <dt>Quotation:</dt>
            <dd className="text-right font-bold">
              {String(document.quotation_number_snapshot || "-")}
            </dd>
            <dt>Revision:</dt>
            <dd className="text-right">
              {String(document.revision_number_snapshot ?? 0)}
            </dd>
          </dl>
        </div>

        <h1 className="mt-8 text-center text-2xl font-bold">Quotation</h1>
        <div className="mt-4 overflow-hidden border border-zinc-400">
          <div className="grid grid-cols-[55px_1fr_110px_110px] bg-zinc-100 text-xs font-bold">
            <span className="border-r border-zinc-300 p-2 text-center">Qty.</span>
            <span className="border-r border-zinc-300 p-2">Description</span>
            <span className="border-r border-zinc-300 p-2 text-right">
              Price Each
            </span>
            <span className="p-2 text-right">Price Ext</span>
          </div>
          {items.map((item, index) => (
            <div
              className="grid grid-cols-[55px_1fr_110px_110px] border-t border-zinc-300 text-xs"
              key={String(item.id ?? index)}
            >
              <span className="border-r border-zinc-300 p-2 text-center">
                {String(item.quantity ?? 0)}
              </span>
              <div className="border-r border-zinc-300 p-2">
                <p className="font-bold">
                  {String(item.scope_title_snapshot || `Scope ${index + 1}`)}
                </p>
                <div
                  className="mt-1 leading-5 [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{
                    __html: String(item.description_html || ""),
                  }}
                />
              </div>
              <span className="border-r border-zinc-300 p-2 text-right">
                {money(item.price_each)}
              </span>
              <span className="p-2 text-right">{money(item.price_ext)}</span>
            </div>
          ))}
        </div>

        <div className="ml-auto mt-4 flex w-64 justify-between border-t-2 border-zinc-950 pt-2 text-sm font-bold">
          <span>Total</span>
          <span>{money(document.total)}</span>
        </div>

        <div className="mt-8 space-y-3 text-xs leading-5">
          <p>
            Thank you, for the opportunity to quote on your requirements,
            please call if you require further information.
          </p>
          <p>
            <strong>Delivery:</strong>{" "}
            {String(document.delivery_text || "-")}
          </p>
          <p>
            <strong>Terms:</strong> {String(document.terms_text || "-")}
          </p>
          <p>
            <strong>FOB:</strong> {String(document.fob_text || "-")}
          </p>
          <p className="pt-2">
            Order Subject to {organization.company_name} Standard terms and
            conditions of sale.
          </p>
          <p className="pt-3">Sincerely,</p>
          <p>{String(document.prepared_by_name_snapshot || "-")}</p>
        </div>

        <footer className="mt-12 border-t border-zinc-300 pt-3 text-center text-[10px] text-zinc-600">
          {footer}
        </footer>
      </section>

      <section className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-[12mm] text-zinc-950 shadow-lg ring-1 ring-zinc-200">
        <header className="flex min-h-14 items-center justify-between gap-6 border-b border-zinc-300 pb-3">
          <p className="font-bold">{organization.company_name}</p>
        </header>
        <h2 className="mt-8 text-center text-sm font-bold">
          TERMS AND CONDITIONS COVERING THIS QUOTATION AND SUBSEQUENT ORDERS
        </h2>
        <div
          className="mt-6 text-[11px] leading-5 [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{
            __html:
              organization.terms_html ||
              String(organization.terms_text || "").replace(/\n/g, "<br>"),
          }}
        />
        <footer className="mt-12 border-t border-zinc-300 pt-3 text-center text-[10px] text-zinc-600">
          {footer}
        </footer>
      </section>
    </div>
  );
}
