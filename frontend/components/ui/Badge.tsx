type Variant = 'tea' | 'gold' | 'red' | 'gray' | 'risk-low' | 'risk-mid' | 'risk-high';

const styles: Record<Variant, string> = {
  tea:        'bg-[#e8f4e8] text-[#2D6A2D] border border-[#2D6A2D]/20',
  gold:       'bg-[#fdf6d8] text-[#8a6d00] border border-[#C49A00]/30',
  red:        'bg-[#fdecea] text-[#C0392B] border border-[#C0392B]/20',
  gray:       'bg-[var(--cream-d)] text-[var(--muted)] border border-[var(--border)]',
  'risk-low': 'bg-[#e8f4e8] text-[#2D6A2D] border border-[#2D6A2D]/20',
  'risk-mid': 'bg-[#fdf6d8] text-[#8a6d00] border border-[#C49A00]/30',
  'risk-high':'bg-[#fdecea] text-[#C0392B] border border-[#C0392B]/20',
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
  const dot = level === 'Low' ? '#2D6A2D' : level === 'Medium' ? '#C49A00' : '#C0392B';
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
