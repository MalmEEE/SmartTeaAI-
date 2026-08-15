// explainability/explainability.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ExplainabilityService } from './explainability.service';

@Controller('explain')
export class ExplainabilityController {
  constructor(private readonly explain: ExplainabilityService) {}

  @Get()
  getShapSummary() {
    return this.explain.getShapSummary();
  }
}