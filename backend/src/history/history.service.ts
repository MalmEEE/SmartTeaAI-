import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const DATA_DIR  = path.resolve(__dirname, '../../../ml-engine/data');
const MODEL_DIR = path.resolve(__dirname, '../../../ml-engine/models');

export interface PricePoint {
  month:  string;
  price:  number;
  split:  'train' | 'val' | 'test';
}

export interface ModelInfo {
  best_model:  string;
  mape_pct:    number;
  rmse:        number;
  r2:          number;
  trained_on:  string;
  test_period: string;
  all_results: Array<{ Model: string; 'MAPE(%)': number; RMSE: number; R2: number }>;
}

export interface ElevationPricePoint {
  month: string;
  price_high: number;
  price_medium: number;
  price_low: number;
  split: 'train' | 'val' | 'test';
}

export interface WeatherEconomicPoint {
  month: string;
  rainfall_mm: number;
  avg_temp_c: number;
  usd_lkr_avg: number;
  oil_price: number;
  mombasa_usd_kg: number;
  export_black_qty_kg: number;
  split: 'train' | 'val' | 'test';
}

export interface SentimentPoint {
  month: string;
  sentiment_score: number;
  article_count: number;
}


@Injectable()
export class HistoryService {

  getPriceHistory(): PricePoint[] {
    const result: PricePoint[] = [];
    const splits = ['train_set', 'val_set', 'test_set'] as const;

    for (const split of splits) {
      const filePath = path.join(DATA_DIR, `${split}.csv`);
      if (!fs.existsSync(filePath)) continue;

      const raw     = fs.readFileSync(filePath, 'utf-8');
      const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
      const label   = split.replace('_set', '') as 'train' | 'val' | 'test';

      for (const row of records) {
        if (row['year_month'] && row['price_national_avg']) {
          result.push({
            month: row['year_month'].slice(0, 7),
            price: parseFloat(row['price_national_avg']),
            split: label,
          });
        }
      }
    }

    return result.sort((a, b) => a.month.localeCompare(b.month));
  }

  getElevationHistory(): ElevationPricePoint[] {
    const result: ElevationPricePoint[] = [];
    const splits = ['train_set', 'val_set', 'test_set'] as const;

    for (const split of splits) {
      const filePath = path.join(DATA_DIR, `${split}.csv`);
      if (!fs.existsSync(filePath)) continue;

      const raw = fs.readFileSync(filePath, 'utf-8');
      const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
      const label = split.replace('_set', '') as 'train' | 'val' | 'test';

      for (const row of records) {
        if (row['year_month']) {
          result.push({
            month: row['year_month'].slice(0, 7),
            price_high: parseFloat(row['price_high_rs']),
            price_medium: parseFloat(row['price_medium_rs']),
            price_low: parseFloat(row['price_low_rs']),
            split: label,
          });
        }
      }
    }

    return result.sort((a, b) => a.month.localeCompare(b.month));
  }

  getWeatherEconomicHistory(): WeatherEconomicPoint[] {
    const result: WeatherEconomicPoint[] = [];
    const splits = ['train_set', 'val_set', 'test_set'] as const;

    for (const split of splits) {
      const filePath = path.join(DATA_DIR, `${split}.csv`);
      if (!fs.existsSync(filePath)) continue;

      const raw = fs.readFileSync(filePath, 'utf-8');
      const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
      const label = split.replace('_set', '') as 'train' | 'val' | 'test';

      for (const row of records) {
        if (row['year_month']) {
          result.push({
            month: row['year_month'].slice(0, 7),
            rainfall_mm: parseFloat(row['rainfall_mm']),
            avg_temp_c: parseFloat(row['avg_temp_c']),
            usd_lkr_avg: parseFloat(row['usd_lkr_avg']),
            oil_price: parseFloat(row['oil_price']),
            mombasa_usd_kg: parseFloat(row['mombasa_usd_kg']),
            export_black_qty_kg: parseFloat(row['export_black_qty_kg']),
            split: label,
          });
        }
      }
    }

    return result.sort((a, b) => a.month.localeCompare(b.month));
  }

    getModelInfo(): ModelInfo | { status: string; message: string } {
      const filePath = path.join(MODEL_DIR, 'best_model.json');
      try {
        if (!fs.existsSync(filePath)) {
          return { status: 'not_available', message: 'best_model.json not found — run model training first' };
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as ModelInfo;
      } catch (err) {
        return { status: 'error', message: `Failed to read model info: ${(err as Error).message}` };
      }
    }

    getSentimentHistory(): SentimentPoint[] | { status: string; message: string } {
    const filePath = path.join(DATA_DIR, 'sentiment_monthly.csv');
    try {
      if (!fs.existsSync(filePath)) {
        return {
          status: 'not_available',
          message: 'No sentiment data yet — run collect_sentiment.py to generate it',
        };
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

      const result: SentimentPoint[] = records
        .filter((row) => row['year_month'])
        .map((row) => ({
          month: row['year_month'].slice(0, 7),
          sentiment_score: parseFloat(row['sentiment_score']),
          article_count: parseInt(row['article_count'], 10),
        }));

      return result.sort((a, b) => a.month.localeCompare(b.month));
    } catch (err) {
      return { status: 'error', message: `Failed to read sentiment data: ${(err as Error).message}` };
    }
  }
}
