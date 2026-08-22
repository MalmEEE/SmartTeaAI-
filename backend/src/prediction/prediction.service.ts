import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';

const PYTHON    = process.env.PYTHON_BIN || 'python';
const ML_ENGINE = path.resolve(__dirname, '../../../ml-engine');

export interface PredictionResult {
  status:              'ok' | 'error';
  elevation?:          string;
  target?:             string;
  predicted_price_rs:  number;
  predicted_month:     string;
  last_known_month:    string;
  last_known_price_rs: number;
  change_rs:           number;
  change_pct:          number;
  price_range_low:     number;
  price_range_high:    number;
  range_basis:         string;
  risk_level:          'Low' | 'Medium' | 'High';
  recommendation: {
    signal: 'Sell' | 'Hold' | 'Monitor';
    justification: string;
  };
  model:               string;
  mape_pct:            number;
  rmse:                number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly cache = new Map<string, { result: PredictionResult; exp: number }>();

  private getCached(key: string): PredictionResult | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.exp) return null;
    return entry.result;
  }

  private setCached(key: string, result: PredictionResult): void {
    this.cache.set(key, { result, exp: Date.now() + CACHE_TTL_MS });
  }

  async predict(elevation?: string): Promise<PredictionResult> {
    const cacheKey = elevation ?? 'national';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    const scriptPath = path.join(ML_ENGINE, 'predict.py');
    const args       = elevation
      ? [scriptPath, `--elevation=${elevation}`]
      : [scriptPath];

    return new Promise((resolve, reject) => {
      const proc = spawn(PYTHON, args, { env: { ...process.env } });

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
            this.setCached(cacheKey, result);
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

  async whatIf(
    overrides: Record<string, number>,
    elevation?: string,
  ): Promise<PredictionResult> {
    const scriptPath = path.join(ML_ENGINE, 'predict.py');
    const args = [scriptPath, `--whatif=${JSON.stringify(overrides)}`];
    if (elevation) args.push(`--elevation=${elevation}`);

    return new Promise((resolve, reject) => {
      const proc = spawn(PYTHON, args, { env: { ...process.env } });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
      proc.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      proc.on('close', (code) => {
        if (stderr) this.logger.debug(`[predict.py whatif] ${stderr.trim()}`);
        try {
          const result = JSON.parse(stdout.trim());
          if (result.status === 'error') {
            reject(new InternalServerErrorException(result.message));
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
