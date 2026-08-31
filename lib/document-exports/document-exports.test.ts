import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import { createArchiveStream, ExportLimitError, readmeText, StorageObjectError, validateExportSources } from "./archive";
import { collectOrganizationDocuments } from "./collector";
import {
  assignZipPaths,
  formatExportFilename,
  manifestCsv,
  parseExportWindow,
  safePathPart,
} from "./format";
import type { DocumentExportCollection, ExportDocument } from "./types";

function document(values: Partial<ExportDocument> = {}): ExportDocument {
  return {
    sourceId: "source-a",
    customerId: "customer-a",
    customerName: "ABC Foods Ltd.",
    customerCode: "CUST-001",
    quotationNumber: "Q-260014",
    revisionNumber: 0,
    jobNumber: "260014",
    poNumber: "PO-55",
    invoiceNumber: null,
    category: "Customer_Quotation",
    originalFilename: "quote.pdf",
    bucket: "customer-quotation-pdfs",
    storagePath: "internal/path.pdf",
    documentDate: "2026-08-10T12:00:00.000Z",
    fileSize: 5,
    mimeType: "application/pdf",
    zipPath: "",
    ...values,
  };
}

describe("document export request semantics", () => {
  it("uses inclusive UTC day boundaries and a fixed snapshot", () => {
    const window = parseExportWindow(
      { type: "date_range", from: "2026-08-01", to: "2026-08-10" },
      "2026-08-10T20:00:00.000Z",
    );
    expect(window.fromUtc).toBe("2026-08-01T00:00:00.000Z");
    expect(window.toUtc).toBe("2026-08-10T23:59:59.999Z");
    expect(window.snapshotAt).toBe("2026-08-10T20:00:00.000Z");
  });

  it("rejects malformed, missing, and reversed date ranges", () => {
    expect(() => parseExportWindow({ type: "date_range", from: "2026-08-10", to: "2026-08-01" }))
      .toThrow("From date cannot be after To date");
    expect(() => parseExportWindow({ type: "date_range", from: "2026-02-30", to: "2026-03-01" }))
      .toThrow("From date must be a valid date");
    expect(() => parseExportWindow({ type: "date_range", from: "2026-08-01" }))
      .toThrow("To date must be a valid date");
  });

  it("creates the specified centralized business filenames", () => {
    expect(formatExportFilename("Protech", parseExportWindow({ type: "full" })))
      .toBe("Protech_fullbackup.zip");
    expect(formatExportFilename(
      "Protech",
      parseExportWindow({ type: "date_range", from: "2025-08-04", to: "2026-08-10" }),
    )).toBe("Protech_4Aug2025_10Aug2026_backup.zip");
  });
});

describe("business-readable ZIP paths", () => {
  it("prevents traversal and strips internal identifiers", () => {
    expect(safePathPart("../../ABC / Foods: Ltd.")).toBe("ABC_Foods_Ltd");
    expect(safePathPart("f17a502c-1c5e-4b96-8d26-67dd0e8cd143.pdf")).not.toMatch(/[0-9a-f]{8}-/i);
  });

  it("handles duplicate customer and file names without overwriting", () => {
    const rows = [
      document(),
      document({ sourceId: "source-b" }),
      document({ sourceId: "source-c", customerId: "customer-b", customerCode: "CUST-002" }),
    ];
    assignZipPaths(rows, "Protech_fullbackup");
    expect(new Set(rows.map((row) => row.zipPath))).toHaveLength(3);
    expect(rows[0].zipPath).toContain("ABC_Foods_Ltd_CUST-001");
    expect(rows[1].zipPath).toMatch(/quote_2\.pdf$/);
    expect(rows[2].zipPath).toContain("ABC_Foods_Ltd_CUST-002");
    rows.forEach((row) => expect(row.zipPath).not.toContain("customer-"));
  });

  it("redacts identifiers and never includes raw storage metadata in the manifest", () => {
    const row = document({
      originalFilename: "f17a502c-1c5e-4b96-8d26-67dd0e8cd143.pdf",
      zipPath: "Protech/ABC/Quotation_Q-1_Rev-0/Quotation/document.pdf",
    });
    const manifest = manifestCsv([row], "2026-08-10T20:00:00.000Z");
    expect(manifest).not.toContain(row.storagePath);
    expect(manifest).not.toContain(row.sourceId);
    expect(manifest).not.toContain("f17a502c-1c5e-4b96-8d26-67dd0e8cd143");
    expect(manifest).toContain("Backup_Manifest".replace("Backup_Manifest", "ZIP Path"));
  });
});

