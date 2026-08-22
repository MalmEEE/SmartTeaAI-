'use client';

import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { PricePoint } from '@/types';
import { ChartSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TOOLTIP_STYLE = {
  background: 'rgba(10,30,10,0.85)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  fontSize: 12,
  color: '#fff',
};

export default function SeasonalPage() {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cachedGet<PricePoint[]>('/history')
      .then(r => setData(r))
      .catch(() => setError('Failed to load seasonal data.'))
      .finally(() => setLoading(false));
  }, []);

  const monthlyAvg = useMemo(() => {
    const acc: Record<number, number[]> = {};
    data.forEach(p => {
      const m = new Date(p.month + '-01').getMonth();
      if (!acc[m]) acc[m] = [];
      acc[m].push(p.price);
    });
    return MONTH_LABELS.map((label, i) => ({
      month: label,
      avg: acc[i] ? acc[i].reduce((a, b) => a + b, 0) / acc[i].length : 0,
    }));
  }, [data]);

  const yoyData = useMemo(() => {
    const byYear: Record<string, Record<string, number>> = {};
    data.forEach(p => {
      const d = new Date(p.month + '-01');
      const y = String(d.getFullYear());
      const m = MONTH_LABELS[d.getMonth()];
      if (!byYear[m]) byYear[m] = {};
      byYear[m][y] = p.price;
    });
    const years = [...new Set(data.map(p => p.month.slice(0, 4)))].slice(-3);
    return MONTH_LABELS.map(m => ({ month: m, ...Object.fromEntries(years.map(y => [y, byYear[m]?.[y] ?? null])) }));
  }, [data]);

  const recentYears = [...new Set(data.map(p => p.month.slice(0, 4)))].slice(-3);
  const yearColors = ['#6ee7b7', '#fde68a', '#fca5a5'];

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Seasonal Trends</h1>
      <ChartSkeleton height="h-72" />
      <ChartSkeleton height="h-72" />
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Seasonal Trends</h1>
        <p className="text-sm text-white/50 mt-0.5">Average price by month and year-over-year comparison</p>
      </div>

      {/* Monthly avg bar */}
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Average Price by Month (all years)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyAvg}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [`LKR ${Number(v).toFixed(0)}`, 'Avg Price']}
            />
            <Bar dataKey="avg" fill="#6ee7b7" radius={[4, 4, 0, 0]} name="Avg Price" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* YoY line */}
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Year-over-Year Comparison</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={yoyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
            {recentYears.map((y, i) => (
              <Line
                key={y} type="monotone" dataKey={y}
                stroke={yearColors[i % yearColors.length]} strokeWidth={2} dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-white/50 mt-2">Showing last 3 years</p>
      </div>
    </div>
  );
}
