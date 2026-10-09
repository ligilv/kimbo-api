import { GoogleGenAI } from '@google/genai';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportExtractor } from './report-extractor.js';
import { REPORT_SYSTEM_PROMPT } from './report-prompt.js';
import {
  reportJsonSchema,
  type ExtractReportRequest,
} from './report.schema.js';

// Same models as meals; both overridable in .env.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash';

// A full report is a lot to read, so each model gets 25 s, no SDK retries.
const ATTEMPT = { timeout: 25_000, maxRetries: 0 };

@Injectable()
export class GeminiReportExtractor implements ReportExtractor {
  private client?: GoogleGenAI;

  constructor(private readonly config: ConfigService) {}

  private readonly logger = new Logger(GeminiReportExtractor.name);

  async extract(report: ExtractReportRequest): Promise<string> {
    const main = this.config.get<string>('GEMINI_MODEL') || DEFAULT_MODEL;
    const backup =
      this.config.get<string>('GEMINI_FALLBACK_MODEL') ||
      DEFAULT_FALLBACK_MODEL;
    try {
      return await this.ask(main, report);
    } catch (error) {
      if (error instanceof BadGatewayException || backup === main) throw error; // e.g. missing key
      this.logger.warn(
        `${main} failed (${(error as Error).message}); trying ${backup}`,
      );
      return this.ask(backup, report);
    }
  }

  private async ask(
    model: string,
    { file }: ExtractReportRequest,
  ): Promise<string> {
    const interaction = await this.getClient().interactions.create(
      {
        model,
        system_instruction: REPORT_SYSTEM_PROMPT,
        // PDFs go in as a document part: https://ai.google.dev/gemini-api/docs/document-processing
        input: [
          { type: 'text', text: 'Read this lab report.' },
          file.mimeType === 'application/pdf'
            ? { type: 'document', data: file.base64, mime_type: file.mimeType }
            : { type: 'image', data: file.base64, mime_type: file.mimeType },
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: reportJsonSchema,
        },
        store: false,
      },
      ATTEMPT,
    );
    return interaction.output_text ?? '';
  }

  // Lazy so the server boots without a key; the request fails with a clear 502 instead.
  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = this.config.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new BadGatewayException(
          'Report reading is unavailable: GEMINI_API_KEY is not configured on the server.',
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }
}
