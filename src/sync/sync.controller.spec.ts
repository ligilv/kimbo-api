import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { PrismaService } from '../database/prisma.service.js';
import { SyncModule } from './sync.module.js';

const DEVICE = 'device_abc-123';

const prisma = {
  user: { upsert: vi.fn(), deleteMany: vi.fn() },
  profile: { upsert: vi.fn() },
  mealLog: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  mealItem: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
};

const profile = {
  name: 'Asha',
  goal: 'lose',
  sex: 'female',
  age: 30,
  heightCm: 165,
  weightKg: 70,
  activity: 'light',
  diet: 'veg',
  heightUnit: 'cm',
  weightUnit: 'kg',
};

const item = {
  id: 'item-1',
  name: 'Idli',
  quantity: 3,
  unit: 'piece',
  kcal: 174,
  protein: 6,
  carbs: 36,
  fat: 0.6,
};

const meal = {
  date: '2026-10-04',
  slot: 'breakfast',
  rawText: '3 idlis',
  createdAt: '2026-10-04T08:00:00.000Z',
  updatedAt: '2026-10-04T08:05:00.000Z',
  items: [item, { ...item, id: 'item-2', name: 'Sambar' }],
};

describe('SyncController', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
        SyncModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  describe('x-device-id', () => {
    it('400s when missing', async () => {
      await http().put('/profile').send(profile).expect(400);
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it.each(['short', 'has space in it', 'bad!chars#1', 'x'.repeat(65)])(
      '400s for invalid %j',
      async (id) => {
        await http()
          .get('/meals?from=2026-10-01&to=2026-10-04')
          .set('x-device-id', id)
          .expect(400);
      },
    );
  });

  describe('PUT /profile', () => {
    it('upserts user and profile, 204', async () => {
      await http()
        .put('/profile')
        .set('x-device-id', DEVICE)
        .send(profile)
        .expect(204);
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { id: DEVICE },
        create: { id: DEVICE },
        update: {},
      });
      const data = { ...profile, targetWeightKg: null };
      expect(prisma.profile.upsert).toHaveBeenCalledWith({
        where: { userId: DEVICE },
        create: { userId: DEVICE, ...data },
        update: data,
      });
    });

    it.each([
      { age: 12 },
      { heightCm: 99 },
      { weightKg: 251 },
      { targetWeightKg: 20 },
      { goal: 'bulk' },
      { diet: 'keto' },
    ])('400s for %j', async (patch) => {
      await http()
        .put('/profile')
        .set('x-device-id', DEVICE)
        .send({ ...profile, ...patch })
        .expect(400);
      expect(prisma.profile.upsert).not.toHaveBeenCalled();
    });
  });

  describe('PUT /meals/:id', () => {
    it('upserts the meal and replaces its items in a transaction', async () => {
      prisma.mealLog.findUnique.mockResolvedValueOnce(null);
      await http()
        .put('/meals/meal-1')
        .set('x-device-id', DEVICE)
        .send(meal)
        .expect(204);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const fields = {
        date: meal.date,
        slot: meal.slot,
        rawText: meal.rawText,
        createdAt: new Date(meal.createdAt),
        updatedAt: new Date(meal.updatedAt),
      };
      expect(prisma.mealLog.upsert).toHaveBeenCalledWith({
        where: { id: 'meal-1' },
        create: { id: 'meal-1', userId: DEVICE, ...fields },
        update: fields,
      });
      expect(prisma.mealItem.deleteMany).toHaveBeenCalledWith({
        where: { mealLogId: 'meal-1' },
      });
      expect(prisma.mealItem.createMany).toHaveBeenCalledWith({
        data: [
          { ...item, mealLogId: 'meal-1', position: 0 },
          {
            ...item,
            id: 'item-2',
            name: 'Sambar',
            mealLogId: 'meal-1',
            position: 1,
          },
        ],
      });
    });

    it('skips the write when the stored meal is newer (last-write-wins)', async () => {
      prisma.mealLog.findUnique.mockResolvedValueOnce({
        userId: DEVICE,
        updatedAt: new Date('2026-10-04T09:00:00.000Z'),
      });
      await http()
        .put('/meals/meal-1')
        .set('x-device-id', DEVICE)
        .send(meal)
        .expect(204);
      expect(prisma.mealLog.upsert).not.toHaveBeenCalled();
      expect(prisma.mealItem.deleteMany).not.toHaveBeenCalled();
      expect(prisma.mealItem.createMany).not.toHaveBeenCalled();
    });

    it('applies the write when the stored meal is older', async () => {
      prisma.mealLog.findUnique.mockResolvedValueOnce({
        userId: DEVICE,
        updatedAt: new Date('2026-10-04T08:00:00.000Z'),
      });
      await http()
        .put('/meals/meal-1')
        .set('x-device-id', DEVICE)
        .send(meal)
        .expect(204);
      expect(prisma.mealLog.upsert).toHaveBeenCalled();
    });

    it("404s for another device's meal", async () => {
      prisma.mealLog.findUnique.mockResolvedValueOnce({
        userId: 'someone-else-1',
        updatedAt: new Date(0),
      });
      await http()
        .put('/meals/meal-1')
        .set('x-device-id', DEVICE)
        .send(meal)
        .expect(404);
      expect(prisma.mealLog.upsert).not.toHaveBeenCalled();
    });

    it.each([
      { items: [] },
      { date: '2026-13-01' },
      { date: '04-10-2026' },
      { slot: 'brunch' },
      { createdAt: 'yesterday' },
      { items: [{ ...item, quantity: 0 }] },
      { items: [{ ...item, kcal: -1 }] },
    ])('400s for %j', async (patch) => {
      await http()
        .put('/meals/meal-1')
        .set('x-device-id', DEVICE)
        .send({ ...meal, ...patch })
        .expect(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /meals/:id', () => {
    it('is scoped to the device and idempotent', async () => {
      prisma.mealLog.deleteMany.mockResolvedValue({ count: 0 });
      await http()
        .delete('/meals/meal-1')
        .set('x-device-id', DEVICE)
        .expect(204);
      await http()
        .delete('/meals/meal-1')
        .set('x-device-id', DEVICE)
        .expect(204);
      expect(prisma.mealLog.deleteMany).toHaveBeenCalledWith({
        where: { id: 'meal-1', userId: DEVICE },
      });
    });
  });

  describe('DELETE /me', () => {
    it("deletes only this device's user (profile and meals cascade), 204", async () => {
      await http().delete('/me').set('x-device-id', DEVICE).expect(204);
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({
        where: { id: DEVICE },
      });
    });

    it('400s without a device id', async () => {
      await http().delete('/me').expect(400);
      expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /meals', () => {
    it('queries the inclusive range in order and maps rows to the PUT shape', async () => {
      prisma.mealLog.findMany.mockResolvedValueOnce([
        {
          id: 'meal-1',
          userId: DEVICE,
          date: meal.date,
          slot: meal.slot,
          rawText: meal.rawText,
          createdAt: new Date(meal.createdAt),
          updatedAt: new Date(meal.updatedAt),
          items: [{ ...item, mealLogId: 'meal-1', position: 0 }],
        },
      ]);
      const res = await http()
        .get('/meals?from=2026-10-01&to=2026-10-04')
        .set('x-device-id', DEVICE)
        .expect(200);

      expect(prisma.mealLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: DEVICE,
          date: { gte: '2026-10-01', lte: '2026-10-04' },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: { items: { orderBy: { position: 'asc' } } },
      });
      expect(res.body).toEqual([{ id: 'meal-1', ...meal, items: [item] }]);
    });

    it.each([
      '',
      '?from=2026-10-01',
      '?from=2026-10-05&to=2026-10-04',
      '?from=2025-01-01&to=2026-10-04',
      '?from=2026-02-30&to=2026-03-01',
    ])('400s for query %j', async (qs) => {
      await http().get(`/meals${qs}`).set('x-device-id', DEVICE).expect(400);
      expect(prisma.mealLog.findMany).not.toHaveBeenCalled();
    });
  });
});
