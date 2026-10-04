import { z } from 'zod';

export const parseMealRequestSchema = z.object({
  text: z
    .string({ error: 'text must be a string' })
    .trim()
    .min(1, 'text must not be empty')
    .max(500, 'text must be at most 500 characters'),
});
export type ParseMealRequest = z.infer<typeof parseMealRequestSchema>;

const mealItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

const mealParseShape = z.object({
  items: z.array(mealItemSchema),
  clarification: z.string().min(1).nullable(),
});

export const mealParseResultSchema = mealParseShape.refine(
  (r) => r.clarification === null || r.items.length === 0,
  'items must be empty when asking for clarification',
);
export type MealParseResult = z.infer<typeof mealParseResultSchema>;

// ponytail: Gemini accepts only a JSON Schema subset; zod still enforces the dropped keywords.
const UNSUPPORTED_KEYWORDS = ['exclusiveMinimum', 'minLength'];

const { $schema: _dialect, ...mealParseJsonSchema } = z.toJSONSchema(
  mealParseShape,
  {
    override: ({ jsonSchema }) => {
      for (const key of UNSUPPORTED_KEYWORDS) {
        delete (jsonSchema as Record<string, unknown>)[key];
      }
    },
  },
);
export { mealParseJsonSchema };
