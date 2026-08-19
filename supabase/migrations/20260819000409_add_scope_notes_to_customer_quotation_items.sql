alter table public.quotation_customer_document_items
  add column notes_html text,
  add column notes_text text;

comment on column public.quotation_customer_document_items.notes_html is
  'Sanitized rich-text notes displayed beneath this scope on the customer-facing quotation.';

comment on column public.quotation_customer_document_items.notes_text is
  'Plain-text representation of the customer-facing scope notes.';
