import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MealsModule } from './meals/meals.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MealsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
