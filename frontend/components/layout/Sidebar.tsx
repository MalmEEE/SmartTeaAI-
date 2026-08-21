'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}

const NAV: NavItem[] = [
  { href: '/dashboard',              label: 'Overview',        icon: '🏠' },
  { href: '/dashboard/forecast',     label: 'Forecast',        icon: '📈' },
  { href: '/dashboard/elevation',    label: 'Elevation Levels',icon: '⛰️' },
  { href: '/dashboard/seasonal',     label: 'Seasonal Trends', icon: '📅' },
  { href: '/dashboard/economic',     label: 'Economic Factors',icon: '💱' },
  { href: '/dashboard/whatif',       label: 'What-If',         icon: '🔬', roles: ['broker','exporter','buyer','analyst','admin'] },
  { href: '/dashboard/sentiment',    label: 'Sentiment',       icon: '📰', roles: ['broker','exporter','buyer','analyst','admin'] },
  { href: '/dashboard/model',        label: 'Model Info',      icon: '🤖', roles: ['analyst','admin'] },
  { href: '/dashboard/reports',      label: 'Reports',         icon: '📄' },
  { href: '/dashboard/data',         label: 'Historical Data', icon: '🗄️' },
  { href: '/dashboard/alerts',       label: 'Alerts',          icon: '🔔' },
  { href: '/dashboard/admin',        label: 'Admin',           icon: '⚙️', roles: ['admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();

  const visible = NAV.filter(n => !n.roles || can(...n.roles));

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col bg-[var(--tea-dark)] text-white overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍃</span>
          <div>
            <p className="font-bold text-lg leading-tight">SmartTeaAI</p>
            <p className="text-xs text-white/50">Price Intelligence</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visible.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/8'
                }`}
            >
              <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      {user && (
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          <div>
            <p className="text-xs font-medium text-white/90 truncate">{user.name || user.email}</p>
            <p className="text-xs text-white/50 capitalize mt-0.5">{user.role}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
              text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="text-base">↩</span>
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
