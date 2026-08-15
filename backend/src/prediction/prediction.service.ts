import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';

const PYTHON    = process.env.PYTHON_BIN || 'python';
const ML_ENGINE = path.resolve(__dirname, '../../../ml-engine');

export interface PredictionResult {
  status:              'ok' | 'error';
  predicted_price_rs:  number;
  predicted_month:     string;
  last_known_month:    string;
  last_known_price_rs: number;
  change_rs:           number;
  change_pct:          number;
  model:               string;
  mape_pct:            number;
  rmse:                number;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  async predict(): Promise<PredictionResult> {
    const scriptPath = path.join(ML_ENGINE, 'predict.py');

    return new Promise((resolve, reject) => {
      const proc = spawn(PYTHON, [scriptPath], { env: { ...process.env } });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (stderr) this.logger.debug(`[predict.py] ${stderr.trim()}`);
        try {
          const result = JSON.parse(stdout.trim()) as PredictionResult;
          if (result.status === 'error') {
            this.logger.error(`[predict.py] ${result['message']}`);
            reject(new InternalServerErrorException(result['message']));
          } else {
            resolve(result);
          }
        } catch {
          reject(new InternalServerErrorException(
            `predict.py bad output (exit ${code}): ${stdout.slice(0, 200)}`
          ));
        }
      });

      proc.on('error', (err) => reject(new InternalServerErrorException(err.message)));
    });
  }
}
