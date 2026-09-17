create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_key text not null,
  document_version text not null,
  content_hash text not null,
  action_type text not null,
  accepted_at timestamptz not null default statement_timestamp(),
  acceptance_source text not null default 'first_login_gate',
  created_at timestamptz not null default statement_timestamp(),
  constraint legal_acceptances_member_fkey
    foreign key (user_id, organization_id)
    references public.org_members(user_id, org_id)
    on delete restrict,
  constraint legal_acceptances_document_key_check
    check (document_key ~ '^[a-z0-9_]+$'),
  constraint legal_acceptances_document_version_check
    check (length(btrim(document_version)) between 1 and 40),
  constraint legal_acceptances_content_hash_check
    check (content_hash ~ '^[a-f0-9]{64}$'),
  constraint legal_acceptances_action_type_check
    check (action_type in ('agreed', 'acknowledged')),
  constraint legal_acceptances_source_check
    check (acceptance_source in ('first_login_gate', 'version_update')),
  constraint legal_acceptances_user_org_document_version_key
    unique (user_id, organization_id, document_key, document_version)
);

comment on table public.legal_acceptances is
  'Immutable, versioned evidence that an authenticated organization member agreed to or acknowledged a required legal document.';
comment on column public.legal_acceptances.accepted_at is
  'Server-generated acceptance time. Browser clients cannot insert or update this table.';
comment on column public.legal_acceptances.content_hash is
  'SHA-256 hash of the exact configured document content accepted by the user.';

create index legal_acceptances_user_org_lookup_idx
  on public.legal_acceptances(user_id, organization_id);
create index legal_acceptances_org_status_lookup_idx
  on public.legal_acceptances(organization_id, user_id, accepted_at desc);

alter table public.legal_acceptances enable row level security;

revoke all on table public.legal_acceptances from public, anon, authenticated;
grant select on table public.legal_acceptances to authenticated;
grant all on table public.legal_acceptances to service_role;

create policy legal_acceptances_read_authorized
  on public.legal_acceptances
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_org_admin(organization_id)
    or public.is_super_admin()
  );
