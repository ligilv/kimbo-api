import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  MEAL_ANALYZER,
  type MealAnalyzer,
  type VoiceToken,
} from './meal-analyzer.js';
import {
  mealParseResultSchema,
  type MealParseResult,
  type ParseMealRequest,
} from './meal.schema.js';

const MAX_ATTEMPTS = 2; // first try + one retry on invalid output

@Injectable()
export class MealsService {
  private readonly logger = new Logger(MealsService.name);

  constructor(@Inject(MEAL_ANALYZER) private readonly analyzer: MealAnalyzer) {}

  async parse(meal: ParseMealRequest): Promise<MealParseResult> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const raw = await this.callAnalyzer(meal);
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

  async voiceToken(): Promise<VoiceToken> {
    try {
      return await this.analyzer.voiceToken();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Voice token failed: ${(error as Error).message}`);
      throw new BadGatewayException('Voice is unavailable right now.');
    }
  }

  private async callAnalyzer(meal: ParseMealRequest): Promise<string> {
    try {
      return await this.analyzer.analyze(meal);
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
