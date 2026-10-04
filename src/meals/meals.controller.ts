import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  parseMealRequestSchema,
  type MealParseResult,
  type ParseMealRequest,
} from './meal.schema.js';
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
    return this.meals.parse(body.text);
  }
}
