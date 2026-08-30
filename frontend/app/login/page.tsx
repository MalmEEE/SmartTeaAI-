'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-white font-semibold text-sm">{title}</p>
        <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      router.push(u?.role === 'farmer' ? '/dashboard/farmer' : '/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1f0a 0%, #162e16 50%, #1e4a1e 100%)' }}
    >
      {/* ── Left branding panel ────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between flex-1 px-14 py-12 relative overflow-hidden">
        {/* Background tea leaf decorations */}
        <img src="/tea-leaf.png" alt="" aria-hidden
          className="pointer-events-none select-none absolute -left-24 top-1/2 -translate-y-1/2 w-[600px] opacity-[0.08] rotate-[15deg]" />
        <img src="/tea-leaf.png" alt="" aria-hidden
          className="pointer-events-none select-none absolute right-0 -bottom-20 w-[300px] opacity-[0.06] -rotate-[20deg]" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/tea-leaf.png" alt="" className="w-10 h-10 object-contain" />
          <span className="text-white font-bold text-lg">SmartTeaAI</span>
        </div>

        {/* Main branding */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
              Sri Lanka Tea<br />
              <span className="text-emerald-400">Price Intelligence</span>
            </h1>
            <p className="text-white/50 text-lg mt-4 leading-relaxed max-w-sm">
              AI-powered forecasts to help tea industry professionals make smarter decisions.
            </p>
          </div>

          <div className="space-y-5">
            <Feature
              icon="🤖"
              title="AI-Powered Forecasts"
              desc="LSTM deep learning model predicts next month's auction prices with high accuracy."
            />
            <Feature
              icon="⛰️"
              title="Elevation-Based Analysis"
              desc="Separate insights for high, medium and low grown tea regions."
            />
            <Feature
              icon="🌐"
              title="Trilingual Interface"
              desc="Full support for English, Sinhala and Tamil."
            />
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/20 text-xs">
          © {new Date().getFullYear()} SmartTeaAI · For decision support only
        </p>
      </div>

      {/* ── Right form panel ───────────────────────────────────── */}
      <div className="w-full lg:w-[420px] shrink-0 flex flex-col justify-center px-8 py-12
        bg-white/5 backdrop-blur-md border-l border-white/10 relative">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <img src="/tea-leaf.png" alt="" className="w-9 h-9 object-contain" />
          <span className="text-white font-bold text-lg">SmartTeaAI</span>
        </div>

        <div className="max-w-sm mx-auto w-full">
          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-white/40 text-sm mb-8">Sign in to continue to your dashboard</p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-400/10 border border-red-400/25 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/25 text-sm
                  focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/25 text-sm
                  focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/50 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
                disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-900/40 mt-1"
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/40">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
              Create one
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-white/25 text-xs text-center mb-2">Demo credentials</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Farmer', email: 'farmer@demo.test' },
                { label: 'Admin', email: 'admin@demo.test' },
              ].map(d => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => { setEmail(d.email); setPassword('TeaDemo@2025'); }}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 text-xs transition-all text-left"
                >
                  <span className="block font-medium">{d.label}</span>
                  <span className="font-mono text-[10px] text-white/25">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
