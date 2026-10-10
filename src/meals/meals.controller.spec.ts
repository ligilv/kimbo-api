import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MEAL_ANALYZER, type MealAnalyzer } from './meal-analyzer.js';
import { MealsModule } from './meals.module.js';

describe('POST /meals/parse', () => {
  let app: INestApplication;
  const analyze = vi.fn<MealAnalyzer['analyze']>();
  const voiceToken = vi.fn<MealAnalyzer['voiceToken']>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [MealsModule] })
      .overrideProvider(MEAL_ANALYZER)
      .useValue({ analyze, voiceToken })
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
          guessed: false,
        },
      ],
      clarification: null,
    };
    analyze.mockResolvedValueOnce(JSON.stringify(body));
    await request(app.getHttpServer())
      .post('/meals/parse')
      .send({ text: ' 3 idlis ' })
      .expect(200, body);
    expect(analyze).toHaveBeenCalledWith({ text: '3 idlis' });
  });

  it('passes an image request through', async () => {
    const body = { items: [], clarification: 'Could you retake the photo?' };
    analyze.mockResolvedValueOnce(JSON.stringify(body));
    const image = { base64: 'aGVsbG8=', mimeType: 'image/jpeg' };
    await request(app.getHttpServer())
      .post('/meals/parse')
      .send({ image })
      .expect(200, body);
    expect(analyze).toHaveBeenLastCalledWith({ image });
  });

  it.each([
    [{ text: '' }],
    [{}],
    [{ image: { base64: 'aGVsbG8=', mimeType: 'image/webp' } }],
  ])('returns 400 for %j', async (payload) => {
    await request(app.getHttpServer())
      .post('/meals/parse')
      .send(payload)
      .expect(400);
  });

  it('hands out a voice token, and hides SDK errors behind a 502', async () => {
    const token = {
      token: 'auth_tokens/abc',
      model: 'gemini-3.5-transcribe-live',
    };
    voiceToken.mockResolvedValueOnce(token);
    await request(app.getHttpServer())
      .post('/meals/voice-token')
      .expect(200, token);
    voiceToken.mockRejectedValueOnce(new Error('quota'));
    await request(app.getHttpServer()).post('/meals/voice-token').expect(502);
  });
});
