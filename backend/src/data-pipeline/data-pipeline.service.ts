import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { spawn } from 'child_process';
import * as path from 'path';

const PYTHON      = process.env.PYTHON_BIN || 'python';
const SCRAPER_DIR = path.resolve(__dirname, '../../../../scraper');

@Injectable()
export class DataPipelineService {
  private readonly logger = new Logger(DataPipelineService.name);

  // Every Sunday at 02:00 — re-scrapes both sources, catches any late SLTB updates
  @Cron('0 2 * * 0')
  async runWeeklyScrape() {
    this.logger.log('Weekly scrape started');
    const [sltb, weather] = await Promise.all([
      this.runScraper('collect_sltb.py'),
      this.runScraper('collect_weather.py'),
    ]);
    this.logger.log(`SLTB: ${sltb['total_rows_added']} rows added, ${sltb['feature_rows']} feature rows`);
    this.logger.log(`Weather: ${weather['rows_inserted']} rows inserted, ${weather['features_updated']} features updated`);
    return { sltb, weather };
  }

  async runScraper(scriptName: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(SCRAPER_DIR, scriptName);
      const proc = spawn(PYTHON, [scriptPath], {
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (stderr) this.logger.debug(`[${scriptName}] ${stderr.trim()}`);
        try {
          const result = JSON.parse(stdout.trim());
          if (result.status === 'error') {
            this.logger.error(`[${scriptName}] ${result.message}`);
          }
          resolve(result);
        } catch {
          reject(new Error(`[${scriptName}] bad output (exit ${code}): ${stdout.slice(0, 200)}`));
        }
      });

      proc.on('error', reject);
    });
  }
}
