import { Controller, Get, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get('history')
  getHistory() {
    return this.history.getPriceHistory();
  }

  @Get('history/elevation')
  getElevationHistory() {
    return this.history.getElevationHistory();
  }

  @Get('history/weather-economic')
  getWeatherEconomicHistory() {
    return this.history.getWeatherEconomicHistory();
  }

  /** Model performance info — analyst and admin only. */
  @Get('model-info')
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  getModelInfo() {
    return this.history.getModelInfo();
  }

  @Get('history/sentiment')
  @Roles(UserRole.BROKER, UserRole.EXPORTER, UserRole.BUYER, UserRole.ANALYST, UserRole.ADMIN)
  getSentimentHistory() {
    return this.history.getSentimentHistory();
  }
}
