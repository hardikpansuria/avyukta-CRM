import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderWorkCompletionPdf, type WorkCompletionPdfData } from "./work-completion-pdf";

const sample: WorkCompletionPdfData = {
  organization: { company_name: "PRO-TECH STAINLESS AND SERVICES LTD.", phone: "306-555-0100" },
  certificate: {
    number: "WC-260002",
    revision_number: 2,
    completion_date: "2026-08-15",
    status: "completed_with_outstanding_items",
    completion_notes: "Fabrication and site installation completed.",
    outstanding_items: "Final protective cap to be installed during the next scheduled site visit.",
  },
  job: {
    job_number: "JOB-001",
    work_order_number: "JOB-001",
    project_name: "Mixing Tank",
    job_start_date: "2026-08-01",
    job_site: "123 Industrial Road, Regina, SK",
  },
  quotation: { number: "QT-260025", date: "2026-07-15", sales_representative: "Jordan Sales" },
  purchase_order: { number: "PO-123", date: "2026-07-20" },
  customer: {
    company_name: "ABC Foods Ltd.",
    contact_name: "Morgan Customer",
    contact_position: "Plant Manager",
    phone: "306-555-0101",
    email: "morgan@example.com",
    address: "123 Industrial Road, Regina, SK",
    job_site: "123 Industrial Road, Regina, SK",
  },
  technicians: [
    { employee_id: "employee-1", employee_name: "John Smith" },
    { employee_id: "employee-2", employee_name: "David Patel" },
  ],
  scopes: [{ id: "scope-1", title: "Scope 1 - Fabricate Mixing Tank", description: "Fabricate the stainless mixing tank to approved drawings." }],
};

describe("Work Completion Acknowledgement PDF", () => {
  it("renders a non-empty PDF from CRM-owned completion data", async () => {
    const pdf = await renderWorkCompletionPdf(sample);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);

    const samplePath = process.env.WORK_COMPLETION_SAMPLE_PATH;
    if (samplePath) writeFileSync(samplePath, pdf);
  });
});
