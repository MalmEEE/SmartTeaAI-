import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import * as path from 'path';
import { MlModel } from './ml-model.entity';
import { Prediction } from './prediction.entity';
import { Recommendation } from './recommendation.entity';

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

// Maps Python model name to the ml_models enum
const MODEL_NAME_MAP: Record<string, MlModel['model_name']> = {
  LSTM:         'LSTM',
  XGBoost:      'XGBOOST',
  XGBoost_core: 'XGBOOST',
  RandomForest: 'RANDOM_FOREST',
  ARIMA:        'ARIMA',
};

const CACHE_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly cache  = new Map<string, { result: PredictionResult; exp: number }>();

  constructor(
    @InjectRepository(MlModel)
    private readonly mlModelRepo: Repository<MlModel>,
    @InjectRepository(Prediction)
    private readonly predRepo: Repository<Prediction>,
    @InjectRepository(Recommendation)
    private readonly recRepo: Repository<Recommendation>,
  ) {}

  private getCached(key: string): PredictionResult | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.exp) return null;
    return entry.result;
  }

  private setCached(key: string, result: PredictionResult): void {
    this.cache.set(key, { result, exp: Date.now() + CACHE_TTL_MS });
  }

  /** Find or create the ml_models record for the winning model. */
  private async findOrCreateMlModel(modelName: string): Promise<MlModel | null> {
    const dbName = MODEL_NAME_MAP[modelName];
    if (!dbName) return null;
    try {
      const existing = await this.mlModelRepo.findOne({
        where: { model_name: dbName, is_active: true },
      });
      if (existing) return existing;
      return await this.mlModelRepo.save({
        model_name:      dbName,
        version:         new Date().toISOString().slice(0, 10),
        file_path:       '',
        hyperparameters: null,
        is_active:       true,
      });
    } catch (err) {
      this.logger.warn(`Could not find/create ml_models record: ${(err as Error).message}`);
      return null;
    }
  }

  /** Persist an elevation-specific prediction + recommendation. National-level is skipped
   *  because predictions.elevation is NOT NULL ENUM('High','Medium','Low'). */
  private async persistPrediction(result: PredictionResult, elevation?: string): Promise<void> {
    if (!elevation) return; // national-level has no valid elevation for the schema

    const elevCap = (elevation.charAt(0).toUpperCase() + elevation.slice(1)) as 'High' | 'Medium' | 'Low';
    const mlModel = await this.findOrCreateMlModel(result.model);
    if (!mlModel) return;

    try {
      const pred = await this.predRepo.save({
        year_month:        result.predicted_month,
        grade:             'ALL',
        elevation:         elevCap,
        predicted_price:   result.predicted_price_rs,
        price_lower_bound: result.price_range_low,
        price_upper_bound: result.price_range_high,
        confidence:        null,
        risk_level:        result.risk_level.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH',
        model:             mlModel,
        actual_price:      null,
      });

      await this.recRepo.save({
        prediction:   pred,
        action:       result.recommendation.signal.toUpperCase() as 'SELL' | 'HOLD' | 'MONITOR',
        justification: result.recommendation.justification,
        target_role:  'ALL',
      });
    } catch (err) {
      this.logger.error(`Failed to persist prediction: ${(err as Error).message}`);
    }
  }

  async predict(elevation?: string): Promise<PredictionResult> {
    const cacheKey = elevation ?? 'national';
    const cached   = this.getCached(cacheKey);
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
            this.persistPrediction(result, elevation);
            resolve(result);
          }
        } catch {
          reject(new InternalServerErrorException(
            `predict.py bad output (exit ${code}): ${stdout.slice(0, 200)}`,
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
            `predict.py bad output (exit ${code}): ${stdout.slice(0, 200)}`,
          ));
        }
      });
      proc.on('error', (err) => reject(new InternalServerErrorException(err.message)));
    });
  }
}
