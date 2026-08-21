import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PredictionModule } from '../prediction/prediction.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [PredictionModule, HistoryModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}