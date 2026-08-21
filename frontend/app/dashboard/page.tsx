'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cachedGet } from '@/lib/cache';
import { useAuth } from '@/lib/auth';
import type { ForecastResult, PricePoint } from '@/types';
import { KpiCard } from '@/components/ui/Card';
import { RiskBadge, SignalBadge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

export default function OverviewPage() {
  const { user } = useAuth();
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
      .catch(() => setError('Could not load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  const chartData = history.slice(-24).map(p => ({
    month: p.month,
    price: p.price,
  }));

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Overview</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Welcome back, <span className="font-medium capitalize">{user?.name ?? user?.email}</span>
        </p>
      </div>

      {/* KPI row */}
      {forecast && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Predicted Price"
            value={`LKR ${forecast.predicted_price_rs.toLocaleString()}`}
            sub={forecast.predicted_month}
            accent
            icon={<span>📈</span>}
          />
          <KpiCard
            label="Change vs Last"
            value={`${forecast.change_pct >= 0 ? '+' : ''}${forecast.change_pct.toFixed(1)}%`}
            sub={`LKR ${forecast.change_rs >= 0 ? '+' : ''}${forecast.change_rs.toFixed(0)}`}
            icon={<span>{forecast.change_pct >= 0 ? '⬆' : '⬇'}</span>}
          />
          <KpiCard
            label="Model Accuracy"
            value={`${(100 - forecast.mape_pct).toFixed(1)}%`}
            sub={`MAPE ${forecast.mape_pct.toFixed(2)}%`}
            icon={<span>🤖</span>}
          />
          <KpiCard
            label="Price Range"
            value={`${forecast.price_range_low.toFixed(0)} – ${forecast.price_range_high.toFixed(0)}`}
            sub="LKR confidence interval"
            icon={<span>📊</span>}
          />
        </div>
      )}

      {/* Signal + Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recommendation */}
        {forecast && (
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-[var(--text)]">Market Signal</h3>
            <div className="flex items-center gap-3">
              <SignalBadge signal={forecast.recommendation.signal} />
              <RiskBadge level={forecast.risk_level} />
            </div>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              {forecast.recommendation.justification}
            </p>
            <div className="pt-2 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted)]">Model: <span className="font-medium text-[var(--text)]">{forecast.model}</span></p>
              <p className="text-xs text-[var(--muted)]">RMSE: <span className="font-medium">{forecast.rmse.toFixed(2)}</span></p>
            </div>
          </div>
        )}

        {/* Price chart */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-6 xl:col-span-2">
          <h3 className="font-semibold text-[var(--text)] mb-4">National Price History (24 months)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D6A2D" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2D6A2D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7280' }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderColor: '#DDD8CF', borderRadius: 8 }}
                formatter={(v) => [`LKR ${Number(v).toLocaleString()}`, 'Price']}
              />
              <Area type="monotone" dataKey="price" stroke="#2D6A2D" strokeWidth={2} fill="url(#priceGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { href: '/dashboard/forecast',  label: 'Full Forecast',      icon: '📈' },
          { href: '/dashboard/elevation', label: 'Elevation Levels',   icon: '⛰️' },
          { href: '/dashboard/seasonal',  label: 'Seasonal Trends',    icon: '📅' },
          { href: '/dashboard/economic',  label: 'Economic Factors',   icon: '💱' },
          { href: '/dashboard/reports',   label: 'Export Reports',     icon: '📄' },
          { href: '/dashboard/data',      label: 'Historical Data',    icon: '🗄️' },
        ].map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-4 flex items-center gap-3
              hover:border-[var(--tea)] hover:shadow-md transition-all"
          >
            <span className="text-xl">{l.icon}</span>
            <span className="text-sm font-medium text-[var(--text)]">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
