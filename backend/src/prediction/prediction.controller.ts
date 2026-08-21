import {
  Controller, Get, Post, Body, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

const VALID_ELEVATIONS = ['high', 'medium', 'low'];

@Controller('predict')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PredictionController {
  constructor(private readonly prediction: PredictionService) {}

  /** Returns next-month price forecast (national avg or per-elevation). Accessible to all roles. */
  @Get()
  predict(@Query('elevation') elevation?: string) {
    if (elevation && !VALID_ELEVATIONS.includes(elevation.toLowerCase())) {
      throw new BadRequestException(
        `Invalid elevation '${elevation}'. Must be one of: ${VALID_ELEVATIONS.join(', ')}`,
      );
    }
    return this.prediction.predict(elevation?.toLowerCase());
  }

  /** What-if simulation — broker, exporter, buyer, analyst, admin only. */
  @Post('whatif')
  @Roles(UserRole.BROKER, UserRole.EXPORTER, UserRole.BUYER, UserRole.ANALYST, UserRole.ADMIN)
  whatIf(
    @Body() body: { overrides: Record<string, number>; elevation?: string },
  ) {
    if (!body?.overrides || Object.keys(body.overrides).length === 0) {
      throw new BadRequestException(
        'Provide at least one feature override, e.g. { "overrides": { "usd_lkr_avg": 10 } }',
      );
    }
    if (body.elevation && !VALID_ELEVATIONS.includes(body.elevation.toLowerCase())) {
      throw new BadRequestException(`Invalid elevation. Must be: ${VALID_ELEVATIONS.join(', ')}`);
    }
    return this.prediction.whatIf(body.overrides, body.elevation?.toLowerCase());
  }
}
