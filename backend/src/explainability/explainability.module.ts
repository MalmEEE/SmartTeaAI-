// explainability/explainability.module.ts
import { Module } from '@nestjs/common';
import { ExplainabilityService } from './explainability.service';
import { ExplainabilityController } from './explainability.controller';

@Module({
  providers: [ExplainabilityService],
  controllers: [ExplainabilityController],
})
export class ExplainabilityModule {}