'use client';

import { useState, useEffect, useCallback } from 'react';
import { cachedGet } from '@/lib/cache';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import type { ForecastResult, ElevationPricePoint } from '@/types';
import { T, type Lang, formatMonth, buildRecommendationSentence } from '@/lib/translations';
import { Spinner } from '@/components/ui/Spinner';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';

type Elevation = 'high' | 'medium' | 'low';

const STORAGE_LANG = 'smartteaai_farmer_lang';
const STORAGE_ELEV = 'smartteaai_farmer_elevation';

const ELEVATION_ICONS: Record<Elevation, string> = { high: '⛰️', medium: '🌿', low: '🌱' };
const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SI_MONTHS = ['ජන','පෙබ','මාර්','අප්‍ර','මැයි','ජූනි','ජූලි','අගෝ','සැප්','ඔක්','නොව','දෙස'];
const TA_MONTHS = ['ஜன','பிப்','மார்','ஏப்','மே','ஜூன்','ஜூலை','ஆக','செப்','அக்','நவ','டிச'];

const SIGNAL_META = {
  Sell: {
    icon: '↑',
    iconClass: 'text-emerald-300',
    badgeClass: 'bg-emerald-400/20 text-emerald-300',
    labelKey: 'signalSell' as const,
    stability: { en: 'Sell Now', si: 'දැන් විකුණන්න', ta: 'இப்போது விற்கவும்' },
  },
  Hold: {
    icon: '⏸',
    iconClass: 'text-yellow-300',
    badgeClass: 'bg-yellow-400/20 text-yellow-300',
    labelKey: 'signalHold' as const,
    stability: { en: 'Wait & Hold', si: 'රැඳී සිටින්න', ta: 'காத்திருங்கள்' },
  },
  Monitor: {
    icon: '👁',
    iconClass: 'text-orange-300',
    badgeClass: 'bg-orange-400/20 text-orange-300',
    labelKey: 'signalWatch' as const,
    stability: { en: 'Watch Market', si: 'වෙළඳපොළ බලන්න', ta: 'சந்தையை கவனிக்கவும்' },
  },
} as const;

const ELEV_DESCS: Record<Elevation, Record<Lang, string>> = {
  high:   { en: 'Nuwara Eliya, Dimbula',    si: 'නුවරඑළිය, දිඹුල',        ta: 'நுவரெலியா, திம்புல' },
  medium: { en: 'Kandy, Matale',             si: 'මහනුවර, මාතලේ',          ta: 'கண்டி, மாத்தளை'    },
  low:    { en: 'Galle, Matara, Ratnapura',  si: 'ගාල්ල, මාතර, රත්නපුර', ta: 'காலி, மாத்தறை'     },
};

function ep(p: ElevationPricePoint, e: Elevation) {
  return e === 'high' ? p.price_high : e === 'medium' ? p.price_medium : p.price_low;
}

function calcVariation(hist: ElevationPricePoint[], elev: Elevation) {
  if (hist.length < 2) return [{ name: 'Up', value: 33 }, { name: 'Stable', value: 34 }, { name: 'Down', value: 33 }];
  let up = 0, stable = 0, down = 0;
  for (let i = 1; i < hist.length; i++) {
    const pct = ((ep(hist[i], elev) - ep(hist[i - 1], elev)) / ep(hist[i - 1], elev)) * 100;
    if (pct > 1.5) up++; else if (pct < -1.5) down++; else stable++;
  }
  const total = up + stable + down || 1;
  return [
    { name: 'Up',     value: Math.round((up     / total) * 100) },
    { name: 'Stable', value: Math.round((stable / total) * 100) },
    { name: 'Down',   value: Math.round((down   / total) * 100) },
  ];
}


function t3(en: string, si: string, ta: string, lang: Lang) {
  return lang === 'si' ? si : lang === 'ta' ? ta : en;
}

