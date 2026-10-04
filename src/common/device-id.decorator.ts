import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** The anonymous device id from the `x-device-id` header; 400 if missing/invalid. */
export const DeviceId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const value = ctx.switchToHttp().getRequest<Request>().headers[
      'x-device-id'
    ];
    if (typeof value !== 'string' || !DEVICE_ID.test(value)) {
      throw new BadRequestException(
        'x-device-id header must be 8-64 chars of [A-Za-z0-9_-]',
      );
    }
    return value;
  },
);
