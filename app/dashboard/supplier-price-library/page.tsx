import { redirect } from "next/navigation";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canViewSupplierPriceLibrary } from "@/lib/supplier-price-library/access";
import { LibraryDashboard } from "./library-dashboard";
export default async function SupplierPriceLibraryPage() { const session = await verifyOrgSession(); if (!session) redirect("/login"); if (!canViewSupplierPriceLibrary(session.role)) redirect("/dashboard"); return <LibraryDashboard />; }