export default function FarmerPage() {
  const { user } = useAuth();

  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const l = localStorage.getItem(STORAGE_LANG) as Lang | null;
    return l && ['en','si','ta'].includes(l) ? l : 'en';
  });
  const [elevation, setElevation] = useState<Elevation>(() => {
    if (typeof window === 'undefined') return 'high';
    const e = localStorage.getItem(STORAGE_ELEV) as Elevation | null;
    return e && ['high','medium','low'].includes(e) ? e : 'high';
  });
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [history, setHistory] = useState<ElevationPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  useEffect(() => { fetchData(elevation); }, [elevation, retryKey, fetchData]);

  useEffect(() => {
    setHasPendingRequest(!!localStorage.getItem('smartteaai_role_request'));
    const handler = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('smartteaai:lang', handler);
    return () => window.removeEventListener('smartteaai:lang', handler);
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

  // ── Derived data ──────────────────────────────────────────────────────
  const chartData = history.slice(-12).map(p => ({ month: p.month.slice(0, 7), price: ep(p, elevation) }));
  const last3 = history.slice(-3);
  const avg3 = last3.length ? Math.round(last3.reduce((s, p) => s + ep(p, elevation), 0) / last3.length) : 0;
  const priceVariation = calcVariation(history, elevation);
  const sig = forecast?.recommendation?.signal ? SIGNAL_META[forecast.recommendation.signal] : null;

  const elevLabels: Record<Elevation, string> = {
    high: T.highGrown[lang], medium: T.mediumGrown[lang], low: T.lowGrown[lang],
  };

  function tickMonth(v: string) {
    const idx = parseInt(v.split('-')[1], 10) - 1;
    return (lang === 'si' ? SI_MONTHS : lang === 'ta' ? TA_MONTHS : EN_MONTHS)[idx] ?? '';
  }

  const today = new Date();
  const monthNames = lang === 'si' ? SI_MONTHS : lang === 'ta' ? TA_MONTHS : EN_MONTHS;
  const dateStr = `${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            {T.welcome[lang]} {user?.name?.split(' ')[0] ?? ''} 🍃
          </h1>
          <p className="text-white/50 text-sm mt-0.5">{T.tagline[lang]}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="flex items-center gap-2 bg-white/8 hover:bg-white/15 border border-white/12 rounded-xl px-4 py-2 transition-colors"
          >
            <span className="text-white/40 text-xs">📅</span>
            <span className="text-white/60 text-xs">{dateStr}</span>
            <span className="text-emerald-400 text-xs ml-1.5">↺ {t3('Refresh', 'යාවත්කාලීන', 'புதுப்பி', lang)}</span>
          </button>
          <div className="flex bg-white/10 rounded-xl p-1">
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
      </div>

      {/* ── Elevation picker + mini hero ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Elevation picker */}
        <div className="lg:col-span-2 bg-white/8 backdrop-blur-md border border-white/12 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-3">{T.whatTeaGrow[lang]}</p>
          <div className="grid grid-cols-3 gap-3">
            {(['high','medium','low'] as Elevation[]).map(e => (
              <button
                key={e}
                onClick={() => changeElevation(e)}
                className={`py-4 px-4 rounded-xl border-2 flex items-center gap-3 transition-all duration-200 text-left
                  ${elevation === e
                    ? 'border-emerald-400/50 bg-emerald-500/20 text-white shadow-lg shadow-emerald-500/10'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/25'
                  }`}
              >
                <span className="text-2xl shrink-0">{ELEVATION_ICONS[e]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{elevLabels[e]}</p>
                  <p className="text-[11px] opacity-55 mt-0.5 leading-snug">{ELEV_DESCS[e][lang]}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mini hero */}
        <div className="relative rounded-2xl overflow-hidden min-h-[140px]">
          <img
            src="/tea2.jpg"
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <p className="text-white text-sm font-bold mb-1">SmartTeaAI</p>
            <p className="text-white font-bold text-base leading-snug">
              {t3('Tea Price Intelligence', 'තේ මිල බුද්ධිය', 'தேயிலை விலை நுண்ணறிவு', lang)}
            </p>
            <p className="text-white/55 text-xs mt-1 leading-relaxed">
              {t3('AI forecasts for smarter selling decisions.', 'AI අනාවැකි මගින් හොඳ විකිණීමේ තීරණ.', 'AI கணிப்புகள் மூலம் சிறந்த விற்பனை.', lang)}
            </p>
          </div>
        </div>

      </div>

      {/* ── Role upgrade card ──────────────────────────────────────── */}
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

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="lg" />
          <p className="text-white/50 text-sm">{T.loading[lang]}</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────── */}
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

      {/* ── Main content ────────────────────────────────────────────── */}
      {!loading && !error && forecast && sig && (
        <>
          {/* 4 stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-5 flex flex-col gap-3">
              <p className="text-emerald-300/70 text-xs font-semibold uppercase tracking-wider">
                {t3('Next Month Price', 'ඊළඟ මාසයේ මිල', 'அடுத்த மாத விலை', lang)}
              </p>
              <div>
                <p className="text-3xl font-bold text-white tabular-nums">
                  Rs {Math.round(forecast.predicted_price_rs).toLocaleString()}
                </p>
                <p className="text-white/40 text-xs mt-1">/kg · {formatMonth(forecast.predicted_month, lang)}</p>
              </div>
              <span className={`self-start inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full
                ${forecast.change_pct >= 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300'}`}>
                {forecast.change_pct >= 0 ? '▲' : '▼'} {Math.abs(forecast.change_pct).toFixed(1)}%
              </span>
            </div>

            <div className="bg-white/8 border border-white/12 rounded-2xl p-5 flex flex-col gap-3">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                {T.lastKnown[lang]}
              </p>
              <div>
                <p className="text-3xl font-bold text-white tabular-nums">
                  Rs {Math.round(forecast.last_known_price_rs).toLocaleString()}
                </p>
                <p className="text-white/40 text-xs mt-1">/kg</p>
              </div>
              <span className="text-xs text-white/30">
                {t3('Current auction', 'වත්මන් වෙන්දේසිය', 'தற்போதைய ஏலம்', lang)}
              </span>
            </div>

            <div className="bg-white/8 border border-white/12 rounded-2xl p-5 flex flex-col gap-3">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                {t3('3-Month Average', 'මාස 3 සාමාන්‍ය', '3 மாத சராசரி', lang)}
              </p>
              <div>
                <p className="text-3xl font-bold text-white tabular-nums">
                  Rs {avg3.toLocaleString()}
                </p>
                <p className="text-white/40 text-xs mt-1">/kg</p>
              </div>
              <span className="text-xs text-white/30">
                {t3('Historical data', 'ඉතිහාස දත්ත', 'வரலாற்று தரவு', lang)}
              </span>
            </div>

            <div className="bg-white/8 border border-white/12 rounded-2xl p-5 flex flex-col gap-3">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                {t3('Market Status', 'වෙළඳපොළ තත්ත්වය', 'சந்தை நிலை', lang)}
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-black leading-none ${sig.iconClass}`}>{sig.icon}</span>
                <p className={`text-xl font-bold leading-tight ${sig.iconClass}`}>
                  {sig.stability[lang]}
                </p>
              </div>
              <p className="text-white/35 text-xs">
                {t3('AI recommendation', 'AI නිර්දේශය', 'AI பரிந்துரை', lang)}
              </p>
            </div>
          </div>

          {/* 3-col: price trend | AI analysis | price variation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Price trend chart */}
            <div className="bg-white/8 backdrop-blur-md border border-white/12 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm">{T.chartTitle[lang]}</p>
              <p className="text-white/40 text-xs mb-4 mt-0.5">{T.chartCaption[lang]}</p>
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={165}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                      tickFormatter={tickMonth}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                      domain={['auto','auto']}
                      tickFormatter={v => `${Math.round(v / 100) * 100}`}
                      width={52}
                    />
                    <Tooltip
                      contentStyle={{ background: 'rgba(10,30,10,0.92)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12, color: '#fff' }}
                      formatter={(v: unknown) => [`Rs ${Number(v).toLocaleString()}`, T.priceRs[lang]]}
                      labelFormatter={v => formatMonth(String(v), lang)}
                    />
                    <Line type="monotone" dataKey="price" stroke="#6ee7b7" strokeWidth={2.5} dot={{ r: 2.5, fill: '#6ee7b7', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-white/30 text-sm text-center py-12">{T.loading[lang]}</p>
              )}
            </div>

            {/* AI analysis */}
            <div className="bg-white/8 backdrop-blur-md border border-white/12 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🧠</span>
                <p className="text-white font-semibold text-sm">
                  {t3('AI Price Analysis', 'AI මිල විශ්ලේෂණය', 'AI விலை பகுப்பாய்வு', lang)}
                </p>
              </div>
              <div>
                <p className="text-white/40 text-xs mb-1.5">
                  {t3('Predicted price', 'අනාවැකි මිල', 'கணிக்கப்பட்ட விலை', lang)}
                </p>
                <p className="text-2xl font-bold text-emerald-300 tabular-nums leading-tight">
                  Rs {Math.round(forecast.predicted_price_rs).toLocaleString()}
                  <span className="text-sm font-normal text-white/40 ml-1">/kg</span>
                </p>
              </div>
              <p className="text-white/60 text-sm leading-relaxed flex-1">
                {buildRecommendationSentence(forecast.recommendation.signal, forecast.change_pct, lang)}
              </p>
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${sig.badgeClass} bg-opacity-10`}>
                <span className={`text-xl font-black ${sig.iconClass}`}>{sig.icon}</span>
                <p className={`text-sm font-semibold ${sig.iconClass}`}>{sig.stability[lang]}</p>
              </div>
            </div>

            {/* Price variation donut */}
            <div className="bg-white/8 backdrop-blur-md border border-white/12 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">
                {t3('Price Variation', 'මිල විචලනය', 'விலை மாறுபாடு', lang)}
              </p>
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-[110px] h-[110px]">
                  <PieChart width={110} height={110}>
                    <Pie
                      data={priceVariation}
                      cx={55}
                      cy={55}
                      innerRadius={32}
                      outerRadius={52}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="rgba(10,30,10,0.8)"
                    >
                      <Cell fill="#6ee7b7" />
                      <Cell fill="#fbbf24" />
                      <Cell fill="#f87171" />
                    </Pie>
                  </PieChart>
                </div>
                <div className="flex-1 space-y-3">
                  {[
                    { label: t3('Up', 'ඉහළ', 'அதிகரித்தது', lang), dot: 'bg-emerald-400', val: priceVariation[0].value },
                    { label: t3('Stable', 'ස්ථාවර', 'நிலையானது', lang), dot: 'bg-yellow-400', val: priceVariation[1].value },
                    { label: t3('Down', 'පහළ', 'குறைந்தது', lang), dot: 'bg-red-400', val: priceVariation[2].value },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.dot}`} />
                        <span className="text-xs text-white/60">{item.label}</span>
                      </div>
                      <span className="text-xs font-bold text-white">{item.val}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-white/25 text-[10px] mt-4 text-center">
                {t3('Based on last 12 months', 'පසුගිය මාස 12 ඇසුරෙන්', 'கடந்த 12 மாதங்கள்', lang)}
              </p>
            </div>
          </div>

          {/* Quick actions — full width */}
          <div className="bg-white/8 backdrop-blur-md border border-white/12 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">
                {t3('Quick Actions', 'ඉක්මන් සබැඳි', 'விரைவு இணைப்புகள்', lang)}
              </p>
              <div className="space-y-1">
                {[
                  {
                    href: '/dashboard/reports',
                    icon: '📊',
                    label: t3('Price Forecast', 'මිල අනාවැකිය', 'விலை கணிப்பு', lang),
                    sub:   t3('AI-powered report', 'AI මගින් ජනනය', 'AI மூலம் உருவாக்கப்பட்டது', lang),
                  },
                  {
                    href: '/dashboard/reports',
                    icon: '📄',
                    label: t3('Download Report', 'වාර්තාව බාගන්න', 'அறிக்கை பதிவிறக்கம்', lang),
                    sub:   'PDF / Excel',
                  },
                  {
                    href: '/dashboard/alerts',
                    icon: '🔔',
                    label: t3('Price Alerts', 'මිල ඇඟවීම්', 'விலை எச்சரிக்கைகள்', lang),
                    sub:   t3('Get notified on changes', 'වෙනස්කම් දැනගන්න', 'மாற்றங்களை அறியுங்கள்', lang),
                  },
                  {
                    href: '/dashboard/profile',
                    icon: '👤',
                    label: t3('My Account', 'මගේ ගිනුම', 'என் கணக்கு', lang),
                    sub:   t3('Profile & role upgrade', 'පැතිකඩ හා භූමිකාව', 'சுயவிவரம் & பாத்திரம்', lang),
                  },
                ].map(item => (
                  <Link
                    key={item.icon + item.label}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/8 transition-colors group"
                  >
                    <span className="text-xl w-8 text-center shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium group-hover:text-emerald-300 transition-colors leading-tight">{item.label}</p>
                      <p className="text-white/35 text-xs mt-0.5">{item.sub}</p>
                    </div>
                    <span className="text-white/25 text-sm group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0">→</span>
                  </Link>
                ))}
              </div>
            </div>
        </>
      )}
    </div>
  );
}
