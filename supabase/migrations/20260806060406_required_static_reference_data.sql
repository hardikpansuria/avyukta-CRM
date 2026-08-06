BEGIN;

-- -----------------------------------------------------------------------------
-- Global required reference data
-- -----------------------------------------------------------------------------

-- Canadian tax rates are global reference data: public.tax_rates has no org_id.
-- The UUIDs are deterministic across clean environments. No current foreign key
-- references tax_rates.id; application records store tax snapshots instead.
-- The natural conflict target preserves an existing environment's UUID while
-- synchronizing only the approved authoritative tax fields.
INSERT INTO public.tax_rates AS existing (
  id,
  country_code,
  province_code,
  province_name,
  tax_name,
  gst_rate,
  pst_rate,
  qst_rate,
  hst_rate,
  combined_rate,
  effective_from,
  effective_to,
  status
)
VALUES
  ('2de42d35-9f03-4ef2-b4e5-f6f9925820c6', 'CA', 'AB', 'Alberta', 'GST', 5.000, 0.000, 0.000, 0.000, 5.000, DATE '2026-01-01', NULL, 'active'),
  ('33f6e802-35fb-488d-a6db-bae3633fd445', 'CA', 'BC', 'British Columbia', 'GST/PST', 5.000, 7.000, 0.000, 0.000, 12.000, DATE '2026-01-01', NULL, 'active'),
  ('5dd6b225-9b29-4518-8458-d910f0a6bce2', 'CA', 'MB', 'Manitoba', 'GST/PST', 5.000, 7.000, 0.000, 0.000, 12.000, DATE '2026-01-01', NULL, 'active'),
  ('292a2417-2f05-4006-86c1-e5b862c12443', 'CA', 'NB', 'New Brunswick', 'HST', 0.000, 0.000, 0.000, 15.000, 15.000, DATE '2026-01-01', NULL, 'active'),
  ('a5856855-42e5-439e-a503-efeec6d0ca69', 'CA', 'NL', 'Newfoundland and Labrador', 'HST', 0.000, 0.000, 0.000, 15.000, 15.000, DATE '2026-01-01', NULL, 'active'),
  ('d0f63cbf-be28-40f4-864d-5f041cc65eac', 'CA', 'NS', 'Nova Scotia', 'HST', 0.000, 0.000, 0.000, 14.000, 14.000, DATE '2026-01-01', NULL, 'active'),
  ('7efb5abf-2b50-4a4c-8851-2bba5d8d1ed5', 'CA', 'NT', 'Northwest Territories', 'GST', 5.000, 0.000, 0.000, 0.000, 5.000, DATE '2026-01-01', NULL, 'active'),
  ('5db7e99c-c012-44e2-9fc4-806f10e91466', 'CA', 'NU', 'Nunavut', 'GST', 5.000, 0.000, 0.000, 0.000, 5.000, DATE '2026-01-01', NULL, 'active'),
  ('761080dd-c431-4710-b75d-b23afc4c306e', 'CA', 'ON', 'Ontario', 'HST', 0.000, 0.000, 0.000, 13.000, 13.000, DATE '2026-01-01', NULL, 'active'),
  ('44ab51fa-90cf-47f6-b957-1099528f0f0e', 'CA', 'PE', 'Prince Edward Island', 'HST', 0.000, 0.000, 0.000, 15.000, 15.000, DATE '2026-01-01', NULL, 'active'),
  ('c2031ad4-6d77-4880-8dd5-7da53baf7119', 'CA', 'QC', 'Quebec', 'GST/QST', 5.000, 0.000, 9.975, 0.000, 14.975, DATE '2026-01-01', NULL, 'active'),
  ('a3e02baf-fbc9-431d-8ee0-93d0f404e88e', 'CA', 'SK', 'Saskatchewan', 'GST/PST', 5.000, 6.000, 0.000, 0.000, 11.000, DATE '2026-01-01', NULL, 'active'),
  ('0dd690cd-ecd4-4056-a182-ab7dc4b15c7a', 'CA', 'YT', 'Yukon', 'GST', 5.000, 0.000, 0.000, 0.000, 5.000, DATE '2026-01-01', NULL, 'active')
