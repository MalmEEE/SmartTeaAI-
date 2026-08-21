'use client';

import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { ForecastResult, ElevationPricePoint } from '@/types';
import { KpiCard } from '@/components/ui/Card';
import { RiskBadge, SignalBadge } from '@/components/ui/Badge';
import { CardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

type Elevation = 'high' | 'medium' | 'low';

const ELEVATIONS: { key: Elevation; label: string; color: string }[] = [
  { key: 'high',   label: 'High Grown',   color: '#6ee7b7' },
  { key: 'medium', label: 'Medium Grown', color: '#fde68a' },
  { key: 'low',    label: 'Low Grown',    color: '#fca5a5' },
];

const TOOLTIP_STYLE = {
  background: 'rgba(10,30,10,0.85)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  fontSize: 12,
  color: '#fff',
};

export default function ElevationPage() {
  const [forecasts, setForecasts] = useState<Record<Elevation, ForecastResult | null>>({
    high: null, medium: null, low: null,
  });
  const [history, setHistory] = useState<ElevationPricePoint[]>([]);
  const [active, setActive] = useState<Elevation>('high');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      cachedGet<ForecastResult>('/predict?elevation=high'),
      cachedGet<ForecastResult>('/predict?elevation=medium'),
      cachedGet<ForecastResult>('/predict?elevation=low'),
      cachedGet<{ data: ElevationPricePoint[] }>('/history/elevation'),
    ])
      .then(([hi, me, lo, hist]) => {
        setForecasts({ high: hi, medium: me, low: lo });
        setHistory(hist.data ?? []);
      })
      .catch(() => setError('Failed to load elevation forecasts.'))
      .finally(() => setLoading(false));
  }, []);

  const chartData = history.slice(-24);
  const cur = forecasts[active];

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Elevation Level Forecasts</h1>
      <div className="grid sm:grid-cols-3 gap-4">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>
      <ChartSkeleton height="h-80" />
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Elevation Level Forecasts</h1>
        <p className="text-sm text-white/50 mt-0.5">High / Medium / Low grown tea price predictions</p>
      </div>

      {/* 3 clickable KPI cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {ELEVATIONS.map(el => {
          const f = forecasts[el.key];
          return (
            <button
              key={el.key}
              onClick={() => setActive(el.key)}
              className={`text-left rounded-2xl border p-5 transition-all
                ${active === el.key
                  ? 'bg-white/20 border-white/40 ring-2 ring-white/20'
                  : 'bg-white/10 border-white/15 hover:bg-white/15'}`}
            >
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">{el.label}</p>
              <p className="text-2xl font-bold" style={{ color: el.color }}>
                {f ? `LKR ${f.predicted_price_rs.toLocaleString()}` : '—'}
              </p>
              {f && (
                <p className="text-xs text-white/50 mt-1">
                  {f.change_pct >= 0 ? '+' : ''}{f.change_pct.toFixed(1)}% · {f.predicted_month}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail + chart */}
      <div className="grid md:grid-cols-3 gap-6">
        {cur && (
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-white">
              {ELEVATIONS.find(e => e.key === active)?.label} Detail
            </h3>
            <div className="flex gap-2 flex-wrap">
              <SignalBadge signal={cur.recommendation.signal} />
              <RiskBadge level={cur.risk_level} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Range</span>
                <span className="font-medium text-white">{cur.price_range_low.toFixed(0)}–{cur.price_range_high.toFixed(0)} LKR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Model</span>
                <span className="font-medium text-white">{cur.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">MAPE</span>
                <span className="font-medium text-white">{cur.mape_pct.toFixed(2)}%</span>
              </div>
            </div>
            <p className="text-xs text-white/60 leading-relaxed border-t border-white/15 pt-3">
              {cur.recommendation.justification}
            </p>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 md:col-span-2">
          <h3 className="font-semibold text-white mb-4">Elevation Price History (24 months)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="price_high"   stroke="#6ee7b7" strokeWidth={2} dot={false} name="High Grown" />
              <Line type="monotone" dataKey="price_medium" stroke="#fde68a" strokeWidth={2} dot={false} name="Medium Grown" />
              <Line type="monotone" dataKey="price_low"    stroke="#fca5a5" strokeWidth={2} dot={false} name="Low Grown" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
