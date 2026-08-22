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
      <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
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
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <p className="text-sm text-white/50 mt-0.5">Manage users and role upgrade requests</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1 w-fit">
        {(['requests', 'users'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize
              ${tab === t ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
          >
            {t === 'requests' ? `Role Requests ${pending.length > 0 ? `(${pending.length})` : ''}` : 'Users'}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden">
          {requests.length === 0 ? (
            <div className="p-8 text-center text-white/50 text-sm">No role requests.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    {['User', 'Current Role', 'Requested', 'Status', 'Submitted', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white/80">{r.user?.name ?? '—'}</p>
                        <p className="text-xs text-white/50">{r.user?.email}</p>
                      </td>
                      <td className="px-5 py-3"><RoleBadge role={r.user?.role ?? '—'} /></td>
                      <td className="px-5 py-3"><RoleBadge role={r.requested_role} /></td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${r.status === 'approved' ? 'bg-emerald-400/20 text-emerald-300'
                            : r.status === 'rejected' ? 'bg-red-400/20 text-red-300'
                            : 'bg-yellow-400/20 text-yellow-300'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white/50 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
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
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  {['User', 'Role', 'Status', 'Joined', 'Change Role'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-white/80">{u.name}</p>
                      <p className="text-xs text-white/50">{u.email}</p>
                    </td>
                    <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${u.is_active ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-white/50 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={e => changeRole(u.id, e.target.value as UserRole)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs focus:outline-none focus:border-white/40"
                      >
                        {ALL_ROLES.map(r => <option key={r} value={r} className="bg-[#1a3d1a]">{r}</option>)}
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
