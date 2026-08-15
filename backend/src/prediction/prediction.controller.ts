import { Controller, Get } from '@nestjs/common';
import { PredictionService } from './prediction.service';

@Controller('predict')
export class PredictionController {
  constructor(private readonly prediction: PredictionService) {}

  @Get()
  predict() {
    return this.prediction.predict();
  }
}
