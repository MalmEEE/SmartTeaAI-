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
      cachedGet<{ data: PricePoint[] }>('/history'),
      cachedGet<{ data: ElevationPricePoint[] }>('/history/elevation'),
    ])
      .then(([nat, elev]) => {
        setNational((nat.data ?? []).slice().reverse());
        setElevation((elev.data ?? []).slice().reverse());
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
      <h1 className="text-2xl font-bold text-[var(--text)]">Historical Data</h1>
      {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Historical Data</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Browse full dataset used for model training and evaluation</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {/* Tabs */}
        <div className="flex bg-[var(--cream-d)] rounded-lg p-1 gap-1">
          {(['national', 'elevation'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
                ${tab === t ? 'bg-white shadow-sm text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
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
          className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-[var(--tea)]/30 focus:border-[var(--tea)] w-60"
        />
        <span className="text-xs text-[var(--muted)] ml-auto">
          {tab === 'national' ? filteredNational.length : filteredElevation.length} rows
        </span>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          {tab === 'national' ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--cream)] z-10">
                <tr>
                  {['Month', 'Price (LKR)', 'Split'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredNational.map(p => (
                  <tr key={p.month} className="hover:bg-[var(--cream)] transition-colors">
                    <td className="px-5 py-2.5 font-mono text-xs">{p.month}</td>
                    <td className="px-5 py-2.5">{p.price.toLocaleString()}</td>
                    <td className="px-5 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${p.split === 'train' ? 'bg-[#e8f4e8] text-[#2D6A2D]'
                          : p.split === 'val' ? 'bg-[#fdf6d8] text-[#8a6d00]'
                          : 'bg-[#fdecea] text-[#C0392B]'}`}>
                        {p.split}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--cream)] z-10">
                <tr>
                  {['Month', 'High (LKR)', 'Medium (LKR)', 'Low (LKR)', 'Split'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredElevation.map(p => (
                  <tr key={p.month} className="hover:bg-[var(--cream)] transition-colors">
                    <td className="px-5 py-2.5 font-mono text-xs">{p.month}</td>
                    <td className="px-5 py-2.5 text-[#2D6A2D] font-medium">{p.price_high?.toLocaleString() ?? '—'}</td>
                    <td className="px-5 py-2.5 text-[#8a6d00]">{p.price_medium?.toLocaleString() ?? '—'}</td>
                    <td className="px-5 py-2.5 text-[#C0392B]">{p.price_low?.toLocaleString() ?? '—'}</td>
                    <td className="px-5 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${p.split === 'train' ? 'bg-[#e8f4e8] text-[#2D6A2D]'
                          : p.split === 'val' ? 'bg-[#fdf6d8] text-[#8a6d00]'
                          : 'bg-[#fdecea] text-[#C0392B]'}`}>
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
