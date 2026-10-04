import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MealAnalyzer } from './meal-analyzer.js';
import { parseMealRequestSchema } from './meal.schema.js';
import { MealsService } from './meals.service.js';

const valid = {
  items: [
    {
      name: 'Chapati',
      quantity: 2,
      unit: 'piece',
      kcal: 240,
      protein: 6,
      carbs: 36,
      fat: 7,
    },
  ],
  clarification: null,
};

function setup(...outputs: unknown[]) {
  const analyze = vi.fn<MealAnalyzer['analyze']>();
  for (const o of outputs)
    analyze.mockResolvedValueOnce(
      typeof o === 'string' ? o : JSON.stringify(o),
    );
  return { analyze, service: new MealsService({ analyze }) };
}

describe('MealsService', () => {
  it('passes valid output through', async () => {
    const { service, analyze } = setup(valid);
    await expect(service.parse('2 chapatis')).resolves.toEqual(valid);
    expect(analyze).toHaveBeenCalledWith('2 chapatis');
  });

  it.each([
    [
      'clarification',
      { items: [], clarification: 'How many chapatis did you have?' },
    ],
    ['non-food', { items: [], clarification: null }],
  ])('passes %s shape through', async (_, output) => {
    const { service } = setup(output);
    await expect(service.parse('x')).resolves.toEqual(output);
  });

  it('retries once on invalid output, then succeeds', async () => {
    const { service, analyze } = setup('not json', valid);
    await expect(service.parse('2 chapatis')).resolves.toEqual(valid);
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it('throws 502 after two invalid outputs', async () => {
    const negative = {
      items: [{ ...valid.items[0], kcal: -1 }],
      clarification: null,
    };
    const { service, analyze } = setup(negative, {
      items: valid.items,
      clarification: 'How many?',
    });
    await expect(service.parse('x')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it('maps analyzer failures to 502 without leaking details', async () => {
    const analyze = vi
      .fn()
      .mockRejectedValue(new Error('secret upstream detail'));
    const err = await new MealsService({ analyze })
      .parse('x')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect((err as Error).message).not.toContain('secret');
  });
});

describe('ZodValidationPipe(parseMealRequestSchema)', () => {
  const pipe = new ZodValidationPipe(parseMealRequestSchema);

  it('trims valid text', () => {
    expect(pipe.transform({ text: '  2 idlis  ' })).toEqual({
      text: '2 idlis',
    });
  });

  it.each([
    [{ text: '' }],
    [{ text: '   ' }],
    [{ text: 'a'.repeat(501) }],
    [{}],
    [{ text: 5 }],
  ])('rejects %j', (body) => {
    expect(() => pipe.transform(body)).toThrow(BadRequestException);
  });
});
