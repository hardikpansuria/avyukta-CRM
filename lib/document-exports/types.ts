export type DocumentExportType = "full" | "date_range";

export type DocumentExportWindow = {
  type: DocumentExportType;
  from: string | null;
  to: string | null;
  fromUtc: string | null;
  toUtc: string | null;
  snapshotAt: string;
};

export type ExportDocument = {
  sourceId: string;
  customerId: string;
  customerName: string;
  customerCode: string | null;
  quotationNumber: string | null;
  revisionNumber: number | null;
  jobNumber: string | null;
  poNumber: string | null;
  invoiceNumber: string | null;
  category: string;
  originalFilename: string;
  bucket: string;
  storagePath: string;
  documentDate: string;
  fileSize: number | null;
  mimeType: string | null;
  zipPath: string;
};

export type DocumentExportCollection = {
  organizationName: string;
  generatedBy: string;
  window: DocumentExportWindow;
  documents: ExportDocument[];
};
