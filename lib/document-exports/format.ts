import type { DocumentExportType, DocumentExportWindow, ExportDocument } from "./types";

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const shortGeneratedIdPattern = /[-_][0-9a-f]{8}(?=\.[^.]+$)/i;

export class ExportValidationError extends Error {}

export function safePathPart(value: unknown, fallback = "Document", maxLength = 100) {
  const safe = String(value ?? "")
    .normalize("NFKC")
    .replace(uuidPattern, "")
    .replace(shortGeneratedIdPattern, "")
    .replace(/[\/\\:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\.\.+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, maxLength)
    .replace(/[._-]+$/g, "");
  return safe || fallback;
}

function parseDateOnly(value: unknown, field: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ExportValidationError(`${field} must be a valid date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ExportValidationError(`${field} must be a valid date.`);
  }
  return value;
}

export function parseExportWindow(body: unknown, snapshotAt = new Date().toISOString()): DocumentExportWindow {
  if (!body || typeof body !== "object") {
    throw new ExportValidationError("A backup type is required.");
  }
  const value = body as Record<string, unknown>;
  if (value.type === "full") {
    return { type: "full", from: null, to: null, fromUtc: null, toUtc: null, snapshotAt };
  }
  if (value.type !== "date_range") {
    throw new ExportValidationError("Backup type must be full or date range.");
  }
  const from = parseDateOnly(value.from, "From date");
  const to = parseDateOnly(value.to, "To date");
  if (from > to) throw new ExportValidationError("From date cannot be after To date.");
  return {
    type: "date_range",
    from,
    to,
    fromUtc: `${from}T00:00:00.000Z`,
    toUtc: `${to}T23:59:59.999Z`,
    snapshotAt,
  };
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function compactDate(dateOnly: string) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return `${day}${months[month - 1]}${year}`;
}

export function formatExportFilename(
  organizationName: string,
  window: Pick<DocumentExportWindow, "type" | "from" | "to">,
) {
  const organization = safePathPart(organizationName, "Organization", 80);
  if (window.type === "full") return `${organization}_fullbackup.zip`;
  if (!window.from || !window.to) throw new ExportValidationError("Date range is incomplete.");
  return `${organization}_${compactDate(window.from)}_${compactDate(window.to)}_backup.zip`;
}

export function attachmentContentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\\r\n]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function withDuplicateSuffix(path: string, count: number) {
  if (count === 1) return path;
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  const hasExtension = dot > slash;
  const base = hasExtension ? path.slice(0, dot) : path;
  const extension = hasExtension ? path.slice(dot) : "";
  return `${base}_${count}${extension}`;
}

export function assignZipPaths(documents: ExportDocument[], rootFolder: string) {
  const customerGroups = new Map<string, Map<string, { id: string; code: string | null }[]>>();
  for (const document of documents) {
    const base = safePathPart(document.customerName, "Customer");
    const byBase = customerGroups.get(base) ?? new Map();
    if (!byBase.has(document.customerId)) {
      byBase.set(document.customerId, [{ id: document.customerId, code: document.customerCode }]);
    }
    customerGroups.set(base, byBase);
  }

  const customerFolder = new Map<string, string>();
  for (const [base, identities] of customerGroups) {
    const rows = [...identities.keys()].sort().map((id) => {
      const sample = documents.find((document) => document.customerId === id)!;
      return { id, code: sample.customerCode };
    });
    const usedFolders = new Set<string>();
    rows.forEach((row, index) => {
      const suffix = rows.length === 1
        ? ""
        : row.code
          ? `_${safePathPart(row.code, String(index + 1), 30)}`
          : index === 0
            ? ""
            : `_${index + 1}`;
      const initial = `${base}${suffix}`;
      let folder = initial;
      let collision = 2;
      while (usedFolders.has(folder.toLocaleLowerCase())) folder = `${initial}_${collision++}`;
      usedFolders.add(folder.toLocaleLowerCase());
      customerFolder.set(row.id, folder);
    });
  }

  const collisions = new Map<string, number>();
  for (const document of documents) {
    const customer = customerFolder.get(document.customerId) ?? "Customer";
    const quotation = document.quotationNumber
      ? `Quotation_${safePathPart(document.quotationNumber, "Unknown", 60)}_Rev-${document.revisionNumber ?? 0}`
      : `Purchase_Order_${safePathPart(document.poNumber, "Unallocated", 60)}`;
    const category = safePathPart(document.category, "Documents", 60);
    const original = safePathPart(document.originalFilename, "Document", 140);
    const businessFile = document.invoiceNumber
      ? `Invoice_${safePathPart(document.invoiceNumber, "Invoice", 60)}_${original}`
      : document.poNumber && document.category === "Customer_PO"
        ? `PO_${safePathPart(document.poNumber, "PO", 60)}_${original}`
        : original;
    const candidate = `${rootFolder}/${customer}/${quotation}/${category}/${businessFile}`;
    const key = candidate.toLocaleLowerCase();
    const count = (collisions.get(key) ?? 0) + 1;
    collisions.set(key, count);
    document.zipPath = withDuplicateSuffix(candidate, count);
  }
  return documents;
}

export function csvCell(value: unknown) {
  const text = String(value ?? "")
    .replace(uuidPattern, "[internal identifier removed]")
    .replace(shortGeneratedIdPattern, "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function manifestCsv(documents: ExportDocument[], snapshotAt: string) {
  const headers = [
    "Customer", "Customer Business Identifier", "Quotation Number", "Revision Number",
    "Job Number", "PO Number", "Invoice Number", "Document Category", "Original Filename",
    "ZIP Path", "Document Date", "File Size", "Export Snapshot Time",
  ];
  const rows = documents.map((document) => [
    document.customerName, document.customerCode, document.quotationNumber,
    document.revisionNumber, document.jobNumber, document.poNumber, document.invoiceNumber,
    document.category, document.originalFilename, document.zipPath, document.documentDate,
    document.fileSize, snapshotAt,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function exportTypeLabel(type: DocumentExportType) {
  return type === "full" ? "Full Backup" : "Date Range";
}
