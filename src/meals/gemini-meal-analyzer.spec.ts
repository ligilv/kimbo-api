import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiMealAnalyzer } from './gemini-meal-analyzer.js';

const create = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    interactions = { create };
  },
}));

const configWith = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const env = {
  GEMINI_API_KEY: 'test-key',
  GEMINI_MODEL: 'main-model',
  GEMINI_FALLBACK_MODEL: 'backup-model',
};

describe('GeminiMealAnalyzer', () => {
  beforeEach(() => {
    create.mockReset();
  });

  it('uses the main model when it answers', async () => {
    create.mockResolvedValueOnce({ output_text: '{"ok":1}' });
    await expect(new GeminiMealAnalyzer(configWith(env)).analyze('rice')).resolves.toBe('{"ok":1}');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe('main-model');
    // One quick attempt, no SDK retries.
    expect(create.mock.calls[0][1]).toEqual({ timeout: 6000, maxRetries: 0 });
  });

  it('falls back to the backup model when the main one fails', async () => {
    create
      .mockRejectedValueOnce(new Error('503 high demand'))
      .mockResolvedValueOnce({ output_text: '{"ok":2}' });
    await expect(new GeminiMealAnalyzer(configWith(env)).analyze('rice')).resolves.toBe('{"ok":2}');
    expect(create.mock.calls.map(call => call[0].model)).toEqual(['main-model', 'backup-model']);
  });

  it('gives up when both models fail', async () => {
    create.mockImplementation(() => Promise.reject(new Error('503 high demand')));
    await expect(new GeminiMealAnalyzer(configWith(env)).analyze('rice')).rejects.toThrow('503');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not try the backup when the key is missing', async () => {
    const analyzer = new GeminiMealAnalyzer(configWith({ GEMINI_MODEL: 'main-model' }));
    await expect(analyzer.analyze('rice')).rejects.toBeInstanceOf(BadGatewayException);
    expect(create).not.toHaveBeenCalled();
  });
});
