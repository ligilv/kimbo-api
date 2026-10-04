import { z } from 'zod';

// ~4 MB of base64 ≈ 3 MB image. The app sends ~1024px JPEGs (100–400 KB).
export const MAX_IMAGE_BASE64_LENGTH = 4 * 1024 * 1024;

export const parseMealRequestSchema = z
  .object({
    text: z
      .string({ error: 'text must be a string' })
      .trim()
      .max(500, 'text must be at most 500 characters')
      .optional(),
    image: z
      .object(
        {
          base64: z
            .string({ error: 'image.base64 must be a string' })
            .min(1, 'image.base64 must not be empty')
            .max(
              MAX_IMAGE_BASE64_LENGTH,
              'image is too large (max ~3 MB); please send a smaller photo',
            )
            .regex(
              /^[A-Za-z0-9+/]+={0,2}$/,
              'image.base64 must be plain base64 (no data: prefix)',
            ),
          mimeType: z.enum(['image/jpeg', 'image/png'], {
            error: "image.mimeType must be 'image/jpeg' or 'image/png'",
          }),
        },
        { error: 'image must be an object' },
      )
      .optional(),
  })
  .refine((body) => body.image || body.text, {
    message: 'text must not be empty (or send an image)',
    path: ['text'],
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
