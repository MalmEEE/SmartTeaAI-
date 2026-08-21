'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Spinner } from '@/components/ui/Spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0d2b0d 0%, #1e4a1e 50%, #2d6a2d 100%)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #0d2b0d 0%, #1a3d1a 40%, #2d6a2d 100%)' }}
    >
      {/* Decorative tea leaves in background */}
      <img
        src="/tea-leaf.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 w-[480px] opacity-[0.07] rotate-12 select-none"
      />
      <img
        src="/tea-leaf.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 w-[420px] opacity-[0.06] -rotate-[30deg] select-none"
      />
      <img
        src="/tea-leaf.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-1/3 right-1/4 w-[260px] opacity-[0.04] rotate-[60deg] select-none"
      />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
