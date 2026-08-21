'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';
import type { User, UserRole } from '@/types';

interface AuthCtx {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: UserRole[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('smartteaai_token');
    const u = localStorage.getItem('smartteaai_user');
    if (t && u) { setToken(t); setUser(JSON.parse(u)); }
    setIsLoading(false);
  }, []);

  const persist = (t: string, u: User) => {
    localStorage.setItem('smartteaai_token', t);
    localStorage.setItem('smartteaai_user', JSON.stringify(u));
    setToken(t); setUser(u);
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    persist(data.access_token, data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    persist(data.access_token, data.user);
  };

  const logout = () => {
    localStorage.removeItem('smartteaai_token');
    localStorage.removeItem('smartteaai_user');
    setToken(null); setUser(null);
  };

  const can = (...roles: UserRole[]) => !!user && roles.includes(user.role);

  return <Ctx.Provider value={{ user, token, isLoading, login, register, logout, can }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
};
