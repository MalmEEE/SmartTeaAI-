// explainability/explainability.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const MODEL_DIR = path.resolve(__dirname, '../../../ml-engine/models');

@Injectable()
export class ExplainabilityService {
  getShapSummary() {
    const filePath = path.join(MODEL_DIR, 'shap_summary.json');
    if (!fs.existsSync(filePath)) {
      return { status: 'not_available', message: 'SHAP summary not yet exported from notebook' };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  }
}