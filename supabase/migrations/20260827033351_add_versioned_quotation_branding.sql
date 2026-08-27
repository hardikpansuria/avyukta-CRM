BEGIN;
CREATE TABLE public.organization_quotation_branding_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  company_name text NOT NULL,
  phone text,
  fax text,
  footer_text text,
  terms_html text,
  terms_text text,
  logo_storage_path text,
  effective_from date NOT NULL,
  effective_to date,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT organization_quotation_branding_versions_pkey PRIMARY KEY (id),
  CONSTRAINT organization_quotation_branding_versions_org_effective_key
    UNIQUE (org_id, effective_from),
  CONSTRAINT organization_quotation_branding_versions_company_name_check
    CHECK (length(btrim(company_name)) > 0),
  CONSTRAINT organization_quotation_branding_versions_effective_range_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT organization_quotation_branding_versions_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT organization_quotation_branding_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.organization_quotation_branding_versions IS
  'Append-only, effective-dated branding used for customer quotations and work orders.';
COMMENT ON COLUMN public.organization_quotation_branding_versions.effective_to IS
  'Derived automatically as the day before the next version starts.';
ALTER TABLE public.organization_quotation_branding_versions
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_quotation_branding_versions FROM anon, authenticated;
GRANT SELECT ON public.organization_quotation_branding_versions TO authenticated;
GRANT ALL ON public.organization_quotation_branding_versions TO service_role;
CREATE INDEX idx_organization_quotation_branding_versions_lookup
  ON public.organization_quotation_branding_versions (org_id, effective_from DESC);
CREATE POLICY organization_quotation_branding_versions_select_allowed
  ON public.organization_quotation_branding_versions
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_active_org_member(org_id)
  );
CREATE FUNCTION public.protect_quotation_branding_version_content()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Quotation branding versions are immutable';
  END IF;

  IF ROW(
    NEW.id,
    NEW.org_id,
    NEW.company_name,
    NEW.phone,
    NEW.fax,
    NEW.footer_text,
    NEW.terms_html,
    NEW.terms_text,
    NEW.logo_storage_path,
    NEW.effective_from,
    NEW.created_by,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.org_id,
    OLD.company_name,
    OLD.phone,
    OLD.fax,
    OLD.footer_text,
    OLD.terms_html,
    OLD.terms_text,
    OLD.logo_storage_path,
    OLD.effective_from,
    OLD.created_by,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Quotation branding version content is immutable';
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.protect_quotation_branding_version_content()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_quotation_branding_version_content()
TO service_role;
CREATE TRIGGER protect_quotation_branding_version_content
  BEFORE UPDATE OR DELETE ON public.organization_quotation_branding_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_quotation_branding_version_content();
CREATE FUNCTION public.refresh_quotation_branding_effective_ranges()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
BEGIN
  UPDATE public.organization_quotation_branding_versions AS branding
  SET effective_to = ranges.next_effective_from - 1
  FROM (
    SELECT
      id,
      lead(effective_from) OVER (
        PARTITION BY org_id
        ORDER BY effective_from
      ) AS next_effective_from
    FROM public.organization_quotation_branding_versions
    WHERE org_id = NEW.org_id
  ) AS ranges
  WHERE branding.id = ranges.id
    AND branding.effective_to IS DISTINCT FROM ranges.next_effective_from - 1;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.refresh_quotation_branding_effective_ranges()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_quotation_branding_effective_ranges()
TO service_role;
CREATE TRIGGER refresh_quotation_branding_effective_ranges
  AFTER INSERT ON public.organization_quotation_branding_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_quotation_branding_effective_ranges();
INSERT INTO public.organization_quotation_branding_versions (
  org_id,
  company_name,
  phone,
  fax,
  footer_text,
  terms_html,
  terms_text,
  logo_storage_path,
  effective_from
)
SELECT
  organization.id,
  COALESCE(NULLIF(btrim(organization.quotation_company_name), ''), organization.name),
  NULLIF(btrim(organization.quotation_phone), ''),
  NULLIF(btrim(organization.quotation_fax), ''),
  NULLIF(btrim(organization.quotation_footer_text), ''),
  NULLIF(btrim(organization.quotation_terms_html), ''),
  NULLIF(btrim(organization.quotation_terms_text), ''),
  organization.logo_storage_path,
  DATE '1900-01-01'
FROM public.organizations AS organization
ON CONFLICT (org_id, effective_from) DO NOTHING;
ALTER TABLE public.quotation_customer_documents
  ADD COLUMN branding_version_id uuid;
ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_branding_version_id_fkey
  FOREIGN KEY (branding_version_id)
  REFERENCES public.organization_quotation_branding_versions(id)
  ON DELETE RESTRICT;
CREATE INDEX idx_quotation_customer_documents_branding_version_id
  ON public.quotation_customer_documents (branding_version_id)
  WHERE branding_version_id IS NOT NULL;
-- This is a one-time metadata backfill, not a user edit to a locked quotation.
-- Disable only the two document UPDATE triggers so historical business fields
-- and updated_at remain untouched while the previously-empty snapshot columns
-- are initialized. The surrounding transaction restores both on any failure.
ALTER TABLE public.quotation_customer_documents
  DISABLE TRIGGER protect_locked_customer_documents;
ALTER TABLE public.quotation_customer_documents
  DISABLE TRIGGER set_quotation_customer_documents_updated_at;
UPDATE public.quotation_customer_documents AS document
SET
  branding_version_id = branding.id,
  organization_name_snapshot = COALESCE(
    NULLIF(document.organization_name_snapshot, ''),
    branding.company_name
  ),
  organization_logo_path_snapshot = COALESCE(
    document.organization_logo_path_snapshot,
    branding.logo_storage_path
  ),
  organization_phone_snapshot = COALESCE(
    NULLIF(document.organization_phone_snapshot, ''),
    branding.phone
  ),
  organization_fax_snapshot = COALESCE(
    NULLIF(document.organization_fax_snapshot, ''),
    branding.fax
  ),
  organization_footer_snapshot = COALESCE(
    NULLIF(document.organization_footer_snapshot, ''),
    branding.footer_text
  ),
  organization_terms_html_snapshot = COALESCE(
    NULLIF(document.organization_terms_html_snapshot, ''),
    branding.terms_html
  ),
  organization_terms_text_snapshot = COALESCE(
    NULLIF(document.organization_terms_text_snapshot, ''),
    branding.terms_text
  )
FROM public.organization_quotation_branding_versions AS branding
WHERE branding.org_id = document.org_id
  AND branding.effective_from <= COALESCE(document.quotation_date, document.created_at::date)
  AND (
    branding.effective_to IS NULL
    OR branding.effective_to >= COALESCE(document.quotation_date, document.created_at::date)
  )
  AND document.branding_version_id IS NULL;
ALTER TABLE public.quotation_customer_documents
  ENABLE TRIGGER set_quotation_customer_documents_updated_at;
ALTER TABLE public.quotation_customer_documents
  ENABLE TRIGGER protect_locked_customer_documents;
COMMIT;
