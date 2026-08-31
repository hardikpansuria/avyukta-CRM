UPDATE public.tax_rates
SET
  tax_name = 'HST',
  gst_rate = 0.000,
  pst_rate = 0.000,
  qst_rate = 0.000,
  hst_rate = 13.000,
  combined_rate = 13.000,
  effective_from = DATE '2010-07-01',
  effective_to = NULL,
  status = 'active'
WHERE id = '761080dd-c431-4710-b75d-b23afc4c306e'
  AND country_code = 'CA'
  AND province_code = 'ON';

INSERT INTO public.tax_rates (
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
SELECT
  '761080dd-c431-4710-b75d-b23afc4c306e',
  'CA',
  'ON',
  'Ontario',
  'HST',
  0.000,
  0.000,
  0.000,
  13.000,
  13.000,
  DATE '2010-07-01',
  NULL,
  'active'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tax_rates
  WHERE country_code = 'CA'
    AND province_code = 'ON'
    AND effective_from = DATE '2010-07-01'
);
