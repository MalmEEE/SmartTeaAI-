'use client';

import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { WeatherEconomicPoint } from '@/types';
import { ChartSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

export default function EconomicPage() {
  const [data, setData] = useState<WeatherEconomicPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cachedGet<{ data: WeatherEconomicPoint[] }>('/history/weather-economic')
      .then(r => setData(r.data ?? []))
      .catch(() => setError('Failed to load economic data.'))
      .finally(() => setLoading(false));
  }, []);

  const recent = data.slice(-24);

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Economic Factors</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {[1,2,3,4].map(i => <ChartSkeleton key={i} />)}
      </div>
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Economic Factors</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Weather, FX, oil, and global tea market indicators</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Rainfall */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5">
          <h3 className="font-semibold text-[var(--text)] mb-4">Rainfall (mm)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6B7280' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="rainfall_mm" fill="#3d8a3d" radius={[3,3,0,0]} name="Rainfall mm" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5">
          <h3 className="font-semibold text-[var(--text)] mb-4">Avg Temperature (°C)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6B7280' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Line type="monotone" dataKey="avg_temp_c" stroke="#C0392B" strokeWidth={2} dot={false} name="Temp °C" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* USD/LKR */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5">
          <h3 className="font-semibold text-[var(--text)] mb-4">USD/LKR Exchange Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6B7280' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Line type="monotone" dataKey="usd_lkr_avg" stroke="#C49A00" strokeWidth={2} dot={false} name="USD/LKR" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mombasa + Oil */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5">
          <h3 className="font-semibold text-[var(--text)] mb-4">Mombasa Price & Oil Price</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E2" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6B7280' }} interval={3} />
              <YAxis yAxisId="mom" tick={{ fontSize: 9, fill: '#6B7280' }} />
              <YAxis yAxisId="oil" orientation="right" tick={{ fontSize: 9, fill: '#6B7280' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend />
              <Line yAxisId="mom" type="monotone" dataKey="mombasa_usd_kg" stroke="#2D6A2D" strokeWidth={2} dot={false} name="Mombasa USD/kg" />
              <Line yAxisId="oil" type="monotone" dataKey="oil_price"      stroke="#C0392B" strokeWidth={2} dot={false} name="Oil USD/bbl" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
