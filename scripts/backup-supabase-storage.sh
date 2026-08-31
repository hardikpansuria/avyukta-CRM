#!/usr/bin/env bash

set -Eeuo pipefail

readonly REQUIRED_BUCKETS=(
  "crm-assets"
  "customer-quotation-pdfs"
  "job-invoice-documents"
  "job-purchase-order-documents"
  "quotation-documents"
  "invoice-request-documents"
  "work-completion-acknowledgements"
)

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  printf 'Usage: SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_URL=<url> %s <development|staging|production>\n' "$0" >&2
}

[[ $# -eq 1 ]] || { usage; exit 2; }

readonly ENVIRONMENT="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
case "$ENVIRONMENT" in
  development|staging|production) ;;
  *) fail "Environment must be development, staging, or production." ;;
esac

readonly PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
readonly DATABASE_URL="${SUPABASE_DB_URL:-}"
[[ -n "$PROJECT_REF" ]] || fail "SUPABASE_PROJECT_REF is required."
[[ -n "$DATABASE_URL" ]] || fail "SUPABASE_DB_URL is required for read-only Storage metadata export."
[[ "$DATABASE_URL" == *"$PROJECT_REF"* ]] || fail "SUPABASE_DB_URL does not contain SUPABASE_PROJECT_REF; refusing a possibly mismatched backup."

command -v npx >/dev/null || fail "npx is required."
command -v psql >/dev/null || fail "psql is required."
command -v tar >/dev/null || fail "tar is required."

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
readonly LINKED_REF_FILE="$REPO_ROOT/supabase/.temp/project-ref"
[[ -f "$LINKED_REF_FILE" ]] || fail "No linked Supabase project was found at supabase/.temp/project-ref."
readonly LINKED_REF="$(tr -d '[:space:]' < "$LINKED_REF_FILE")"
[[ "$LINKED_REF" == "$PROJECT_REF" ]] || fail "Linked project ref does not match SUPABASE_PROJECT_REF."

printf 'Environment: %s\n' "$ENVIRONMENT"
printf 'Linked project reference: %s\n' "$LINKED_REF"

if [[ "$ENVIRONMENT" == "production" ]]; then
  [[ -t 0 ]] || fail "Production backup confirmation requires an interactive terminal."
  printf 'Type BACKUP PRODUCTION %s to continue: ' "$PROJECT_REF" >&2
  read -r production_confirmation
  [[ "$production_confirmation" == "BACKUP PRODUCTION $PROJECT_REF" ]] || fail "Production backup was not confirmed."
fi

readonly DEFAULT_BACKUP_ROOT="${HOME}/avyukta-crm-backups"
readonly REQUESTED_BACKUP_ROOT="${AVYUKTA_BACKUP_ROOT:-$DEFAULT_BACKUP_ROOT}"
mkdir -p "$REQUESTED_BACKUP_ROOT"
readonly BACKUP_ROOT="$(cd "$REQUESTED_BACKUP_ROOT" && pwd -P)"
case "$BACKUP_ROOT/" in
  "$REPO_ROOT/"*) fail "Backup root must be outside the Git repository." ;;
esac

readonly TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
readonly RUN_DIR="$BACKUP_ROOT/$TIMESTAMP"
readonly STORAGE_DIR="$RUN_DIR/storage"
readonly FILES_DIR="$STORAGE_DIR/files"
mkdir -p "$FILES_DIR"

declare -a BUCKETS=()
backup_status="FAILED"
archive_status="NOT_CREATED"
archive_name=""
write_manifest() {
  if [[ -d "$STORAGE_DIR" ]]; then
    {
      printf 'status=%s\n' "$backup_status"
      printf 'environment=%s\n' "$ENVIRONMENT"
      printf 'project_ref=%s\n' "$PROJECT_REF"
      printf 'timestamp_utc=%s\n' "$TIMESTAMP"
      printf 'bucket_count=%s\n' "${#BUCKETS[@]}"
      printf 'backup_directory=%s\n' "$STORAGE_DIR"
      printf 'archive_status=%s\n' "$archive_status"
      if [[ -n "$archive_name" ]]; then
        printf 'archive_name=%s\n' "$archive_name"
      fi
    } > "$STORAGE_DIR/MANIFEST.txt"
  fi
}

