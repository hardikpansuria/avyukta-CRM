-- Keep every application Storage bucket reproducible through `supabase db push`.
-- config.toml is also retained for local seeding, but hosted projects must not
-- depend on a separate `supabase seed buckets` command.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'crm-assets',
    'crm-assets',
    false,
    10485760,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'image/vnd.dwg'
    ]::text[]
  ),
  (
    'customer-quotation-pdfs',
    'customer-quotation-pdfs',
    false,
    52428800,
    array['application/pdf']::text[]
  ),
  (
    'job-invoice-documents',
    'job-invoice-documents',
    false,
    52428800,
    array['application/pdf', 'image/png', 'image/jpeg']::text[]
  ),
  (
    'job-purchase-order-documents',
    'job-purchase-order-documents',
    false,
    52428800,
    array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
  ),
  (
    'quotation-documents',
    'quotation-documents',
    false,
    10485760,
    array['application/pdf']::text[]
  ),
  (
    'invoice-request-documents',
    'invoice-request-documents',
    false,
    15728640,
    array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
  ),
  (
    'work-completion-acknowledgements',
    'work-completion-acknowledgements',
    false,
    15728640,
    array['application/pdf']::text[]
  )
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
