import { describe, expect, it } from "vitest";

import {
  findMissingRequiredDocuments,
  type LegalAcceptanceRecord,
} from "./acceptance-state";
import { safeLegalReturnPath } from "./redirect";

const required = [
  {
    key: "authorized_user_terms",
    slug: "terms",
    path: "/legal/terms",
    title: "Terms",
    description: "Terms",
    version: "1.0",
    effectiveDate: "2026-09-02",
    lastUpdated: "2026-09-01",
    sections: [],
    required: true,
    actionType: "agreed" as const,
    contentHash: "a".repeat(64),
  },
];

describe("legal acceptance matching", () => {
  it("accepts only the exact version, hash, and action", () => {
    const records: LegalAcceptanceRecord[] = [
      {
        document_key: "authorized_user_terms",
        document_version: "1.0",
        content_hash: "a".repeat(64),
        action_type: "agreed",
      },
    ];

    expect(findMissingRequiredDocuments(records, required)).toEqual([]);
  });

  it("requires acknowledgment again when the version or content changes", () => {
    const stale: LegalAcceptanceRecord[] = [
      {
        document_key: "authorized_user_terms",
        document_version: "0.9",
        content_hash: "b".repeat(64),
        action_type: "agreed",
      },
    ];

    expect(findMissingRequiredDocuments(stale, required)).toEqual(required);
  });
});

describe("legal return paths", () => {
  it("preserves dashboard paths and query strings", () => {
    expect(safeLegalReturnPath("/dashboard/quotations?page=2")).toBe(
      "/dashboard/quotations?page=2",
    );
  });

  it("rejects external and non-dashboard redirects", () => {
    expect(safeLegalReturnPath("https://attacker.test")).toBe("/dashboard");
    expect(safeLegalReturnPath("//attacker.test")).toBe("/dashboard");
    expect(safeLegalReturnPath("/legal/privacy")).toBe("/dashboard");
  });
});
