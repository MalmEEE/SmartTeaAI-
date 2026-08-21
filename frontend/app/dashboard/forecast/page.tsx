'use client';

import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { ForecastResult, PricePoint } from '@/types';
import { Card, CardHeader, CardBody, KpiCard } from '@/components/ui/Card';
import { RiskBadge, SignalBadge } from '@/components/ui/Badge';
import { CardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import {
  ResponsiveContainer, ComposedChart, Line, Area, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

export default function ForecastPage() {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      cachedGet<ForecastResult>('/predict'),
      cachedGet<{ data: PricePoint[] }>('/history'),
    ])
      .then(([forecast, hist]) => {
        setForecast(forecast);
        setHistory(hist.data ?? []);
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
      <h1 className="text-2xl font-bold text-[var(--text)]">National Price Forecast</h1>
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
        <h1 className="text-2xl font-bold text-[var(--text)]">National Price Forecast</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Sri Lanka tea auction — national average</p>
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

          {/* Signal card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 space-y-3 md:col-span-1">
              <h3 className="font-semibold text-[var(--text)]">Recommendation</h3>
              <div className="flex gap-2 flex-wrap">
                <SignalBadge signal={forecast.recommendation.signal} />
                <RiskBadge level={forecast.risk_level} />
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {forecast.recommendation.justification}
              </p>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 md:col-span-2">
              <h3 className="font-semibold text-[var(--text)] mb-4">Price History + Forecast</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D6A2D" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2D6A2D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7280' }} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderColor: '#DDD8CF', borderRadius: 8 }} />
                  <Legend />
                  <Area
                    type="monotone" dataKey="historical" stroke="#2D6A2D" strokeWidth={2}
                    fill="url(#histGrad)" name="Historical" connectNulls
                  />
                  <Bar dataKey="forecast" fill="#C49A00" name="Forecast" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
