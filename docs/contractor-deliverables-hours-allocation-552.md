# Avyukta CRM Contractor Deliverables and Retrospective Hours Allocation

## Purpose and Basis

This report supports project tracking and business-record review for the Avyukta CRM implementation. The known contractor total of **552 hours** was supplied externally and has not been changed.

- **Project:** Avyukta CRM
- **Report prepared:** 2026-09-11
- **Contractor name:** Not supplied in the source brief
- **Known period totals:** Period 1 - 192 hours; Period 2 - 176 hours; Period 3 - 184 hours
- **Known total:** 552 hours

The module and ticket hours below are **retrospective estimates used only to allocate that known total**. They are not contemporaneous time entries and should not be represented as daily clock records. Git activity, migrations, tests, routes, and documentation establish that work occurred and indicate its relative scope; they do not independently prove the exact time spent.

Repository basis:

- Branch reviewed: `develop`
- Repository snapshot: commit `6da6f62`
- Git history reviewed: 78 commits from 2026-07-14 through 2026-09-10
- Internal references `CRM-001` through `CRM-028` were created for this report and are not represented as pre-existing historical ticket numbers
- Cross-cutting database, testing, security, and integration effort is generally allocated to the business feature that required it; the standalone Database module covers baseline and reproducibility work only

## Module-Level Summary

| Module | Estimated Hours | % of Total Hours | Main Deliverables |
| ------ | --------------: | ---------------: | ----------------- |
| Shared / Platform | 20 | 3.62% | Next.js application foundation, shared UI system, dependency/configuration work, and cross-module usability consistency |
| Authentication | 22 | 3.99% | Organization-aware login/logout, session handling, password recovery, and invitation communications |
| Organizations / Super Admin / Branding | 26 | 4.71% | Organization provisioning, super-admin management, versioned branding, and configurable quotation wording |
| Customers | 22 | 3.99% | Customer company profiles, contacts, addresses, notes, activities, tags, logos, and lifecycle management |
| Quotations | 122 | 22.10% | Scope costing, finalization, status control, customer documents, PDF generation, snapshots, revisions, comparison, and later quotation enhancements |
| Jobs / Work Orders / Receivables | 64 | 11.59% | Job conversion and tracking, purchase-order intake, receivable foundations, completion workflow, and completion certificates |
| Calendar / Workforce | 34 | 6.16% | Calendar scheduling, conflict checks, availability, employee skills, and workforce administration |
| Supplier Price Library | 34 | 6.16% | Supplier, category, material, and price management with archive, restore, duplicate, and correction workflows |
| Database | 12 | 2.17% | Reproducible Supabase schema baseline, configuration, and required reference-data migration |
| Documents / Storage | 34 | 6.16% | Organization-scoped file paths, backup/restore safeguards, multi-module document collection, and archive downloads |
| Security / RBAC / Infrastructure | 46 | 8.33% | Module/action permissions, record scope, RLS and function hardening, storage readiness, runtime safeguards, and performance remediation |
| Invoice Requests | 24 | 4.35% | Invoice-request creation, review, lifecycle states, permissions, and job/invoice integration |
| Purchase Orders | 18 | 3.26% | Purchase-order revisions, duplicate handling, attachments, history, and invoice handoff controls |
| Dashboard / Reporting | 18 | 3.26% | Search, date filters, scoped metrics, executive summary, Ontario-time handling, and drill-down navigation |
| Invoices / Unbilled Jobs | 16 | 2.90% | Unbilled-job reporting, completed-job separation, invoice visibility, and exact-money handling |
| Legal / Compliance | 26 | 4.71% | Legal document publication controls, user acceptance, receipts, reporting, CSV export, and administrative review |
| Deployment / Documentation | 14 | 2.54% | Production setup guidance, onboarding documentation, source-control safeguards, and controlled release runbook |
| **TOTAL** | **552** | **100.00%** | |

## Contractor Work Register

