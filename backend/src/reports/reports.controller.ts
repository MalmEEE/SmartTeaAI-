import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BROKER, UserRole.EXPORTER, UserRole.ANALYST, UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('forecast')
  async getForecastReport(@Res() res: Response) {
    const pdf = await this.reports.generateReport();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="smartteaai_forecast_${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }

  @Get('history')
  getHistoryCsv(@Res() res: Response) {
    const csv = this.reports.generateHistoryCsv();
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="smartteaai_history_${new Date().toISOString().slice(0, 10)}.csv"`,
    });
    res.send(csv);
  }

  @Get('model')
  async getModelReport(@Res() res: Response) {
    const pdf = await this.reports.generateModelReport();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="smartteaai_model_${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
