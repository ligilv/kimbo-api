import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { GeminiMealAnalyzer } from './gemini-meal-analyzer.js';
import { MEAL_ANALYZER } from './meal-analyzer.js';
import { MealsController } from './meals.controller.js';
import { MealsService } from './meals.service.js';

@Module({
  // 20 requests/minute per IP so a demo can't burn the Gemini free tier.
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
  controllers: [MealsController],
  providers: [
    MealsService,
    { provide: MEAL_ANALYZER, useClass: GeminiMealAnalyzer },
  ],
})
export class MealsModule {}
