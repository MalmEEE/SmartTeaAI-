'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

type ReportType = 'forecast' | 'history' | 'model';

const REPORTS: { key: ReportType; label: string; desc: string; icon: string }[] = [
  {
    key: 'forecast',
    label: 'Price Forecast Report',
    desc: 'Current month prediction, signal, risk level, price range and justification.',
    icon: '📈',
  },
  {
    key: 'history',
    label: 'Historical Data Report',
    desc: 'Full price history with weather and economic indicators as a CSV export.',
    icon: '🗄️',
  },
  {
    key: 'model',
    label: 'Model Performance Report',
    desc: 'Comparison table for all models (MAE, RMSE, MAPE, R²) and SHAP feature importance.',
    icon: '🤖',
  },
];

export default function ReportsPage() {
  const [loading, setLoading] = useState<ReportType | null>(null);
  const [error, setError] = useState('');

  async function download(type: ReportType) {
    setError('');
    setLoading(type);
    try {
      const r = await api.get(`/reports/${type}`, { responseType: 'blob' });
      const isCSV = type === 'history';
      const ext = isCSV ? 'csv' : 'pdf';
      const mime = isCSV ? 'text/csv' : 'application/pdf';
      const blob = new Blob([r.data as BlobPart], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartteaai_${type}_report.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(`Failed to download ${type} report.`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Reports</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Export PDF and CSV reports for offline use</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        {REPORTS.map(r => (
          <div key={r.key} className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-6 flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--cream)] flex items-center justify-center text-2xl">
              {r.icon}
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text)]">{r.label}</h3>
              <p className="text-sm text-[var(--muted)] mt-1 leading-relaxed">{r.desc}</p>
            </div>
            <Button
              variant="secondary"
              loading={loading === r.key}
              onClick={() => download(r.key)}
              className="mt-auto"
            >
              {r.key === 'history' ? '↓ Download CSV' : '↓ Download PDF'}
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-[var(--cream-d)] rounded-xl p-5 text-sm text-[var(--muted)] space-y-1">
        <p className="font-medium text-[var(--text)]">Note</p>
        <p>Reports are generated on-demand from the latest model predictions and historical data.</p>
        <p>CSV exports open in Excel or Google Sheets. PDF reports include charts and analysis summaries.</p>
      </div>
    </div>
  );
}
