'use client';

import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { ModelInfo, ShapSummary } from '@/types';
import { KpiCard } from '@/components/ui/Card';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

const TOOLTIP_STYLE = {
  background: 'rgba(10,30,10,0.85)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  fontSize: 12,
  color: '#fff',
};

function shapEntries(map?: Record<string, number>) {
  if (!map) return [];
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([name, val]) => ({
      name: name.length > 24 ? name.slice(0, 24) + '…' : name,
      value: Number(val.toFixed(4)),
    }));
}

export default function ModelPage() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [shap, setShap] = useState<ShapSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      cachedGet<ModelInfo>('/model-info'),
      cachedGet<ShapSummary>('/explain'),
    ])
      .then(([i, s]) => { setInfo(i); setShap(s); })
      .catch(() => setError('Failed to load model information.'))
      .finally(() => setLoading(false));
  }, []);

  const xgbShap  = shapEntries(shap?.xgboost_core?.mean_abs_shap);
  const lstmShap = shapEntries(shap?.lstm?.mean_abs_shap);

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Model Information</h1>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Model Information</h1>
        <p className="text-sm text-white/50 mt-0.5">Performance metrics and SHAP feature importance</p>
      </div>

      {info && (
        <>
          {/* KPI cards */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <KpiCard label="Best Model"  value={info.best_model ?? '—'}                              sub={info.feature_set ? `Feature set: ${info.feature_set}` : 'Winner'} accent />
            <KpiCard label="MAPE"        value={info.mape_pct  != null ? `${info.mape_pct.toFixed(2)}%` : '—'} sub="Mean Abs % Error" />
            <KpiCard label="RMSE"        value={info.rmse      != null ? info.rmse.toFixed(2)         : '—'} sub="Root Mean Sq Error" />
            <KpiCard label="R²"          value={info.r2        != null ? info.r2.toFixed(4)           : '—'} sub="Coefficient of det." />
            <KpiCard label="Test Rows"   value={info.test_rows != null ? String(info.test_rows)       : '—'} sub={info.test_period ?? 'Test period'} />
          </div>

          {/* Metadata strip */}
          <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3 flex flex-wrap gap-x-8 gap-y-1 text-xs text-white/50">
            {info.model_file   && <span>Model file: <span className="text-white/70 font-mono">{info.model_file}</span></span>}
            {info.feature_set  && <span>Feature set: <span className="text-white/70 font-mono">{info.feature_set}</span></span>}
            {info.trained_on   && <span>Trained: <span className="text-white/70">{new Date(info.trained_on).toLocaleString()}</span></span>}
            {info.test_period  && <span>Test period: <span className="text-white/70">{info.test_period}</span></span>}
          </div>

          {/* All model results table */}
          {info.all_results && (
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/15">
                <h3 className="font-semibold text-white">All Model Comparison</h3>
                <p className="text-xs text-white/50">{info.all_results.length} models evaluated on test set · Best model marked ✓</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      {['Model', 'MAE', 'RMSE', 'MAPE (%)', 'R²'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {info.all_results.map((r, i) => (
                      <tr key={i} className={`transition-colors ${r.Model === info.best_model ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                        <td className="px-5 py-3 font-medium text-white/80">{r.Model}{r.Model === info.best_model && ' ✓'}</td>
                        <td className="px-5 py-3 text-white/80">{r.MAE?.toFixed(2) ?? '—'}</td>
                        <td className="px-5 py-3 text-white/80">{r.RMSE.toFixed(2)}</td>
                        <td className="px-5 py-3 text-white/80">{r['MAPE(%)'].toFixed(2)}%</td>
                        <td className="px-5 py-3 text-white/80">{r.R2.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* SHAP charts — all features from mean_abs_shap sorted descending */}
      <div className="grid md:grid-cols-2 gap-6">
        {xgbShap.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-1">XGBoost — Feature Importance (SHAP)</h3>
            <p className="text-xs text-white/40 mb-4">
              {shap?.xgboost_core?.feature_names?.length ?? xgbShap.length} features · mean |SHAP value|, sorted
            </p>
            <ResponsiveContainer width="100%" height={xgbShap.length * 26 + 20}>
              <BarChart data={xgbShap} layout="vertical" margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [Number(v).toFixed(4), 'Mean |SHAP|']} />
                <Bar dataKey="value" fill="#6ee7b7" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {lstmShap.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-1">LSTM — Feature Importance (SHAP)</h3>
            <p className="text-xs text-white/40 mb-4">
              {shap?.lstm?.feature_names?.length ?? lstmShap.length} features · mean |SHAP value|, sorted
            </p>
            <ResponsiveContainer width="100%" height={lstmShap.length * 26 + 20}>
              <BarChart data={lstmShap} layout="vertical" margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [Number(v).toFixed(4), 'Mean |SHAP|']} />
                <Bar dataKey="value" fill="#fde68a" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Feature name lists */}
      {(shap?.xgboost_core?.feature_names || shap?.lstm?.feature_names) && (
        <div className="grid md:grid-cols-2 gap-6">
          {shap?.xgboost_core?.feature_names && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">
                XGBoost Feature Names ({shap.xgboost_core.feature_names.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {shap.xgboost_core.feature_names.map(f => (
                  <span key={f} className="text-xs font-mono bg-white/10 text-white/60 px-2 py-0.5 rounded-md">{f}</span>
                ))}
              </div>
            </div>
          )}
          {shap?.lstm?.feature_names && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">
                LSTM Feature Names ({shap.lstm.feature_names.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {shap.lstm.feature_names.map(f => (
                  <span key={f} className="text-xs font-mono bg-white/10 text-white/60 px-2 py-0.5 rounded-md">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
