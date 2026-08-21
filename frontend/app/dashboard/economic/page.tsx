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

const TOOLTIP_STYLE = {
  background: 'rgba(10,30,10,0.85)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  fontSize: 12,
  color: '#fff',
};

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
      <h1 className="text-2xl font-bold text-white">Economic Factors</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {[1,2,3,4].map(i => <ChartSkeleton key={i} />)}
      </div>
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Economic Factors</h1>
        <p className="text-sm text-white/50 mt-0.5">Weather, FX, oil, and global tea market indicators</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Rainfall */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Rainfall (mm)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="rainfall_mm" fill="#6ee7b7" radius={[3,3,0,0]} name="Rainfall mm" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Avg Temperature (°C)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="avg_temp_c" stroke="#fca5a5" strokeWidth={2} dot={false} name="Temp °C" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* USD/LKR */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">USD/LKR Exchange Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="usd_lkr_avg" stroke="#fde68a" strokeWidth={2} dot={false} name="USD/LKR" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mombasa + Oil */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Mombasa Price & Oil Price</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} interval={3} />
              <YAxis yAxisId="mom" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} />
              <YAxis yAxisId="oil" orientation="right" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Line yAxisId="mom" type="monotone" dataKey="mombasa_usd_kg" stroke="#6ee7b7" strokeWidth={2} dot={false} name="Mombasa USD/kg" />
              <Line yAxisId="oil" type="monotone" dataKey="oil_price"      stroke="#fca5a5" strokeWidth={2} dot={false} name="Oil USD/bbl" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
