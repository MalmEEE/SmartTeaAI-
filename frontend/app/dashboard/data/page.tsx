'use client';

import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from '@/lib/cache';
import type { PricePoint, ElevationPricePoint } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/NotAvailable';

type Tab = 'national' | 'elevation';

export default function DataPage() {
  const [tab, setTab] = useState<Tab>('national');
  const [national, setNational] = useState<PricePoint[]>([]);
  const [elevation, setElevation] = useState<ElevationPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

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

  const filteredNational = useMemo(
    () => national.filter(p => p.month.includes(search)),
    [national, search]
  );
  const filteredElevation = useMemo(
    () => elevation.filter(p => p.month.includes(search)),
    [elevation, search]
  );

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Historical Data</h1>
      {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Historical Data</h1>
        <p className="text-sm text-white/50 mt-0.5">Browse full dataset used for model training and evaluation</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {/* Tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          {(['national', 'elevation'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize
                ${tab === t ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
            >
              {t === 'national' ? 'National' : 'Elevation'}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Filter by month (e.g. 2024-01)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3.5 py-1.5 bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl focus:border-white/40 focus:bg-white/15 focus:outline-none text-sm w-60"
        />
        <span className="text-xs text-white/50 ml-auto">
          {tab === 'national' ? filteredNational.length : filteredElevation.length} rows
        </span>
      </div>

      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          {tab === 'national' ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white/5 z-10">
                <tr>
                  {['Month', 'Price (LKR)', 'Split'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredNational.map(p => (
                  <tr key={p.month} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-2.5 font-mono text-xs text-white/80">{p.month}</td>
                    <td className="px-5 py-2.5 text-white/80">{p.price.toLocaleString()}</td>
                    <td className="px-5 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${p.split === 'train' ? 'bg-emerald-400/20 text-emerald-300'
                          : p.split === 'val' ? 'bg-yellow-400/20 text-yellow-300'
                          : 'bg-red-400/20 text-red-300'}`}>
                        {p.split}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white/5 z-10">
                <tr>
                  {['Month', 'High (LKR)', 'Medium (LKR)', 'Low (LKR)', 'Split'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredElevation.map(p => (
                  <tr key={p.month} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-2.5 font-mono text-xs text-white/80">{p.month}</td>
                    <td className="px-5 py-2.5 text-[#6ee7b7] font-medium">{p.price_high?.toLocaleString() ?? '—'}</td>
                    <td className="px-5 py-2.5 text-[#fde68a]">{p.price_medium?.toLocaleString() ?? '—'}</td>
                    <td className="px-5 py-2.5 text-[#fca5a5]">{p.price_low?.toLocaleString() ?? '—'}</td>
                    <td className="px-5 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${p.split === 'train' ? 'bg-emerald-400/20 text-emerald-300'
                          : p.split === 'val' ? 'bg-yellow-400/20 text-yellow-300'
                          : 'bg-red-400/20 text-red-300'}`}>
                        {p.split}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
