import { Controller, Get, Query } from '@nestjs/common';
import { PredictionService } from './prediction.service';

@Controller('predict')
export class PredictionController {
  constructor(private readonly prediction: PredictionService) {}

  @Get()
  predict(@Query('elevation') elevation?: string) {
    return this.prediction.predict(elevation);
  }
}
