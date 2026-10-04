import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { DeviceId } from '../common/device-id.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  entityIdSchema,
  mealRangeSchema,
  mealSchema,
  profileSchema,
  type MealInput,
  type MealOutput,
  type MealRange,
  type ProfileInput,
} from './sync.schema.js';
import { SyncService } from './sync.service.js';

const idPipe = new ZodValidationPipe(entityIdSchema);

// Uses the global ThrottlerModule registered in MealsModule, but with its own
// (higher) limit: sync calls are frequent and don't cost Gemini quota.
@Controller()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Put('profile')
  @HttpCode(204)
  putProfile(
    @DeviceId() deviceId: string,
    @Body(new ZodValidationPipe(profileSchema)) body: ProfileInput,
  ): Promise<void> {
    return this.sync.putProfile(deviceId, body);
  }

  @Get('meals')
  listMeals(
    @DeviceId() deviceId: string,
    @Query(new ZodValidationPipe(mealRangeSchema)) range: MealRange,
  ): Promise<MealOutput[]> {
    return this.sync.listMeals(deviceId, range);
  }

  @Put('meals/:id')
  @HttpCode(204)
  putMeal(
    @DeviceId() deviceId: string,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(mealSchema)) body: MealInput,
  ): Promise<void> {
    return this.sync.putMeal(deviceId, id, body);
  }

  // Reset in the app: removes this device's profile and meals (cascade).
  @Delete('me')
  @HttpCode(204)
  deleteMe(@DeviceId() deviceId: string): Promise<void> {
    return this.sync.deleteUser(deviceId);
  }

  @Delete('meals/:id')
  @HttpCode(204)
  deleteMeal(
    @DeviceId() deviceId: string,
    @Param('id', idPipe) id: string,
  ): Promise<void> {
    return this.sync.deleteMeal(deviceId, id);
  }
}
