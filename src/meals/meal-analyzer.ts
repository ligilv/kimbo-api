import type { ParseMealRequest } from './meal.schema.js';

/** Turns a meal description and/or photo into the model's raw JSON text. Validation happens in MealsService. */
export interface MealAnalyzer {
  analyze(meal: ParseMealRequest): Promise<string>;
}

export const MEAL_ANALYZER = Symbol('MEAL_ANALYZER');
