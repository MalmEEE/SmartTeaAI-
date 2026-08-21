import { Module } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';

@Module({
  providers:   [PredictionService],
  controllers: [PredictionController],
  exports: [PredictionService]
})
export class PredictionModule {}