| Ticket | Assigned | Module | Work / Deliverable | Status | Completed | Hours |
| ------ | -------- | ------ | ------------------ | ------ | --------- | ----: |
| CRM-001 | 2026-07-14 | Shared / Platform | Established the Next.js CRM application foundation, shared configuration, dependencies, layouts, and initial interface structure | Completed | 2026-07-15 | 12 |
| CRM-002 | 2026-07-15 | Authentication | Implemented organization-aware login/logout, Supabase clients, session verification, and initial password-support screens | Completed | 2026-07-15 | 12 |
| CRM-003 | 2026-07-15 | Organizations / Super Admin / Branding | Implemented super-admin access and organization provisioning/management screens and APIs | Completed | 2026-07-15 | 8 |
| CRM-004 | 2026-07-15 | Customers | Delivered customer company profiles with contacts, addresses, notes, activities, tags, logos, assignment, and record lifecycle support | Completed | 2026-07-29 | 22 |
| CRM-005 | 2026-07-16 | Quotations | Built quotation creation, scope builder, material/labour/additional-charge costing, quantities, discounts, and calculation services | Completed | 2026-07-16 | 30 |
| CRM-006 | 2026-07-16 | Quotations | Added quotation finalization, status management, supplier documentation, internal print/PDF output, and feedback-driven workflow refinements | Completed | 2026-07-17 | 22 |
| CRM-007 | 2026-07-19 | Quotations | Implemented the customer-facing quotation wizard, preview, rich content, immutable PDF generation, storage, and generated-document history | Completed | 2026-07-19 | 24 |
| CRM-008 | 2026-07-21 | Quotations | Added quotation snapshots, revision creation, pricing synchronization, revision comparison, and quantity/status consistency | Completed | 2026-07-21 | 24 |
| CRM-009 | 2026-07-27 | Jobs / Work Orders / Receivables | Implemented initial jobs-on-the-go, PO-pending, purchase-order document, invoice, outstanding-receivable, and job-status workflows | Completed | 2026-07-27 | 38 |
| CRM-010 | 2026-08-01 | Calendar / Workforce | Delivered calendar events, scheduling, availability/conflict checks, employee records, skills, and organization user-management integration | Completed | 2026-08-01 | 34 |
| CRM-011 | 2026-08-04 | Supplier Price Library | Built supplier price library dashboards and end-to-end supplier, category, material, and pricing administration | Completed | 2026-08-05 | 34 |
| CRM-012 | 2026-08-06 | Database | Established the versioned Supabase schema baseline, local configuration, and required static reference-data migration | Completed | 2026-08-06 | 12 |
| CRM-013 | 2026-08-06 | Documents / Storage | Added organization-scoped storage validation, document-route safeguards, backup tooling, and backup/restore documentation | Completed | 2026-08-06 | 14 |
| CRM-014 | 2026-08-08 | Quotations | Enforced controlled quotation status transitions and approval without unnecessary revision creation | Completed | 2026-08-10 | 10 |
| CRM-015 | 2026-08-11 | Security / RBAC / Infrastructure | Implemented module/action RBAC across routes and layouts, access-denied handling, permission APIs, and database policy tests | Completed | 2026-08-11 | 28 |
| CRM-016 | 2026-08-13 | Invoice Requests | Implemented invoice-request creation, review, status workflow, permission integration, job context, and invoice linkage | Completed | 2026-08-13 | 24 |
| CRM-017 | 2026-08-14 | Documents / Storage | Implemented authorized multi-module document collection, ZIP archive generation, download UI, error handling, and database permission coverage | Completed | 2026-08-14 | 20 |
| CRM-018 | 2026-08-17 | Jobs / Work Orders / Receivables | Delivered job completion/reopening, customer acknowledgement, work-completion PDF certificates, controlled corrections, and workflow tests | Completed | 2026-08-18 | 26 |
| CRM-019 | 2026-08-19 | Quotations | Added per-scope customer notes, quotation/work-order document types, generated-document typing, PDF updates, and effective-date HST handling | Completed | 2026-08-19 | 12 |
| CRM-020 | 2026-08-19 | Authentication | Completed password-recovery callbacks and confirmations plus personalized invitation and resend-invitation communications | Completed | 2026-09-01 | 10 |
| CRM-021 | 2026-08-25 | Purchase Orders | Implemented purchase-order revision history, duplicate handling, attachment flows, display states, and controlled movement toward invoicing | Completed | 2026-08-25 | 18 |
| CRM-022 | 2026-08-25 | Shared / Platform | Standardized display labels, required-field presentation, forms, organization logo behavior, and cross-module navigation details | Completed | 2026-09-01 | 8 |
| CRM-023 | 2026-08-26 | Dashboard / Reporting | Added global dashboard search, date-range filtering, record-scope-aware metrics, executive summary corrections, Ontario dates, and reporting drill-downs | Completed | 2026-09-10 | 18 |
| CRM-024 | 2026-08-27 | Organizations / Super Admin / Branding | Added organization-admin safeguards, versioned branding, quotation terms management, configurable commercial wording, snapshot preservation, and consistent PDF footers | Completed | 2026-09-10 | 18 |
| CRM-025 | 2026-08-27 | Invoices / Unbilled Jobs | Implemented unbilled-job reporting, invoice/job separation, completed-job views, navigation, and exact currency calculations | Completed | 2026-08-27 | 16 |
| CRM-026 | 2026-08-31 | Security / RBAC / Infrastructure | Hardened storage buckets and database functions, preserved managed extensions, restored service-role access, improved runtime error handling, and reduced auth/quotation latency | Completed | 2026-09-01 | 18 |
| CRM-027 | 2026-09-01 | Legal / Compliance | Implemented controlled legal-document publication, mandatory acceptance, acceptance persistence, receipt emails, admin reporting, CSV export, and rollout guidance | Completed | 2026-09-01 | 26 |
| CRM-028 | 2026-09-01 | Deployment / Documentation | Documented production setup, onboarding, source-control protections, staged release flow, environment safety, and operational recovery procedures | Completed | 2026-09-08 | 14 |
| **TOTAL** | | | | | | **552** |

