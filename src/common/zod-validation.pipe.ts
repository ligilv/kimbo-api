import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i) => i.message));
    }
    return result.data;
  }
}
