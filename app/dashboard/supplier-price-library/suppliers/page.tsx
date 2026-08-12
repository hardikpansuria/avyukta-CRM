import { redirect } from "next/navigation";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { getSupplierPricePermissions } from "@/lib/auth/permissions";
import { SuppliersClient } from "./suppliers-client";
export default async function SuppliersPage(){const session=await verifyOrgSession();if(!session)redirect("/login");return <SuppliersClient permissions={await getSupplierPricePermissions(session)}/>}
