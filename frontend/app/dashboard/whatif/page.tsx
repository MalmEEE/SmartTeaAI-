'use client';

import { useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import type { ForecastResult } from '@/types';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/Card';
import { RiskBadge, SignalBadge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/NotAvailable';

interface WhatIfParams {
  usd_lkr_avg: string;
  oil_price: string;
  mombasa_usd_kg: string;
  rainfall_mm: string;
  elevation: string;
}

const DEFAULTS: WhatIfParams = {
  usd_lkr_avg:   '320',
  oil_price:      '80',
  mombasa_usd_kg: '2.8',
  rainfall_mm:    '180',
  elevation:      'none',
};

const FIELDS: { key: keyof WhatIfParams; label: string; unit: string; step: string }[] = [
  { key: 'usd_lkr_avg',   label: 'USD/LKR Rate',       unit: 'LKR',  step: '1'   },
  { key: 'oil_price',      label: 'Oil Price',           unit: 'USD/bbl', step: '1' },
  { key: 'mombasa_usd_kg', label: 'Mombasa Tea Price',  unit: 'USD/kg', step: '0.01' },
  { key: 'rainfall_mm',   label: 'Rainfall',             unit: 'mm',   step: '5'   },
];

export default function WhatIfPage() {
  const [params, setParams] = useState<WhatIfParams>(DEFAULTS);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(key: keyof WhatIfParams, val: string) {
    setParams(p => ({ ...p, [key]: val }));
  }

  async function run(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        usd_lkr_avg:   parseFloat(params.usd_lkr_avg),
        oil_price:     parseFloat(params.oil_price),
        mombasa_usd_kg:parseFloat(params.mombasa_usd_kg),
        rainfall_mm:   parseFloat(params.rainfall_mm),
      };
      if (params.elevation !== 'none') body.elevation = params.elevation;
      const r = await api.post<ForecastResult>('/predict/whatif', body);
      setResult(r.data);
    } catch {
      setError('What-If simulation failed. Check your inputs or try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">What-If Simulator</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Adjust economic and weather inputs to simulate price scenarios</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input form */}
        <form onSubmit={run} className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-6 space-y-5">
          <h3 className="font-semibold text-[var(--text)]">Scenario Parameters</h3>

          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                {f.label} <span className="text-[var(--muted)] font-normal">({f.unit})</span>
              </label>
              <input
                type="number"
                step={f.step}
                value={params[f.key]}
                onChange={e => update(f.key, e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--tea)]/30 focus:border-[var(--tea)]"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Elevation (optional)</label>
            <select
              value={params.elevation}
              onChange={e => update('elevation', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--tea)]/30 focus:border-[var(--tea)] bg-white"
            >
              <option value="none">National average</option>
              <option value="high">High Grown</option>
              <option value="medium">Medium Grown</option>
              <option value="low">Low Grown</option>
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
            Run Simulation
          </Button>
        </form>

        {/* Result */}
        <div>
          {!result ? (
            <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] p-10 text-center">
              <div>
                <span className="text-4xl block mb-3">🔬</span>
                <p className="text-[var(--muted)] text-sm">Set your parameters and run the simulation to see results</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  label="Simulated Price"
                  value={`LKR ${result.predicted_price_rs.toLocaleString()}`}
                  sub={result.predicted_month}
                  accent
                />
                <KpiCard
                  label="Change"
                  value={`${result.change_pct >= 0 ? '+' : ''}${result.change_pct.toFixed(1)}%`}
                  sub={`vs LKR ${result.last_known_price_rs.toFixed(0)}`}
                />
                <KpiCard
                  label="Price Range"
                  value={`${result.price_range_low.toFixed(0)}–${result.price_range_high.toFixed(0)}`}
                  sub="LKR"
                />
                <KpiCard
                  label="MAPE"
                  value={`${result.mape_pct.toFixed(2)}%`}
                  sub={result.model}
                />
              </div>
              <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <SignalBadge signal={result.recommendation.signal} />
                  <RiskBadge level={result.risk_level} />
                </div>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {result.recommendation.justification}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
