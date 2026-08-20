ALTER TABLE public.quotation_customer_documents
  ADD COLUMN document_type text DEFAULT 'quotation'::text NOT NULL;

ALTER TABLE public.quotation_customer_documents
  ADD CONSTRAINT quotation_customer_documents_document_type_check
  CHECK (document_type = ANY (ARRAY['quotation'::text, 'work_order'::text]));

COMMENT ON COLUMN public.quotation_customer_documents.document_type IS
  'Customer-facing document terminology. Quotation numbering and all underlying quotation data remain shared.';
