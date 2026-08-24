import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { MlModel } from './ml-model.entity';
import { Prediction } from './prediction.entity';
import { Recommendation } from './recommendation.entity';

@Module({
  imports:     [TypeOrmModule.forFeature([MlModel, Prediction, Recommendation])],
  providers:   [PredictionService],
  controllers: [PredictionController],
  exports:     [PredictionService],
})
export class PredictionModule {}
