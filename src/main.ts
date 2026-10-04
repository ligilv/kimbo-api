import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Meal photos arrive as base64 JSON (~4 MB max, enforced in meal.schema.ts); Express defaults to 100 kb.
  app.useBodyParser('json', { limit: '5mb' });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
