'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';

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
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">🍃</span>
          <h1 className="text-2xl font-bold text-[var(--tea-dark)] mt-3">SmartTeaAI</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--tea)]/30 focus:border-[var(--tea)]
                  bg-white text-[var(--text)] placeholder-[var(--muted)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--tea)]/30 focus:border-[var(--tea)]
                  bg-white text-[var(--text)] placeholder-[var(--muted)]"
              />
            </div>
            <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[var(--tea)] font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>

        {/* Demo hint */}
        <p className="text-center text-xs text-[var(--muted)] mt-4">
          Demo: <span className="font-mono">farmer@demo.test</span> / <span className="font-mono">TeaDemo@2025</span>
        </p>
      </div>
    </div>
  );
}
