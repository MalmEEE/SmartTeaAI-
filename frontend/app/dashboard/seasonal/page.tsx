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
  const [error, setError]   = useState('');
  const [tableExpanded, setTableExpanded] = useState(false);

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
      idx: i,
      avg: acc[i] ? acc[i].reduce((a, b) => a + b, 0) / acc[i].length : 0,
    }));
  }, [data]);

  // Sorted highest → lowest for the ranked table
  const rankedMonths = useMemo(
    () => [...monthlyAvg].filter(m => m.avg > 0).sort((a, b) => b.avg - a.avg),
    [monthlyAvg],
  );

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
  const yearColors  = ['#6ee7b7', '#fde68a', '#fca5a5'];

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Seasonal Trends</h1>
      <ChartSkeleton height="h-72" />
      <ChartSkeleton height="h-72" />
    </div>
  );

  if (error) return <ErrorState message={error} />;

  const allAvgs   = monthlyAvg.map(m => m.avg).filter(Boolean);
  const minAvg    = allAvgs.length ? Math.min(...allAvgs) : 0;
  const maxAvg    = allAvgs.length ? Math.max(...allAvgs) : 1;
  const normalize = (v: number) => (v - minAvg) / (maxAvg - minAvg || 1);
  const currentMonth  = new Date().getMonth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Seasonal Trends</h1>
        <p className="text-sm text-white/50 mt-0.5">
          Historical average auction price by month - Sri Lanka Tea Board data
        </p>
      </div>

      {/* ── Ranked months table ──────────────────────────────────────── */}
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden">
        <button
          onClick={() => setTableExpanded(p => !p)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="text-left">
            <h3 className="font-semibold text-white">Months Ranked by Average Price</h3>
            <p className="text-xs text-white/40 mt-0.5">
              Ranked highest to lowest — averaged across all years in the dataset
            </p>
          </div>
          <span className="text-white/40 text-lg ml-4">{tableExpanded ? '▲' : '▼'}</span>
        </button>

        {tableExpanded && (
          <>
            <div className="divide-y divide-white/5 border-t border-white/10">
              {rankedMonths.map((m, rank) => {
                const isTop3    = rank < 3;
                const isBottom3 = rank >= rankedMonths.length - 3;
                const isCurrent = m.idx === currentMonth;
                const ratio     = normalize(m.avg);
                const barWidth  = `${Math.round(ratio * 100)}%`;
                return (
                  <div
                    key={m.month}
                    className={`flex items-center gap-4 px-6 py-3 ${isCurrent ? 'bg-white/5' : ''}`}
                  >
                    <span className={`text-xs font-bold w-5 text-right tabular-nums
                      ${isTop3 ? 'text-emerald-400' : isBottom3 ? 'text-slate-400' : 'text-white/30'}`}>
                      {rank + 1}
                    </span>
                    <span className="text-sm font-semibold text-white w-8">{m.month}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isTop3 ? 'bg-emerald-400' : isBottom3 ? 'bg-slate-500' : 'bg-white/30'}`}
                        style={{ width: barWidth }}
                      />
                    </div>
                    <span className="text-sm font-mono text-white/70 w-24 text-right">
                      LKR {m.avg.toFixed(0)}
                    </span>
                    {isCurrent && (
                      <span className="text-xs bg-white/10 border border-white/15 text-white/50 px-2 py-0.5 rounded-full">
                        Now
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-3 border-t border-white/10 flex gap-4">
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Top 3 months
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Bottom 3 months
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Monthly avg bar chart ────────────────────────────────────── */}
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-1">Average Price by Month (all years)</h3>
        <p className="text-xs text-white/40 mb-4">Historical monthly mean across the full dataset</p>
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

      {/* ── Year-over-Year line ──────────────────────────────────────── */}
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-1">Year-over-Year Comparison</h3>
        <p className="text-xs text-white/40 mb-4">Showing last 3 years</p>
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
      </div>
    </div>
  );
}
