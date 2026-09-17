# Avyukta CRM pilot legal and privacy rollout

Status: implementation draft for review. Do not deploy until every production blocker below is resolved.

## Verified application facts

- Avyukta CRM is a Next.js App Router application hosted on Vercel.
- Supabase provides PostgreSQL, Auth and private Storage.
- The production Supabase project `lnybnkbetjjluhpspvjy` is configured in `us-west-2` (United States), verified with the Supabase CLI on 2026-09-01. Canada-only data residency must not be claimed.
- Resend is used as the custom SMTP provider for transactional authentication email.
- The application uses organization-scoped memberships in `public.org_members`, with `org_id`, role, status and record/permission checks.
- Avyukta Technologies Inc. owns the CRM software. The Client owns its Client Data.
- The audited source and deployed login HTML contain no Vercel Web Analytics, Speed Insights, Google Analytics, Meta Pixel, Sentry, Hotjar, session replay or equivalent optional tracking script.
- Vercel, Supabase and Resend still process operational metadata and logs as service providers. Their exact production retention periods must be approved below.

## Canadian privacy framework

The pilot privacy program is designed around PIPEDA's ten fair-information principles: accountability, identifying purposes, consent, limiting collection, limiting use/disclosure/retention, accuracy, safeguards, openness, individual access and challenging compliance.

ProTech operates in Ontario. Ontario does not have a general private-sector privacy law deemed substantially similar to PIPEDA. Ontario's Personal Health Information Protection Act (PHIPA) is substantially similar for health information custodians, but Avyukta CRM expressly prohibits health information during this commercial pilot. PIPEDA is therefore the primary framework used for this implementation. Applicability still depends on the organizations, information and activities involved and should be confirmed by Canadian privacy counsel.

Authoritative references:

- https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/
- https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/prov-pipeda/
- https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/

This implementation does not claim that Avyukta is PIPEDA-certified, SOC 2 certified, ISO 27001 certified, HIPAA compliant or PCI certified.

## CRM data inventory

The schema and application handle:

- Account identity: name, business email, status, organization membership, role and permission overrides.
- Business contacts: customer/supplier names, job title, department, business email, mobile/office telephone, extension and business addresses.
- Customer operations: company profiles, industry, credit terms/limits, notes, tags, activities and assigned users.
- Commercial and job records: quotations, RFQs, scope, materials, labour, pricing, margin, tax, work orders, jobs, purchase orders, supplier pricing, invoices and payment status.
- Employee and scheduling records: directory details, skills, availability, calendar events and work-completion technicians.
- Uploaded documents: logos, quotation/RFQ files, supplier quotations, purchase orders, invoices, invoice-request documents and work-completion documents.
- Audit/history: quotation revisions, status histories, correction history, creator/updater IDs, timestamps, authentication events and operational request logs.
- Versioned legal acceptance: user ID, organization ID, document key/version/hash, agreed/acknowledged action, server-generated time and server-assigned source.

The CRM is not intended for payment-card data, social insurance numbers, health information, biometric information, children's information, government identity documents or other highly sensitive information. That restriction appears in the Privacy Notice, User Terms and Acceptable Use Policy.

## Cookie and browser-storage inventory

| Name/pattern | Purpose | Behavior |
| --- | --- | --- |
| `sb-<project-ref>-auth-token` and chunked variants | Supabase authenticated session and refresh | Essential; SameSite=Lax; path `/`; managed by `@supabase/ssr`; JavaScript-accessible because the browser Supabase client must refresh the cookie |
| `sb-<project-ref>-auth-token-code-verifier` or chunked variant | Temporary PKCE verifier during invitation/recovery/auth flows | Essential and temporary; managed by `@supabase/ssr` |
| `org_context` | Selected organization ID/context | Essential; HTTP-only; Secure in production; SameSite=Lax; path `/`; session cookie; server revalidates membership |
| `sa_context` | Separate super-admin context | Essential; HTTP-only; Secure in production; SameSite=Lax; path `/`; session cookie; server revalidates super-admin status |

