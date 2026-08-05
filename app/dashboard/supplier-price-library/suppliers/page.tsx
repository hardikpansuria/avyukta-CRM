import { redirect } from "next/navigation";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canViewSupplierPriceLibrary, supplierPricePermissions } from "@/lib/supplier-price-library/access";
import { SuppliersClient } from "./suppliers-client";
export default async function SuppliersPage(){const session=await verifyOrgSession();if(!session)redirect("/login");if(!canViewSupplierPriceLibrary(session.role))redirect("/dashboard");return <SuppliersClient permissions={supplierPricePermissions(session.role)}/>}
