import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { INSIGHT_WRITER, type InsightWriter } from './gemini-insight-writer.js';
import {
  insightRequestSchema,
  type InsightRequest,
  type InsightResponse,
} from './insight.schema.js';

// The app caches the answer for the day, so a low limit is plenty.
@Controller('insights')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class InsightsController {
  constructor(@Inject(INSIGHT_WRITER) private readonly writer: InsightWriter) {}

  @Post()
  @HttpCode(200)
  async create(
    @Body(new ZodValidationPipe(insightRequestSchema)) body: InsightRequest,
  ): Promise<InsightResponse> {
    return { insight: await this.writer.write(body) };
  }
}
