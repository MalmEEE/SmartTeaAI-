import type { ReactNode } from 'react';

const glass = 'bg-white/10 backdrop-blur-md border border-white/15 shadow-lg';
const glassText = 'text-white';
const glassMuted = 'text-white/60';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${glass} rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-white/10">
      <div>
        <h3 className={`font-semibold ${glassText}`}>{title}</h3>
        {subtitle && <p className={`text-xs ${glassMuted} mt-0.5`}>{subtitle}</p>}
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
    <div className={`${glass} rounded-2xl p-5 flex gap-4 items-start
      ${accent ? 'border-l-4 border-l-white/50' : ''}`}>
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className={`text-xs font-medium ${glassMuted} uppercase tracking-wider`}>{label}</p>
        <p className={`text-2xl font-bold ${glassText} mt-0.5 truncate`}>{value}</p>
        {sub && <p className={`text-xs ${glassMuted} mt-1`}>{sub}</p>}
      </div>
    </div>
  );
}
