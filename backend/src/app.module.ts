import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataPipelineModule } from './data-pipeline/data-pipeline.module';
import { PredictionModule } from './prediction/prediction.module';
import { HistoryModule } from './history/history.module';
import { ExplainabilityModule } from './explainability/explainability.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DataPipelineModule,
    PredictionModule,
    HistoryModule,
    ExplainabilityModule,
  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}
