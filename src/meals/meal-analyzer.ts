/** Turns a free-text meal description into the model's raw JSON text. Validation happens in MealsService. */
export interface MealAnalyzer {
  analyze(text: string): Promise<string>;
}

export const MEAL_ANALYZER = Symbol('MEAL_ANALYZER');
