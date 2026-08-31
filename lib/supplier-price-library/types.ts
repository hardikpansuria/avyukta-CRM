export type SupplierPriceSupplier = {
  id: string;
  company_name: string;
  contact_person: string | null;
  company_address: string | null;
  email_address: string | null;
  contact_number: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type SupplierPriceCategory = {
  id: string;
  category_name: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  material_count?: number;
};

export type SupplierPriceMaterial = {
  id: string;
  material_code: string;
  category_id: string;
  material_description: string;
  size_specification: string | null;
  grade_material_type: string | null;
  unit_of_measure: string;
  notes: string | null;
  is_archived: boolean;
  duplicated_from_material_id: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; category_name: string; is_archived?: boolean } | null;
  supplier_count?: number;
  latest_price_date?: string | null;
  lowest_latest_prices?: Array<{ currency: string; unit_price: number }>;
};

export type SupplierPriceRecord = {
  id: string;
  material_id: string;
  supplier_id: string;
  supplier_quote_number: string | null;
  unit_price: number;
  currency: string;
  quote_date: string;
  price_valid_until: string | null;
  notes: string | null;
  record_status: "active" | "superseded" | "archived";
  supersedes_price_record_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: { id: string; company_name: string; is_archived?: boolean } | null;
  added_by?: { full_name: string | null; email: string | null } | null;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
