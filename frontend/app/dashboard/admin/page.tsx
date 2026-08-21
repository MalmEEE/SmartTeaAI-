'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AdminUser, RoleRequest, UserRole } from '@/types';
import { Button } from '@/components/ui/Button';
import { RoleBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState, NotAvailable } from '@/components/ui/NotAvailable';

const ALL_ROLES: UserRole[] = ['farmer','broker','exporter','buyer','analyst','admin'];

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'users' | 'requests'>('requests');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<AdminUser[]>('/admin/users'),
      api.get<RoleRequest[]>('/admin/role-requests'),
    ])
      .then(([ur, rr]) => {
        setUsers(ur.data ?? []);
        setRequests(rr.data ?? []);
      })
      .catch(() => setError('Failed to load admin data.'))
      .finally(() => setLoading(false));
  }, []);

  if (user?.role !== 'admin') {
    return <NotAvailable title="Access Denied" message="This page is only accessible to administrators." />;
  }

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--text)]">Admin Panel</h1>
      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );

  if (error) return <ErrorState message={error} />;

  const pending = requests.filter(r => r.status === 'pending');

  async function approveRequest(id: number) {
    setBusyId(id);
    try {
      await api.post(`/admin/role-requests/${id}/approve`);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
    } finally { setBusyId(null); }
  }

  async function rejectRequest(id: number) {
    setBusyId(id);
    try {
      await api.post(`/admin/role-requests/${id}/reject`);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
    } finally { setBusyId(null); }
  }

  async function changeRole(userId: number, role: UserRole) {
    setBusyId(userId);
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Admin Panel</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Manage users and role upgrade requests</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--cream-d)] rounded-lg p-1 gap-1 w-fit">
        {(['requests', 'users'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
              ${tab === t ? 'bg-white shadow-sm text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            {t === 'requests' ? `Role Requests ${pending.length > 0 ? `(${pending.length})` : ''}` : 'Users'}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          {requests.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] text-sm">No role requests.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--cream)]">
                  <tr>
                    {['User', 'Current Role', 'Requested', 'Status', 'Submitted', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-[var(--cream)] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{r.user?.name ?? '—'}</p>
                        <p className="text-xs text-[var(--muted)]">{r.user?.email}</p>
                      </td>
                      <td className="px-5 py-3"><RoleBadge role={r.user?.role ?? '—'} /></td>
                      <td className="px-5 py-3"><RoleBadge role={r.requested_role} /></td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${r.status === 'approved' ? 'bg-[#e8f4e8] text-[#2D6A2D]'
                            : r.status === 'rejected' ? 'bg-[#fdecea] text-[#C0392B]'
                            : 'bg-[#fdf6d8] text-[#8a6d00]'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--muted)] text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        {r.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" loading={busyId === r.id} onClick={() => approveRequest(r.id)}>Approve</Button>
                            <Button size="sm" variant="danger" loading={busyId === r.id} onClick={() => rejectRequest(r.id)}>Reject</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--cream)]">
                <tr>
                  {['User', 'Role', 'Status', 'Joined', 'Change Role'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[var(--cream)] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-[var(--muted)]">{u.email}</p>
                    </td>
                    <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${u.is_active ? 'bg-[#e8f4e8] text-[#2D6A2D]' : 'bg-[var(--cream-d)] text-[var(--muted)]'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)] text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={e => changeRole(u.id, e.target.value as UserRole)}
                        className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs bg-white
                          focus:outline-none focus:ring-2 focus:ring-[var(--tea)]/30"
                      >
                        {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
