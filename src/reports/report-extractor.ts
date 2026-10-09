import type { ExtractReportRequest } from './report.schema.js';

/** Turns a lab report photo/PDF into the model's raw JSON text. Validation happens in ReportsService. */
export interface ReportExtractor {
  extract(report: ExtractReportRequest): Promise<string>;
}

export const REPORT_EXTRACTOR = Symbol('REPORT_EXTRACTOR');