The audited application creates no localStorage or sessionStorage values. Because there are no optional analytics/advertising/replay cookies, an “Accept All” banner is not implemented. If optional telemetry is added later, it must remain disabled until the Cookie Notice and consent behavior are reassessed.

## First-login acceptance security model

Migration: `supabase/migrations/20260901072042_add_legal_acceptances.sql`

- `public.legal_acceptances` is append-only for browser roles.
- `anon` has no privileges.
- `authenticated` has SELECT only and RLS still limits rows.
- A user can read their own rows.
- An active organization admin can read acceptance status only inside their organization.
- The existing secure super-admin helper permits super-admin reads.
- Browser roles cannot insert, update or delete acceptance evidence.
- The server validates the authenticated Supabase user and active organization membership, derives the user and organization IDs, supplies the current document version/hash/action and uses one atomic bulk upsert through the server-only service client.
- `accepted_at` and `created_at` use database defaults. The browser cannot submit them.
- No IP address, user-agent or device fingerprint is collected.
- A changed version or content hash fails the gate. Content changes require a document version increase.
- Membership and user deletion are restricted when retained acceptance evidence exists.

Supabase RLS reference: https://supabase.com/docs/guides/database/postgres/row-level-security

## Required Vercel environment configuration

Add these as server-only values for Preview and Production. Do not use the `NEXT_PUBLIC_` prefix.

```text
LEGAL_PRIVACY_CONTACT_EMAIL
LEGAL_SECURITY_CONTACT_EMAIL
LEGAL_EFFECTIVE_DATE
LEGAL_CLIENT_DATA_RETENTION
LEGAL_BACKUP_RETENTION
LEGAL_LOG_RETENTION
LEGAL_RESEND_RETENTION
LEGAL_SUPABASE_REGION
LEGAL_DOCUMENTS_APPROVED
RESEND_API_KEY
LEGAL_ACCEPTANCE_EMAIL_FROM
```

Production must use the verified value for `LEGAL_SUPABASE_REGION`, for example a clear approved statement identifying `us-west-2` as a United States region. Preview should identify the Development project's `us-east-2` region if the Preview deployment remains connected to crm-dev.

Set `LEGAL_DOCUMENTS_APPROVED=true` only after the Client and qualified Canadian privacy/legal counsel approve version 1.0 and its effective date. The build script fails on Vercel Production while any required value is empty or approval is not exactly `true`.

## Database and release order

1. Obtain written approval for the legal content, contacts, retention statements and effective date.
2. Configure all legal environment values in Vercel Preview.
3. Reset and test the local Supabase database from migrations.
4. Apply `20260901072042_add_legal_acceptances.sql` to crm-dev only.
5. Deploy the develop branch to Preview and test legal pages while logged out.
6. Test invitation, login, logout, recovery and password reset.
7. Confirm a user without acceptance is redirected to `/legal/acceptance` and organization APIs reject access.
8. Confirm one checkbox atomically records all three required documents and returns to the requested dashboard route.
9. Confirm user/self, same-organization admin and cross-organization negative RLS behavior.
10. Increase a document version in a test branch and confirm the user is prompted again.
11. Review the final content with ProTech and counsel; set Production values and approval.
12. Back up Production, push the migration before deploying application code, then run the production smoke test.

Never deploy the application gate before the migration. The gated session verifier expects `public.legal_acceptances` to exist.

## Manual production blockers

- Confirm the Privacy Officer email address.
- Confirm the security-reporting email address and who monitors it.
- Approve the effective date and version 1.0 wording.
- Approve the Client Data deletion/retention statement.
- Confirm Supabase managed-backup and separately encrypted-backup retention.
- Confirm Vercel, Supabase Auth/database and application log retention.
- Confirm Resend message/event retention for the current account and plan.
- Review Vercel project settings to ensure Web Analytics and Speed Insights remain disabled for the pilot; the current code and live login HTML contain no scripts, but the dashboard setting should be recorded as evidence.
- Confirm incident-response contacts, breach escalation and PIPEDA breach-record/reporting responsibilities.
- Confirm the service agreement/data-processing terms between Avyukta and ProTech, including cross-border processing and pilot exit/deletion.
- Obtain legal review. The repository implementation is technical/privacy-by-design work, not legal advice.
