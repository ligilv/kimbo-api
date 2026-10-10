import type { ParseMealRequest } from './meal.schema.js';

/** Turns a meal description and/or photo into the model's raw JSON text. Validation happens in MealsService. */
export interface MealAnalyzer {
  analyze(meal: ParseMealRequest): Promise<string>;
  /** A one-use key, valid ~1 minute, that lets the app stream speech straight to Gemini's live transcriber. */
  voiceToken(): Promise<VoiceToken>;
}

export type VoiceToken = { token: string; model: string };

export const MEAL_ANALYZER = Symbol('MEAL_ANALYZER');
