export const SUPPLIER_PRICE_VIEW_ROLES = new Set([
  "admin",
  "org_admin",
  "sales",
  "accountant",
  "accounts",
  "production",
]);

export const SUPPLIER_PRICE_EDIT_ROLES = new Set([
  "admin",
  "org_admin",
  "sales",
]);

export const SUPPLIER_PRICE_ADMIN_ROLES = new Set(["admin", "org_admin"]);

export function canViewSupplierPriceLibrary(role: string) {
  return SUPPLIER_PRICE_VIEW_ROLES.has(role);
}

export function canEditSupplierPriceLibrary(role: string) {
  return SUPPLIER_PRICE_EDIT_ROLES.has(role);
}

export function canAdminSupplierPriceLibrary(role: string) {
  return SUPPLIER_PRICE_ADMIN_ROLES.has(role);
}

export type SupplierPricePermissions = {
  canView: boolean;
  canEdit: boolean;
  canAdmin: boolean;
};

export function supplierPricePermissions(role: string): SupplierPricePermissions {
  return {
    canView: canViewSupplierPriceLibrary(role),
    canEdit: canEditSupplierPriceLibrary(role),
    canAdmin: canAdminSupplierPriceLibrary(role),
  };
}
