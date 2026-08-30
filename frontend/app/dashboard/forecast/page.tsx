'use client';

import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { ForecastResult, PricePoint } from '@/types';
import { KpiCard } from '@/components/ui/Card';
import { RiskBadge, SignalBadge } from '@/components/ui/Badge';
import { CardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import {
  ResponsiveContainer, ComposedChart, Line, Area, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const TOOLTIP_STYLE = {
  background: 'rgba(10,30,10,0.85)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  fontSize: 12,
  color: '#fff',
};

export default function ForecastPage() {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      cachedGet<ForecastResult>('/predict'),
      cachedGet<PricePoint[]>('/history'),
    ])
      .then(([forecast, hist]) => {
        setForecast(forecast);
        setHistory(hist);
      })
      .catch(() => setError('Failed to load forecast data.'))
      .finally(() => setLoading(false));
  }, []);

  const chartData = [
    ...history.slice(-18).map(p => ({
      month: p.month,
      historical: p.price,
      forecast: null,
      type: p.split,
    })),
    ...(forecast
      ? [{
          month: forecast.predicted_month,
          historical: null,
          forecast: forecast.predicted_price_rs,
          low: forecast.price_range_low,
          high: forecast.price_range_high,
          type: 'forecast',
        }]
      : []),
  ];

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">National Price Forecast</h1>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
      </div>
      <ChartSkeleton height="h-80" />
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">National Price Forecast</h1>
        <p className="text-sm text-white/50 mt-0.5">Sri Lanka tea auction - national average</p>
      </div>

      {forecast && (
        <>
          {/* KPIs */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Predicted Price"
              value={`LKR ${forecast.predicted_price_rs.toLocaleString()}`}
              sub={`For ${forecast.predicted_month}`}
              accent
            />
            <KpiCard
              label="Change"
              value={`${forecast.change_pct >= 0 ? '+' : ''}${forecast.change_pct.toFixed(2)}%`}
              sub={`LKR ${forecast.change_rs >= 0 ? '+' : ''}${forecast.change_rs.toFixed(0)} vs ${forecast.last_known_month}`}
            />
            <KpiCard
              label="Price Range"
              value={`${forecast.price_range_low.toFixed(0)}–${forecast.price_range_high.toFixed(0)}`}
              sub={`LKR · ${forecast.range_basis}`}
            />
            <KpiCard
              label="Model MAPE"
              value={`${forecast.mape_pct.toFixed(2)}%`}
              sub={`RMSE ${forecast.rmse.toFixed(2)} · ${forecast.model}`}
            />
          </div>

          {/* Signal card + chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 space-y-3 md:col-span-1">
              <h3 className="font-semibold text-white">Recommendation</h3>
              <div className="flex gap-2 flex-wrap">
                <SignalBadge signal={forecast.recommendation.signal} />
                <RiskBadge level={forecast.risk_level} />
              </div>

              {forecast.recommendation.factors && forecast.recommendation.factors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/30">Key drivers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {forecast.recommendation.factors.map(f => (
                      <span
                        key={f}
                        className="text-xs bg-emerald-500/15 border border-emerald-400/20 text-emerald-300 px-2.5 py-1 rounded-full"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm text-white/60 leading-relaxed">
                {forecast.recommendation.justification}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 md:col-span-2">
              <h3 className="font-semibold text-white mb-4">Price History + Forecast</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6ee7b7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6ee7b7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Area
                    type="monotone" dataKey="historical" stroke="#6ee7b7" strokeWidth={2}
                    fill="url(#histGrad)" name="Historical" connectNulls
                  />
                  <Bar dataKey="forecast" fill="#fde68a" name="Forecast" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