ON CONFLICT (country_code, province_code, effective_from)
DO UPDATE SET
  province_name = EXCLUDED.province_name,
  tax_name = EXCLUDED.tax_name,
  gst_rate = EXCLUDED.gst_rate,
  pst_rate = EXCLUDED.pst_rate,
  qst_rate = EXCLUDED.qst_rate,
  hst_rate = EXCLUDED.hst_rate,
  combined_rate = EXCLUDED.combined_rate,
  effective_to = EXCLUDED.effective_to,
  status = EXCLUDED.status
WHERE (
  existing.province_name,
  existing.tax_name,
  existing.gst_rate,
  existing.pst_rate,
  existing.qst_rate,
  existing.hst_rate,
  existing.combined_rate,
  existing.effective_to,
  existing.status
) IS DISTINCT FROM (
  EXCLUDED.province_name,
  EXCLUDED.tax_name,
  EXCLUDED.gst_rate,
  EXCLUDED.pst_rate,
  EXCLUDED.qst_rate,
  EXCLUDED.hst_rate,
  EXCLUDED.combined_rate,
  EXCLUDED.effective_to,
  EXCLUDED.status
);

-- -----------------------------------------------------------------------------
-- Organization-specific defaults: employee skills
-- -----------------------------------------------------------------------------

-- The baseline already provides normalized uniqueness through
-- employee_skills_org_name_unique on (org_id, lower(skill_name)).
CREATE FUNCTION public.seed_default_employee_skills(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.employee_skills (
    org_id,
    skill_name,
    is_active
  )
  SELECT
    p_org_id,
    default_skill.skill_name,
    true
  FROM (
    VALUES
      ('Electrical'),
      ('General Labour'),
      ('Installation'),
      ('Mechanical Assembly'),
      ('MIG Welding'),
      ('Pipe Fitting'),
      ('Polishing'),
      ('Project Management'),
      ('Quality Inspection'),
      ('Stainless Steel Fabrication'),
      ('TIG Welding')
  ) AS default_skill(skill_name)
  ON CONFLICT (org_id, lower(skill_name)) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_default_employee_skills(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.seed_default_employee_skills(uuid)
TO service_role;

CREATE FUNCTION public.seed_employee_skills_after_org_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.seed_default_employee_skills(NEW.id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_employee_skills_after_org_insert()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.seed_employee_skills_after_org_insert()
TO service_role;

CREATE TRIGGER seed_employee_skills_after_org_insert
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.seed_employee_skills_after_org_insert();

-- Backfill organizations that predate this trigger. The seed function is
-- idempotent and does not reactivate, rename, or overwrite an existing skill.
SELECT public.seed_default_employee_skills(organization.id)
FROM public.organizations AS organization;

-- -----------------------------------------------------------------------------
-- Organization-specific defaults already handled by the baseline
-- -----------------------------------------------------------------------------

-- Supplier Price Library categories are already handled by
-- public.seed_supplier_price_categories_for_org(uuid) and the existing
-- seed_supplier_categories_after_org_insert trigger. Do not duplicate them or
-- hardcode organization IDs here.

-- -----------------------------------------------------------------------------
-- Intentional exclusions
-- -----------------------------------------------------------------------------

-- Tags are user-managed organization data, not universal defaults.
-- Roles, statuses, event types, currencies, and supplier-price statuses are
-- represented by schema CHECK constraints rather than reference rows.
-- Organization identity, membership, branding, quotation terms, super admins,
-- and any environment_guard value belong to controlled environment onboarding.
-- Storage buckets and stored documents are configured separately from this
-- static/reference-data migration.

COMMIT;
