'use client';

import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { ForecastResult } from '@/types';
import { RiskBadge, SignalBadge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';

interface Alert {
  id: string;
  title: string;
  body: string;
  signal?: 'Sell' | 'Hold' | 'Monitor';
  risk?: 'Low' | 'Medium' | 'High';
  ts: string;
  type: 'price' | 'risk' | 'info';
}

function buildAlerts(f: ForecastResult): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  alerts.push({
    id: 'forecast',
    title: `Price Forecast: LKR ${f.predicted_price_rs.toLocaleString()} for ${f.predicted_month}`,
    body: `${f.change_pct >= 0 ? '+' : ''}${f.change_pct.toFixed(1)}% vs ${f.last_known_month}. Range: ${f.price_range_low.toFixed(0)}–${f.price_range_high.toFixed(0)} LKR.`,
    signal: f.recommendation.signal,
    risk: f.risk_level,
    ts: now,
    type: 'price',
  });

  if (f.risk_level === 'High') {
    alerts.push({
      id: 'risk',
      title: 'High Price Volatility Alert',
      body: `Current risk level is High. ${f.recommendation.justification}`,
      risk: 'High',
      ts: now,
      type: 'risk',
    });
  }

  if (Math.abs(f.change_pct) > 10) {
    alerts.push({
      id: 'swing',
      title: `Large Price Movement Detected`,
      body: `Forecast shows ${Math.abs(f.change_pct).toFixed(1)}% ${f.change_pct > 0 ? 'increase' : 'decline'} from last known price of LKR ${f.last_known_price_rs.toFixed(0)}.`,
      ts: now,
      type: 'risk',
    });
  }

  alerts.push({
    id: 'model',
    title: `Model: ${f.model} · MAPE ${f.mape_pct.toFixed(2)}%`,
    body: `Prediction accuracy is ${(100 - f.mape_pct).toFixed(1)}%. RMSE: ${f.rmse.toFixed(2)}.`,
    ts: now,
    type: 'info',
  });

  return alerts;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cachedGet<ForecastResult>('/predict')
      .then(r => setAlerts(buildAlerts(r)))
      .catch(() => setError('Failed to load alerts.'))
      .finally(() => setLoading(false));
  }, []);

  const typeIcon: Record<Alert['type'], string> = {
    price: '📈',
    risk:  '⚠️',
    info:  'ℹ️',
  };
  const typeBg: Record<Alert['type'], string> = {
    price: 'bg-[#e8f4e8]',
    risk:  'bg-[#fdf6d8]',
    info:  'bg-[var(--cream-d)]',
  };

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Alerts</h1>
      {[1,2,3].map(i => <CardSkeleton key={i} />)}
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Alerts</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Real-time market signals and forecast alerts</p>
      </div>

      {alerts.length === 0 && (
        <div className="text-center py-20 text-[var(--muted)]">No alerts at this time.</div>
      )}

      <div className="space-y-3">
        {alerts.map(a => (
          <div
            key={a.id}
            className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 flex gap-4"
          >
            <div className={`w-10 h-10 rounded-lg ${typeBg[a.type]} flex items-center justify-center text-lg shrink-0`}>
              {typeIcon[a.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-[var(--text)] text-sm">{a.title}</p>
                <div className="flex gap-1.5 shrink-0">
                  {a.signal && <SignalBadge signal={a.signal} />}
                  {a.risk && <RiskBadge level={a.risk} />}
                </div>
              </div>
              <p className="text-sm text-[var(--muted)] mt-1 leading-relaxed">{a.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
