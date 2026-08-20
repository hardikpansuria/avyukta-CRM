ALTER TABLE public.quotation_generated_documents
  ADD COLUMN document_type text DEFAULT 'quotation'::text NOT NULL;

ALTER TABLE public.quotation_generated_documents
  ADD CONSTRAINT quotation_generated_documents_document_type_check
  CHECK (document_type = ANY (ARRAY['quotation'::text, 'work_order'::text]));

COMMENT ON COLUMN public.quotation_generated_documents.document_type IS
  'Immutable document type snapshot captured when the customer PDF was generated.';

-- Before document_type was snapshotted, the usual flow stored a quotation first
-- and then a work order. Preserve existing rows as quotations and identify the
-- newest generated PDF as a work order when the current draft is a work order.
WITH latest_generated_documents AS (
  SELECT DISTINCT ON (generated.customer_document_id)
    generated.id,
    customer_document.document_type
  FROM public.quotation_generated_documents AS generated
  INNER JOIN public.quotation_customer_documents AS customer_document
    ON customer_document.id = generated.customer_document_id
   AND customer_document.quotation_id = generated.quotation_id
   AND customer_document.org_id = generated.org_id
  ORDER BY
    generated.customer_document_id,
    generated.generated_at DESC,
    generated.id DESC
)
UPDATE public.quotation_generated_documents AS generated
SET document_type = latest.document_type
FROM latest_generated_documents AS latest
WHERE generated.id = latest.id
  AND latest.document_type = 'work_order';

CREATE INDEX idx_quotation_generated_documents_latest_by_type
  ON public.quotation_generated_documents
  (org_id, quotation_id, document_type, generated_at DESC);
