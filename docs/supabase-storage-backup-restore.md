# Supabase Storage backup and restore

This runbook covers the five private Avyukta CRM file buckets. It does not replace the database migration and logical-dump procedure.

## What each backup protects

- `supabase/migrations/` protects custom database schema, including any custom Storage policies or triggers. The current migrations do not define policies on `storage.objects` or `storage.buckets`.
- `supabase/config.toml` protects the five bucket definitions: privacy, per-file limit, and allowed MIME types.
- Supabase-managed `storage.buckets` and `storage.objects` rows describe buckets and objects. They are metadata, not file contents.
- `roles.sql`, `schema.sql`, and `data.sql` protect their respective logical database content. The Supabase CLI excludes managed schemas including `auth` and `storage` from a normal `db dump`.
- The Storage backup created by `scripts/backup-supabase-storage.sh` protects the actual PDFs, images, DWG, DOCX, and XLSX objects, plus inventories and checksums.

Do not restore `storage.objects` rows directly. Uploading each object through the Storage API recreates managed object metadata. Original owner fields may differ after a restore; application authorization must continue to rely on the verified organization and business-record metadata, not Storage object ownership alone.

## Create a Development backup

Prerequisites:

- Supabase CLI authenticated and this repository linked to the intended Development project.
- `psql`, `tar`, and either `sha256sum` or `shasum` installed.
- A read-only-capable database connection URL in `SUPABASE_DB_URL`. The script only issues `SELECT` statements through it.
- `SUPABASE_PROJECT_REF` must exactly match `supabase/.temp/project-ref`, and the database URL must contain that project reference.

Enter the database URL without echoing it or placing it directly in shell history:

```bash
read -r -s -p "Development database URL: " SUPABASE_DB_URL
printf '\n'
export SUPABASE_DB_URL
export SUPABASE_PROJECT_REF="$(tr -d '[:space:]' < supabase/.temp/project-ref)"
./scripts/backup-supabase-storage.sh development
unset SUPABASE_DB_URL SUPABASE_PROJECT_REF
```

The default destination is `~/avyukta-crm-backups/YYYYMMDD_HHMMSS/storage/`. Override the parent directory with `AVYUKTA_BACKUP_ROOT`; the script refuses a destination inside this Git repository.

The script:

1. verifies the explicit environment, project reference, linked reference, database URL association, and all five buckets;
2. exports `buckets.csv`, `objects-inventory.csv`, and `remote-summary.csv`;
3. downloads every non-empty bucket with the installed CLI's `storage cp --experimental --recursive --linked` command;
4. verifies per-bucket remote and local object counts;
5. writes `local-files.txt`, `SHA256SUMS`, download logs, and `MANIFEST.txt`;
6. creates `storage-files-<timestamp>.tar.gz` and its SHA-256 file;
7. exits non-zero if metadata export, any bucket download, count validation, hashing, or archiving fails.

Production is not implied by a linked project. A Production backup additionally requires an interactive confirmation containing the exact project reference.

## Verify a backup before a restore

```bash
export STORAGE_BACKUP="/absolute/path/to/YYYYMMDD_HHMMSS/storage"
grep '^status=SUCCESS$' "$STORAGE_BACKUP/MANIFEST.txt"

if command -v sha256sum >/dev/null; then
  (cd "$STORAGE_BACKUP" && sha256sum -c SHA256SUMS)
  (cd "$STORAGE_BACKUP" && sha256sum -c storage-files-*.tar.gz.sha256)
else
  (cd "$STORAGE_BACKUP" && shasum -a 256 -c SHA256SUMS)
  (cd "$STORAGE_BACKUP" && shasum -a 256 -c storage-files-*.tar.gz.sha256)
fi
```

Review `remote-summary.csv` against the file counts beneath `files/<bucket>/`. Do not proceed from a `FAILED` or `FILES_VERIFIED` manifest.

## Restore order for a new clean project

Never use this procedure against an existing Development or Production project without a separate approved change plan.

1. Create a clean Supabase project and record its new project reference and database credentials.
2. Link a clean checkout to the new target and apply database migrations.
3. configure target-specific Auth, URL, SMTP, secrets, and other environment settings;
4. create buckets from `supabase/config.toml`;
5. query and verify that every bucket is private and has the expected limit and MIME list;
6. verify the server-only service-role authorization model or apply reviewed custom Storage policies if the architecture has changed;
7. restore the required logical database data;
8. upload the actual Storage files to the matching bucket and path;
9. compare source and target object inventory, counts, sizes, and local checksums;
10. test representative signed downloads and all document screens;
11. test that a user in one organization cannot sign, download, overwrite, or delete another organization's object.

