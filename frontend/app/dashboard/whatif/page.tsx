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
  { key: 'usd_lkr_avg',   label: 'USD/LKR Rate',       unit: 'LKR',     step: '1'    },
  { key: 'oil_price',      label: 'Oil Price',           unit: 'USD/bbl', step: '1'    },
  { key: 'mombasa_usd_kg', label: 'Mombasa Tea Price',  unit: 'USD/kg',  step: '0.01' },
  { key: 'rainfall_mm',   label: 'Rainfall',             unit: 'mm',      step: '5'    },
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
        usd_lkr_avg:    parseFloat(params.usd_lkr_avg),
        oil_price:      parseFloat(params.oil_price),
        mombasa_usd_kg: parseFloat(params.mombasa_usd_kg),
        rainfall_mm:    parseFloat(params.rainfall_mm),
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
        <h1 className="text-2xl font-bold text-white">What-If Simulator</h1>
        <p className="text-sm text-white/50 mt-0.5">Adjust economic and weather inputs to simulate price scenarios</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input form */}
        <form onSubmit={run} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-5">
          <h3 className="font-semibold text-white">Scenario Parameters</h3>

          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-white mb-1">
                {f.label} <span className="text-white/50 font-normal">({f.unit})</span>
              </label>
              <input
                type="number"
                step={f.step}
                value={params[f.key]}
                onChange={e => update(f.key, e.target.value)}
                className="w-full px-3.5 py-2 bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl focus:border-white/40 focus:bg-white/15 focus:outline-none text-sm"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-white mb-1">Elevation (optional)</label>
            <select
              value={params.elevation}
              onChange={e => update('elevation', e.target.value)}
              className="w-full px-3.5 py-2 bg-white/10 border border-white/20 text-white rounded-xl focus:border-white/40 focus:bg-white/15 focus:outline-none text-sm"
            >
              <option value="none" className="bg-[#1a3d1a]">National average</option>
              <option value="high" className="bg-[#1a3d1a]">High Grown</option>
              <option value="medium" className="bg-[#1a3d1a]">Medium Grown</option>
              <option value="low" className="bg-[#1a3d1a]">Low Grown</option>
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm">{error}</div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full justify-center bg-white text-[#1e4a1e] font-semibold hover:bg-white/90"
            size="lg"
          >
            Run Simulation
          </Button>
        </form>

        {/* Result */}
        <div>
          {!result ? (
            <div className="h-full flex items-center justify-center rounded-2xl border-2 border-dashed border-white/15 p-10 text-center">
              <div>
                <span className="text-4xl block mb-3">🔬</span>
                <p className="text-white/50 text-sm">Set your parameters and run the simulation to see results</p>
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
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <SignalBadge signal={result.recommendation.signal} />
                  <RiskBadge level={result.risk_level} />
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
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