describe("archive production and limits", () => {
  it("creates a valid ZIP with a document, manifest, and README", async () => {
    const row = document();
    assignZipPaths([row], "Protech_fullbackup");
    const collection: DocumentExportCollection = {
      organizationName: "Protech",
      generatedBy: "Admin User",
      window: parseExportWindow({ type: "full" }, "2026-08-10T20:00:00.000Z"),
      documents: [row],
    };
    const stream = createArchiveStream(
      collection,
      "Protech_fullbackup",
      () => Readable.from(Buffer.from("hello")),
    );
    const bytes = Buffer.from(await new Response(stream).arrayBuffer());
    const directory = mkdtempSync(join(tmpdir(), "document-export-test-"));
    const archivePath = join(directory, "backup.zip");
    writeFileSync(archivePath, bytes);
    expect(execFileSync("unzip", ["-t", archivePath], { encoding: "utf8" })).toContain("No errors detected");
    const entries = execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" });
    const details = execFileSync("unzip", ["-lv", archivePath], { encoding: "utf8" });
    expect(entries).toContain(row.zipPath);
    expect(entries).toContain("Protech_fullbackup/Backup_Manifest.csv");
    expect(entries).toContain("Protech_fullbackup/README.txt");
    expect(readmeText(collection)).toContain("Archive Version: 1");
    expect(details).toContain("Stored");
  });

  it("rejects count and metadata-byte limits before Storage access", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(validateExportSources([document(), document({ sourceId: "b" })], {
      maxFiles: 1,
      maxBytes: 100,
      validationConcurrency: 1,
    })).rejects.toBeInstanceOf(ExportLimitError);
    await expect(validateExportSources([document({ fileSize: 101 })], {
      maxFiles: 10,
      maxBytes: 100,
      validationConcurrency: 1,
    })).rejects.toBeInstanceOf(ExportLimitError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("fails the entire export when a required Storage object is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(validateExportSources([document()], {
      maxFiles: 10,
      maxBytes: 100,
      validationConcurrency: 1,
    })).rejects.toBeInstanceOf(StorageObjectError);
    fetchSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("times out a stalled Storage validation instead of exhausting the Function duration", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(validateExportSources([document()], {
      maxFiles: 10,
      maxBytes: 100,
      validationConcurrency: 1,
      storageRequestTimeoutMs: 5,
      validationTimeoutMs: 50,
    })).rejects.toBeInstanceOf(StorageObjectError);
    fetchSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

type FixtureRow = Record<string, unknown>;

class FixtureQuery implements PromiseLike<{ data: FixtureRow[]; error: null }> {
  private filters: Array<(row: FixtureRow) => boolean> = [];
  constructor(private readonly rows: FixtureRow[]) {}
  select() { return this; }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column]) >= value);
    return this;
  }
  lte(column: string, value: string) {
    this.filters.push((row) => String(row[column]) <= value);
    return this;
  }
  then<TResult1 = { data: FixtureRow[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: FixtureRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({
      data: this.rows.filter((row) => this.filters.every((filter) => filter(row))),
      error: null,
    })
      .then(onfulfilled, onrejected);
  }
}

function fixtureClient(tables: Record<string, FixtureRow[]>) {
  return {
    from(table: string) {
      return new FixtureQuery(tables[table] ?? []);
    },
  } as unknown as SupabaseClient;
}

const organizationA = "10000000-0000-4000-8000-000000000001";
const organizationB = "10000000-0000-4000-8000-000000000002";