## Period Allocation

The repository does not define the supplied periods as calendar or payroll ranges. For reconciliation, work was grouped into three chronological development waves using first/final related commits and migration dates. These chronology bands should not be substituted for official billing-period dates without separate source records.

| Period | Known Total Hours | Modules / Major Deliverables |
| ------ | ----------------: | ---------------------------- |
| Period 1 | 192 | `CRM-001`-`CRM-009`: platform foundation, authentication, organizations/super admin, customers, quotation costing/finalization/customer documents/revisions, and initial jobs/PO/receivables workflow |
| Period 2 | 176 | `CRM-010`-`CRM-017`: calendar/workforce, supplier price library, database baseline, storage safeguards, quotation status control, RBAC, invoice requests, and document exports |
| Period 3 | 184 | `CRM-018`-`CRM-028`: job completion, quotation enhancements, password/invitation flows, PO revisions, UX consistency, dashboard reporting, branding, unbilled jobs, hardening/performance, legal compliance, and release documentation |
| **TOTAL** | **552** | |

## Evidence Mapping

### CRM-001

- **Module:** Shared / Platform
- **Relevant files:** `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `components/ui/*`
- **Relevant commits:** `36f14bc`, `2d94020`, `9263e08`
- **Relevant migrations:** None identified for this platform-only deliverable
- **Relevant routes/components:** `/`, root layout, dashboard shell, shared UI components
- **Reason for estimated hours:** Foundational application setup spanning framework configuration, dependencies, shared layout, styling, and the reusable component layer required by all later modules.

### CRM-002

- **Module:** Authentication
- **Relevant files:** `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/login/page.tsx`, `lib/auth/verify-org-session.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`
- **Relevant commits:** `2d94020`, `db65ad5`
- **Relevant migrations:** Authentication-related organization/profile structures are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** `/login`, `/forgot-password`, `/auth/reset-password`, `/api/auth/login`, `/api/auth/logout`
- **Reason for estimated hours:** Cross-cutting authentication and organization-session foundation involving server routes, client flows, Supabase integration, redirects, and role-aware behavior.

### CRM-003

- **Module:** Organizations / Super Admin / Branding
- **Relevant files:** `app/api/super-admin/organizations/route.ts`, `app/api/super-admin/organizations/[id]/route.ts`, `app/super-admin/dashboard/organizations/page.tsx`, `lib/auth/verify-super-admin.ts`
- **Relevant commits:** `2d94020`
- **Relevant migrations:** Organization and super-admin tables/functions are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** `/super-admin/login`, `/super-admin/dashboard`, `/super-admin/dashboard/organizations`
- **Reason for estimated hours:** Administrative control plane for provisioning and managing tenant organizations, with separate authentication and protected APIs.

### CRM-004

- **Module:** Customers
- **Relevant files:** `app/api/org/customers/route.ts`, `app/api/org/customers/[id]/route.ts`, `app/dashboard/customers/[id]/page.tsx`, `app/dashboard/customers/[id]/edit/page.tsx`, `lib/customers/activity.ts`, `lib/customers/industries.ts`
- **Relevant commits:** `2904718`, `645645c`, `f317a0e`
- **Relevant migrations:** Customer, contact, address, note, tag, activity, and assignment structures are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** `/dashboard/customers`, `/dashboard/customers/new`, `/dashboard/customers/[id]`, customer contacts/notes/tags/logo APIs
- **Reason for estimated hours:** Broad business module with CRUD, related records, activity tracking, storage, assignment, validation, lifecycle handling, and multiple page/API flows.

### CRM-005

- **Module:** Quotations
- **Relevant files:** `app/dashboard/quotations/quotation-form.tsx`, `app/dashboard/quotations/scope-builder.tsx`, `lib/quotations/scope-calculations.ts`, `lib/quotations/api.ts`, `app/api/org/quotations/route.ts`
- **Relevant commits:** `ffa9029`, `61e1a1d`
- **Relevant migrations:** Quotation, scope, material, labour, charge, contact, and note structures are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** `/dashboard/quotations`, `/dashboard/quotations/new`, `/dashboard/quotations/[id]/edit`
- **Reason for estimated hours:** Major calculation-heavy workflow covering nested forms, scope composition, commercial costing, validation, persistence, and synchronized totals.

### CRM-006

- **Module:** Quotations
- **Relevant files:** `app/dashboard/quotations/final-sections.tsx`, `app/dashboard/quotations/quotation-document.ts`, `app/api/org/quotations/[id]/route.ts`, supplier-quote and scope-charge document routes
- **Relevant commits:** `125e28d`, `630c8f3`, `0eef273`, `9263e08`
- **Relevant migrations:** Supporting quotation status and document fields are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** quotation detail/finalization, supplier quote upload, scope-charge document download, internal print/PDF output
- **Reason for estimated hours:** Multi-stage finalization and document workflow with pricing, status behavior, uploads/downloads, print output, and iterative feedback remediation.

### CRM-007

- **Module:** Quotations
- **Relevant files:** `app/dashboard/quotations/[id]/customer-quotation/customer-quotation-wizard.tsx`, `customer-quotation-preview.tsx`, `lib/quotations/customer-quotation.ts`, `lib/quotations/customer-quotation-pdf.tsx`
- **Relevant commits:** `8a7e967`
- **Relevant migrations:** Customer-document, customer-document-item, and generated-document structures are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** `/dashboard/quotations/[id]/customer-quotation`, customer-quotation API, PDF-generation API, generated-document history/download APIs
- **Reason for estimated hours:** End-to-end customer document system involving a guided editor, immutable snapshots, rich text, PDF layout, secure storage, download history, and server-side generation.

### CRM-008

- **Module:** Quotations
- **Relevant files:** `lib/quotations/revisions.ts`, `lib/quotations/sync-customer-quotation-pricing.ts`, `app/api/org/quotations/[id]/revision/route.ts`, `app/api/org/quotations/[id]/compare/route.ts`, `app/dashboard/quotations/[id]/compare/page.tsx`
- **Relevant commits:** `5ae93f3`, `72484f0`, `8141062`
- **Relevant migrations:** Revision and snapshot structures are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** revision creation/history, comparison page/API, customer-document snapshot and pricing synchronization
- **Reason for estimated hours:** Complex historical-integrity workflow involving immutable snapshots, revision cloning, quantity and pricing reconciliation, comparison algorithms, and status constraints.

### CRM-009

- **Module:** Jobs / Work Orders / Receivables
- **Relevant files:** `lib/jobs/data.ts`, `lib/jobs/purchase-orders.ts`, `lib/invoices/data.ts`, job, purchase-order, and invoice API route groups
- **Relevant commits:** `2821268`
- **Relevant migrations:** Job, job PO, invoice, document, and status structures are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** `/dashboard/jobs`, `/dashboard/jobs/po-pending`, `/dashboard/jobs/purchase-orders`, `/dashboard/invoices`, `/dashboard/invoices/outstanding`
- **Reason for estimated hours:** Large cross-module operational workflow connecting approved quotations to jobs, purchase orders, invoice records, documents, statuses, and receivable reporting.

### CRM-010

- **Module:** Calendar / Workforce
- **Relevant files:** `lib/calendar/server.ts`, `lib/calendar/access.ts`, `lib/employees/server.ts`, `app/dashboard/calendar/calendar-client.tsx`, `app/dashboard/employees/employee-form.tsx`, `app/dashboard/user-management/user-management-client.tsx`
- **Relevant commits:** `abc98b5`
- **Relevant migrations:** Calendar, employee, skill, membership, and scheduling structures are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** `/dashboard/calendar`, `/dashboard/employees`, `/dashboard/user-management`, calendar event/conflict/availability APIs, employee skill APIs
- **Reason for estimated hours:** Full scheduling and workforce capability with interactive calendar UI, conflict logic, availability, skills, employee management, and organization access administration.

### CRM-011

- **Module:** Supplier Price Library
- **Relevant files:** `lib/supplier-price-library/server.ts`, `lib/supplier-price-library/access.ts`, supplier/category/material/price API route groups, supplier-price-library pages and forms
- **Relevant commits:** `ac7053a`, `13e8090`
- **Relevant migrations:** Supplier library tables and functions are captured in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** `/dashboard/supplier-price-library`, `/suppliers`, `/categories`, `/materials`, `/prices/new`
- **Reason for estimated hours:** Substantial CRUD and catalog module with multiple related entities, historical/corrective pricing, archive/restore, duplicate operations, dashboard metrics, and reusable forms.

### CRM-012

- **Module:** Database
- **Relevant files:** `supabase/config.toml`, `supabase/migrations/20260806054913_initial_remote_schema.sql`, `supabase/migrations/20260806060406_required_static_reference_data.sql`
- **Relevant commits:** `4979209`
- **Relevant migrations:** `20260806054913_initial_remote_schema.sql`, `20260806060406_required_static_reference_data.sql`
- **Relevant routes/components:** No direct UI route; enables all Supabase-backed modules
- **Reason for estimated hours:** Reproducibility and environment work covering a large remote-schema baseline, constraints, functions, policies, indexes, storage metadata, and required reference data.

### CRM-013

- **Module:** Documents / Storage
- **Relevant files:** `lib/supabase/storage-path.ts`, `scripts/backup-supabase-storage.sh`, `docs/supabase-storage-backup-restore.md`, `lib/jobs/documents.ts`, secured document download routes
- **Relevant commits:** `2928709`
- **Relevant migrations:** Storage objects/policies are represented in `20260806054913_initial_remote_schema.sql`
- **Relevant routes/components:** customer logos, supplier quote documents, PO/invoice documents, customer quotation generated documents
- **Reason for estimated hours:** Cross-module storage-security and recovery work involving tenant-scoped paths, protected download behavior, backup scripting, restore guidance, and updates across several document types.

### CRM-014

- **Module:** Quotations
- **Relevant files:** `lib/quotations/status-transitions.ts`, `app/api/org/quotations/[id]/status/route.ts`, `app/dashboard/quotations/[id]/page.tsx`
- **Relevant commits:** `08c5d9d`
- **Relevant migrations:** `20260808003623_enforce_quotation_status_transitions.sql`
- **Relevant routes/components:** quotation approval/status endpoint and quotation detail actions
- **Reason for estimated hours:** Business-state integrity work requiring coordinated UI, API validation, database enforcement, and correct approval/revision behavior.

### CRM-015

- **Module:** Security / RBAC / Infrastructure
- **Relevant files:** `lib/auth/permissions.ts`, `app/api/org/permissions/route.ts`, `app/dashboard/module-access-layout.tsx`, access-denied pages/components, protected organization APIs
- **Relevant commits:** `f2cd227`
- **Relevant migrations:** `20260811234545_module_action_rbac.sql`
- **Relevant routes/components:** permissions API, module layouts, access-denied flow, enforcement across customer, quotation, jobs, invoices, calendar, employees, supplier, and user-management routes
- **Reason for estimated hours:** Repository-wide security change affecting more than 100 files, with permission modeling, database functions/policies, route authorization, navigation visibility, and database tests.

### CRM-016

- **Module:** Invoice Requests
- **Relevant files:** invoice-request API routes, `app/dashboard/invoice-requests/invoice-requests-client.tsx`, `new-invoice-request-form.tsx`, invoice/job data helpers
- **Relevant commits:** `f809101`, `0750466`
- **Relevant migrations:** `20260813090000_invoice_request_workflow.sql`
- **Relevant routes/components:** `/dashboard/invoice-requests`, `/dashboard/invoice-requests/new`, `/dashboard/invoice-requests/[requestId]`
- **Reason for estimated hours:** End-to-end approval-oriented workflow with new schema, state transitions, forms, lists, detail review, permissions, and integration into job/invoice dashboards.

### CRM-017

- **Module:** Documents / Storage
- **Relevant files:** `lib/document-exports/collector.ts`, `archive.ts`, `format.ts`, `app/api/org/document-exports/download/route.ts`, `app/dashboard/download-documents-dialog.tsx`
- **Relevant commits:** `a068079`, `421bbc1`
- **Relevant migrations:** `20260814062251_add_document_export_permissions.sql`
- **Relevant routes/components:** dashboard document-download dialog and `/api/org/document-exports/download`
- **Reason for estimated hours:** Multi-source export subsystem requiring authorization, document discovery, ZIP creation, naming, error handling, UI progress, corrective fixes, and automated coverage.

### CRM-018

- **Module:** Jobs / Work Orders / Receivables
- **Relevant files:** `lib/jobs/work-completion.ts`, `lib/jobs/work-completion-pdf.tsx`, job completion/reopen/certificate APIs, `app/dashboard/jobs/job-completion-dialog.tsx`
- **Relevant commits:** `3480a19`
- **Relevant migrations:** `20260817225428_job_completion_workflow.sql`, `20260817233826_add_work_completion_corrections.sql`
- **Relevant routes/components:** job complete/reopen endpoints, completed jobs page, work-completion certificate download and correction endpoints
- **Reason for estimated hours:** Controlled operational closure flow with acknowledgement capture, immutable certificate PDFs, correction history, reopening rules, job-status integration, and database workflow tests.

### CRM-019

- **Module:** Quotations
- **Relevant files:** `lib/quotations/customer-document-type.ts`, `lib/quotations/customer-quotation.ts`, `lib/quotations/customer-quotation-pdf.tsx`, customer quotation wizard/preview, `lib/quotations/api.ts`
- **Relevant commits:** `57c6fa0`, `76103f3`, `930b802`
- **Relevant migrations:** `20260819000409_add_scope_notes_to_customer_quotation_items.sql`, `20260819231428_add_customer_document_type.sql`, `20260820000339_add_generated_customer_document_type.sql`, `20260820010211_set_ontario_hst_effective_date.sql`
- **Relevant routes/components:** customer quotation editor/PDF, quotation API tax resolution, generated-document history
- **Reason for estimated hours:** Coordinated quotation improvements across schema, editor, PDF, types, pricing/tax behavior, and tests, narrower than the original end-to-end quotation build.

### CRM-020

- **Module:** Authentication
- **Relevant files:** `lib/auth/password-recovery-confirmation.ts`, `lib/auth/invitation-email.ts`, auth confirmation/reset pages, Supabase recovery/invite templates, user-management invitation APIs
- **Relevant commits:** `6c0f637`, `c9be2b4`, `8175b8b`
- **Relevant migrations:** No dedicated schema migration identified
- **Relevant routes/components:** `/forgot-password`, `/auth/confirm`, `/auth/reset-password`, invitation and resend-invitation APIs
- **Reason for estimated hours:** Security-sensitive email callback and account-onboarding work involving token confirmation, redirect handling, templates, personalized messages, resend behavior, and tests.

### CRM-021

- **Module:** Purchase Orders
- **Relevant files:** `lib/jobs/purchase-orders.ts`, PO revision API, PO attach/combine pages, duplicate dialog, purchase-order revision form/page
- **Relevant commits:** `482482d`
- **Relevant migrations:** `20260825205354_add_purchase_order_revisions.sql`
- **Relevant routes/components:** `/dashboard/jobs/po-pending`, PO attachment/combination, `/dashboard/jobs/purchase-orders/[poId]/revisions/new`
- **Reason for estimated hours:** Business-history workflow requiring immutable PO revisions, file continuity, duplicate detection/handling, UI state, validation, and database tests.

### CRM-022

- **Module:** Shared / Platform
- **Relevant files:** `components/ui/label.tsx`, cross-module forms, `app/dashboard/organization-logo.tsx`, navigation/detail pages across customers, jobs, invoices, quotations, and suppliers
- **Relevant commits:** `d3b40ee`, `a55f7fd`, `975ffac`
- **Relevant migrations:** None identified
- **Relevant routes/components:** organization logo, display-label mappings, required markers, back-navigation, dropdown/form consistency across dashboard modules
- **Reason for estimated hours:** Broad but shallow usability pass across many modules; lower hours than a new workflow because it standardized existing behavior rather than introducing a major subsystem.

### CRM-023

- **Module:** Dashboard / Reporting
- **Relevant files:** `lib/dashboard/data.ts`, `lib/dashboard/date-range.ts`, `lib/dashboard/config.ts`, `app/dashboard/page.tsx`, `dashboard-search.tsx`, `dashboard-date-filter.tsx`
- **Relevant commits:** `ebeb6ea`, `96eaf91`
- **Relevant migrations:** `20260826232401_add_record_scope_permissions.sql`
- **Relevant routes/components:** `/dashboard`, `/api/org/dashboard-search`, executive summary cards, date filter, quick actions, reporting drill-downs
- **Reason for estimated hours:** Aggregated reporting and search feature involving role/record scope, multiple data sources, date boundary logic, Ontario timezone behavior, corrected business definitions, UI simplification, and unit tests.

### CRM-024

- **Module:** Organizations / Super Admin / Branding
- **Relevant files:** `app/api/org/quotation-branding/route.ts`, `app/dashboard/user-management/company-branding-settings.tsx`, `lib/organizations/branding.ts`, `lib/quotations/commercial-copy.ts`, customer quotation PDF/data files
- **Relevant commits:** `825e46b`, `4a202d3`, `5a9b017`, `6da6f62`
- **Relevant migrations:** `20260827014347_protect_last_active_admin.sql`, `20260827033351_add_versioned_quotation_branding.sql`, `20260910025957_add_quotation_commercial_copy_settings.sql`
- **Relevant routes/components:** `/dashboard/user-management`, quotation branding API, customer quotation wizard/preview/PDF
- **Reason for estimated hours:** Organization-level governance and document-branding work with append-only versions, effective dating, admin protection, logo/terms inheritance, immutable quotation snapshots, configurable commercial text, migration backfills, and PDF layout verification.

### CRM-025

- **Module:** Invoices / Unbilled Jobs
- **Relevant files:** `lib/invoices/unbilled-jobs.ts`, `lib/invoices/exact-money.ts`, unbilled invoice API, unbilled/completed jobs pages, invoice/job navigation and status tabs
- **Relevant commits:** `da393be`
- **Relevant migrations:** `20260827234256_add_unbilled_jobs_reporting.sql`
- **Relevant routes/components:** `/dashboard/invoices/unbilled-jobs`, `/dashboard/jobs/completed`, `/api/org/job-invoices/unbilled`
- **Reason for estimated hours:** Reporting workflow with business-status definitions, database function, invoice/job separation, exact currency normalization, navigation updates, and automated tests.

### CRM-026

- **Module:** Security / RBAC / Infrastructure
- **Relevant files:** `lib/auth/session-cookies.ts`, `lib/jobs/runtime-errors.ts`, auth/quotation loading paths, storage backup script/docs, Supabase configuration and security tests
- **Relevant commits:** `c13e8a2`, `a653325`, `4a202d3`, `ac0881c`
- **Relevant migrations:** `20260831025812_ensure_all_storage_buckets.sql`, `20260831031820_harden_database_function_security.sql`, `20260901015112_restore_service_role_private_schema_usage.sql`
- **Relevant routes/components:** session-expired route, dashboard/quotation loading states, hardened job/quotation APIs
- **Reason for estimated hours:** Production-readiness work spanning database function security, storage completeness, managed-extension preservation, service-role repair, runtime safety, session handling, and performance optimization.

### CRM-027

- **Module:** Legal / Compliance
- **Relevant files:** `lib/legal/*`, `components/legal/legal-document-view.tsx`, legal acceptance/report APIs and pages, `middleware.ts`, `docs/legal-privacy-pilot-rollout.md`
- **Relevant commits:** `75bc5e9`, `1264de9`, `c895ef9`
- **Relevant migrations:** `20260901072042_add_legal_acceptances.sql`
- **Relevant routes/components:** `/legal/[slug]`, `/legal/acceptance`, `/security`, legal acceptance API, super-admin legal acceptance reporting
- **Reason for estimated hours:** Compliance subsystem involving document content/configuration, publication gates, mandatory consent, persistence and RLS, receipt email generation, reporting/CSV export, administrative UI, rollout documentation, and tests.

### CRM-028

- **Module:** Deployment / Documentation
- **Relevant files:** `docs/production-setup-and-protech-onboarding.md`, `docs/source-control-and-production-release-safety.md`, `AGENTS.md`, production runbook generation script
- **Relevant commits:** `fa75587`, `952a003`
- **Relevant migrations:** None identified
- **Relevant routes/components:** Operational process rather than an application route; covers GitHub, Vercel, Supabase, environment configuration, staged promotion, rollback, and access-control procedures
- **Reason for estimated hours:** Detailed operational and security documentation requiring repository-specific environment mapping, controlled release design, incident safeguards, onboarding guidance, and maintainable enforcement instructions.

## Hours Allocation Method

- The **552 hours** are an externally supplied known total.
- Individual module and ticket hours are retrospective allocations, not reconstructed daily clock entries.
- Allocation is based on repository evidence, business scope, relative technical complexity, number and significance of affected layers, database migrations, frontend/backend integration, security implications, testing, and dependency relationships.
- Git activity is evidence of work performed and chronology, but it is not treated as a time clock. Commit size alone was not converted directly into hours.
- Large end-to-end workflows received more hours than focused corrections or usability refinements.
- Related technical changes were combined into business-level deliverables to avoid duplicate or artificially granular entries.
- Database and testing work required by a feature was allocated with that feature unless it represented standalone platform/reproducibility work.
- These estimated allocations should not be interpreted as contemporaneously recorded time records.

## Validation

1. Ticket hours were summed: **552 hours**.
2. Module hours were independently summed: **552 hours**.
3. Period 1 was reconciled to **192 hours**.
4. Period 2 was reconciled to **176 hours**.
5. Period 3 was reconciled to **184 hours**.
6. Period arithmetic was checked: **192 + 176 + 184 = 552**.
7. Cross-module work was assigned once to its principal business deliverable to avoid duplication.
8. Small fixes were consolidated into meaningful feature-level tickets.
9. Every ticket maps to repository files and commits; migrations are listed where applicable.
10. No work item was added solely to consume hours.

**TOTAL CONTRACTOR HOURS: 552**

**Period reconciliation:** 192 + 176 + 184 = 552

**Module reconciliation:** 552 = 552

**Ticket reconciliation:** 552 = 552
