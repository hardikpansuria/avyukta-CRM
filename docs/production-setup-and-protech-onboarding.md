# Avyukta CRM Production Setup and Protech Onboarding Runbook

Last verified: 2026-08-31

This runbook records the production architecture, safe configuration process, Protech onboarding steps, and final release checks. It intentionally contains no usable secret values.

## 1. Environment map

| Environment | Git branch | Vercel environment | Supabase project | Site URL |
| --- | --- | --- | --- | --- |
| Development | `develop` | Preview | `crm-dev` (`bfsorhjuivyqlvqrkwgn`) | `https://avyukta-crm-git-develop-avyuktacrm.vercel.app` |
| Production | `main` | Production | `crm-prod` (`lnybnkbetjjluhpspvjy`) | `https://protech.avyukta.ca` |

Repository checkouts:

- Development: `/Users/hardik/Documents/Avyukta-CRM/crm-protech`
- Production worktree: `/Users/hardik/Documents/Avyukta-CRM/crm-protech-prod`

Safety rule: keep the development checkout linked to `crm-dev` and the production worktree linked to `crm-prod`. Never run `npx supabase db reset --linked`.

## 2. Vercel configuration

Vercel project: `avyuktacrm/avyukta-crm`

Production branch: `main`

Production domain: `https://protech.avyukta.ca`

Configure the same four variable names twice, with different environment scopes:

| Variable | Preview value | Production value | Exposure |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://avyukta-crm-git-develop-avyuktacrm.vercel.app` | `https://protech.avyukta.ca` | Browser-safe configuration |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bfsorhjuivyqlvqrkwgn.supabase.co` | `https://lnybnkbetjjluhpspvjy.supabase.co` | Browser-safe configuration |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Development publishable key | Production publishable key | Browser-safe configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Development secret key | Production secret key | Sensitive, server only |

Rules:

1. Never add `NEXT_PUBLIC_` to `SUPABASE_SERVICE_ROLE_KEY`.
2. Never store a service-role key or Resend API key in Git, this document, screenshots, tickets, or chat.
3. Use the key from the matching Supabase project. Never mix Development and Production values.
4. Redeploy the relevant Vercel environment after changing environment variables.
5. Confirm the Production deployment was built from `main`, then test the custom domain.

## 3. Supabase Production Auth configuration

Open the `crm-prod` URL Configuration page:

`https://supabase.com/dashboard/project/lnybnkbetjjluhpspvjy/auth/url-configuration`

Set:

```text
Site URL
https://protech.avyukta.ca

Redirect URLs
https://protech.avyukta.ca/auth/confirm
https://protech.avyukta.ca/auth/reset-password
```

Do not add `https://protech.avyukta.ca/**` for Production. Exact production paths are safer. The root URL is already represented by the Site URL and does not need to be repeated.

For the separate `crm-dev` project, allow the two exact routes on the stable Development preview domain:

```text
https://avyukta-crm-git-develop-avyuktacrm.vercel.app/auth/confirm
https://avyukta-crm-git-develop-avyuktacrm.vercel.app/auth/reset-password
```

For an invite-only CRM, disable **Allow new users to sign up** after confirming that administrator invitations work. Admin invitations remain the intended account-creation path. Keep email confirmation enabled for ordinary users.

## 4. Production SMTP with Resend

Resend domain ownership:

- `notify.avyukta.ca`: Avyukta website messages
- `auth.avyukta.ca`: CRM authentication messages

The CRM domain `auth.avyukta.ca` must show **Verified** in Resend.

Supabase `crm-prod` SMTP settings:

```text
Sender name:  Avyukta CRM
Sender email: no-reply@auth.avyukta.ca
Host:         smtp.resend.com
Port:         465
Username:     resend
Password:     dedicated Production Resend API key (stored securely)
```

Use a dedicated Production sending key restricted to `auth.avyukta.ca` when that option is available. Do not reuse the website or Development key.

Email-template checks:

1. Invitation email must take the user to the password setup flow.
2. In **Supabase Dashboard > Authentication > Email Templates > Reset password**, use this recovery link instead of `{{ .ConfirmationURL }}`:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">
     Continue password reset
   </a>
   ```

   The application passes `/auth/confirm` as `RedirectTo`. Sending the token hash to that page lets the user deliberately select **Continue** before the one-time token is verified, reducing failures caused by email-link prefetching. The callback also accepts Supabase's PKCE `?code=` format for backward compatibility when the originating browser still has the PKCE verifier, but the token-hash template is the Production standard and also works when the email opens in another browser.
3. Send one real invitation and one password-reset email to controlled inboxes.
4. Confirm the recovery email opens `/auth/confirm?token_hash=...&type=recovery`, then reaches `/auth/reset-password` after **Continue**.
5. Confirm delivery and link behavior in Resend logs and the browser.

## 5. Super administrator setup

Super administrator login:

`https://protech.avyukta.ca/super-admin/login`

