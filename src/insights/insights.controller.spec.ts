import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { INSIGHT_WRITER, type InsightWriter } from './gemini-insight-writer.js';
import { InsightsModule } from './insights.module.js';

const summary = {
  range: 7,
  goal: 'gain',
  diet: 'nonveg',
  targets: { calories: 2620, proteinG: 105 },
  daysLogged: 6,
  avgKcal: 2310,
  avgProtein: 74,
  onTargetDays: 3,
  proteinHitDays: 1,
  slotKcal: { breakfast: 3100, lunch: 5200, snacks: 900, dinner: 4600 },
  topFoods: [{ name: 'Chapati', count: 9 }],
};

describe('POST /insights', () => {
  let app: INestApplication;
  const write = vi.fn<InsightWriter['write']>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
        InsightsModule,
      ],
    })
      .overrideProvider(INSIGHT_WRITER)
      .useValue({ write })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => {
    write.mockReset();
  });

  it('returns the written insight for a valid summary', async () => {
    write.mockResolvedValueOnce('Protein landed on 1 of 6 days.');
    await request(app.getHttpServer())
      .post('/insights')
      .send(summary)
      .expect(200, { insight: 'Protein landed on 1 of 6 days.' });
    expect(write).toHaveBeenCalledWith(summary);
  });

  it.each([
    [{ ...summary, range: 14 }],
    [{ ...summary, diet: 'keto' }],
    [{ ...summary, topFoods: Array(11).fill({ name: 'Dal', count: 1 }) }],
    [{}],
  ])('returns 400 and never calls Gemini for %j', async (payload) => {
    await request(app.getHttpServer())
      .post('/insights')
      .send(payload)
      .expect(400);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('insightFacts', () => {
  it('spells out gaps so the model cannot misread them', async () => {
    const { insightFacts } = await import('./gemini-insight-writer.js');
    const facts = insightFacts(summary as never);
    expect(facts).toContain('Target reached on 1 of 6 logged days');
    expect(facts).toContain(
      'average 2310 kcal a day on logged days, target 2620 (310 under)',
    );
    expect(facts).toContain('Biggest meal by calories: lunch.');
    expect(facts).toContain('Chapati (9)');
  });
});
