import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MOCK_REPORT } from './mock-report-extractor.js';
import { REPORT_EXTRACTOR, type ReportExtractor } from './report-extractor.js';
import { ReportsModule } from './reports.module.js';

describe('POST /reports/extract', () => {
  let app: INestApplication;
  const extract = vi.fn<ReportExtractor['extract']>();
  const file = { base64: 'aGVsbG8=', mimeType: 'application/pdf' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ReportsModule],
    })
      .overrideProvider(REPORT_EXTRACTOR)
      .useValue({ extract })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('returns 200 with the validated report', async () => {
    extract.mockResolvedValueOnce(JSON.stringify(MOCK_REPORT));
    const res = await request(app.getHttpServer())
      .post('/reports/extract')
      .send({ file })
      .expect(200, MOCK_REPORT);
    expect(res.body.values).toHaveLength(24);
    expect(extract).toHaveBeenCalledWith({ file });
  });

  it.each([
    ['not json'],
    [JSON.stringify({ ...MOCK_REPORT, takenOn: '1 Oct 2026' })],
    [JSON.stringify({ ...MOCK_REPORT, notAReport: true })],
  ])('returns 502 for an invalid model reply %#', async (raw) => {
    extract.mockResolvedValueOnce(raw);
    const res = await request(app.getHttpServer())
      .post('/reports/extract')
      .send({ file })
      .expect(502);
    expect(res.body.message).toBe(
      'Could not read the report. Please try again.',
    );
  });

  it.each([
    [{}],
    [{ file: { base64: 'aGVsbG8=', mimeType: 'image/webp' } }],
    [
      {
        file: {
          base64: 'data:application/pdf;base64,aGVsbG8=',
          mimeType: 'application/pdf',
        },
      },
    ],
  ])('returns 400 for %j', async (payload) => {
    extract.mockClear();
    await request(app.getHttpServer())
      .post('/reports/extract')
      .send(payload)
      .expect(400);
    expect(extract).not.toHaveBeenCalled();
  });
});
