// ── Export types ──

export type ReportType =
  | 'clientes'
  | 'recargas'
  | 'botellones'
  | 'fidelidad'
  | 'cliente-ficha';

export type ExportFormat = 'pdf' | 'excel';

export type ExportResult = {
  base64: string;
  filename: string;
};

export type BusinessInfo = {
  businessName: string;
  logoBase64: string | null;
  date: string;
};
