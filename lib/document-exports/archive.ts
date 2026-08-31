import "server-only";

import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";

import { exportTypeLabel, manifestCsv } from "./format";
import type { DocumentExportCollection, ExportDocument } from "./types";

export class ExportLimitError extends Error {}
export class StorageObjectError extends Error {}

export type ExportLimits = {
  maxFiles: number;
  maxBytes: number;
  validationConcurrency: number;
  storageRequestTimeoutMs?: number;
  validationTimeoutMs?: number;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getExportLimits(): ExportLimits {
  return {
    maxFiles: positiveInteger(process.env.DOCUMENT_EXPORT_MAX_FILES, 500),
    maxBytes: positiveInteger(process.env.DOCUMENT_EXPORT_MAX_BYTES, 250 * 1024 * 1024),
    // Validation happens before response headers are sent. Keep enough requests in
    // flight that a large export does not spend the whole Function duration here.
    validationConcurrency: positiveInteger(process.env.DOCUMENT_EXPORT_VALIDATION_CONCURRENCY, 24),
    storageRequestTimeoutMs: positiveInteger(process.env.DOCUMENT_EXPORT_STORAGE_TIMEOUT_MS, 20_000),
    validationTimeoutMs: positiveInteger(process.env.DOCUMENT_EXPORT_VALIDATION_TIMEOUT_MS, 90_000),
  };
}

function storageObjectUrl(document: ExportDocument) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new StorageObjectError("Storage is not configured.");
  const objectPath = document.storagePath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/authenticated/${encodeURIComponent(document.bucket)}/${objectPath}`;
}

function storageHeaders(range?: string) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new StorageObjectError("Storage is not configured.");
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    ...(range ? { range } : {}),
  };
}

function responseSize(response: Response) {
  const contentRange = response.headers.get("content-range");
  const rangeTotal = contentRange?.match(/\/(\d+)$/)?.[1];
  const value = rangeTotal ?? response.headers.get("content-length");
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function validateStorageObject(
  document: ExportDocument,
  timeoutMs: number,
  validationSignal: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch(storageObjectUrl(document), {
      method: "GET",
      headers: storageHeaders("bytes=0-0"),
      cache: "no-store",
      signal: AbortSignal.any([validationSignal, AbortSignal.timeout(timeoutMs)]),
    });
  } catch (error) {
    console.error("Document export Storage validation failed", {
      sourceId: document.sourceId,
      bucket: document.bucket,
      error,
    });
    throw new StorageObjectError("A required source document is unavailable.");
  }
  const size = responseSize(response);
  await response.body?.cancel().catch(() => undefined);
  if (!response.ok) {
    console.error("Document export Storage object is missing", {
      sourceId: document.sourceId,
      bucket: document.bucket,
      status: response.status,
    });
    throw new StorageObjectError("A required source document is unavailable.");
  }
  if (size !== null) document.fileSize = size;
}

async function boundedForEach<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  let nextIndex = 0;
  let stopped = false;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!stopped && nextIndex < items.length) {
      const item = items[nextIndex++];
      try {
        await task(item);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  });
  await Promise.all(workers);
}

export async function validateExportSources(
  documents: ExportDocument[],
  limits = getExportLimits(),
) {
  if (documents.length > limits.maxFiles) {
    throw new ExportLimitError("This backup is too large for instant download. Large asynchronous exports will be supported by the next export phase.");
  }
  const metadataBytes = documents.reduce((total, document) => total + (document.fileSize ?? 0), 0);
  if (metadataBytes > limits.maxBytes) {
    throw new ExportLimitError("This backup is too large for instant download. Large asynchronous exports will be supported by the next export phase.");
  }
  const validationSignal = AbortSignal.timeout(limits.validationTimeoutMs ?? 90_000);
  await boundedForEach(
    documents,
    limits.validationConcurrency,
    (document) => validateStorageObject(
      document,
      limits.storageRequestTimeoutMs ?? 20_000,
      validationSignal,
    ),
  );
  const verifiedBytes = documents.reduce((total, document) => total + (document.fileSize ?? 0), 0);
  if (verifiedBytes > limits.maxBytes) {
    throw new ExportLimitError("This backup is too large for instant download. Large asynchronous exports will be supported by the next export phase.");
  }
  return { fileCount: documents.length, totalBytes: verifiedBytes };
}

function documentStream(document: ExportDocument) {
  return Readable.from((async function* () {
    let response: Response;
    try {
      response = await fetch(storageObjectUrl(document), {
        headers: storageHeaders(),
        cache: "no-store",
      });
    } catch (error) {
      console.error("Document export Storage download failed", {
        sourceId: document.sourceId,
        bucket: document.bucket,
        error,
      });
      throw new StorageObjectError("A required source document could not be downloaded.");
    }
    if (!response.ok || !response.body) {
      console.error("Document export Storage download returned an error", {
        sourceId: document.sourceId,
        bucket: document.bucket,
        status: response.status,
      });
      throw new StorageObjectError("A required source document could not be downloaded.");
    }
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  })());
}

function readableDate(dateOnly: string | null) {
  if (!dateOnly) return "Not applicable";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

export function readmeText(collection: DocumentExportCollection) {
  const customers = new Set(collection.documents.map((document) => document.customerId)).size;
  const lines = [
    `Organization: ${collection.organizationName}`,
    `Export Type: ${exportTypeLabel(collection.window.type)}`,
    `Generated At: ${collection.window.snapshotAt}`,
    `Generated By: ${collection.generatedBy}`,
    `Documents: ${collection.documents.length}`,
    `Customers: ${customers}`,
    "Archive Version: 1",
  ];
  if (collection.window.type === "date_range") {
    lines.push(`From: ${readableDate(collection.window.from)}`, `To: ${readableDate(collection.window.to)}`);
  }
  lines.push(
    "",
    "Folder structure:",
    "Customer / Quotation number and revision / Document category / File",
    "",
    "The manifest lists every exported document and the export snapshot cutoff.",
    "Document metadata is selected as of the snapshot time. Object Storage itself is not transactionally snapshotted.",
  );
  return lines.join("\r\n") + "\r\n";
}

export function createArchiveStream(
  collection: DocumentExportCollection,
  rootFolder: string,
  openDocument: (document: ExportDocument) => Readable = documentStream,
) {
  const output = new PassThrough();
  // CRM documents are predominantly PDFs, images, and Office files, which are
  // already compressed. Recompressing them wastes Function CPU and increases the
  // chance of hitting Vercel's execution-duration limit.
  const archive = archiver("zip", { store: true });
  archive.on("warning", (error) => output.destroy(error));
  archive.on("error", (error) => output.destroy(error));
  archive.pipe(output);

  for (const document of collection.documents) {
    archive.append(openDocument(document), { name: document.zipPath, date: new Date(document.documentDate) });
  }
  archive.append(manifestCsv(collection.documents, collection.window.snapshotAt), {
    name: `${rootFolder}/Backup_Manifest.csv`,
  });
  archive.append(readmeText(collection), { name: `${rootFolder}/README.txt` });
  void archive.finalize().catch((error) => output.destroy(error));
  return Readable.toWeb(output) as ReadableStream<Uint8Array>;
}
