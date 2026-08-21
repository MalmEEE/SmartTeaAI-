import { api } from './api';

const store = new Map<string, { data: unknown; exp: number }>();

function get<T>(key: string): T | null {
  const e = store.get(key);
  if (!e || Date.now() > e.exp) return null;
  return e.data as T;
}

function set<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, exp: Date.now() + ttlMs });
}

// Deduplicate in-flight requests for the same key
const inflight = new Map<string, Promise<unknown>>();

export async function cachedGet<T>(
  url: string,
  ttlMs = 5 * 60 * 1000,
): Promise<T> {
  const hit = get<T>(url);
  if (hit !== null) return hit;

  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;

  const p = api.get<T>(url).then((r) => {
    set(url, r.data, ttlMs);
    inflight.delete(url);
    return r.data;
  }).catch((err) => {
    inflight.delete(url);
    throw err;
  });

  inflight.set(url, p);
  return p as Promise<T>;
}

export function invalidate(urlPrefix?: string): void {
  if (!urlPrefix) { store.clear(); return; }
  for (const key of store.keys()) {
    if (key.startsWith(urlPrefix)) store.delete(key);
  }
}
