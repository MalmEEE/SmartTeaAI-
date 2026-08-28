'use client';

import { useState, useEffect, useCallback } from 'react';
import { cachedGet } from '@/lib/cache';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import type { ForecastResult, ElevationPricePoint } from '@/types';
import { T, type Lang, formatMonth, buildRecommendationSentence } from '@/lib/translations';
import { Spinner } from '@/components/ui/Spinner';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

type Elevation = 'high' | 'medium' | 'low';

const STORAGE_LANG = 'smartteaai_farmer_lang';
const STORAGE_ELEV = 'smartteaai_farmer_elevation';

const SIGNAL_CONFIG = {
  Sell: {
    icon: '↑',
    iconClass: 'text-emerald-300',
    cardClass: 'bg-emerald-400/15 border-emerald-400/30',
    labelKey: 'signalSell',
  },
  Hold: {
    icon: '⏸',
    iconClass: 'text-yellow-300',
    cardClass: 'bg-yellow-400/15 border-yellow-400/30',
    labelKey: 'signalHold',
  },
  Monitor: {
    icon: '●',
    iconClass: 'text-orange-300',
    cardClass: 'bg-orange-400/15 border-orange-400/30',
    labelKey: 'signalWatch',
  },
} as const;

const ELEVATION_ICONS: Record<Elevation, string> = {
  high: '⛰️', medium: '🌿', low: '🌱',
};

const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SI_MONTHS = ['ජන','පෙබ','මාර්','අප්‍ර','මැයි','ජූනි','ජූලි','අගෝ','සැප්','ඔක්','නොව','දෙස'];
const TA_MONTHS = ['ஜன','பிப்','மார்','ஏப்','மே','ஜூன்','ஜூலை','ஆக','செப்','அக்','நவ','டிச'];

