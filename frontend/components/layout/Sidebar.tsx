'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/types';
import { T, type Lang } from '@/lib/translations';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}

const NAV: NavItem[] = [
  { href: '/dashboard',              label: 'Overview',         icon: '🏠' },
  { href: '/dashboard/forecast',     label: 'Forecast',         icon: '📈' },
  { href: '/dashboard/elevation',    label: 'Elevation Levels', icon: '⛰️' },
  { href: '/dashboard/seasonal',     label: 'Seasonal Trends',  icon: '📅' },
  { href: '/dashboard/economic',     label: 'Economic Factors', icon: '💱' },
  { href: '/dashboard/whatif',       label: 'What-If',          icon: '🔬', roles: ['broker','exporter','buyer','analyst','admin'] },
  { href: '/dashboard/sentiment',    label: 'Sentiment',        icon: '📰', roles: ['broker','exporter','buyer','analyst','admin'] },
  { href: '/dashboard/model',        label: 'Model Info',       icon: '🤖', roles: ['analyst','admin'] },
  { href: '/dashboard/reports',      label: 'Reports',          icon: '📄' },
  { href: '/dashboard/data',         label: 'Historical Data',  icon: '🗄️' },
  { href: '/dashboard/alerts',       label: 'Alerts',           icon: '🔔' },
  { href: '/dashboard/profile',     label: 'My Account',       icon: '👤' },
  { href: '/dashboard/admin',        label: 'Admin',            icon: '⚙️', roles: ['admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();

  const isFarmer = user?.role === 'farmer';

  const [farmerLang, setFarmerLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    return (localStorage.getItem('smartteaai_farmer_lang') as Lang | null) ?? 'en';
  });

  useEffect(() => {
    const onLangChange = (e: Event) => setFarmerLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('smartteaai:lang', onLangChange);
    return () => window.removeEventListener('smartteaai:lang', onLangChange);
  }, []);

  const lang = isFarmer ? farmerLang : 'en';

  const farmerNav = [
    { href: '/dashboard/farmer',  label: T.myDashboard[lang], icon: '🏠' },
    { href: '/dashboard/alerts',  label: T.alerts[lang],      icon: '🔔' },
    { href: '/dashboard/reports', label: T.reports[lang],     icon: '📄' },
    { href: '/dashboard/profile', label: T.myAccount[lang],   icon: '👤' },
  ];

  const visible = isFarmer
    ? farmerNav
    : NAV.filter(n => !n.roles || can(...n.roles));

  return (
    <aside
      className="w-60 shrink-0 h-screen sticky top-0 flex flex-col overflow-y-auto z-20 border-r border-white/10"
      style={{ background: 'rgba(10, 30, 10, 0.55)', backdropFilter: 'blur(20px)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
        <img src="/tea-leaf.png" alt="" className="w-9 h-9 object-contain" />
        <div>
          <p className="font-bold text-white text-base leading-tight">SmartTeaAI</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            {isFarmer ? T.tagline[lang] : 'Price Intelligence'}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visible.map(item => {
          const active = item.href === '/dashboard' || item.href === '/dashboard/farmer'
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150
                ${active
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
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
            <p className="text-sm font-medium text-white truncate">{user.name || user.email}</p>
            <p className="text-xs text-white/40 capitalize mt-0.5">{user.role}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm
              text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span>↩</span>
            {isFarmer ? T.signOut[lang] : 'Sign out'}
          </button>
        </div>
      )}
    </aside>
  );
}
