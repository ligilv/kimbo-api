import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Meal photos and lab reports arrive as base64 JSON (~20 MB max, enforced in report.schema.ts); Express defaults to 100 kb.
  app.useBodyParser('json', { limit: '22mb' });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
