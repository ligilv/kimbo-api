import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  parseMealRequestSchema,
  type MealParseResult,
  type ParseMealRequest,
} from './meal.schema.js';
import type { VoiceToken } from './meal-analyzer.js';
import { MealsService } from './meals.service.js';

@Controller('meals')
@UseGuards(ThrottlerGuard)
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  @Post('parse')
  @HttpCode(200)
  parse(
    @Body(new ZodValidationPipe(parseMealRequestSchema)) body: ParseMealRequest,
  ): Promise<MealParseResult> {
    return this.meals.parse(body);
  }

  // Shares the 20/minute limit with /parse, so one phone can't mint keys in a loop.
  @Post('voice-token')
  @HttpCode(200)
  voiceToken(): Promise<VoiceToken> {
    return this.meals.voiceToken();
  }
}
