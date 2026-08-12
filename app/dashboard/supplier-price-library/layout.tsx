import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function SupplierPriceLibraryLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="supplier_price_library">{children}</ModuleAccessLayout>;
}
