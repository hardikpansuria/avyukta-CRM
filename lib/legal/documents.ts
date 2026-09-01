import { createHash } from "node:crypto";

import {
  getLegalSiteConfiguration,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_LAST_UPDATED,
} from "./config";

export type LegalActionType = "agreed" | "acknowledged";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  key: string;
  slug: string;
  path: string;
  title: string;
  description: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: LegalSection[];
  required: boolean;
  actionType?: LegalActionType;
  contentHash: string;
};

type DocumentDefinition = Omit<LegalDocument, "contentHash">;

function hashDocument(document: DocumentDefinition) {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function finalize(document: DocumentDefinition): LegalDocument {
  return { ...document, contentHash: hashDocument(document) };
}

export function getLegalDocuments(): LegalDocument[] {
  const config = getLegalSiteConfiguration();
  const common = {
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: config.effectiveDate,
    lastUpdated: LEGAL_LAST_UPDATED,
  };

  const documents: DocumentDefinition[] = [
    {
      ...common,
      key: "crm_privacy_notice",
      slug: "privacy",
      path: "/legal/privacy",
      title: "CRM Privacy Notice",
      description:
        "How personal information and Client Data are handled in Avyukta CRM.",
      required: true,
      actionType: "acknowledged",
      sections: [
        {
          id: "scope-and-roles",
          title: "1. Scope and roles",
          paragraphs: [
            "This notice applies to authorized users of Avyukta CRM. Avyukta Technologies Inc. provides and operates the CRM software. The organization that authorized your account is the Client and owns its Client Data.",
            "The allocation of privacy responsibilities between Avyukta and the Client depends on the circumstances and any written service agreement. The Client determines what business records its users enter into the CRM; Avyukta uses Client Data to operate, secure, maintain and support the service.",
          ],
        },
        {
          id: "information",
          title: "2. Information handled by the CRM",
          paragraphs: [
            "The CRM handles personal information and confidential business information needed for customer, sales, job and billing workflows.",
          ],
          bullets: [
            "Account information: name, business email, account status, organization membership, role and permissions.",
            "Business contact information: customer and supplier names, job titles, departments, business email addresses, telephone numbers, extensions and business addresses.",
            "CRM records: customer profiles, notes, tags, activities, quotations, RFQ details, work orders, job scopes, schedules and completion records.",
            "Commercial records: supplier pricing, purchase orders, invoices, payment-status information, taxes, credit terms and related calculations.",
            "Uploaded content: organization and customer logos, quotation materials, supplier quotations, purchase-order files, invoice files and work-completion documents.",
            "Audit and security information: record revisions, status histories, creator/updater identifiers, timestamps, authentication events, request logs and essential session-cookie data.",
          ],
        },
        {
          id: "restricted-data",
          title: "3. Data that must not be entered",
          paragraphs: [
            "Avyukta CRM is not intended for payment-card numbers, social insurance numbers, health or medical information, biometric information, information about children, government identity documents, account passwords placed in free-text fields, or other highly sensitive personal information. Users must not upload or enter those categories.",
          ],
        },
        {
          id: "purposes",
          title: "4. Purposes",
          bullets: [
            "Authenticate users and enforce organization, role and record access.",
            "Provide customer, quotation, job, document, employee, calendar and invoice workflows requested by the Client.",
            "Maintain records, generate business documents and support authorized exports.",
            "Protect the service, investigate errors or misuse, maintain auditability and recover from incidents.",
            "Provide support, respond to privacy requests and meet legal or contractual obligations.",
          ],
        },
        {
          id: "legal-framework",
          title: "5. Canadian privacy framework",
          paragraphs: [
            "The privacy program for this commercial pilot is designed around the fair-information principles in Canada's Personal Information Protection and Electronic Documents Act (PIPEDA): accountability, identifying purposes, consent, limiting collection, limiting use/disclosure/retention, accuracy, safeguards, openness, access and challenging compliance.",
            "This statement describes the framework used for the pilot; it is not a certification and does not replace case-specific legal advice. Other laws may apply depending on the Client, the individuals and where information is handled.",
          ],
        },
        {
          id: "sharing",
          title: "6. Service providers and disclosure",
          paragraphs: [
            "Avyukta does not sell Client Data and does not use Client Data for third-party advertising. Client Data is disclosed to service providers only as needed to host, authenticate, store, transmit, secure and support the CRM, or when required by law. Current providers are listed in the Subprocessors Notice.",
          ],
        },
        {
          id: "cross-border",
          title: "7. Cross-border processing",
          paragraphs: [
            `Canada-only data residency is not promised. The configured production Supabase region must be disclosed as: ${config.supabaseRegion}. Vercel, Supabase, Resend and their providers may process service data in other jurisdictions. Information processed outside Canada may be subject to the laws and lawful-access regimes of those jurisdictions.`,
          ],
        },
        {
          id: "retention",
          title: "8. Retention and deletion",
          bullets: [
            `Client Data: ${config.clientDataRetention}`,
            `Database and Storage backups: ${config.backupRetention}`,
            `Application, authentication and security logs: ${config.logRetention}`,
            `Transactional email data handled through Resend: ${config.resendRetention}`,
            "Versioned legal-acceptance records are retained as evidence of the agreement or acknowledgment and cannot be edited by users.",
          ],
        },
        {
          id: "safeguards",
          title: "9. Safeguards",
          paragraphs: [
            "The CRM uses organization-scoped authorization, database row-level security, private Storage access, server-side secret handling, password authentication managed by Supabase Auth, audit/history records and HTTPS delivery. No safeguard eliminates all risk. Security controls and incident reporting are described on the Security page.",
          ],
        },
        {
          id: "choices-and-rights",
          title: "10. Access, correction and questions",
          paragraphs: [
            "Users should first contact their Client administrator to access or correct CRM business records. Individuals may also ask questions, challenge compliance or request access/correction by contacting the Privacy Officer. Requests may require identity and authority verification and may be subject to legal or contractual limits.",
          ],
        },
        {
          id: "contact",
          title: "11. Contact the Privacy Officer",
          paragraphs: [
            `Privacy inquiries: ${config.privacyContactEmail}`,
          ],
        },
        {
          id: "changes",
          title: "12. Changes to this notice",
          paragraphs: [
            "Material changes will receive a new version. Authorized users will be asked to acknowledge the new version before continuing to protected CRM areas.",
          ],
        },
      ],
    },
    {
      ...common,
      key: "authorized_user_terms",
      slug: "terms",
      path: "/legal/terms",
      title: "Authorized User Terms",
      description: "Terms for individual users authorized by a Client organization.",
      required: true,
      actionType: "agreed",
      sections: [
        {
          id: "scope",
          title: "1. Scope",
          paragraphs: [
            "These terms apply to each person who uses Avyukta CRM through an account authorized by a Client organization. By signing in and completing the first-login agreement, you confirm that you are authorized to use the account and agree to these terms and the Acceptable Use Policy.",
            "If a separate written agreement between Avyukta and the Client conflicts with these user terms, that written agreement controls to the extent of the conflict.",
          ],
        },
        {
          id: "accounts",
          title: "2. Account responsibility",
          bullets: [
            "Use only your own account and organization code.",
            "Keep credentials confidential and use a strong, unique password.",
            "Do not share sessions or attempt to assume another user's identity or permissions.",
            "Notify the Client administrator promptly about suspected unauthorized access, disclosure or account compromise.",
          ],
        },
        {
          id: "authorized-use",
          title: "3. Authorized business use",
          paragraphs: [
            "Use the CRM only for the Client's legitimate business purposes, within your assigned role and permissions, and in accordance with applicable law, Client policy and the Acceptable Use Policy.",
          ],
        },
        {
          id: "data",
          title: "4. Client Data",
          paragraphs: [
            "The Client owns its Client Data. You are responsible for the accuracy, legality and authority of information you enter or upload. Do not enter prohibited highly sensitive data or information you are not authorized to handle.",
          ],
        },
        {
          id: "confidentiality",
          title: "5. Confidentiality",
          paragraphs: [
            "Treat Client Data, credentials, documents, pricing and other non-public records as confidential. Download, export, print or disclose them only when authorized for Client business.",
          ],
        },
        {
          id: "pilot",
          title: "6. Pilot operation",
          paragraphs: [
            "The CRM is being evaluated during a limited pilot. Features may be corrected or changed, and the Client should maintain appropriate operational review and backup practices. Do not rely on the CRM as the sole repository for records that must be preserved independently by law or contract unless the Client has expressly approved that use.",
          ],
        },
        {
          id: "suspension",
          title: "7. Suspension and termination",
          paragraphs: [
            "Avyukta or the Client may restrict or suspend access when reasonably necessary to protect accounts, Client Data, the service or other users; to investigate misuse; or when authorization ends. Your obligations concerning confidentiality and prior misuse continue after access ends.",
          ],
        },
        {
          id: "software",
          title: "8. Software ownership",
          paragraphs: [
            "Avyukta Technologies Inc. owns the CRM software and related intellectual property, except for Client Data and third-party open-source components. Access is limited, revocable and non-transferable; no ownership in the software is granted to an authorized user.",
          ],
        },
        {
          id: "contact",
          title: "9. Questions",
          paragraphs: [
            `Privacy questions: ${config.privacyContactEmail}`,
            `Security reports: ${config.securityContactEmail}`,
          ],
        },
      ],
    },
    {
      ...common,
      key: "acceptable_use_policy",
      slug: "acceptable-use",
      path: "/legal/acceptable-use",
      title: "Acceptable Use Policy",
      description: "Rules that protect Client Data, users and the CRM service.",
      required: true,
      actionType: "agreed",
      sections: [
        {
          id: "permitted-use",
          title: "1. Permitted use",
          paragraphs: [
            "Use the CRM only for authorized Client business, within your assigned organization, role, permissions and record scope.",
          ],
        },
        {
          id: "prohibited-conduct",
          title: "2. Prohibited conduct",
          bullets: [
            "Accessing or attempting to access another organization, user account or record without authorization.",
            "Circumventing role permissions, row-level security, rate limits, authentication, audit controls or other safeguards.",
            "Introducing malware, automated abuse, denial-of-service traffic or code intended to disrupt or probe the service.",
            "Using exported data, documents or contact information for an unauthorized purpose, advertising or resale.",
            "Uploading unlawful, infringing, deceptive or malicious content.",
            "Reverse engineering or copying the service except where a non-waivable law expressly permits it.",
          ],
        },
        {
          id: "prohibited-data",
          title: "3. Prohibited data",
          paragraphs: [
            "Do not enter payment-card numbers, social insurance numbers, health information, biometric information, children's information, government identity documents, passwords in free-text fields or other highly sensitive personal information. If such data is entered accidentally, stop using or sharing the affected record and notify the Client administrator and Avyukta promptly.",
          ],
        },
        {
          id: "reporting",
          title: "4. Reporting concerns",
          paragraphs: [
            `Report suspected security vulnerabilities, misuse or data exposure to ${config.securityContactEmail}. Do not publicly disclose a vulnerability before Avyukta has had a reasonable opportunity to investigate and address it.`,
          ],
        },
        {
          id: "enforcement",
          title: "5. Enforcement",
          paragraphs: [
            "Access may be limited or suspended while suspected misuse is investigated or when necessary to protect the service and Client Data. Serious misuse may be reported to the Client and, where required, to appropriate authorities.",
          ],
        },
      ],
    },
    {
      ...common,
      key: "cookie_notice",
      slug: "cookies",
      path: "/legal/cookies",
      title: "Cookie Notice",
      description: "Essential cookies used for authentication and session security.",
      required: false,
      sections: [
        {
          id: "essential-only",
          title: "1. Essential cookies only",
          paragraphs: [
            "The audited CRM application uses cookies that are necessary to authenticate users, maintain secure sessions and keep the selected organization or super-administrator context. It does not currently load optional analytics, advertising or session-replay scripts, so an “Accept All” banner is not used.",
          ],
        },
        {
          id: "cookies",
          title: "2. Cookies used",
          bullets: [
            "Supabase authentication cookies (`sb-<project-ref>-auth-token` and chunked variants) store and refresh the signed-in session. A temporary PKCE code-verifier cookie may be used during authentication and password-recovery flows.",
            "`org_context` is an HTTP-only, SameSite=Lax session cookie that identifies the organization selected at login. The server revalidates the user and active membership; the cookie is not trusted by itself.",
            "`sa_context` is an HTTP-only, SameSite=Lax session cookie used only for the separate super-administrator area. The server revalidates super-administrator status.",
          ],
        },
        {
          id: "storage",
          title: "3. Browser storage",
          paragraphs: [
            "The audited application code does not create localStorage or sessionStorage values. Supabase SSR is configured to keep the authentication session in cookies.",
          ],
        },
        {
          id: "choices",
          title: "4. Your choices",
          paragraphs: [
            "Browsers can block or delete cookies, but disabling these essential cookies prevents secure login or causes the session and selected organization context to be lost. If optional tracking is added later, this notice and the consent behavior must be reviewed before it is enabled.",
          ],
        },
      ],
    },
    {
      ...common,
      key: "subprocessors_notice",
      slug: "subprocessors",
      path: "/legal/subprocessors",
      title: "Subprocessors Notice",
      description: "Third parties used to operate the CRM pilot.",
      required: false,
      sections: [
        {
          id: "providers",
          title: "1. Current service providers",
          bullets: [
            "Vercel — hosts and delivers the Next.js application and processes request/runtime logs needed to operate and secure it. Website: vercel.com.",
            `Supabase — provides PostgreSQL, authentication and private file Storage. The production project is configured as: ${config.supabaseRegion}. Website: supabase.com.`,
            "Resend — sends transactional authentication email such as invitations and password-recovery messages. Website: resend.com.",
          ],
        },
        {
          id: "data",
          title: "2. Data involved",
          paragraphs: [
            "A provider receives only the categories needed for its function. Hosting and database providers may process Client Data and technical logs. The email provider processes recipient address, message content and email-delivery metadata for transactional messages.",
          ],
        },
        {
          id: "locations-retention",
          title: "3. Location and retention",
          bullets: [
            `Supabase project region: ${config.supabaseRegion}`,
            `Application/authentication/security log retention: ${config.logRetention}`,
            `Resend transactional email retention: ${config.resendRetention}`,
            "The providers may use additional infrastructure providers and may process information outside Canada. No Canada-only residency representation is made.",
          ],
        },
        {
          id: "changes",
          title: "4. Changes",
          paragraphs: [
            "Avyukta will update this notice before adding a provider that materially changes how Client Data is processed. Contractual notice obligations, if any, are governed by the applicable written agreement with the Client.",
          ],
        },
      ],
    },
    {
      ...common,
      key: "open_source_notices",
      slug: "open-source",
      path: "/legal/open-source",
      title: "Open-Source Notices",
      description: "Principal open-source software used by the CRM application.",
      required: false,
      sections: [
        {
          id: "notice",
          title: "1. Notice",
          paragraphs: [
            "Avyukta CRM includes open-source software. Copyright and license rights remain with their respective owners. The repository lockfile is the authoritative version inventory for a particular build.",
          ],
        },
        {
          id: "components",
          title: "2. Principal runtime components",
          bullets: [
            "Next.js 15.5.24, React 19.2.7 and React DOM 19.2.7 — MIT License.",
            "Supabase JS and Supabase SSR — MIT License.",
            "Base UI, FullCalendar, React PDF, Tiptap, Archiver, clsx, htmlparser2, jsPDF, jsPDF-AutoTable, sanitize-html, shadcn, tailwind-merge and tw-animate-css — MIT License.",
            "class-variance-authority — Apache License 2.0.",
            "Lucide React — ISC License.",
          ],
        },
        {
          id: "copies",
          title: "3. License copies",
          paragraphs: [
            "Complete license texts and notices are distributed with the installed packages and their upstream source repositories. Contact Avyukta for a build-specific dependency inventory or a copy of an applicable license notice.",
          ],
        },
      ],
    },
    {
      ...common,
      key: "security_overview",
      slug: "security",
      path: "/security",
      title: "Security Overview",
      description: "Verified safeguards and responsible reporting for Avyukta CRM.",
      required: false,
      sections: [
        {
          id: "approach",
          title: "1. Security approach",
          paragraphs: [
            "Avyukta uses layered application and database controls appropriate to the CRM pilot. This overview describes controls verified in the codebase; it does not claim a security certification or guarantee that every incident can be prevented.",
          ],
        },
        {
          id: "controls",
          title: "2. Verified controls",
          bullets: [
            "Supabase Auth manages passwords and signed sessions; the CRM application does not store raw passwords.",
            "Organization membership, active status, role permissions and record scope are revalidated server-side.",
            "Tenant-aware database row-level security and server authorization checks restrict organization data.",
            "Uploaded CRM files use private Storage buckets and server-authorized signed downloads.",
            "Service-role and secret keys remain server-side and are not exposed through NEXT_PUBLIC variables.",
            "HTTPS, secure production context cookies, SameSite cookie controls and server-side session validation protect browser sessions.",
            "Revision, status-history and audit records support investigation of important business changes.",
            "Backups and restore procedures exist, but their approved production retention schedule is documented separately in the Privacy Notice.",
          ],
        },
        {
          id: "customer-responsibilities",
          title: "3. Client and user responsibilities",
          bullets: [
            "Use strong, unique passwords and do not share accounts.",
            "Assign the least permissions needed and promptly deactivate access that is no longer required.",
            "Do not enter prohibited highly sensitive data.",
            "Review exported files and recipient addresses before sharing documents outside the CRM.",
            "Report suspected compromise, unauthorized disclosure or unexpected cross-organization access promptly.",
          ],
        },
        {
          id: "reporting",
          title: "4. Report a security concern",
          paragraphs: [
            `Send security reports to ${config.securityContactEmail}. Include the affected page or feature, time observed and steps to reproduce, but do not include passwords or unnecessary Client Data.`,
          ],
        },
      ],
    },
  ];

  return documents.map(finalize);
}

export function getLegalDocumentBySlug(slug: string) {
  return getLegalDocuments().find((document) => document.slug === slug) ?? null;
}

export function getRequiredLegalDocuments() {
  return getLegalDocuments().filter(
    (document): document is LegalDocument & { actionType: LegalActionType } =>
      document.required && document.actionType !== undefined,
  );
}
