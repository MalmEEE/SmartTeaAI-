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
      .then(([info, shap]) => {
        setInfo(info);
        setShap(shap);
      })
      .catch(() => setError('Failed to load model information.'))
      .finally(() => setLoading(false));
  }, []);

  const shapData = shap?.xgboost_core?.top_5?.map(([name, val]) => ({
    name: name.length > 20 ? name.slice(0, 20) + '…' : name,
    value: Number(val.toFixed(4)),
  })) ?? [];

  const lstmShapData = shap?.lstm?.top_5?.map(([name, val]) => ({
    name: name.length > 20 ? name.slice(0, 20) + '…' : name,
    value: Number(val.toFixed(4)),
  })) ?? [];

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Model Information</h1>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Model Information</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Performance metrics and SHAP feature importance</p>
      </div>

      {info && (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard label="Best Model"   value={info.best_model ?? '—'}  sub="Winner"                   accent />
            <KpiCard label="MAPE"         value={info.mape_pct != null ? `${info.mape_pct.toFixed(2)}%` : '—'} sub="Mean Abs % Error" />
            <KpiCard label="RMSE"         value={info.rmse?.toFixed(2) ?? '—'} sub="Root Mean Sq Error" />
            <KpiCard label="R²"           value={info.r2?.toFixed(4) ?? '—'}   sub="Coefficient of det."  />
          </div>

          {info.all_results && (
            <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--border)]">
                <h3 className="font-semibold text-[var(--text)]">All Model Results</h3>
                <p className="text-xs text-[var(--muted)]">
                  Trained: {info.trained_on} · Test: {info.test_period}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--cream)]">
                    <tr>
                      {['Model', 'MAE', 'RMSE', 'MAPE (%)', 'R²'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {info.all_results.map((r, i) => (
                      <tr key={i} className={r.Model === info.best_model ? 'bg-[#e8f4e8]' : ''}>
                        <td className="px-5 py-3 font-medium">{r.Model}{r.Model === info.best_model && ' ✓'}</td>
                        <td className="px-5 py-3 text-[var(--muted)]">{r.MAE.toFixed(2)}</td>
                        <td className="px-5 py-3 text-[var(--muted)]">{r.RMSE.toFixed(2)}</td>
                        <td className="px-5 py-3 text-[var(--muted)]">{r['MAPE(%)'].toFixed(2)}%</td>
                        <td className="px-5 py-3 text-[var(--muted)]">{r.R2.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* SHAP charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {shapData.length > 0 && (
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5">
            <h3 className="font-semibold text-[var(--text)] mb-4">XGBoost Top Features (SHAP)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shapData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#6B7280' }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: '#6B7280' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="value" fill="#2D6A2D" radius={[0, 3, 3, 0]} name="Mean |SHAP|" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {lstmShapData.length > 0 && (
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5">
            <h3 className="font-semibold text-[var(--text)] mb-4">LSTM Top Features (SHAP)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={lstmShapData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#6B7280' }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: '#6B7280' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="value" fill="#C49A00" radius={[0, 3, 3, 0]} name="Mean |SHAP|" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
