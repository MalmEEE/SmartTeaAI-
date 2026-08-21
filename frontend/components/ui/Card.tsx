import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-[var(--border)] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[var(--border)]">
      <div>
        <h3 className="font-semibold text-[var(--text)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon?: ReactNode;
}

export function KpiCard({ label, value, sub, accent, icon }: KpiCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 flex gap-4 items-start ${accent ? 'border-l-4 border-l-[var(--tea)]' : ''}`}>
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-[var(--cream)] flex items-center justify-center text-[var(--tea)] shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-[var(--text)] mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-[var(--muted)] mt-1">{sub}</p>}
      </div>
    </div>
  );
}
