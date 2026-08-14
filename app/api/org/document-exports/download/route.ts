import { NextResponse } from "next/server";

import { hasOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  createArchiveStream,
  ExportLimitError,
  StorageObjectError,
  validateExportSources,
} from "@/lib/document-exports/archive";
import {
  attachmentContentDisposition,
  ExportValidationError,
  formatExportFilename,
  parseExportWindow,
} from "@/lib/document-exports/format";
import {
  collectOrganizationDocuments,
  DocumentCollectionError,
} from "@/lib/document-exports/collector";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json(
    { error, code },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  const snapshotAt = new Date().toISOString();
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401, "UNAUTHORIZED");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400, "INVALID_REQUEST");
  }

  if (body && typeof body === "object") {
    const unexpected = Object.keys(body).filter((key) => !["type", "from", "to"].includes(key));
    if (unexpected.length > 0) {
      return jsonError("The request contains unsupported fields.", 400, "INVALID_REQUEST");
    }
  }

  let window;
  try {
    window = parseExportWindow(body, snapshotAt);
  } catch (error) {
    if (error instanceof ExportValidationError) {
      return jsonError(error.message, 400, "INVALID_REQUEST");
    }
    return jsonError("Invalid export request.", 400, "INVALID_REQUEST");
  }

  const action = window.type === "full" ? "full_backup" : "date_range_export";
  const [canView, canExport] = await Promise.all([
    hasOrgPermission(session, "document_exports", "view"),
    hasOrgPermission(session, "document_exports", action),
  ]);
  if (!canView || !canExport) {
    return jsonError("You do not have permission to download this backup.", 403, "ACCESS_DENIED");
  }

  try {
    const collection = await collectOrganizationDocuments(
      createAdminClient(),
      session,
      window,
    );
    if (collection.documents.length === 0) {
      return jsonError(
        window.type === "date_range"
          ? "No documents were found for the selected date range."
          : "No documents were found for this organization.",
        404,
        "NO_DOCUMENTS",
      );
    }
    await validateExportSources(collection.documents);
    const filename = formatExportFilename(collection.organizationName, window);
    const rootFolder = filename.slice(0, -4);
    return new Response(createArchiveStream(collection, rootFolder), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": attachmentContentDisposition(filename),
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ExportLimitError) {
      return jsonError(error.message, 413, "EXPORT_TOO_LARGE");
    }
    if (error instanceof StorageObjectError) {
      return jsonError(
        "A required document is unavailable, so no incomplete backup was created. Please contact an administrator.",
        409,
        "SOURCE_UNAVAILABLE",
      );
    }
    if (error instanceof DocumentCollectionError) {
      return jsonError("Unable to prepare the document backup.", 500, "COLLECTION_FAILED");
    }
    console.error("Unexpected document export failure", error);
    return jsonError("Unable to create the document backup.", 500, "EXPORT_FAILED");
  }
}
