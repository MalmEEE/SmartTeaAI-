'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { T, type Lang } from '@/lib/translations';

const STORAGE_KEY  = 'smartteaai_role_request';
const STORAGE_LANG = 'smartteaai_farmer_lang';

export function RoleRequestBanner() {
  const { user } = useAuth();
  const role = user?.role;

  const [farmerPending, setFarmerPending] = useState<string | null>(null); // role name
  const [adminCount,    setAdminCount]    = useState<number>(0);
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const l = localStorage.getItem(STORAGE_LANG) as Lang | null;
    return l && ['en', 'si', 'ta'].includes(l) ? l : 'en';
  });

  useEffect(() => {
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('smartteaai:lang', onLang);
    return () => window.removeEventListener('smartteaai:lang', onLang);
  }, []);

  useEffect(() => {
    if (role === 'farmer') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setFarmerPending(parsed.role ?? null);
        } catch { /* ignore */ }
      }
    }
    if (role === 'admin') {
      api.get<{ id: number; status: string }[]>('/admin/role-requests')
        .then(r => setAdminCount((r.data ?? []).filter(x => x.status === 'pending').length))
        .catch(() => { /* silent */ });
    }
  }, [role]);

  if (role === 'farmer' && farmerPending) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl
        bg-yellow-400/10 border border-yellow-400/20 text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-yellow-300 shrink-0">⏳</span>
          <p className="text-yellow-200 leading-snug">
            {lang === 'si'
              ? <>ඔබේ <span className="font-semibold capitalize">{farmerPending}</span> භූමිකා ඉල්ලීම පරිපාලකගේ අනුමැතිය සඳහා රැඳී ඇත.</>
              : lang === 'ta'
              ? <>உங்கள் <span className="font-semibold capitalize">{farmerPending}</span> பாத்திர கோரிக்கை நிர்வாகியின் ஒப்புதலுக்காக காத்திருக்கிறது.</>
              : <>Your <span className="font-semibold capitalize">{farmerPending}</span> role request is pending admin approval.</>
            }
          </p>
        </div>
        <Link
          href="/dashboard/profile"
          className="shrink-0 text-xs font-semibold text-yellow-300 hover:text-yellow-100 underline underline-offset-2 transition-colors"
        >
          {T.myAccount[lang]}
        </Link>
      </div>
    );
  }

  if (role === 'admin' && adminCount > 0) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl
        bg-amber-400/10 border border-amber-400/20 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-amber-300 shrink-0">📋</span>
          <p className="text-amber-200">
            <span className="font-semibold">{adminCount}</span>{' '}
            {adminCount === 1 ? 'role upgrade request is' : 'role upgrade requests are'} awaiting your review.
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="shrink-0 text-xs font-semibold text-amber-300 hover:text-amber-100 underline underline-offset-2 transition-colors"
        >
          Review →
        </Link>
      </div>
    );
  }

  return null;
}
