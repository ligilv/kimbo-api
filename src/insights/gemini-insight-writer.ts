import { GoogleGenAI } from '@google/genai';
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InsightRequest } from './insight.schema.js';

export const INSIGHT_WRITER = Symbol('INSIGHT_WRITER');
export interface InsightWriter {
  write(summary: InsightRequest): Promise<string>;
}

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash';
const ATTEMPT = { timeout: 8_000, maxRetries: 0 };
const MAX_LENGTH = 400;

export const INSIGHT_SYSTEM_PROMPT = `You are Kimbo, a warm nutrition buddy in a food-logging app used mostly in India.
You get plain facts about the user's last 7 or 30 days. Write 2 short sentences, under 45 words in total:
1. The single most useful observation, taken only from the facts. Prefer the biggest gap (e.g. protein reached on few days, eating well under or over the calorie target).
2. One small, practical suggestion with everyday Indian food that fits their diet.
Rules: never say a target was reached or "great" unless the facts show it. Don't invent numbers or foods they ate. Kind and encouraging, never judgemental. No medical claims, no markdown, at most one emoji.
If fewer than 3 days were logged, just say there isn't much to go on yet and encourage logging.`;

const DIETS: Record<InsightRequest['diet'], string> = {
  veg: 'vegetarian (no meat, fish or eggs)',
  egg: 'vegetarian plus eggs',
  nonveg: 'eats meat, fish and eggs',
  vegan: 'vegan (no dairy, eggs or meat)',
};

// Facts as sentences, so the model repeats them instead of misreading raw numbers.
export function insightFacts(s: InsightRequest): string {
  const biggest = (Object.entries(s.slotKcal) as [string, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0][0];
  const calorieGap = s.avgKcal - s.targets.calories;
  return [
    `Period: last ${s.range} days. Days with meals logged: ${s.daysLogged}.`,
    `Goal: ${s.goal} weight. Diet: ${DIETS[s.diet]}.`,
    `Calories: average ${s.avgKcal} kcal a day on logged days, target ${s.targets.calories} (${
      calorieGap >= 0 ? `${calorieGap} over` : `${-calorieGap} under`
    }). Within 10% of target on ${s.onTargetDays} of ${s.daysLogged} logged days.`,
    `Protein: average ${s.avgProtein} g a day, target ${s.targets.proteinG} g. Target reached on ${s.proteinHitDays} of ${s.daysLogged} logged days.`,
    `Biggest meal by calories: ${biggest}.`,
    `Most logged foods: ${
      s.topFoods.map((f) => `${f.name} (${f.count})`).join(', ') || 'none'
    }.`,
  ].join('\n');
}

// ponytail: the Gemini setup mirrors GeminiMealAnalyzer; share a helper if a third caller appears.
@Injectable()
export class GeminiInsightWriter implements InsightWriter {
  private client?: GoogleGenAI;
  private readonly logger = new Logger(GeminiInsightWriter.name);

  constructor(private readonly config: ConfigService) {}

  async write(summary: InsightRequest): Promise<string> {
    const main = this.config.get<string>('GEMINI_MODEL') || DEFAULT_MODEL;
    const backup =
      this.config.get<string>('GEMINI_FALLBACK_MODEL') ||
      DEFAULT_FALLBACK_MODEL;
    let text: string;
    try {
      text = await this.ask(main, summary);
    } catch (error) {
      if (error instanceof BadGatewayException || backup === main) throw error;
      this.logger.warn(
        `${main} failed (${(error as Error).message}); trying ${backup}`,
      );
      text = await this.ask(backup, summary);
    }
    const insight = text.trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH);
    if (!insight) throw new ServiceUnavailableException('Empty insight');
    return insight;
  }

  private async ask(model: string, summary: InsightRequest) {
    const interaction = await this.getClient().interactions.create(
      {
        model,
        system_instruction: INSIGHT_SYSTEM_PROMPT,
        input: insightFacts(summary),
        store: false,
      },
      ATTEMPT,
    );
    return interaction.output_text ?? '';
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = this.config.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new BadGatewayException(
          'Insights are unavailable: GEMINI_API_KEY is not configured on the server.',
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }
}
