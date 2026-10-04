import { z } from 'zod';

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 400;

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'date must be a real calendar day');
const timestamp = z.iso.datetime({
  offset: true,
  error: 'timestamps must be ISO 8601 strings',
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  goal: z.enum(['lose', 'maintain', 'gain']),
  sex: z.enum(['male', 'female', 'unspecified']),
  age: z.number().int().min(13).max(100),
  heightCm: z.number().min(100).max(230),
  weightKg: z.number().min(30).max(250),
  targetWeightKg: z.number().min(30).max(250).nullish(),
  activity: z.enum(['sedentary', 'light', 'moderate', 'very']),
  diet: z.enum(['veg', 'egg', 'nonveg', 'vegan']),
  heightUnit: z.string().min(1).max(16),
  weightUnit: z.string().min(1).max(16),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const entityIdSchema = z.string().min(1).max(64);

const mealItemSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(50),
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

export const mealSchema = z.object({
  date: isoDay,
  slot: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
  rawText: z.string().max(2000),
  createdAt: timestamp,
  updatedAt: timestamp,
  items: z.array(mealItemSchema).min(1, 'items must not be empty').max(100),
});
export type MealInput = z.infer<typeof mealSchema>;
export type MealOutput = MealInput & { id: string };

export const mealRangeSchema = z
  .object({ from: isoDay, to: isoDay })
  .refine((q) => q.from <= q.to, 'from must be on or before to')
  .refine(
    (q) => (Date.parse(q.to) - Date.parse(q.from)) / DAY_MS <= MAX_RANGE_DAYS,
    `range must be at most ${MAX_RANGE_DAYS} days`,
  );
export type MealRange = z.infer<typeof mealRangeSchema>;
