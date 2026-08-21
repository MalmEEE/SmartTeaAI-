'use client';

import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { SentimentPoint } from '@/types';
import { KpiCard } from '@/components/ui/Card';
import { ChartSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import {
  ResponsiveContainer, AreaChart, Area, ReferenceLine,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

function sentimentLabel(score: number): { label: string; color: string } {
  if (score >= 0.3) return { label: 'Positive', color: '#2D6A2D' };
  if (score <= -0.3) return { label: 'Negative', color: '#C0392B' };
  return { label: 'Neutral', color: '#C49A00' };
}

export default function SentimentPage() {
  const [data, setData] = useState<SentimentPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cachedGet<{ data: SentimentPoint[] }>('/history/sentiment')
      .then(r => setData(r.data ?? []))
      .catch(() => setError('Failed to load sentiment data.'))
      .finally(() => setLoading(false));
  }, []);

  const recent = data.slice(-24);
  const latest = recent[recent.length - 1];
  const avg3 = useMemo(() => {
    const last3 = recent.slice(-3);
    return last3.length ? last3.reduce((s, p) => s + p.sentiment_score, 0) / last3.length : 0;
  }, [recent]);

  const { label: latestLabel, color: latestColor } = latest
    ? sentimentLabel(latest.sentiment_score)
    : { label: '—', color: '#6B7280' };

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Market Sentiment</h1>
      <ChartSkeleton height="h-80" />
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Market Sentiment</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">News & market sentiment index used as a model feature</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <KpiCard
          label="Latest Sentiment"
          value={latestLabel}
          sub={latest ? `Score: ${latest.sentiment_score.toFixed(3)}` : '—'}
          icon={<span style={{ color: latestColor }}>●</span>}
        />
        <KpiCard
          label="3-Month Avg"
          value={avg3.toFixed(3)}
          sub={sentimentLabel(avg3).label}
        />
        <KpiCard
          label="Observation Period"
          value={`${recent.length} months`}
          sub={recent.length > 0 ? `${recent[0].month} → ${recent[recent.length - 1].month}` : '—'}
        />
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-6">
        <h3 className="font-semibold text-[var(--text)] mb-4">Sentiment Score Timeline (24 months)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={recent}>
            <defs>
              <linearGradient id="sentPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D6A2D" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2D6A2D" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="sentNeg" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor="#C0392B" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#C0392B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7280' }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} domain={[-1, 1]} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#DDD8CF' }}
              formatter={(v) => [Number(v).toFixed(4), 'Sentiment Score']}
            />
            <ReferenceLine y={0} stroke="#DDD8CF" strokeWidth={2} />
            <ReferenceLine y={0.3}  stroke="#2D6A2D" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={-0.3} stroke="#C0392B" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Area
              type="monotone" dataKey="sentiment_score"
              stroke="#2D6A2D" strokeWidth={2} fill="url(#sentPos)"
              name="Sentiment"
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#2D6A2D] rounded inline-block" /> Positive (&gt;0.3)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#C49A00] rounded inline-block" /> Neutral (−0.3 to 0.3)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#C0392B] rounded inline-block" /> Negative (&lt;−0.3)</span>
        </div>
      </div>
    </div>
  );
}
