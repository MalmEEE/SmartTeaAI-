import { Controller, Get } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller()
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

  @Get('model-info')
  getModelInfo() {
    return this.history.getModelInfo();
  }
}
