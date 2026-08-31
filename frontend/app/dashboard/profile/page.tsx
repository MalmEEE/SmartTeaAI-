'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/types';
import { T, type Lang } from '@/lib/translations';
import { RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const STORAGE_LANG = 'smartteaai_farmer_lang';
const STORAGE_KEY  = 'smartteaai_role_request';

type RequestableRole = Exclude<UserRole, 'farmer' | 'admin'>;

const REQUESTABLE: { key: RequestableRole; labelKey: keyof typeof T; descKey: keyof typeof T; icon: React.ReactNode }[] = [
  { key: 'broker',   labelKey: 'roleBrokerLabel',   descKey: 'roleBrokerDesc',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
  { key: 'exporter', labelKey: 'roleExporterLabel',  descKey: 'roleExporterDesc',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64" /></svg> },
  { key: 'buyer',    labelKey: 'roleBuyerLabel',     descKey: 'roleBuyerDesc',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg> },
  { key: 'analyst',  labelKey: 'roleAnalystLabel',   descKey: 'roleAnalystDesc',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
];

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isFarmer = user?.role === 'farmer';

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

  const [selected, setSelected] = useState<RequestableRole | null>(null);
  const [pending, setPending] = useState<{ role: string; submitted_at: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFarmer) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setPending(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [isFarmer]);

  async function submitRequest() {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/request-role', { role: selected });
      const entry = { role: selected, submitted_at: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
      setPending(entry);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to submit request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedLabel = selected
    ? T[REQUESTABLE.find(r => r.key === selected)!.labelKey][lang]
    : '';

  return (
    <div className="space-y-6 max-w-xl">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{T.myAccount[lang]}</h1>
        <p className="text-sm text-white/50 mt-0.5">{T.profileSubtitle[lang]}</p>
      </div>

      {/* Avatar + name hero card */}
      <div
        className="rounded-2xl p-6 flex items-center gap-5 border border-white/10"
        style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(255,255,255,0.05) 100%)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)' }}
        >
          {getInitials(user?.name)}
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-lg leading-tight truncate">{user?.name ?? '—'}</p>
          <p className="text-white/50 text-sm truncate mt-0.5">{user?.email ?? '—'}</p>
          <div className="mt-2">
            <RoleBadge role={user?.role ?? ''} />
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="bg-white/[0.07] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            {T.profileSection[lang]}
          </p>
        </div>
        <div className="divide-y divide-white/[0.07]">
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              <span className="text-white/60 text-sm">{T.profileName[lang]}</span>
            </div>
            <span className="text-white font-medium text-sm">{user?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
              <span className="text-white/60 text-sm">{T.profileEmail[lang]}</span>
            </div>
            <span className="text-white font-medium text-sm truncate max-w-[200px]">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              <span className="text-white/60 text-sm">{T.profileRole[lang]}</span>
            </div>
            <RoleBadge role={user?.role ?? ''} />
          </div>
        </div>
      </div>

      {/* Role upgrade — farmers only */}
      {isFarmer && (
        <div className="bg-white/[0.07] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              {T.roleUpgradeTitle[lang]}
            </p>
            <p className="text-white/50 text-sm mt-1.5 leading-relaxed">
              {T.roleUpgradeDesc[lang]}
            </p>
          </div>

          <div className="p-6 space-y-5">
            {pending ? (
              <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-300 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="space-y-1">
                    <p className="text-yellow-300 font-semibold text-sm">{T.rolePendingTitle[lang]}</p>
                    <p className="text-white/60 text-sm leading-relaxed">
                      {lang === 'si'
                        ? <>ඔබේ <span className="text-white font-medium capitalize">{pending.role}</span> ශ්‍රේණිය ලබා ගැනීමේ ඉල්ලීම {new Date(pending.submitted_at).toLocaleDateString()} දිනෙත් ඉදිරිපත් කෙරිණ.</>
                        : lang === 'ta'
                        ? <><span className="text-white font-medium capitalize">{pending.role}</span> பாத்திரத்திற்கான உங்கள் கோரிக்கை {new Date(pending.submitted_at).toLocaleDateString()} அன்று சமர்ப்பிக்கப்பட்டது.</>
                        : <>Your request to become a <span className="text-white font-medium capitalize">{pending.role}</span> was submitted on {new Date(pending.submitted_at).toLocaleDateString()}.</>
                      }
                    </p>
                    <p className="text-white/30 text-xs pt-1">{T.rolePendingNote[lang]}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {REQUESTABLE.map(r => (
                    <button
                      key={r.key}
                      onClick={() => setSelected(r.key)}
                      className={`text-left p-4 rounded-xl border-2 transition-all duration-150 cursor-pointer
                        ${selected === r.key
                          ? 'border-emerald-400/60 bg-emerald-400/10'
                          : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'}`}
                    >
                      <div className="text-white/50 mb-2">{r.icon}</div>
                      <p className="font-semibold text-white text-sm">{T[r.labelKey][lang]}</p>
                      <p className="text-white/50 text-xs mt-1 leading-relaxed">{T[r.descKey][lang]}</p>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  disabled={!selected}
                  loading={submitting}
                  onClick={submitRequest}
                  className="w-full"
                >
                  {selected
                    ? `${T.roleRequestAccess[lang]} — ${selectedLabel}`
                    : T.roleSelectPrompt[lang]}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Non-farmer, non-admin info */}
      {!isFarmer && user?.role !== 'admin' && (
        <div className="bg-white/[0.07] border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-3">
          <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
          <p className="text-sm text-white/50">
            Your role was assigned by an administrator. Contact your admin to change it.
          </p>
        </div>
      )}

    </div>
  );
}
