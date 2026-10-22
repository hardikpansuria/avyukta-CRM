# Database Release History

This document records the Supabase migration boundary associated with each
application release tag. Git remains the source of truth for migration files,
while Supabase records applied migration timestamps in
`supabase_migrations.schema_migrations`.

Do not add release markers directly to the Supabase migration-history table and
do not use `supabase migration repair` for release tagging. That command is
reserved for reconciling migration-history drift.

## Environments

| Environment | Supabase project | Project reference |
| --- | --- | --- |
| Development | `crm-dev` | `bfsorhjuivyqlvqrkwgn` |
| Production | `crm-prod` | `lnybnkbetjjluhpspvjy` |

## Release boundaries

| Release | Git commit | Last included migration | Migration files included |
| --- | --- | --- | ---: |
| `1.0.0` | `d2b4c4fe6383966a77f00a8821b19ebc014f6d21` | `20260917033119_harden_admin_settings_audit_logs.sql` | 25 |
| `1.0.1` | `4b18f8877fd5913b45699076bcbdc95229420303` | `20261021090000_update_purchase_order_details.sql` | 29 |

### Release 1.0.0

- Git tag: `1.0.0`
- Release commit: `d2b4c4fe6383966a77f00a8821b19ebc014f6d21`
- Database boundary: every migration through and including
  `20260917033119_harden_admin_settings_audit_logs.sql`
- Total migration files at the tag: 25

### Release 1.0.1

- Git tag: `1.0.1`
- Release commit: `4b18f8877fd5913b45699076bcbdc95229420303`
- Database boundary: every migration through and including
  `20261021090000_update_purchase_order_details.sql`
- Total migration files at the tag: 29
- Database migrations added after `1.0.0`:
  - `20261020060735_audit_purchase_order_number_changes.sql`
  - `20261020060743_allow_active_job_quotation_revisions.sql`
  - `20261020061422_sync_accepted_quotation_po_allocation.sql`
  - `20261021090000_update_purchase_order_details.sql`

## Release verification

Before recording a future release, verify the Git tag and the target Supabase
project independently.

```bash
# Show the final migration included in a release tag.
git ls-tree -r --name-only <tag> -- supabase/migrations | sort | tail -1

# Show database migrations introduced between two releases.
git diff --name-only <previous-tag>..<new-tag> -- supabase/migrations

# Compare repository migrations with the linked Supabase project.
supabase migration list --linked
```

For every future release, append the Git tag, release commit, last included
migration filename, migration count, and any migrations added since the prior
release. Production database operations must continue to follow
`docs/source-control-and-production-release-safety.md`.
