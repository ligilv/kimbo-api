import { GoogleGenAI } from '@google/genai';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MealAnalyzer } from './meal-analyzer.js';
import { MEAL_SYSTEM_PROMPT } from './meal-prompt.js';
import { mealParseJsonSchema, type ParseMealRequest } from './meal.schema.js';

// Models: https://ai.google.dev/gemini-api/docs/models
// Main model, plus a lighter backup used when the main one is overloaded or
// failing (Google returns 503 "high demand" during spikes). Both overridable in .env.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash';

// Each attempt gets one quick try, no SDK retries, so main + backup together
// finish inside the app's 15 s wait instead of the SDK retrying for a minute.
const TEXT_ATTEMPT = { timeout: 6_000, maxRetries: 0 };
// Photos take longer to analyse, so each model gets 15 s (up to ~30 s total with the backup).
const IMAGE_ATTEMPT = { timeout: 15_000, maxRetries: 0 };

@Injectable()
export class GeminiMealAnalyzer implements MealAnalyzer {
  private client?: GoogleGenAI;

  constructor(private readonly config: ConfigService) {}

  private readonly logger = new Logger(GeminiMealAnalyzer.name);

  async analyze(meal: ParseMealRequest): Promise<string> {
    const main = this.config.get<string>('GEMINI_MODEL') || DEFAULT_MODEL;
    const backup =
      this.config.get<string>('GEMINI_FALLBACK_MODEL') ||
      DEFAULT_FALLBACK_MODEL;
    try {
      return await this.ask(main, meal);
    } catch (error) {
      if (error instanceof BadGatewayException || backup === main) throw error; // e.g. missing key
      this.logger.warn(
        `${main} failed (${(error as Error).message}); trying ${backup}`,
      );
      return this.ask(backup, meal);
    }
  }

  private async ask(
    model: string,
    { text, image }: ParseMealRequest,
  ): Promise<string> {
    // Structured output via the Interactions API: https://ai.google.dev/gemini-api/docs/structured-output
    const interaction = await this.getClient().interactions.create(
      {
        model,
        system_instruction: MEAL_SYSTEM_PROMPT,
        // Image + text input: https://ai.google.dev/gemini-api/docs/image-understanding
        input: image
          ? [
              {
                type: 'text',
                text: text
                  ? `User's note: ${text}`
                  : 'Estimate the food in this photo.',
              },
              { type: 'image', data: image.base64, mime_type: image.mimeType },
            ]
          : (text ?? ''),
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: mealParseJsonSchema,
        },
        store: false,
      },
      image ? IMAGE_ATTEMPT : TEXT_ATTEMPT,
    );
    return interaction.output_text ?? '';
  }

  // Lazy so the server boots without a key; the request fails with a clear 502 instead.
  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = this.config.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new BadGatewayException(
          'Meal analysis is unavailable: GEMINI_API_KEY is not configured on the server.',
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }
}
