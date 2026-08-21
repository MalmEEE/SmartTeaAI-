import { Controller, Get, UseGuards } from '@nestjs/common';
import { ExplainabilityService } from './explainability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('explain')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExplainabilityController {
  constructor(private readonly explain: ExplainabilityService) {}

  /** SHAP explainability summary — analyst and admin only. */
  @Get()
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  getShapSummary() {
    return this.explain.getShapSummary();
  }
}
