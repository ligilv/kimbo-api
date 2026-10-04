import { Module } from '@nestjs/common';
import {
  GeminiInsightWriter,
  INSIGHT_WRITER,
} from './gemini-insight-writer.js';
import { InsightsController } from './insights.controller.js';

@Module({
  controllers: [InsightsController],
  providers: [{ provide: INSIGHT_WRITER, useClass: GeminiInsightWriter }],
})
export class InsightsModule {}
