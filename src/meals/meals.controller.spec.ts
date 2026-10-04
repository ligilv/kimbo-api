import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MEAL_ANALYZER } from './meal-analyzer.js';
import { MealsModule } from './meals.module.js';

describe('POST /meals/parse', () => {
  let app: INestApplication;
  const analyze = vi.fn<(text: string) => Promise<string>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [MealsModule] })
      .overrideProvider(MEAL_ANALYZER)
      .useValue({ analyze })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('returns 200 with parsed items', async () => {
    const body = {
      items: [
        {
          name: 'Idli',
          quantity: 3,
          unit: 'piece',
          kcal: 174,
          protein: 6,
          carbs: 36,
          fat: 0.6,
        },
      ],
      clarification: null,
    };
    analyze.mockResolvedValueOnce(JSON.stringify(body));
    await request(app.getHttpServer())
      .post('/meals/parse')
      .send({ text: ' 3 idlis ' })
      .expect(200, body);
    expect(analyze).toHaveBeenCalledWith('3 idlis');
  });

  it('returns 400 for an invalid body', async () => {
    await request(app.getHttpServer())
      .post('/meals/parse')
      .send({ text: '' })
      .expect(400);
  });
});
