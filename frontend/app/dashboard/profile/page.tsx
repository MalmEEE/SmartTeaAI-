'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/types';
import { T, type Lang } from '@/lib/translations';
import { RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const STORAGE_LANG = 'smartteaai_farmer_lang';
const STORAGE_KEY  = 'smartteaai_role_request';

type RequestableRole = Exclude<UserRole, 'farmer' | 'admin'>;

const REQUESTABLE: { key: RequestableRole; labelKey: keyof typeof T; descKey: keyof typeof T }[] = [
  { key: 'broker',   labelKey: 'roleBrokerLabel',   descKey: 'roleBrokerDesc'   },
  { key: 'exporter', labelKey: 'roleExporterLabel',  descKey: 'roleExporterDesc' },
  { key: 'buyer',    labelKey: 'roleBuyerLabel',     descKey: 'roleBuyerDesc'    },
  { key: 'analyst',  labelKey: 'roleAnalystLabel',   descKey: 'roleAnalystDesc'  },
];

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
      <div>
        <h1 className="text-2xl font-bold text-white">{T.myAccount[lang]}</h1>
        <p className="text-sm text-white/50 mt-0.5">{T.profileSubtitle[lang]}</p>
      </div>

      {/* Profile info */}
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          {T.profileSection[lang]}
        </p>
        <div className="divide-y divide-white/10">
          <div className="flex justify-between items-center py-3">
            <span className="text-white/60 text-sm">{T.profileName[lang]}</span>
            <span className="text-white font-medium">{user?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-white/60 text-sm">{T.profileEmail[lang]}</span>
            <span className="text-white font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-white/60 text-sm">{T.profileRole[lang]}</span>
            <RoleBadge role={user?.role ?? ''} />
          </div>
        </div>
      </div>

      {/* Role upgrade — farmers only */}
      {isFarmer && (
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              {T.roleUpgradeTitle[lang]}
            </p>
            <p className="text-white/60 text-sm mt-2 leading-relaxed">
              {T.roleUpgradeDesc[lang]}
            </p>
          </div>

          {pending ? (
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 space-y-1.5">
              <p className="text-yellow-300 font-semibold text-sm">{T.rolePendingTitle[lang]}</p>
              <p className="text-white/60 text-sm leading-relaxed">
                {lang === 'si'
                  ? <>ඔබේ <span className="text-white font-medium capitalize">{pending.role}</span> ශ්‍රේණිය ලබා ගැනීමේ ඉල්ලීම {new Date(pending.submitted_at).toLocaleDateString()} දිනෙත් ඉදිරිපත් කෙරිණ.</>
                  : lang === 'ta'
                  ? <><span className="text-white font-medium capitalize">{pending.role}</span> பாத்திரத்திற்கான உங்கள் கோரிக்கை {new Date(pending.submitted_at).toLocaleDateString()} அன்று சமர்ப்பிக்கப்பட்டது.</>
                  : <>Your request to become a <span className="text-white font-medium capitalize">{pending.role}</span> was submitted on {new Date(pending.submitted_at).toLocaleDateString()}.</>
                }
              </p>
              <p className="text-white/40 text-xs">{T.rolePendingNote[lang]}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {REQUESTABLE.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setSelected(r.key)}
                    className={`text-left p-4 rounded-xl border-2 transition-all duration-150
                      ${selected === r.key
                        ? 'border-emerald-400/60 bg-emerald-400/10'
                        : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'}`}
                  >
                    <p className="font-semibold text-white text-sm">{T[r.labelKey][lang]}</p>
                    <p className="text-white/50 text-xs mt-1 leading-relaxed">{T[r.descKey][lang]}</p>
                  </button>
                ))}
              </div>

              {error && <p className="text-red-300 text-sm">{error}</p>}

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
      )}

      {/* Non-farmer, non-admin */}
      {!isFarmer && user?.role !== 'admin' && (
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 text-sm text-white/50">
          Your role was assigned by an administrator. Contact your admin to change it.
        </div>
      )}
    </div>
  );
}