Reusable setup process:

1. In Supabase `crm-prod`, open **Authentication > Users**.
2. Create the administrator Auth user and set a strong unique password.
3. Confirm the user so the initial login is not blocked by email confirmation.
4. Promote the matching profile with this idempotent SQL, changing only the email:

```sql
insert into public.super_admins (id, email)
select p.id, lower(p.email)
from public.profiles as p
where lower(p.email) = lower('admin@avyukta.ca')
on conflict (id) do update
set email = excluded.email;
```

5. Verify exactly one matching row was created:

```sql
select id, email
from public.super_admins
where lower(email) = lower('admin@avyukta.ca');
```

6. Sign in through the Super Admin URL and confirm the dashboard and Organizations page load.

Passwords live in Supabase Auth. Never insert a password into `profiles` or `super_admins`.

## 6. Create the Protech organization

Prepare these values before starting:

```text
Organization Name: the approved legal/display name
Org Code: protech
First Admin Email: the approved Protech administrator
First Admin Full Name: the administrator's real name
```

The Org Code must contain lowercase letters and numbers only. Users must enter it at the organization login, so record it exactly.

Execution:

1. Sign in at `https://protech.avyukta.ca/super-admin/login`.
2. Open **Organizations**.
3. In **Create organization**, enter the prepared values.
4. Select **Create organization** once and wait for a success message.
5. Confirm Protech appears with status `active` and Org Code `protech`.
6. If the first administrator is new, confirm the invitation appears in Resend and arrives in the inbox.
7. The administrator opens the invitation, chooses a password, and finishes the flow at `/auth/reset-password`.
8. The administrator signs in at `https://protech.avyukta.ca/login` with Org Code `protech`, email, and password.

What the creation action performs:

- Creates the organization.
- Reuses an existing Auth user or sends a Supabase invitation to a new user.
- Creates/updates the user profile.
- Adds an active `admin` membership for Protech.

Important failure rule: the organization row is created before the invitation and membership steps. If the UI returns an error, do not repeatedly submit the form. First inspect the Organizations list, Supabase Auth Users, Resend logs, profile, and membership to determine which part completed.

## 7. Add Protech branding, phone, logo, and terms

Only an organization administrator can perform this step.

1. Sign in at `https://protech.avyukta.ca/login` using Org Code `protech`.
2. Open **Settings** in the CRM navigation. The direct path is `/dashboard/user-management`.
3. Locate **Company Branding** and select **Add Branding**.
4. Complete the fields:

   - **Effective From:** use today for immediate activation. A future date schedules the version.
   - **Company Name:** use the approved legal/display name that should appear on documents.
   - **Phone:** enter the approved public business phone number.
   - **Fax:** optional.
   - **Footer:** enter the short approved document footer, if required.
   - **Terms and Conditions:** paste the approved terms into the rich-text editor. Terms are entered as formatted text; there is no terms-file upload.
   - **Company Logo:** upload a JPEG, PNG, or WebP file no larger than 5 MB.

5. Review every value carefully and select **Create Version**.
6. Confirm the current branding card displays the correct company name, phone, logo, footer, terms, and effective date.

Branding behavior:

- Branding versions are append-only and effective-dated.
- Only one version can start on a given date.
- Existing saved/generated customer documents retain their captured branding.
- New quotation documents use the version effective for their document date.
- To change branding later, create a new scheduled version; do not expect the old version to be overwritten.

Use only management/legal-approved terms. A useful preparation checklist is: pricing and taxes, quote validity, payment terms, delivery, scope changes, cancellation, warranties, liability, ownership/risk, acceptance, and governing law. This is a content checklist, not legal advice.

## 8. Organization-wide versioned branding

The effective-dated **Company Branding** record is the source of truth for document identity. The CRM does not duplicate each branding change into the legacy fields on `organizations`.

Current behavior:

- New quotation documents use the branding version effective for the quotation date.
- The dashboard/sidebar uses the logo from the branding version effective today.
- Work-completion acknowledgement PDFs use the company name, logo, phone, fax, and footer from the version effective on the completion date.
- Organizations without a branding version continue to use the legacy organization values as a safe fallback.
- A version that explicitly removes its logo does not revive an older legacy logo.