on_exit() {
  local exit_code=$?
  write_manifest
  exit "$exit_code"
}
trap on_exit EXIT

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc "
  select id
  from storage.buckets
  order by id;
" > "$STORAGE_DIR/bucket-names.txt" || fail "Unable to query remote Storage buckets."

while IFS= read -r bucket || [[ -n "$bucket" ]]; do
  [[ -n "$bucket" ]] && BUCKETS+=("$bucket")
done < "$STORAGE_DIR/bucket-names.txt"

[[ "${#BUCKETS[@]}" -gt 0 ]] || fail "No remote Storage buckets were found."
for required_bucket in "${REQUIRED_BUCKETS[@]}"; do
  grep -Fqx -- "$required_bucket" "$STORAGE_DIR/bucket-names.txt" \
    || fail "Required Storage bucket is missing: $required_bucket."
done

for bucket in "${BUCKETS[@]}"; do
  mkdir -p "$FILES_DIR/$bucket"
done

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --csv -c "
  select id, name, public, file_size_limit, array_to_string(allowed_mime_types, '|') as allowed_mime_types
  from storage.buckets
  order by id;
" > "$STORAGE_DIR/buckets.csv" || fail "Unable to export bucket configuration."

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --csv -c "
  select bucket_id, name, id, owner, created_at, updated_at, last_accessed_at,
         coalesce((metadata ->> 'size')::bigint, 0) as size_bytes,
         metadata ->> 'mimetype' as mime_type,
         metadata ->> 'eTag' as etag
  from storage.objects
  order by bucket_id, name;
" > "$STORAGE_DIR/objects-inventory.csv" || fail "Unable to export object inventory."

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --csv -c "
  select b.id as bucket_id,
         count(o.id) as object_count,
         coalesce(sum((o.metadata ->> 'size')::bigint), 0) as total_size_bytes
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  group by b.id
  order by b.id;
" > "$STORAGE_DIR/remote-summary.csv" || fail "Unable to export remote object summary."

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' -c "
  select b.id,
         count(o.id),
         coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  group by b.id
  order by b.id;
" > "$STORAGE_DIR/remote-summary.tsv" || fail "Unable to export machine-readable remote object summary."

file_size() {
  if stat -f '%z' "$1" >/dev/null 2>&1; then
    stat -f '%z' "$1"
  else
    stat -c '%s' "$1"
  fi
}

printf 'bucket_id,object_count,total_size_bytes\n' > "$STORAGE_DIR/local-summary.csv"
remote_total_count=0
remote_total_bytes=0
local_total_count=0
local_total_bytes=0

for bucket in "${BUCKETS[@]}"; do
  remote_record="$(awk -F $'\t' -v bucket="$bucket" '
    $1 == bucket { print $2 "\t" $3; found = 1 }
    END { if (!found) exit 1 }
  ' "$STORAGE_DIR/remote-summary.tsv")" || fail "Unable to read remote summary for $bucket."
  IFS=$'\t' read -r remote_count remote_bytes <<< "$remote_record"
  [[ "$remote_count" =~ ^[0-9]+$ ]] || fail "Unable to read remote object count for $bucket."
  [[ "$remote_bytes" =~ ^[0-9]+$ ]] || fail "Unable to read remote byte total for $bucket."
  if [[ "$remote_count" -gt 0 ]]; then
    printf 'Downloading %s (%s objects, %s bytes)...\n' "$bucket" "$remote_count" "$remote_bytes"
    npx supabase storage cp --experimental --recursive --linked "ss:///$bucket" "$FILES_DIR" \
      > "$STORAGE_DIR/download-$bucket.log" 2>&1 \
      || fail "Download failed for $bucket. See download-$bucket.log."
  else
    printf 'Bucket %s is empty; preserving its directory.\n' "$bucket"
    : > "$STORAGE_DIR/download-$bucket.log"
  fi

  local_count="$(find "$FILES_DIR/$bucket" -type f | wc -l | tr -d '[:space:]')"
  [[ "$local_count" == "$remote_count" ]] || fail "Object count mismatch for $bucket: remote=$remote_count local=$local_count."

  local_bytes=0
  while IFS= read -r -d '' file_path; do
    size_bytes="$(file_size "$file_path")"
    [[ "$size_bytes" =~ ^[0-9]+$ ]] || fail "Unable to read local file size: $file_path."
    local_bytes=$((local_bytes + size_bytes))
  done < <(find "$FILES_DIR/$bucket" -type f -print0)
  [[ "$local_bytes" == "$remote_bytes" ]] || fail "Byte total mismatch for $bucket: remote=$remote_bytes local=$local_bytes."

  printf '%s,%s,%s\n' "$bucket" "$local_count" "$local_bytes" >> "$STORAGE_DIR/local-summary.csv"
  remote_total_count=$((remote_total_count + remote_count))
  remote_total_bytes=$((remote_total_bytes + remote_bytes))
  local_total_count=$((local_total_count + local_count))
  local_total_bytes=$((local_total_bytes + local_bytes))
