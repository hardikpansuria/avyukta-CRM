import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type OrganizationBrandingSource = {
  name?: unknown;
  logo_storage_path?: unknown;
  quotation_company_name?: unknown;
  quotation_phone?: unknown;
  quotation_fax?: unknown;
  quotation_footer_text?: unknown;
};

type VersionedBrandingSource = {
  company_name?: unknown;
  phone?: unknown;
  fax?: unknown;
  footer_text?: unknown;
  logo_storage_path?: unknown;
};

export type EffectiveOrganizationBranding = {
  company_name: string;
  phone: string | null;
  fax: string | null;
  footer_text: string | null;
  logo_storage_path: string | null;
};

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveOrganizationBranding(
  organization: OrganizationBrandingSource,
  version: VersionedBrandingSource | null,
): EffectiveOrganizationBranding {
  const fallback: EffectiveOrganizationBranding = {
    company_name:
      optionalText(organization.quotation_company_name) ??
      optionalText(organization.name) ??
      "Organization",
    phone: optionalText(organization.quotation_phone),
    fax: optionalText(organization.quotation_fax),
    footer_text: optionalText(organization.quotation_footer_text),
    logo_storage_path: optionalText(organization.logo_storage_path),
  };

  if (!version) return fallback;

  return {
    company_name: optionalText(version.company_name) ?? fallback.company_name,
    phone: optionalText(version.phone),
    fax: optionalText(version.fax),
    footer_text: optionalText(version.footer_text),
    logo_storage_path: optionalText(version.logo_storage_path),
  };
}

export async function getEffectiveOrganizationBranding(
  admin: SupabaseClient,
  orgId: string,
  effectiveDate: string,
  organization: OrganizationBrandingSource,
): Promise<
  | { data: EffectiveOrganizationBranding; error: null }
  | { data: null; error: unknown }
> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    return {
      data: null,
      error: new Error("Effective branding date must use YYYY-MM-DD."),
    };
  }

  const { data, error } = await admin
    .from("organization_quotation_branding_versions")
    .select("company_name,phone,fax,footer_text,logo_storage_path")
    .eq("org_id", orgId)
    .lte("effective_from", effectiveDate)
    .or(`effective_to.is.null,effective_to.gte.${effectiveDate}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  return {
    data: resolveOrganizationBranding(organization, data),
    error: null,
  };
}
