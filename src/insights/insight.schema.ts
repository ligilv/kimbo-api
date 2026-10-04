import { z } from 'zod';

const kcal = z.number().min(0).max(20_000);
const grams = z.number().min(0).max(2_000);

// A summary the app works out from its own meals; no raw meal text is sent.
export const insightRequestSchema = z.object({
  range: z.union([z.literal(7), z.literal(30)]),
  goal: z.enum(['lose', 'maintain', 'gain']),
  diet: z.enum(['veg', 'egg', 'nonveg', 'vegan']),
  targets: z.object({ calories: kcal, proteinG: grams }),
  daysLogged: z.number().int().min(0).max(31),
  avgKcal: kcal,
  avgProtein: grams,
  onTargetDays: z.number().int().min(0).max(31),
  proteinHitDays: z.number().int().min(0).max(31),
  slotKcal: z.object({
    breakfast: kcal,
    lunch: kcal,
    snacks: kcal,
    dinner: kcal,
  }),
  topFoods: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        count: z.number().int().min(1).max(500),
      }),
    )
    .max(10),
});
export type InsightRequest = z.infer<typeof insightRequestSchema>;

export type InsightResponse = { insight: string };
