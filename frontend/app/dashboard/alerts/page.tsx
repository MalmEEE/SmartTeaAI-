'use client';

import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import { useAuth } from '@/lib/auth';
import type { ForecastResult } from '@/types';
import { RiskBadge, SignalBadge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';
import { T, type Lang, buildRecommendationSentence } from '@/lib/translations';

// ── Non-farmer alerts (unchanged) ────────────────────────────────────

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
      title: 'Large Price Movement Detected',
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

// ── Farmer-specific alerts ────────────────────────────────────────────

interface FarmerAlert {
  id: string;
  icon: string;
  cardClass: string;
  iconBgClass: string;
  title: string;
  body: string;
}

function buildFarmerAlerts(f: ForecastResult, lang: Lang): FarmerAlert[] {
  const alerts: FarmerAlert[] = [];
  const sig = f.recommendation.signal;

  const signalLabelKey = sig === 'Sell' ? 'signalSell' : sig === 'Hold' ? 'signalHold' : 'signalWatch';
  alerts.push({
    id: 'signal',
    icon: sig === 'Sell' ? '↑' : sig === 'Hold' ? '⏸' : '●',
    cardClass: sig === 'Sell'
      ? 'border-emerald-400/30 bg-emerald-400/10'
      : sig === 'Hold'
      ? 'border-yellow-400/30 bg-yellow-400/10'
      : 'border-orange-400/30 bg-orange-400/10',
    iconBgClass: sig === 'Sell' ? 'bg-emerald-400/20' : sig === 'Hold' ? 'bg-yellow-400/20' : 'bg-orange-400/20',
    title: T[signalLabelKey][lang],
    body: buildRecommendationSentence(sig, f.change_pct, lang),
  });

  if (f.risk_level === 'High') {
    alerts.push({
      id: 'risk',
      icon: '⚠️',
      cardClass: 'border-red-400/30 bg-red-400/10',
      iconBgClass: 'bg-red-400/15',
      title: T.alertRiskHTitle[lang],
      body: T.alertRiskHBody[lang],
    });
  } else if (f.risk_level === 'Medium') {
    alerts.push({
      id: 'risk-med',
      icon: '⚡',
      cardClass: 'border-yellow-400/20 bg-yellow-400/5',
      iconBgClass: 'bg-yellow-400/15',
      title: T.alertRiskMTitle[lang],
      body: T.alertRiskMBody[lang],
    });
  }

  if (Math.abs(f.change_pct) > 10) {
    alerts.push({
      id: 'swing',
      icon: f.change_pct > 0 ? '📈' : '📉',
      cardClass: 'border-white/15 bg-white/5',
      iconBgClass: 'bg-white/10',
      title: T.alertSwingTitle[lang],
      body: f.change_pct > 0 ? T.alertSwingUp[lang] : T.alertSwingDown[lang],
    });
  }

  return alerts;
}

// ── Page ──────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { user } = useAuth();
  const isFarmer = user?.role === 'farmer';

  const lang = useState<Lang>(() => {
    if (!isFarmer || typeof window === 'undefined') return 'en';
    return (localStorage.getItem('smartteaai_farmer_lang') as Lang | null) ?? 'en';
  })[0];

  const elevation = useState<string>(() => {
    if (!isFarmer || typeof window === 'undefined') return 'high';
    return localStorage.getItem('smartteaai_farmer_elevation') ?? 'high';
  })[0];

  const [farmerAlerts, setFarmerAlerts] = useState<FarmerAlert[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isFarmer) {
      cachedGet<ForecastResult>(`/predict?elevation=${elevation}`)
        .then(r => setFarmerAlerts(buildFarmerAlerts(r, lang)))
        .catch(() => setError('fetch_error'))
        .finally(() => setLoading(false));
    } else {
      cachedGet<ForecastResult>('/predict')
        .then(r => setAlerts(buildAlerts(r)))
        .catch(() => setError('Failed to load alerts.'))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFarmer]);

  const typeIcon: Record<Alert['type'], string> = { price: '📈', risk: '⚠️', info: 'ℹ️' };
  const typeBg:   Record<Alert['type'], string> = { price: 'bg-emerald-400/10', risk: 'bg-yellow-400/10', info: 'bg-white/5' };

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">
        {isFarmer ? T.alerts[lang] : 'Alerts'}
      </h1>
      {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
    </div>
  );

  if (error) return <ErrorState message={isFarmer ? T.errorText[lang] : error} />;

  // ── Farmer view ───────────────────────────────────────────────────
  if (isFarmer) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">{T.alerts[lang]}</h1>
          <p className="text-sm text-white/50 mt-0.5">{T.alertsSubtitle[lang]}</p>
        </div>

        {farmerAlerts.length === 0 && (
          <div className="text-center py-20 text-white/50">{T.noAlerts[lang]}</div>
        )}

        <div className="space-y-3">
          {farmerAlerts.map(a => (
            <div
              key={a.id}
              className={`border-2 rounded-2xl p-5 flex gap-4 backdrop-blur-md ${a.cardClass}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${a.iconBgClass}`}>
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-base leading-tight">{a.title}</p>
                <p className="text-sm text-white/75 mt-1.5 leading-relaxed">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Non-farmer view (unchanged) ───────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="text-sm text-white/50 mt-0.5">Real-time market signals and forecast alerts</p>
      </div>

      {alerts.length === 0 && (
        <div className="text-center py-20 text-white/50">No alerts at this time.</div>
      )}

      <div className="space-y-3">
        {alerts.map(a => (
          <div
            key={a.id}
            className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 flex gap-4"
          >
            <div className={`w-10 h-10 rounded-xl ${typeBg[a.type]} flex items-center justify-center text-lg shrink-0`}>
              {typeIcon[a.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-white text-sm">{a.title}</p>
                <div className="flex gap-1.5 shrink-0">
                  {a.signal && <SignalBadge signal={a.signal} />}
                  {a.risk && <RiskBadge level={a.risk} />}
                </div>
              </div>
              <p className="text-sm text-white/60 mt-1 leading-relaxed">{a.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
