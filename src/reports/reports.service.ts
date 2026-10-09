import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { REPORT_EXTRACTOR, type ReportExtractor } from './report-extractor.js';
import {
  reportResultSchema,
  type ExtractReportRequest,
  type ReportResult,
} from './report.schema.js';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(REPORT_EXTRACTOR) private readonly extractor: ReportExtractor,
  ) {}

  // ponytail: no retry on invalid output (unlike meals): each attempt can take ~50 s with the backup model.
  async extract(report: ExtractReportRequest): Promise<ReportResult> {
    const raw = await this.callExtractor(report);
    const result = reportResultSchema.safeParse(safeJsonParse(raw));
    if (result.success) return result.data;
    this.logger.warn(`Invalid model output: ${result.error.message}`);
    throw new BadGatewayException(
      'Could not read the report. Please try again.',
    );
  }

  private async callExtractor(report: ExtractReportRequest): Promise<string> {
    try {
      return await this.extractor.extract(report);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Report extractor failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('Report reading failed. Please try again.');
    }
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
