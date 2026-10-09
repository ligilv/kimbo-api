import { z } from 'zod';

// 20 MB of base64 ≈ 15 MB file: covers scanned multi-page lab PDFs. Gemini takes
// up to 50 MB per PDF; this cap is for the free Render instance's 512 MB of memory.
// The app checks the same number before uploading (src/features/reports/reportApi.ts).
export const MAX_FILE_BASE64_LENGTH = 20 * 1024 * 1024;

export const extractReportRequestSchema = z.object({
  file: z.object(
    {
      base64: z
        .string({ error: 'file.base64 must be a string' })
        .min(1, 'file.base64 must not be empty')
        .max(
          MAX_FILE_BASE64_LENGTH,
          'file is too large (max ~15 MB); please send a smaller file',
        )
        .regex(
          /^[A-Za-z0-9+/]+={0,2}$/,
          'file.base64 must be plain base64 (no data: prefix)',
        ),
      mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf'], {
        error:
          "file.mimeType must be 'image/jpeg', 'image/png' or 'application/pdf'",
      }),
    },
    { error: 'file must be an object' },
  ),
});
export type ExtractReportRequest = z.infer<typeof extractReportRequestSchema>;

const reportValueSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  low: z.number().nullable(),
  high: z.number().nullable(),
  status: z.enum(['low', 'high', 'normal']),
  note: z.string().nullable(),
  why: z.array(z.string()).max(3),
  foods: z.object({
    veg: z.array(z.string()).max(4),
    nonveg: z.array(z.string()).max(4),
  }),
});

const reportShape = z.object({
  notAReport: z.boolean(),
  takenOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  values: z.array(reportValueSchema),
});

export const reportResultSchema = reportShape.refine(
  (r) => !r.notAReport || r.values.length === 0,
  'values must be empty when the file is not a report',
);
export type ReportResult = z.infer<typeof reportResultSchema>;

// ponytail: Gemini accepts only a JSON Schema subset; zod still enforces the dropped keywords.
const UNSUPPORTED_KEYWORDS = ['minLength', 'pattern'];

const { $schema: _dialect, ...reportJsonSchema } = z.toJSONSchema(reportShape, {
  override: ({ jsonSchema }) => {
    for (const key of UNSUPPORTED_KEYWORDS) {
      delete (jsonSchema as Record<string, unknown>)[key];
    }
  },
});
export { reportJsonSchema };
