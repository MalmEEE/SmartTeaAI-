import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
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

  @Post('whatif')
  whatIf(
    @Body() body: { overrides: Record<string, number>; elevation?: string },
  ) {
    if (!body?.overrides || Object.keys(body.overrides).length === 0) {
      throw new BadRequestException('Provide at least one feature override, e.g. { "overrides": { "usd_lkr_avg": 10 } }');
    }
    if (body.elevation && !['high', 'medium', 'low'].includes(body.elevation.toLowerCase())) {
      throw new BadRequestException(`Invalid elevation. Must be: high, medium, low`);
    }
    return this.prediction.whatIf(body.overrides, body.elevation?.toLowerCase());
  }
}