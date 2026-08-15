import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';

const PYTHON     = process.env.PYTHON_BIN  || 'python';
const ML_ENGINE  = path.resolve(__dirname, '../../../ml-engine');

export interface PipelineResult {
  script:    string;
  status:    'ok' | 'error';
  durationMs: number;
  data?:     Record<string, unknown>;
  message?:  string;
}

export interface RunSummary {
  startedAt:  string;
  finishedAt: string;
  steps:      PipelineResult[];
  success:    boolean;
}

@Injectable()
export class DataPipelineService {
  private readonly logger = new Logger(DataPipelineService.name);
  private lastRun: RunSummary | null = null;

  // Every Sunday at 02:00 — pull new data and rebuild feature matrix
  // @Cron('0 2 * * 0')
  async runWeeklyPipeline(): Promise<RunSummary> {
    return this.runPipeline();
  }

  async runPipeline(): Promise<RunSummary> {
    const startedAt = new Date().toISOString();
    this.logger.log('Data pipeline started');

    const steps: PipelineResult[] = [];

    // Step 1: SLTB + weather in parallel (independent sources)
    const [sltb, weather] = await Promise.all([
      this.runScript('collect_sltb.py'),
      this.runScript('collect_weather.py'),
    ]);
    steps.push(sltb, weather);

    if (sltb.status === 'error' || weather.status === 'error') {
      this.logger.error('SLTB or weather collection failed — aborting pipeline');
      const summary = this.buildSummary(startedAt, steps, false);
      this.lastRun = summary;
      return summary;
    }

    // Step 2: oil + FX (blocking) + sentiment (non-blocking — supplementary feature)
    const [oil, fx, sentiment] = await Promise.all([
      this.runScript('collect_oil.py'),
      this.runScript('process_fx.py'),
      this.runScript('collect_sentiment.py'),
    ]);
    steps.push(oil, fx, sentiment);

    if (oil.status === 'error' || fx.status === 'error') {
      this.logger.error('Oil or FX collection failed — aborting pipeline');
      const summary = this.buildSummary(startedAt, steps, false);
      this.lastRun = summary;
      return summary;
    }

    if (sentiment.status === 'error') {
      this.logger.warn(
        `Sentiment collection failed (non-blocking, supplementary feature): ${sentiment.message}. ` +
        `Continuing pipeline — affected months keep neutral placeholder (0.0).`,
      );
    }

    // Step 3: rebuild ML feature matrix (must run after all collectors)
    const preprocess = await this.runScript('preprocess_features.py');
    steps.push(preprocess);

    const success = preprocess.status === 'ok';
    const summary = this.buildSummary(startedAt, steps, success);
    this.lastRun = summary;

    if (success) {
      this.logger.log('Pipeline complete — feature matrix updated');
    } else {
      this.logger.error('Preprocessing failed');
    }

    return summary;
  }

  getLastRun(): RunSummary | null {
    return this.lastRun;
  }

  private buildSummary(startedAt: string, steps: PipelineResult[], success: boolean): RunSummary {
    return { startedAt, finishedAt: new Date().toISOString(), steps, success };
  }

  private runScript(scriptName: string): Promise<PipelineResult> {
    const scriptPath = path.join(ML_ENGINE, scriptName);
    const start      = Date.now();

    return new Promise((resolve) => {
      const proc = spawn(PYTHON, [scriptPath], { env: { ...process.env } });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        const durationMs = Date.now() - start;
        if (stderr) this.logger.debug(`[${scriptName}] ${stderr.trim()}`);

        try {
          const data = JSON.parse(stdout.trim());
          if (data.status === 'error') {
            this.logger.error(`[${scriptName}] ${data.message}`);
            resolve({ script: scriptName, status: 'error', durationMs, message: data.message });
          } else {
            resolve({ script: scriptName, status: 'ok', durationMs, data });
          }
        } catch {
          const message = `bad JSON output (exit ${code}): ${stdout.slice(0, 200)}`;
          this.logger.error(`[${scriptName}] ${message}`);
          resolve({ script: scriptName, status: 'error', durationMs, message });
        }
      });

      proc.on('error', (err) => {
        resolve({ script: scriptName, status: 'error', durationMs: Date.now() - start, message: err.message });
      });
    });
  }
}
