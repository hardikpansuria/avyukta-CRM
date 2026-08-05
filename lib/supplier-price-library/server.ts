import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  canAdminSupplierPriceLibrary,
  canEditSupplierPriceLibrary,
  canViewSupplierPriceLibrary,
} from "@/lib/supplier-price-library/access";

export type SupplierPriceSession = NonNullable<
  Awaited<ReturnType<typeof verifyOrgSession>>
>;

export function jsonError(error: string, status: number, details?: object) {
  return NextResponse.json({ error, ...details }, { status });
}

export async function requireSupplierPriceSession(
  permission: "view" | "edit" | "admin" = "view",
) {
  const session = await verifyOrgSession();
  if (!session) return { response: jsonError("Unauthorized", 401) } as const;

  const allowed =
    permission === "admin"
      ? canAdminSupplierPriceLibrary(session.role)
      : permission === "edit"
        ? canEditSupplierPriceLibrary(session.role)
        : canViewSupplierPriceLibrary(session.role);

  if (!allowed) return { response: jsonError("Forbidden", 403) } as const;
  return { session } as const;
}

export function text(value: unknown, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  return required ? result : result || null;
}

export function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function safeSearch(value: string) {
  return value
    .replace(/[(),"]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .trim();
}

export function pagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function isDuplicateError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || /duplicate|unique/i.test(error?.message ?? "");
}

export function logDatabaseError(context: string, error: unknown) {
  const safe = error as { code?: string; message?: string } | null;
  console.error(context, { code: safe?.code, message: safe?.message });
}

export function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
