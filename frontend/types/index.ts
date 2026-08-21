export type UserRole = 'farmer' | 'broker' | 'exporter' | 'buyer' | 'analyst' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface ForecastResult {
  status: 'ok' | 'error';
  elevation?: string;
  target?: string;
  predicted_price_rs: number;
  predicted_month: string;
  last_known_month: string;
  last_known_price_rs: number;
  change_rs: number;
  change_pct: number;
  price_range_low: number;
  price_range_high: number;
  range_basis: string;
  risk_level: 'Low' | 'Medium' | 'High';
  recommendation: { signal: 'Sell' | 'Hold' | 'Monitor'; justification: string };
  model: string;
  mape_pct: number;
  rmse: number;
}

export interface PricePoint {
  month: string;
  price: number;
  split: 'train' | 'val' | 'test';
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

export interface ModelResult {
  Model: string;
  MAE: number;
  RMSE: number;
  'MAPE(%)': number;
  R2: number;
}

export interface ModelInfo {
  status?: string;
  message?: string;
  best_model?: string;
  mape_pct?: number;
  rmse?: number;
  r2?: number;
  trained_on?: string;
  test_period?: string;
  all_results?: ModelResult[];
}

export interface ShapFeature {
  feature_names: string[];
  mean_abs_shap: Record<string, number>;
  top_5: [string, number][];
}

export interface ShapSummary {
  status?: string;
  message?: string;
  xgboost_core?: ShapFeature;
  lstm?: ShapFeature;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface RoleRequest {
  id: number;
  user_id: number;
  requested_role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user?: { name: string; email: string; role: UserRole };
}

export interface SentimentPoint {
  month: string;
  sentiment_score: number;
  split: 'train' | 'val' | 'test';
}
