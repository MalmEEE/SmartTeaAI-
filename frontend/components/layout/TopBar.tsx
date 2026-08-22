'use client';

import { useAuth } from '@/lib/auth';
import { RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-[var(--border)] px-6 flex items-center justify-between shrink-0">
      <div>
        <h1 className="font-semibold text-[var(--text)] text-lg leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-[var(--text)]">{user.name ?? user.email}</p>
            </div>
            <RoleBadge role={user.role} />
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign out
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
