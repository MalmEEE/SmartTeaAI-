import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PredictionService } from './prediction.service';

@Controller('predict')
export class PredictionController {
  constructor(private readonly prediction: PredictionService) {}

  @Get()
  predict(@Query('elevation') elevation?: string) {
    if (elevation && !['high', 'medium', 'low'].includes(elevation.toLowerCase())) {
      throw new BadRequestException(
        `Invalid elevation '${elevation}'. Must be one of: high, medium, low`,
      );
    }
    return this.prediction.predict(elevation?.toLowerCase());
  }
}