## Create buckets locally

```bash
npx supabase start
npx supabase seed buckets --local
```

Inspect the local bucket records:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -X -P pager=off -c "
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;
"
```

## Create buckets on a new linked target

The following writes bucket configuration. Run it only after confirming that the linked project is the new, empty restore target:

```bash
export TARGET_PROJECT_REF="replace-with-new-clean-target-ref"
npx supabase link --project-ref "$TARGET_PROJECT_REF"
npx supabase db push --linked
npx supabase seed buckets --linked
```

Immediately query `storage.buckets` on the target and confirm exactly the five expected rows, `public = false`, the exact byte limits, and exact MIME lists before uploading files.

## Upload restored objects

Verify the linked project reference again, then upload each bucket without changing its relative path:

```bash
export STORAGE_BACKUP="/absolute/path/to/YYYYMMDD_HHMMSS/storage"
export TARGET_PROJECT_REF="replace-with-new-clean-target-ref"
test "$(tr -d '[:space:]' < supabase/.temp/project-ref)" = "$TARGET_PROJECT_REF"

while IFS= read -r bucket; do
  bucket_dir="$STORAGE_BACKUP/files/$bucket"
  while IFS= read -r -d '' file; do
    relative_path="${file#"$bucket_dir/"}"
    extension="$(printf '%s' "${file##*.}" | tr '[:upper:]' '[:lower:]')"
    case "$extension" in
      pdf) content_type="application/pdf" ;;
      jpg|jpeg) content_type="image/jpeg" ;;
      png) content_type="image/png" ;;
      webp) content_type="image/webp" ;;
      svg) content_type="image/svg+xml" ;;
      dwg) content_type="image/vnd.dwg" ;;
      docx) content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document" ;;
      xlsx) content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;;
      *) printf 'Unsupported restore extension: %s\n' "$file" >&2; exit 1 ;;
    esac
    npx supabase storage cp --experimental --linked \
      --content-type "$content_type" \
      "$file" \
      "ss:///$bucket/$relative_path"
  done < <(find "$bucket_dir" -type f -print0)
done < "$STORAGE_BACKUP/bucket-names.txt"
```

The explicit extension map is intentional: this CLI auto-detects `.dwg` as `application/octet-stream`, which the normalized bucket correctly rejects. The restore maps `.dwg` to `image/vnd.dwg` and does not broaden the bucket allowlist. If a bucket is empty, leave it empty. Never use an overwrite flag to conceal collisions. A collision means the target is not clean or the restore was partially run; stop and investigate.

## Compare source and target inventory

Using the target database URL, export the same target summary:

```bash
read -r -s -p "Target database URL: " TARGET_DB_URL
printf '\n'
export TARGET_DB_URL

psql "$TARGET_DB_URL" -X -v ON_ERROR_STOP=1 --csv -c "
select b.id as bucket_id,
       count(o.id) as object_count,
       coalesce(sum((o.metadata ->> 'size')::bigint), 0) as total_size_bytes
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
where b.id in ('crm-assets','customer-quotation-pdfs','job-invoice-documents','job-purchase-order-documents','quotation-documents')
group by b.id
order by b.id;
" > /tmp/avyukta-target-storage-summary.csv

diff -u "$STORAGE_BACKUP/remote-summary.csv" /tmp/avyukta-target-storage-summary.csv
unset TARGET_DB_URL
```

A zero `diff` confirms per-bucket object counts and sizes, but not content identity. Also retain the successful local `SHA256SUMS` check and test representative restored downloads. For an independent content-level target comparison, run the backup script against the restored target into a separate directory and compare both `SHA256SUMS` files after normalizing their common `files/` paths.

## Application verification after restore

- Customer and organization logos render through time-limited signed URLs.
- Supplier quote and scope-charge PDFs upload, open, replace intentionally, and delete only within the owning organization.
- Customer quotation PDFs preserve generated history and do not overwrite earlier generations.
- Purchase-order PDF/JPEG/PNG/DOCX/XLSX files and invoice PDFs upload and download.
- Unsupported MIME types, extension/MIME mismatches, empty files, and oversized files are rejected by the server.
- Direct public URLs fail because every bucket remains private.
- Cross-organization record IDs return not found/forbidden and never produce a signed URL.

## Rollback and failure handling

The backup script is read-only against the source project and does not delete remote files. A failed restore can leave uploaded objects in the new target. Do not run an automated delete or database reset against an established project. For a brand-new disposable restore target, discard the target project only through a separately approved recovery decision, then begin again from the verified archive.
