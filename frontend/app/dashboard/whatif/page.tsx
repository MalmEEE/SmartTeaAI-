'use client';

import { useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import { RiskBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/NotAvailable';

interface WhatIfResult {
  status:            'ok';
  mode:              string;
  elevation?:        string;
  target:            string;
  model:             string;
  baseline_price_rs: number;
  whatif_price_rs:   number;
  price_impact_rs:   number;
  price_impact_pct:  number;
  risk_level:        'Low' | 'Medium' | 'High';
  overrides_applied: Array<{
    feature:     string;
    pct_change?: number;
    original?:   number;
    new_value?:  number;
    status:      string;
    reason?:     string;
  }>;
  interpretation: string;
}

interface WhatIfParams {
  usd_lkr_avg:    string;
  oil_price:       string;
  mombasa_usd_kg:  string;
  rainfall_mm:     string;
  elevation:       string;
}

const DEFAULTS: WhatIfParams = {
  usd_lkr_avg:   '0',
  oil_price:      '0',
  mombasa_usd_kg: '0',
  rainfall_mm:    '0',
  elevation:      'none',
};

const FIELDS: { key: keyof Omit<WhatIfParams, 'elevation'>; label: string; hint: string }[] = [
  { key: 'usd_lkr_avg',   label: 'USD/LKR Rate',      hint: '+10 means rate rises 10%' },
  { key: 'oil_price',      label: 'Oil Price',          hint: '-20 means price drops 20%' },
  { key: 'mombasa_usd_kg', label: 'Mombasa Tea Price',  hint: '+5 means Mombasa price rises 5%' },
  { key: 'rainfall_mm',    label: 'Rainfall',           hint: '-30 means 30% less rain' },
];

export default function WhatIfPage() {
  const [params, setParams] = useState<WhatIfParams>(DEFAULTS);
  const [result, setResult] = useState<WhatIfResult | null>(null);
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
      const overrides: Record<string, number> = {};
      for (const f of FIELDS) {
        const v = parseFloat(params[f.key]);
        if (!isNaN(v) && v !== 0) overrides[f.key] = v;
      }
      if (Object.keys(overrides).length === 0) {
        setError('Change at least one factor before running the simulation.');
        setLoading(false);
        return;
      }
      const body: Record<string, unknown> = { overrides };
      if (params.elevation !== 'none') body.elevation = params.elevation;
      const r = await api.post<WhatIfResult>('/predict/whatif', body);
      setResult(r.data);
    } catch {
      setError('What-If simulation failed. Check your inputs or try again.');
    } finally {
      setLoading(false);
    }
  }

  const impactPositive = (result?.price_impact_pct ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">What-If Simulator</h1>
        <p className="text-sm text-white/50 mt-0.5">
          Enter how much each factor changes (in %) to simulate the price impact
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input form */}
        <form onSubmit={run} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-5">
          <h3 className="font-semibold text-white">Scenario Parameters</h3>
          <p className="text-xs text-white/40 -mt-3">
            Enter percentage changes — e.g. <span className="font-mono">+10</span> means 10% higher,{' '}
            <span className="font-mono">-20</span> means 20% lower. Leave at 0 to keep as-is.
          </p>

          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-white mb-1">
                {f.label} <span className="text-white/40 font-normal">% change</span>
              </label>
              <input
                type="number"
                step="1"
                min="-100"
                max="200"
                value={params[f.key]}
                onChange={e => update(f.key, e.target.value)}
                className="w-full px-3.5 py-2 bg-white/10 border border-white/20 text-white placeholder-white/30
                  rounded-xl focus:border-white/40 focus:bg-white/15 focus:outline-none text-sm"
              />
              <p className="text-xs text-white/30 mt-1">{f.hint}</p>
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-white mb-1">Elevation (optional)</label>
            <select
              value={params.elevation}
              onChange={e => update('elevation', e.target.value)}
              className="w-full px-3.5 py-2 bg-white/10 border border-white/20 text-white
                rounded-xl focus:border-white/40 focus:bg-white/15 focus:outline-none text-sm"
            >
              <option value="none"  className="bg-[#1a3d1a]">National average</option>
              <option value="high"  className="bg-[#1a3d1a]">High Grown</option>
              <option value="medium"className="bg-[#1a3d1a]">Medium Grown</option>
              <option value="low"   className="bg-[#1a3d1a]">Low Grown</option>
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm">{error}</div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full justify-center bg-white hover:bg-white/90 font-semibold"
            style={{ color: '#1e4a1e' }}
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
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  label="Simulated Price"
                  value={`Rs ${result.whatif_price_rs.toLocaleString()}`}
                  sub={`Baseline: Rs ${result.baseline_price_rs.toFixed(0)}`}
                  accent
                />
                <KpiCard
                  label="Price Impact"
                  value={`${impactPositive ? '+' : ''}${result.price_impact_pct.toFixed(1)}%`}
                  sub={`${impactPositive ? '+' : ''}Rs ${result.price_impact_rs.toFixed(2)}`}
                />
              </div>

              {/* Interpretation + risk */}
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <RiskBadge level={result.risk_level} />
                  <span className="text-xs text-white/40 font-mono">{result.model} · {result.target}</span>
                </div>
                <p className="text-sm text-white/80 leading-relaxed">{result.interpretation}</p>
              </div>

              {/* Overrides applied table */}
              {result.overrides_applied.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-wider px-4 pt-3 pb-2">
                    Overrides Applied
                  </p>
                  <table className="w-full text-xs">
                    <thead className="bg-white/5">
                      <tr>
                        {['Feature', 'Original', 'New Value', 'Change', 'Status'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-white/40 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {result.overrides_applied.map((o, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-mono text-white/70">{o.feature}</td>
                          <td className="px-4 py-2 text-white/50">{o.original ?? '—'}</td>
                          <td className="px-4 py-2 text-white/70">{o.new_value ?? '—'}</td>
                          <td className="px-4 py-2">
                            {o.pct_change !== undefined
                              ? <span className={o.pct_change >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                                  {o.pct_change >= 0 ? '+' : ''}{o.pct_change.toFixed(1)}%
                                </span>
                              : '—'}
                          </td>
                          <td className="px-4 py-2">
                            {o.status === 'ignored'
                              ? <span className="text-white/30">ignored{o.reason ? ` — ${o.reason}` : ''}</span>
                              : <span className="text-emerald-400/70">applied</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
