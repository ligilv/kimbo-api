import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  extractReportRequestSchema,
  type ExtractReportRequest,
  type ReportResult,
} from './report.schema.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
@UseGuards(ThrottlerGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('extract')
  @HttpCode(200)
  extract(
    @Body(new ZodValidationPipe(extractReportRequestSchema))
    body: ExtractReportRequest,
  ): Promise<ReportResult> {
    return this.reports.extract(body);
  }
}
