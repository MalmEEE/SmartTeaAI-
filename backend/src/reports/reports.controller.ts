import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('report')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BROKER, UserRole.EXPORTER, UserRole.ANALYST, UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('pdf')
  async getPdf(@Res() res: Response) {
    const pdf = await this.reports.generateReport();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="smartteaai_report_${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}