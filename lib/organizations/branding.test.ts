import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import {
  getEffectiveOrganizationBranding,
  resolveOrganizationBranding,
} from "./branding";

describe("resolveOrganizationBranding", () => {
  const legacy = {
    name: "Test Protech",
    logo_storage_path: "org-id/legacy-logo.png",
    quotation_company_name: "Legacy Protech",
    quotation_phone: "306-555-0100",
    quotation_fax: "306-555-0101",
    quotation_footer_text: "Legacy footer",
  };

  it("uses the effective version as the organization document identity", () => {
    expect(
      resolveOrganizationBranding(legacy, {
        company_name: "Current Protech",
        phone: "306-555-0200",
        fax: "306-555-0201",
        footer_text: "Current footer",
        logo_storage_path: "org-id/quotation-branding/version/logo.png",
      }),
    ).toEqual({
      company_name: "Current Protech",
      phone: "306-555-0200",
      fax: "306-555-0201",
      footer_text: "Current footer",
      logo_storage_path: "org-id/quotation-branding/version/logo.png",
    });
  });

  it("preserves an intentional no-logo version instead of reviving the legacy logo", () => {
    expect(
      resolveOrganizationBranding(legacy, {
        company_name: "Current Protech",
        phone: null,
        fax: null,
        footer_text: null,
        logo_storage_path: null,
      }),
    ).toEqual({
      company_name: "Current Protech",
      phone: null,
      fax: null,
      footer_text: null,
      logo_storage_path: null,
    });
  });

  it("falls back to legacy organization fields when no branding version exists", () => {
    expect(resolveOrganizationBranding(legacy, null)).toEqual({
      company_name: "Legacy Protech",
      phone: "306-555-0100",
      fax: "306-555-0101",
      footer_text: "Legacy footer",
      logo_storage_path: "org-id/legacy-logo.png",
    });
  });
});

describe("getEffectiveOrganizationBranding", () => {
  it("queries the version active on the requested date", async () => {
    const result = {
      data: {
        company_name: "Scheduled Protech",
        phone: "306-555-0300",
        fax: null,
        footer_text: "Scheduled footer",
        logo_storage_path: "org-id/quotation-branding/scheduled/logo.png",
      },
      error: null,
    };
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      lte: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle,
    };
    Object.values(chain).forEach((method) => {
      if (method !== maybeSingle) method.mockReturnValue(chain);
    });
    const from = vi.fn().mockReturnValue(chain);
    const admin = { from } as unknown as SupabaseClient;

    await expect(
      getEffectiveOrganizationBranding(admin, "org-id", "2026-09-01", {
        name: "Test Protech",
      }),
    ).resolves.toEqual({ data: result.data, error: null });
    expect(from).toHaveBeenCalledWith(
      "organization_quotation_branding_versions",
    );
    expect(chain.eq).toHaveBeenCalledWith("org_id", "org-id");
    expect(chain.lte).toHaveBeenCalledWith("effective_from", "2026-09-01");
    expect(chain.or).toHaveBeenCalledWith(
      "effective_to.is.null,effective_to.gte.2026-09-01",
    );
  });
});
