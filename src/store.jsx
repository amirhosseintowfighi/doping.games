'use client';
// Client state: the site content and signed-in user rendered by the server, per-visitor preferences
// (kept on this device), toasts, and `api()`, the one way the browser talks to the backend.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const PREFS_KEY = 'doping.prefs.v1';
const basePrefs = { isp: 'mci', favs: [], game: 'cs2', guide: {} };
function loadPrefs() {
  try {
    return { ...basePrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return basePrefs;
  }
}

const readCookie = (name) => document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields ?? {};
  }
}

/** JSON request with the CSRF header. Throws ApiError with the server's Persian message on failure. */
export async function api(path, { method = 'GET', body } = {}) {
  const csrf = decodeURIComponent(readCookie('__Host-dp_csrf') || readCookie('dp_csrf'));
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('اتصال به سرور برقرار نشد. اینترنتت رو چک کن.', 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth')) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.hash)}`;
    }
    throw new ApiError(data?.error ?? `خطای ${res.status}`, res.status, data?.fields);
  }
  return data;
}

export function StoreProvider({ initial, children }) {
  const [s, setS] = useState(() => ({
    site: initial.site,
    user: initial.user,
    prefs: basePrefs,
    rec: null,
    pingRun: 0,
    exit: 'mct',
    panelTab: null,
    toasts: [],
  }));

  // Preferences live in this browser only; read them after hydration so server and client HTML match.
  useEffect(() => {
    const prefs = loadPrefs();
    setS((p) => ({ ...p, prefs }));
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(s.prefs)); } catch { /* storage is optional */ }
  }, [s.prefs]);

  // The accent colour drives the theme variables (also rendered on <html> by the server).
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--color-brand', s.site.accent);
    root.setProperty('--color-brand2', `color-mix(in srgb, ${s.site.accent} 82%, white)`);
  }, [s.site.accent]);

  const set = useCallback((fn) => setS((prev) => ({ ...prev, ...(typeof fn === 'function' ? fn(prev) : fn) })), []);

  const toast = useCallback((msg, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setS((p) => ({ ...p, toasts: [...p.toasts, { id, msg, tone }] }));
    setTimeout(() => setS((p) => ({ ...p, toasts: p.toasts.filter((t) => t.id !== id) })), 4200);
  }, []);

  /** Re-reads the wallet and account after a payment or profile change. */
  const refreshUser = useCallback(async () => {
    try {
      const me = await api('/api/me');
      setS((p) => ({ ...p, user: p.user ? { ...p.user, ...me.user } : p.user }));
      return me;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(() => ({ s, set, toast, api, refreshUser }), [s, set, toast, refreshUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Fetches a JSON resource and keeps it fresh; `reload()` after a write. */
export function useResource(url, { interval = 0 } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    try {
      const data = await api(url);
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      setState((p) => ({ ...p, error, loading: false }));
      return null;
    }
  }, [url]);
  useEffect(() => {
    load();
    if (!interval) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, interval);
    return () => clearInterval(t);
  }, [load, interval]);
  return { ...state, reload: load, setData: (fn) => setState((p) => ({ ...p, data: typeof fn === 'function' ? fn(p.data) : fn })) };
}
