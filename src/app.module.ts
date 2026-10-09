import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { InsightsModule } from './insights/insights.module.js';
import { MealsModule } from './meals/meals.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SyncModule } from './sync/sync.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MealsModule,
    SyncModule,
    InsightsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
