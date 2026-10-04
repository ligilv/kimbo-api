import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { MEAL_ANALYZER, type MealAnalyzer } from './meal-analyzer.js';
import { mealParseResultSchema, type MealParseResult } from './meal.schema.js';

const MAX_ATTEMPTS = 2; // first try + one retry on invalid output

@Injectable()
export class MealsService {
  private readonly logger = new Logger(MealsService.name);

  constructor(@Inject(MEAL_ANALYZER) private readonly analyzer: MealAnalyzer) {}

  async parse(text: string): Promise<MealParseResult> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const raw = await this.callAnalyzer(text);
      const result = mealParseResultSchema.safeParse(safeJsonParse(raw));
      if (result.success) return result.data;
      this.logger.warn(
        `Invalid model output (attempt ${attempt}): ${result.error.message}`,
      );
    }
    throw new BadGatewayException(
      'Could not understand the meal analysis. Please try again.',
    );
  }

  private async callAnalyzer(text: string): Promise<string> {
    try {
      return await this.analyzer.analyze(text);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Meal analyzer failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('Meal analysis failed. Please try again.');
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
