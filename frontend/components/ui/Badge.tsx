type Variant = 'tea' | 'gold' | 'red' | 'gray' | 'risk-low' | 'risk-mid' | 'risk-high';

const styles: Record<Variant, string> = {
  tea:         'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30',
  gold:        'bg-yellow-400/20  text-yellow-300  border border-yellow-400/30',
  red:         'bg-red-400/20     text-red-300     border border-red-400/30',
  gray:        'bg-white/10       text-white/60    border border-white/15',
  'risk-low':  'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30',
  'risk-mid':  'bg-yellow-400/20  text-yellow-300  border border-yellow-400/30',
  'risk-high': 'bg-red-400/20     text-red-300     border border-red-400/30',
};

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}

export function RiskBadge({ level }: { level: 'Low' | 'Medium' | 'High' }) {
  const v = level === 'Low' ? 'risk-low' : level === 'Medium' ? 'risk-mid' : 'risk-high';
  const dot = level === 'Low' ? '#6ee7b7' : level === 'Medium' ? '#fde68a' : '#fca5a5';
  return (
    <Badge variant={v}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dot }} />
      {level} Risk
    </Badge>
  );
}

export function SignalBadge({ signal }: { signal: 'Sell' | 'Hold' | 'Monitor' }) {
  const v = signal === 'Hold' ? 'tea' : signal === 'Sell' ? 'red' : 'gold';
  return <Badge variant={v}>{signal}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const v: Variant = role === 'admin' ? 'red' : role === 'analyst' ? 'gold' : 'tea';
  return <Badge variant={v}>{role}</Badge>;
}