done

[[ "$local_total_count" == "$remote_total_count" ]] || fail "Overall object count mismatch: remote=$remote_total_count local=$local_total_count."
[[ "$local_total_bytes" == "$remote_total_bytes" ]] || fail "Overall byte total mismatch: remote=$remote_total_bytes local=$local_total_bytes."

: > "$STORAGE_DIR/local-files.txt"
while IFS= read -r file_path; do
  relative_path="${file_path#"$STORAGE_DIR/"}"
  printf '%s\t%s\n' "$(file_size "$file_path")" "$relative_path" >> "$STORAGE_DIR/local-files.txt"
done < <(find "$FILES_DIR" -type f | LC_ALL=C sort)

if command -v sha256sum >/dev/null; then
  (
    cd "$STORAGE_DIR"
    find files -type f -exec sha256sum {} + | LC_ALL=C sort -k2
  ) > "$STORAGE_DIR/SHA256SUMS"
elif command -v shasum >/dev/null; then
  (
    cd "$STORAGE_DIR"
    find files -type f -exec shasum -a 256 {} + | LC_ALL=C sort -k2
  ) > "$STORAGE_DIR/SHA256SUMS"
else
  fail "sha256sum or shasum is required."
fi

{
  printf 'content_status=VERIFIED\n'
  printf 'environment=%s\n' "$ENVIRONMENT"
  printf 'project_ref=%s\n' "$PROJECT_REF"
  printf 'timestamp_utc=%s\n' "$TIMESTAMP"
  printf 'bucket_count=%s\n' "${#BUCKETS[@]}"
  printf 'object_count=%s\n' "$local_total_count"
  printf 'total_size_bytes=%s\n' "$local_total_bytes"
} > "$STORAGE_DIR/ARCHIVE-MANIFEST.txt"

backup_status="ARCHIVING"
archive_status="CREATING"
write_manifest

readonly ARCHIVE_NAME="storage-files-$TIMESTAMP.tar.gz"
readonly ARCHIVE_TMP="$RUN_DIR/$ARCHIVE_NAME"
archive_name="$ARCHIVE_NAME"
tar --exclude='./MANIFEST.txt' -czf "$ARCHIVE_TMP" -C "$STORAGE_DIR" . || fail "Unable to create Storage archive."
mv "$ARCHIVE_TMP" "$STORAGE_DIR/$ARCHIVE_NAME"

if command -v sha256sum >/dev/null; then
  (cd "$STORAGE_DIR" && sha256sum "$ARCHIVE_NAME") > "$STORAGE_DIR/$ARCHIVE_NAME.sha256"
  (cd "$STORAGE_DIR" && sha256sum -c "$ARCHIVE_NAME.sha256") >/dev/null \
    || fail "Storage archive checksum verification failed."
else
  (cd "$STORAGE_DIR" && shasum -a 256 "$ARCHIVE_NAME") > "$STORAGE_DIR/$ARCHIVE_NAME.sha256"
  (cd "$STORAGE_DIR" && shasum -a 256 -c "$ARCHIVE_NAME.sha256") >/dev/null \
    || fail "Storage archive checksum verification failed."
fi

archive_status="VERIFIED"
backup_status="SUCCESS"
write_manifest
trap - EXIT
printf 'Storage backup completed: %s\n' "$STORAGE_DIR"
