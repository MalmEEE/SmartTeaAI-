import { Module } from '@nestjs/common';
import { DataPipelineService } from './data-pipeline.service';
import { DataPipelineController } from './data-pipeline.controller';

@Module({
  providers:   [DataPipelineService],
  controllers: [DataPipelineController],
  exports:     [DataPipelineService],
})
export class DataPipelineModule {}
