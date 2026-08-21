import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:   'bg-[var(--tea)] text-white hover:bg-[var(--tea-dark)] active:scale-[0.98]',
  secondary: 'bg-[var(--cream)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--cream-d)]',
  ghost:     'text-[var(--text)] hover:bg-[var(--cream)] border border-transparent',
  danger:    'bg-[#C0392B] text-white hover:bg-[#a53122] active:scale-[0.98]',
};
const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, children, disabled, className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150
        ${variants[variant]} ${sizes[size]}
        disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading && (
        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {!loading && icon}
      {children}
    </button>
  );
}