export default function FarmerPage() {
  const { user } = useAuth();

  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const l = localStorage.getItem(STORAGE_LANG) as Lang | null;
    return l && ['en', 'si', 'ta'].includes(l) ? l : 'en';
  });
  const [elevation, setElevation] = useState<Elevation>(() => {
    if (typeof window === 'undefined') return 'high';
    const e = localStorage.getItem(STORAGE_ELEV) as Elevation | null;
    return e && ['high', 'medium', 'low'].includes(e) ? e : 'high';
  });
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [history, setHistory] = useState<ElevationPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const fetchData = useCallback((elev: Elevation) => {
    setLoading(true);
    setError('');
    Promise.all([
      cachedGet<ForecastResult>(`/predict?elevation=${elev}`),
      cachedGet<ElevationPricePoint[]>('/history/elevation'),
    ])
      .then(([fc, hist]) => {
        setForecast(fc);
        setHistory(Array.isArray(hist) ? hist : []);
      })
      .catch(() => setError('fetch_error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData(elevation);
  }, [elevation, retryKey, fetchData]);

  useEffect(() => {
    setHasPendingRequest(!!localStorage.getItem('smartteaai_role_request'));
  }, []);

  function changeLang(l: Lang) {
    setLang(l);
    localStorage.setItem(STORAGE_LANG, l);
    window.dispatchEvent(new CustomEvent('smartteaai:lang', { detail: l }));
  }

  function changeElevation(e: Elevation) {
    setElevation(e);
    localStorage.setItem(STORAGE_ELEV, e);
  }

  const chartData = history.slice(-12).map(p => ({
    month: p.month.slice(0, 7),
    price: elevation === 'high' ? p.price_high : elevation === 'medium' ? p.price_medium : p.price_low,
  }));

  const sig = forecast?.recommendation?.signal
    ? SIGNAL_CONFIG[forecast.recommendation.signal]
    : null;

  const elevLabels: Record<Elevation, string> = {
    high:   T.highGrown[lang],
    medium: T.mediumGrown[lang],
    low:    T.lowGrown[lang],
  };

  function tickMonth(v: string) {
    const idx = parseInt(v.split('-')[1], 10) - 1;
    const names = lang === 'si' ? SI_MONTHS : lang === 'ta' ? TA_MONTHS : EN_MONTHS;
    return names[idx] ?? '';
  }

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            {T.welcome[lang]} {user?.name?.split(' ')[0] ?? ''}
          </h1>
          <p className="text-white/50 text-sm mt-0.5">{T.tagline[lang]}</p>
        </div>
        <div className="flex bg-white/10 rounded-xl p-1 shrink-0">
          {(['en','si','ta'] as Lang[]).map(l => (
            <button
              key={l}
              onClick={() => changeLang(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${lang === l ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
            >
              {T[`lang${l.charAt(0).toUpperCase() + l.slice(1)}` as keyof typeof T][lang]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Elevation picker ─────────────────────────────────────── */}
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-3">{T.whatTeaGrow[lang]}</p>
        <div className="grid grid-cols-3 gap-3">
          {(['high','medium','low'] as Elevation[]).map(e => (
            <button
              key={e}
              onClick={() => changeElevation(e)}
              className={`py-4 rounded-xl border-2 flex items-center justify-center gap-3 transition-all duration-200
                ${elevation === e
                  ? 'border-white/60 bg-white/20 text-white shadow-lg'
                  : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/30'
                }`}
            >
              <span className="text-2xl">{ELEVATION_ICONS[e]}</span>
              <span className="text-sm font-semibold">{elevLabels[e]}</span>
            </button>
          ))}
        </div>

      </div>

      {/* ── Role upgrade discovery ───────────────────────────────── */}
      {!hasPendingRequest && (
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-400/25 rounded-2xl px-5 py-4 hover:bg-emerald-500/20 hover:border-emerald-400/40 transition-all duration-200 group"
        >
          <span className="text-3xl shrink-0">💼</span>
          <div className="flex-1 min-w-0">
            <p className="text-emerald-300 font-semibold text-sm">{T.upgradePromptTitle[lang]}</p>
            <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{T.upgradePromptDesc[lang]}</p>
          </div>
          <span className="text-emerald-400 font-bold text-lg shrink-0 group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      )}

      {/* ── Loading ──────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="lg" />
          <p className="text-white/50 text-sm">{T.loading[lang]}</p>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="bg-red-400/10 border border-red-400/25 rounded-2xl p-8 text-center space-y-3">
          <p className="text-2xl">⚠️</p>
          <p className="text-white font-semibold">{T.errorTitle[lang]}</p>
          <p className="text-white/50 text-sm">{T.errorText[lang]}</p>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="mt-2 px-5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm transition-all"
          >
            {T.retry[lang]}
          </button>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      {!loading && !error && forecast && sig && (
        <>
          {/* Signal + Price — side by side on md+ */}
          <div className="grid md:grid-cols-2 gap-5">

            {/* Signal card */}
            <div className={`relative overflow-hidden border-2 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4 ${sig.cardClass}`}>
              <img
                src="/tea-leaf2.png"
                alt=""
                className="absolute -bottom-4 -right-4 w-48 opacity-50 rotate-6 drop-shadow-lg pointer-events-none select-none"
              />
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                {T.shouldISell[lang]}
              </p>
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-black leading-none shrink-0 ${sig.iconClass}`}>
                  {sig.icon}
                </span>
                <span className="text-2xl font-bold text-white leading-tight">
                  {T[sig.labelKey][lang]}
                </span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                {buildRecommendationSentence(
                  forecast.recommendation.signal,
                  forecast.change_pct,
                  lang,
                )}
              </p>
            </div>

            {/* Price card */}
            <div className="relative overflow-hidden bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 flex flex-col gap-4">
              <img
                src="/tea.png"
                alt=""
                className="absolute -top-4 -right-4 w-48 opacity-40 -rotate-6 drop-shadow-lg pointer-events-none select-none"
              />
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                {T.yourTeaPrice[lang]}
              </p>
              <div>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold text-white tabular-nums">
                    Rs {Math.round(forecast.predicted_price_rs).toLocaleString()}
                  </span>
                  <span className="text-white/50 mb-1 text-lg">/ kg</span>
                </div>
                <p className="text-white/50 text-sm mt-1">
                  {T.forMonth[lang]} {formatMonth(forecast.predicted_month, lang)}
                </p>
                <p className="text-white/35 text-xs mt-2 flex items-center gap-1">
                  <span>ℹ</span>
                  {T.priceDisclaimer[lang]}
                </p>
              </div>
              <div className="border-t border-white/10 pt-4 flex items-center justify-between mt-auto">
                <span className="text-white/50 text-sm">{T.lastKnown[lang]}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">
                    Rs {Math.round(forecast.last_known_price_rs).toLocaleString()}
                  </span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full
                    ${forecast.change_pct >= 0
                      ? 'bg-emerald-400/20 text-emerald-300'
                      : 'bg-red-400/20 text-red-300'}`}>
                    {forecast.change_pct >= 0 ? '▲' : '▼'} {Math.abs(forecast.change_pct).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trend chart — full width */}
          {chartData.length > 1 && (
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
              <p className="text-white font-semibold mb-1">{T.chartTitle[lang]}</p>
              <p className="text-white/40 text-xs mb-4">{T.chartCaption[lang]}</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                    tickFormatter={tickMonth}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                    domain={['auto', 'auto']}
                    tickFormatter={v => `Rs ${v}`}
                    width={65}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(10,30,10,0.92)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      fontSize: 13,
                      color: '#fff',
                    }}
                    formatter={(v: unknown) => [`Rs ${Number(v).toLocaleString()}`, T.priceRs[lang]]}
                    labelFormatter={v => formatMonth(String(v), lang)}
                  />
                  <Line
                    type="linear"
                    dataKey="price"
                    stroke="#6ee7b7"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#6ee7b7', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* What does this mean? */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden">
            <button
              className="w-full px-6 py-4 flex items-center justify-between text-left"
              onClick={() => setHelpOpen(v => !v)}
            >
              <span className="text-white font-medium text-sm">{T.whatMeansTitle[lang]}</span>
              <span className="text-white/40 text-xs">{helpOpen ? '▲' : '▼'}</span>
            </button>
            {helpOpen && (
              <div className="px-6 pb-5 border-t border-white/10 pt-4">
                <p className="text-white/70 text-sm leading-relaxed">{T.whatMeansText[lang]}</p>
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
