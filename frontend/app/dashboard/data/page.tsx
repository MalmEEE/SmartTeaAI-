'use client';

import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { PricePoint, ElevationPricePoint } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';

type Tab = 'national' | 'elevation';

const SPLIT_STYLE: Record<string, string> = {
  train: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/20',
  val:   'bg-yellow-400/15  text-yellow-300  border border-yellow-400/20',
  test:  'bg-red-400/15     text-red-300     border border-red-400/20',
};

export default function DataPage() {
  const [tab, setTab]           = useState<Tab>('national');
  const [national, setNational] = useState<PricePoint[]>([]);
  const [elevation, setElevation] = useState<ElevationPricePoint[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    Promise.all([
      cachedGet<PricePoint[]>('/history'),
      cachedGet<ElevationPricePoint[]>('/history/elevation'),
    ])
      .then(([nat, elev]) => {
        setNational([...nat].reverse());
        setElevation([...elev].reverse());
      })
      .catch(() => setError('Failed to load historical data.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredNational  = useMemo(() => national.filter(p  => p.month.includes(search)), [national, search]);
  const filteredElevation = useMemo(() => elevation.filter(p => p.month.includes(search)), [elevation, search]);

  // Summary stats
  const natPrices  = national.map(p => p.price);
  const minPrice   = natPrices.length ? Math.min(...natPrices) : 0;
  const maxPrice   = natPrices.length ? Math.max(...natPrices) : 0;
  const avgPrice   = natPrices.length ? natPrices.reduce((a, b) => a + b, 0) / natPrices.length : 0;
  const dateFrom   = national.length ? national[national.length - 1].month : '—';
  const dateTo     = national.length ? national[0].month : '—';

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Historical Data</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
      {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Historical Data</h1>
        <p className="text-sm text-white/50 mt-0.5">
          Previous auction prices published by the{' '}
          <span className="text-white/80 font-medium">Sri Lanka Tea Board (SLTB)</span>
          {' '}— used as the training dataset for the forecasting models.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records',  value: `${national.length} months`,           sub: `${dateFrom} → ${dateTo}` },
          { label: 'Average Price',  value: `Rs ${avgPrice.toFixed(0)}`,           sub: 'Volume-weighted avg' },
          { label: 'Lowest Price',   value: `Rs ${minPrice.toFixed(0)}`,           sub: 'Auction floor' },
          { label: 'Highest Price',  value: `Rs ${maxPrice.toFixed(0)}`,           sub: '2022 crisis peak' },
        ].map(s => (
          <div key={s.label} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4">
            <p className="text-xs text-white/40 uppercase tracking-wider font-medium">{s.label}</p>
            <p className="text-xl font-bold text-white mt-1">{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          {(['national', 'elevation'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all
                ${tab === t
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'}`}
            >
              {t === 'national' ? '🌐 National' : '⛰️ Elevation'}
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Filter by year or month (e.g. 2022)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-1.5 bg-white/10 border border-white/15 text-white placeholder-white/25
              rounded-xl focus:border-white/35 focus:bg-white/15 focus:outline-none text-sm w-64"
          />
        </div>

        <span className="text-xs text-white/40 ml-auto font-mono">
          {tab === 'national' ? filteredNational.length : filteredElevation.length} / {national.length} rows
        </span>
      </div>

      {/* Table */}
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden">
        {/* Table header bar */}
        <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
            {tab === 'national' ? 'National Average Price (LKR/kg)' : 'Price by Elevation Category (LKR/kg)'}
          </p>
          <p className="text-xs text-white/30">Source: SLTB Colombo Tea Auction</p>
        </div>

        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          {tab === 'national' ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0f2a10]/90 backdrop-blur-sm z-10">
                <tr>
                  {['Month', 'Price (LKR / kg)', 'Dataset Split'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredNational.map((p, i) => (
                  <tr key={p.month} className={`hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="px-6 py-3 font-mono text-sm text-white/70">{p.month}</td>
                    <td className="px-6 py-3 font-semibold text-white">
                      Rs {p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${SPLIT_STYLE[p.split]}`}>
                        {p.split === 'val' ? 'validation' : p.split}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0f2a10]/90 backdrop-blur-sm z-10">
                <tr>
                  {['Month', 'High Grown', 'Medium Grown', 'Low Grown', 'Dataset Split'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredElevation.map((p, i) => (
                  <tr key={p.month} className={`hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="px-6 py-3 font-mono text-sm text-white/70">{p.month}</td>
                    <td className="px-6 py-3 font-semibold text-emerald-300">
                      {p.price_high != null ? `Rs ${p.price_high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-6 py-3 font-semibold text-yellow-300">
                      {p.price_medium != null ? `Rs ${p.price_medium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-6 py-3 font-semibold text-orange-300">
                      {p.price_low != null ? `Rs ${p.price_low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${SPLIT_STYLE[p.split]}`}>
                        {p.split === 'val' ? 'validation' : p.split}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
          <p className="text-xs text-white/30">
            <span className="inline-flex items-center gap-1.5 mr-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400/60 inline-block" />training set
            </span>
            <span className="inline-flex items-center gap-1.5 mr-4">
              <span className="w-2 h-2 rounded-full bg-yellow-400/60 inline-block" />validation set
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400/60 inline-block" />test set
            </span>
          </p>
          <p className="text-xs text-white/25">Apr 2015 – Jul 2026 · 136 months</p>
        </div>
      </div>
    </div>
  );
}
