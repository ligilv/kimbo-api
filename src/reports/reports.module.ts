import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { GeminiReportExtractor } from './gemini-report-extractor.js';
import { MockReportExtractor } from './mock-report-extractor.js';
import { REPORT_EXTRACTOR } from './report-extractor.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  // 10 requests/minute per IP: reports are big and slow to read.
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    {
      provide: REPORT_EXTRACTOR,
      // AI_PROVIDER=mock returns a canned report, for building the app without a key.
      useFactory: (config: ConfigService) =>
        config.get<string>('AI_PROVIDER') === 'mock'
          ? new MockReportExtractor()
          : new GeminiReportExtractor(config),
      inject: [ConfigService],
    },
  ],
})
export class ReportsModule {}
