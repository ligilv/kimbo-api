import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type {
  MealInput,
  MealOutput,
  MealRange,
  ProfileInput,
} from './sync.schema.js';

// The database is in Sydney (ap-southeast-2), so opening a connection can take
// longer than Prisma's 2 s default wait. Six queries per save also need headroom.
const TRANSACTION_TIMING = { maxWait: 10_000, timeout: 15_000 };

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureUser(id: string) {
    return this.prisma.user.upsert({
      where: { id },
      create: { id },
      update: {},
    });
  }

  async putProfile(userId: string, profile: ProfileInput): Promise<void> {
    await this.ensureUser(userId);
    const data = { ...profile, targetWeightKg: profile.targetWeightKg ?? null };
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async putMeal(userId: string, id: string, meal: MealInput): Promise<void> {
    const createdAt = new Date(meal.createdAt);
    const updatedAt = new Date(meal.updatedAt);
    // ponytail: two first-time writes of the same new id racing → one gets a
    // unique-violation 500 and the app retries; add ON CONFLICT handling if seen.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: userId },
        create: { id: userId },
        update: {},
      });
      const existing = await tx.mealLog.findUnique({
        where: { id },
        select: { userId: true, updatedAt: true },
      });
      if (existing && existing.userId !== userId) throw new NotFoundException();
      // Last-write-wins on the app's clock: offline queues can replay out of order.
      if (existing && existing.updatedAt > updatedAt) return;

      const fields = {
        date: meal.date,
        slot: meal.slot,
        rawText: meal.rawText,
        createdAt,
        updatedAt,
      };
      await tx.mealLog.upsert({
        where: { id },
        create: { id, userId, ...fields },
        update: fields,
      });
      await tx.mealItem.deleteMany({ where: { mealLogId: id } });
      await tx.mealItem.createMany({
        data: meal.items.map((item, position) => ({
          ...item,
          mealLogId: id,
          position,
        })),
      });
    }, TRANSACTION_TIMING);
  }

  async deleteMeal(userId: string, id: string): Promise<void> {
    await this.ensureUser(userId);
    // deleteMany scoped by user: idempotent, and never touches another device's meal.
    await this.prisma.mealLog.deleteMany({ where: { id, userId } });
  }

  // The schema cascades from users to profiles, meals and items.
  // deleteMany: deleting an unknown device is a no-op, so retries are safe.
  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { id: userId } });
  }

  async listMeals(
    userId: string,
    { from, to }: MealRange,
  ): Promise<MealOutput[]> {
    await this.ensureUser(userId);
    const rows = await this.prisma.mealLog.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return rows.map((m) => ({
      id: m.id,
      date: m.date,
      slot: m.slot as MealOutput['slot'],
      rawText: m.rawText,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      items: m.items.map(
        ({ id, name, quantity, unit, kcal, protein, carbs, fat }) => ({
          id,
          name,
          quantity,
          unit,
          kcal,
          protein,
          carbs,
          fat,
        }),
      ),
    }));
  }
}
