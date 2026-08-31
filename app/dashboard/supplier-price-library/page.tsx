import { redirect } from "next/navigation";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { LibraryDashboard } from "./library-dashboard";
export default async function SupplierPriceLibraryPage() { const session = await verifyOrgSession(); if (!session) redirect("/login"); return <LibraryDashboard />; }
