import { Controller, Get, Post, HttpCode, UseGuards } from '@nestjs/common';
import { DataPipelineService } from './data-pipeline.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user.entity';

@Controller('pipeline')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ANALYST, UserRole.ADMIN)
export class DataPipelineController {
  constructor(private readonly pipeline: DataPipelineService) {}

  @Post('run')
  @HttpCode(202)
  async run() {
    // Fire and forget — returns immediately; check /pipeline/status for result
    this.pipeline.runPipeline().catch(() => {});
    return { status: 'started', message: 'Pipeline triggered — poll /api/pipeline/status' };
  }

  @Get('status')
  status() {
    const last = this.pipeline.getLastRun();
    if (!last) return { status: 'never_run' };
    return last;
  }
}