This keeps scheduled branding changes accurate and avoids two competing copies of the same configuration.

## 9. Required validation after Protech setup

Complete these tests with controlled data:

- [ ] Super admin can sign in and open Organizations.
- [ ] Protech exists once, is `active`, and uses Org Code `protech`.
- [ ] First Protech administrator can accept the invitation and set a password.
- [ ] Protech administrator can sign in through the organization login.
- [ ] Password recovery reaches `/auth/confirm`, verifies, and permits a new password.
- [ ] Branding card shows the approved logo, company name, phone, footer, terms, and active date.
- [ ] A sample customer quotation PDF shows the correct branding and terms on every page.
- [ ] Logo upload/download succeeds in the `crm-assets` bucket.
- [ ] A work-completion PDF shows the branding version effective on its completion date.
- [ ] A second organization cannot read or change Protech records or files.
- [ ] Missing quotation scope produces a readable error and no data change.
- [ ] Duplicate purchase-order number produces a conflict and no partial record/file.
- [ ] Expired authentication returns the user safely to login and clears invalid cookies.
- [ ] Vercel Production runtime logs contain no unexplained errors during the test.
- [ ] Supabase Security Advisor contains no unexplained critical finding.

## 10. Remaining production items

These items are not proven merely by entering environment variables:

### Release blockers

- [ ] Upgrade Vercel from Hobby before commercial use. Vercel restricts Hobby to personal, non-commercial use.
- [ ] Verify the `crm-prod` Supabase billing/availability/backup plan is suitable for a production business system.
- [ ] Remove the broad Production redirect wildcard if it is still present.
- [ ] Complete real invitation and password-recovery email tests.
- [ ] Complete the controlled end-to-end tests in Section 9.

### Strongly recommended before customer data

- [ ] Disable public sign-up if all CRM users must be invited by an administrator.
- [ ] Review Auth rate limits and enable appropriate attack protection.
- [ ] Record the release commit and active Vercel deployment URL.
- [ ] Create a fresh Production logical database backup after baseline setup.
- [ ] Run the seven-bucket Storage backup and require `status=SUCCESS` with matching object counts and bytes.
- [ ] Store an encrypted backup copy off the Mac.
- [ ] Record who performed and verified the release checks.

## 11. Safe future deployment procedure

1. Complete and test changes on `develop` against `crm-dev`.
2. Require lint, tests, production build, database tests, migration replay, and migration lint to pass.
3. Back up Development database and all seven Storage buckets when the release requires it.
4. Review migrations before applying them to Production.
5. Work from the Production worktree and verify its project reference:

```bash
cd /Users/hardik/Documents/Avyukta-CRM/crm-protech-prod
tr -d '[:space:]' < supabase/.temp/project-ref
```

Expected Production reference:

```text
lnybnkbetjjluhpspvjy
```

6. Compare migration history before pushing:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

7. Merge the reviewed `develop` commit into `main`; do not delete or rewrite `main` history.
8. Apply only reviewed pending migrations to the confirmed Production project.
9. Push `main`, wait for the Vercel Production deployment, and confirm the custom domain points to it.
10. Run the Section 9 smoke tests and monitor Vercel and Supabase logs.
11. Record the result and create verified Production backups.

Never run:

```bash
npx supabase db reset --linked
```

## 12. Secret rotation procedure

If a service-role key or Resend API key is exposed:

1. Create/rotate the credential in the provider dashboard.
2. Replace it only in the matching Vercel environment or Supabase SMTP setting.
3. Redeploy when a Vercel variable changed.
4. Test the affected server operation or email flow.
5. Revoke the old credential after the replacement is proven.
6. Record the rotation date and operator without recording the secret value.

## Official references

- Supabase Redirect URLs: `https://supabase.com/docs/guides/auth/redirect-urls`
- Supabase Custom SMTP: `https://supabase.com/docs/guides/auth/auth-smtp`
- Supabase Users and invitations: `https://supabase.com/docs/guides/auth/users`
- Resend SMTP: `https://resend.com/docs/send-with-smtp`
- Resend verified domains: `https://resend.com/docs/dashboard/domains/introduction`
- Vercel Hobby plan: `https://vercel.com/docs/plans/hobby`
- Vercel Fair Use Guidelines: `https://vercel.com/docs/limits/fair-use-guidelines`
