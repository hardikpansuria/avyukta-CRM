BEGIN;

ALTER TABLE public.organization_quotation_branding_versions
  ADD COLUMN quotation_intro_text text,
  ADD COLUMN quotation_order_terms_text text;

UPDATE public.organization_quotation_branding_versions
SET
  quotation_intro_text =
    'Thank you, for the opportunity to quote on your requirements, please call if you require further information.',
  quotation_order_terms_text =
    'Order Subject to ' || company_name || ' Standard terms and conditions of sale.';

ALTER TABLE public.organization_quotation_branding_versions
  ADD CONSTRAINT organization_quotation_branding_intro_length_check
    CHECK (
      quotation_intro_text IS NULL
      OR length(btrim(quotation_intro_text)) BETWEEN 1 AND 2000
    ),
  ADD CONSTRAINT organization_quotation_branding_order_terms_length_check
    CHECK (
      quotation_order_terms_text IS NULL
      OR length(btrim(quotation_order_terms_text)) BETWEEN 1 AND 2000
    );

COMMENT ON COLUMN public.organization_quotation_branding_versions.quotation_intro_text IS
  'Versioned introductory sentence displayed below customer quotation totals.';
COMMENT ON COLUMN public.organization_quotation_branding_versions.quotation_order_terms_text IS
  'Versioned order-subject statement displayed with customer quotation commercial terms.';

CREATE OR REPLACE FUNCTION public.protect_quotation_branding_version_content()
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
    NEW.quotation_intro_text,
    NEW.quotation_order_terms_text,
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
    OLD.quotation_intro_text,
    OLD.quotation_order_terms_text,
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

ALTER TABLE public.quotation_customer_documents
  ADD COLUMN organization_quotation_intro_snapshot text,
  ADD COLUMN organization_quotation_order_terms_snapshot text;

-- This is a one-time metadata backfill, not a user edit to a locked quotation.
ALTER TABLE public.quotation_customer_documents
  DISABLE TRIGGER protect_locked_customer_documents;
ALTER TABLE public.quotation_customer_documents
  DISABLE TRIGGER set_quotation_customer_documents_updated_at;

UPDATE public.quotation_customer_documents AS document
SET
  organization_quotation_intro_snapshot = COALESCE(
    branding.quotation_intro_text,
    'Thank you, for the opportunity to quote on your requirements, please call if you require further information.'
  ),
  organization_quotation_order_terms_snapshot = COALESCE(
    branding.quotation_order_terms_text,
    'Order Subject to ' || COALESCE(
      NULLIF(btrim(document.organization_name_snapshot), ''),
      'Organization'
    ) || ' Standard terms and conditions of sale.'
  )
FROM public.organization_quotation_branding_versions AS branding
WHERE branding.id = document.branding_version_id;

UPDATE public.quotation_customer_documents AS document
SET
  organization_quotation_intro_snapshot = COALESCE(
    document.organization_quotation_intro_snapshot,
    'Thank you, for the opportunity to quote on your requirements, please call if you require further information.'
  ),
  organization_quotation_order_terms_snapshot = COALESCE(
    document.organization_quotation_order_terms_snapshot,
    'Order Subject to ' || COALESCE(
      NULLIF(btrim(document.organization_name_snapshot), ''),
      'Organization'
    ) || ' Standard terms and conditions of sale.'
  )
WHERE
  document.organization_quotation_intro_snapshot IS NULL
  OR document.organization_quotation_order_terms_snapshot IS NULL;

ALTER TABLE public.quotation_customer_documents
  ENABLE TRIGGER set_quotation_customer_documents_updated_at;
ALTER TABLE public.quotation_customer_documents
  ENABLE TRIGGER protect_locked_customer_documents;

COMMENT ON COLUMN public.quotation_customer_documents.organization_quotation_intro_snapshot IS
  'Immutable quotation introduction captured from the effective branding version.';
COMMENT ON COLUMN public.quotation_customer_documents.organization_quotation_order_terms_snapshot IS
  'Immutable quotation order-subject statement captured from the effective branding version.';

COMMIT;
