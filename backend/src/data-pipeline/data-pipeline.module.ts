import { Module } from '@nestjs/common';
import { DataPipelineService } from './data-pipeline.service';

@Module({
  providers: [DataPipelineService]
})
export class DataPipelineModule {}