function collectorFixtures(): Record<string, FixtureRow[]> {
  return {
    customers: [
      { id: "customer-a", org_id: organizationA, company_name: "Organization A Customer", customer_code: "A-1" },
      { id: "customer-b", org_id: organizationB, company_name: "Organization B Customer", customer_code: "B-1" },
    ],
    quotations: [
      { id: "quote-a", org_id: organizationA, customer_id: "customer-a", quotation_number: "QA-1", revision_number: 0 },
      { id: "quote-b", org_id: organizationB, customer_id: "customer-b", quotation_number: "QB-1", revision_number: 0 },
    ],
    jobs: [{ id: "job-a", org_id: organizationA, job_number: "260001", customer_id: "customer-a" }],
    job_purchase_orders: [{ id: "po-a", org_id: organizationA, customer_id: "customer-a", po_number: "PO-A" }],
    job_purchase_order_allocations: [{
      org_id: organizationA, purchase_order_id: "po-a", job_id: "job-a",
      quotation_id_snapshot: "quote-a", quotation_number_snapshot: "QA-1", revision_number_snapshot: 0,
    }],
    job_invoices: [{ id: "invoice-a", org_id: organizationA, job_id: "job-a", purchase_order_id: "po-a", invoice_number: "INV-A" }],
    invoice_requests: [],
    quotation_material_documents: [],
    quotation_scope_charge_documents: [],
    quotation_generated_documents: [
      { id: "aug-1", org_id: organizationA, quotation_id: "quote-a", revision_number: 0, file_name: "aug-1.pdf", file_path: "a/aug-1.pdf", file_size: 1, generated_at: "2026-08-01T00:00:00.000Z" },
      { id: "aug-10", org_id: organizationA, quotation_id: "quote-a", revision_number: 0, file_name: "aug-10.pdf", file_path: "a/aug-10.pdf", file_size: 1, generated_at: "2026-08-10T23:59:59.999Z" },
      { id: "july-31", org_id: organizationA, quotation_id: "quote-a", revision_number: 0, file_name: "july-31.pdf", file_path: "a/july-31.pdf", file_size: 1, generated_at: "2026-07-31T23:59:59.999Z" },
      { id: "aug-11", org_id: organizationA, quotation_id: "quote-a", revision_number: 0, file_name: "aug-11.pdf", file_path: "a/aug-11.pdf", file_size: 1, generated_at: "2026-08-11T00:00:00.000Z" },
      { id: "org-b-doc", org_id: organizationB, quotation_id: "quote-b", revision_number: 0, file_name: "organization-b-secret.pdf", file_path: "b/secret.pdf", file_size: 1, generated_at: "2026-08-05T12:00:00.000Z" },
      { id: "after-snapshot", org_id: organizationA, quotation_id: "quote-a", revision_number: 0, file_name: "after-snapshot.pdf", file_path: "a/after-snapshot.pdf", file_size: 1, generated_at: "2026-08-13T00:00:00.000Z" },
    ],
    job_purchase_order_documents: [],
    invoice_request_documents: [],
    job_work_completions: [{
      id: "completion-a", org_id: organizationA, job_id: "job-a",
      certificate_number: "WC-260001", certificate_file_name: "WC-260001.pdf",
      certificate_storage_path: "a/jobs/job-a/WC-260001.pdf", certificate_file_size: 1,
      certificate_generated_at: "2026-08-09T12:00:00.000Z", generation_status: "generated",
    }],
    job_invoice_documents: [{
      id: "old-quote-new-invoice", org_id: organizationA, invoice_id: "invoice-a",
      file_name: "invoice.pdf", file_path: "a/invoice.pdf", file_size: 1,
      mime_type: "application/pdf", uploaded_at: "2026-08-05T12:00:00.000Z",
    }],
  };
}

describe("organization-scoped collection", () => {
  const session = {
    user: { id: "user-a", email: "admin-a@test.local", user_metadata: {} } as User,
    org_id: organizationA,
    role: "admin",
    org_code: "orga",
    org_name: "Organization A",
  };

  it("collects only the active session organization and has no request org selector", async () => {
    const collection = await collectOrganizationDocuments(
      fixtureClient(collectorFixtures()),
      session,
      parseExportWindow({ type: "full" }, "2026-08-12T00:00:00.000Z"),
    );
    expect(collection.documents).toHaveLength(6);
    expect(collection.documents.every((row) => row.customerName === "Organization A Customer")).toBe(true);
    expect(JSON.stringify(collection)).not.toContain("Organization B Customer");
    expect(JSON.stringify(collection)).not.toContain("organization-b-secret");
  });

  it("filters each document timestamp inclusively and includes a newly uploaded invoice for an old quotation", async () => {
    const collection = await collectOrganizationDocuments(
      fixtureClient(collectorFixtures()),
      session,
      parseExportWindow(
        { type: "date_range", from: "2026-08-01", to: "2026-08-10" },
        "2026-08-12T00:00:00.000Z",
      ),
    );
    expect(collection.documents.map((row) => row.sourceId).sort())
      .toEqual(["aug-1", "aug-10", "completion-a", "old-quote-new-invoice"]);
    expect(collection.documents.find((row) => row.sourceId === "old-quote-new-invoice")?.category)
      .toBe("Invoices");
    expect(collection.documents.find((row) => row.sourceId === "completion-a")?.category)
      .toBe("Work_Completion_Acknowledgement");
  });
});
