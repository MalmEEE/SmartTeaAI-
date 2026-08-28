import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

const ALL_ROLES = [UserRole.FARMER, UserRole.BROKER, UserRole.EXPORTER, UserRole.BUYER, UserRole.ANALYST, UserRole.ADMIN];
const NON_FARMER_ROLES = [UserRole.BROKER, UserRole.EXPORTER, UserRole.BUYER, UserRole.ANALYST, UserRole.ADMIN];

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('forecast')
  @Roles(...ALL_ROLES)
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
  @Roles(...ALL_ROLES)
  getHistoryCsv(@Res() res: Response) {
    const csv = this.reports.generateHistoryCsv();
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="smartteaai_history_${new Date().toISOString().slice(0, 10)}.csv"`,
    });
    res.send(csv);
  }

  @Get('model')
  @Roles(...NON_FARMER_ROLES)
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
