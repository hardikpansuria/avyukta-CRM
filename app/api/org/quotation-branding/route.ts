import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  richTextToPlainText,
  sanitizeCustomerQuotationHtml,
} from "@/lib/quotations/customer-quotation";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedLogoTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);
const maxLogoBytes = 5 * 1024 * 1024;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

function safeFileName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "logo"
  );
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "admin") return jsonError("Forbidden", 403);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_quotation_branding_versions")
    .select(
      "id,company_name,phone,fax,footer_text,terms_html,terms_text,logo_storage_path,effective_from,effective_to,created_by,created_at",
    )
    .eq("org_id", session.org_id)
    .order("effective_from", { ascending: false });

  if (error) return jsonError("Unable to load branding history", 500);

  const creatorIds = Array.from(
    new Set((data ?? []).map((row) => row.created_by).filter(Boolean)),
  ) as string[];
  const { data: creators } = creatorIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name")
        .in("id", creatorIds)
    : { data: [] };
  const creatorNames = new Map(
    (creators ?? []).map((creator) => [creator.id, creator.full_name]),
  );
  const currentDate = new Date().toISOString().slice(0, 10);
  const currentVersion = (data ?? []).find(
    (row) =>
      row.effective_from <= currentDate &&
      (!row.effective_to || row.effective_to >= currentDate),
  );
  const { data: signedLogo } = currentVersion?.logo_storage_path
    ? await admin.storage
        .from("crm-assets")
        .createSignedUrl(currentVersion.logo_storage_path, 10 * 60)
    : { data: null };

  const versions = (data ?? []).map((row) => ({
    ...row,
    terms_html: sanitizeCustomerQuotationHtml(row.terms_html),
    has_logo: Boolean(row.logo_storage_path),
    created_by_name:
      (row.created_by && creatorNames.get(row.created_by)?.trim()) || "System",
  }));

  return NextResponse.json({
    current: currentVersion
      ? {
          ...versions.find((row) => row.id === currentVersion.id),
          logo_signed_url: signedLogo?.signedUrl ?? null,
        }
      : null,
    versions,
  });
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "admin") {
    return jsonError("Only organization administrators can change branding", 403);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return jsonError("Invalid request body", 400);

  const companyName = value(formData, "company_name");
  const phone = value(formData, "phone");
  const fax = value(formData, "fax");
  const footerText = value(formData, "footer_text");
  const effectiveFrom = value(formData, "effective_from");
  const termsHtml = sanitizeCustomerQuotationHtml(
    value(formData, "terms_html"),
  );
  const termsText = richTextToPlainText(termsHtml);
  const removeLogo = value(formData, "remove_logo") === "true";
  const logo = formData.get("logo");

  if (!companyName) return jsonError("Company name is required", 400);
  if (!validDate(effectiveFrom)) {
    return jsonError("A valid effective date is required", 400);
  }
  if (companyName.length > 200 || phone.length > 60 || fax.length > 60) {
    return jsonError("Company name, phone, or fax is too long", 400);
  }
  if (footerText.length > 2_000 || termsHtml.length > 100_000) {
    return jsonError("Footer or terms and conditions are too long", 400);
  }

  const admin = createAdminClient();
  const { data: inherited } = await admin
    .from("organization_quotation_branding_versions")
    .select("logo_storage_path")
    .eq("org_id", session.org_id)
    .lte("effective_from", effectiveFrom)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  let logoStoragePath = removeLogo
    ? null
    : inherited?.logo_storage_path ?? session.logo_storage_path ?? null;
  let uploadedPath: string | null = null;

  if (logo instanceof File && logo.size > 0) {
    const extension = logo.name.split(".").pop()?.toLowerCase() ?? "";
    if (allowedLogoTypes.get(extension) !== logo.type.toLowerCase()) {
      return jsonError("Logo must be JPEG, PNG, or WebP", 400);
    }
    if (logo.size > maxLogoBytes) {
      return jsonError("Logo must be 5 MB or smaller", 400);
    }

    const versionId = crypto.randomUUID();
    uploadedPath = `${session.org_id}/quotation-branding/${versionId}/${safeFileName(logo.name)}`;
    const { error: uploadError } = await admin.storage
      .from("crm-assets")
      .upload(uploadedPath, Buffer.from(await logo.arrayBuffer()), {
        contentType: logo.type,
        upsert: false,
      });
    if (uploadError) return jsonError("Unable to upload branding logo", 500);
    logoStoragePath = uploadedPath;
  }

  const { data: version, error } = await admin
    .from("organization_quotation_branding_versions")
    .insert({
      org_id: session.org_id,
      company_name: companyName,
      phone: phone || null,
      fax: fax || null,
      footer_text: footerText || null,
      terms_html: termsHtml || null,
      terms_text: termsText || null,
      logo_storage_path: logoStoragePath,
      effective_from: effectiveFrom,
      created_by: session.user.id,
    })
    .select("*")
    .single();

  if (error || !version) {
    if (uploadedPath) {
      await admin.storage.from("crm-assets").remove([uploadedPath]);
    }
    if (error?.code === "23505") {
      return jsonError("A branding version already starts on this date", 409);
    }
    return jsonError("Unable to create branding version", 500);
  }

  const { data: signedLogo } = version.logo_storage_path
    ? await admin.storage
        .from("crm-assets")
        .createSignedUrl(version.logo_storage_path, 10 * 60)
    : { data: null };

  return NextResponse.json(
    {
      version: {
        ...version,
        logo_signed_url: signedLogo?.signedUrl ?? null,
      },
      message:
        "Branding version created. Existing customer documents remain unchanged.",
    },
    { status: 201 },
  );
}
