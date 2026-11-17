import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as D from './data.js';
import { guessCover } from './covers.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const SITE_KEY = 'doping.site.v1';
/** Saved settings layered over the defaults, so a newer build with new fields still gets them. */
function loadSite() {
  const base = D.seedSite();
  try {
    const saved = JSON.parse(localStorage.getItem(SITE_KEY) ?? 'null');
    if (!saved) return base;
    const site = D.migrateSite(saved, base, guessCover);
    return Object.keys(D.validateSite(site)).length ? base : site;
  } catch {
    return base;
  }
}

/** Per-visitor choices (ISP, favourite servers, last game tested). Kept on this device only. */
const PREFS_KEY = 'doping.prefs.v1';
function loadPrefs() {
  const base = { isp: 'mci', favs: [], game: 'cs2', guide: {} };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return base;
  }
}

const init = () => ({
  site: loadSite(),
  prefs: loadPrefs(),
  rec: null,
  pingRun: 0,
  users: D.seedUsers(),
  routers: D.seedRouters(),
  servers: D.seedServers(),
  pricing: D.seedPricing(),
  discounts: D.seedDiscounts(),
  gateways: D.seedGateways(),
  invoices: D.seedInvoices(),
  tickets: D.seedTickets(),
  logs: D.seedLogs(),
  wallet: 185_000,
  steamId: '76561198412770351',
  perks: { slot: true, tag: true, skins: false },
  dnsIps: [{ ip: '5.160.14.92', label: 'خانه · مخابرات', at: Date.now() - 95_000 }],
  dnsSlots: 2,
  myKeys: { priv: D.wgKey(), pub: D.wgKey(), psk: D.wgKey(), rotated: Date.now() - 11 * 86_400_000 },
  exit: 'mct',
  toasts: [],
  tick: 0,
});

const mkLog = (type, level, msg, actor = 'admin', ip = '10.0.0.2') => ({ id: D.uid(), at: Date.now(), type, level, msg, actor, ip });

/** The same rule the backend quota worker applies, run on every simulated poll. */
function enforce(u, logs) {
  if (u.status !== 'active') return u;
  if (u.quota != null && u.up + u.down >= u.quota) {
    logs.push(mkLog('mikrotik', 'warn', `PATCH /rest/interface/wireguard/peers/${u.peerId} disabled=true · اتمام حجم ${u.username}`, 'quota-worker', '10.0.0.5'));
    return { ...u, status: 'quota', peer: false, online: false };
  }
  return u;
}

function simulate(s) {
  const logs = [];
  const users = s.users.map((u) => {
    if (u.status !== 'active' || !u.peer || !u.online || u.plan === 'dns') return u;
    return enforce({ ...u, down: u.down + D.rnd(2, 26) * D.MB, up: u.up + D.rnd(0.3, 3) * D.MB }, logs);
  });
  const servers = s.servers.map((v) => {
    if (v.status !== 'online') return v;
    const players = Math.max(0, Math.min(v.max, v.players + D.pick([-1, 0, 0, 0, 1])));
    const list = players > v.list.length ? [...v.list, ...D.roster(1)] : v.list.slice(0, players);
    return { ...v, players, list, ping: Math.max(8, Math.min(22, v.ping + D.pick([-1, 0, 0, 1]))) };
  });
  const routers = s.routers.map((r) =>
    r.status !== 'online' ? r : {
      ...r,
      cpu: Math.max(6, Math.min(93, r.cpu + D.rint(-4, 4))),
      ram: Math.max(18, Math.min(88, r.ram + D.rint(-1, 1))),
      handshake: r.handshake > 110 ? D.rint(1, 6) : r.handshake + 3,
    });
  if (s.tick % 8 === 7) {
    const r = D.pick(routers.filter((x) => x.role === 'entry' && x.status === 'online'));
    if (r) logs.push(mkLog('mikrotik', 'info', `GET /rest/queue/simple → 200 (${r.queues} queues, ${D.rint(120, 260)}ms) · ${r.name}`, 'quota-worker', '10.0.0.5'));
  }
  return { ...s, users, servers, routers, logs: logs.length ? [...logs.reverse(), ...s.logs].slice(0, 200) : s.logs, tick: s.tick + 1 };
}

export function StoreProvider({ children }) {
  const [s, setS] = useState(init);

  useEffect(() => {
    const t = setInterval(() => setS(simulate), 3000);
    return () => clearInterval(t);
  }, []);

  // Settings survive a reload on this device; the accent colour drives the theme variables.
  useEffect(() => {
    try { localStorage.setItem(SITE_KEY, JSON.stringify(s.site)); } catch { /* storage is optional */ }
    const root = document.documentElement.style;
    root.setProperty('--color-brand', s.site.accent);
    root.setProperty('--color-brand2', `color-mix(in srgb, ${s.site.accent} 82%, white)`);
  }, [s.site]);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(s.prefs)); } catch { /* storage is optional */ }
  }, [s.prefs]);

  const set = useCallback((fn) => setS((prev) => ({ ...prev, ...(typeof fn === 'function' ? fn(prev) : fn) })), []);

  const api = useMemo(() => {
    const toast = (msg, tone = 'ok') => {
      const id = D.uid();
      setS((p) => ({ ...p, toasts: [...p.toasts, { id, msg, tone }] }));
      setTimeout(() => setS((p) => ({ ...p, toasts: p.toasts.filter((t) => t.id !== id) })), 3800);
    };
    const log = (type, level, msg, actor, ip) => setS((p) => ({ ...p, logs: [mkLog(type, level, msg, actor, ip), ...p.logs].slice(0, 200) }));
    /** Immutable update of one row in a list, re-running quota enforcement for users. */
    const patch = (key, id, fn) =>
      setS((p) => {
        const logs = [];
        const list = p[key].map((x) => {
          if (x.id !== id) return x;
          const next = { ...x, ...fn(x) };
          return key === 'users' ? enforce(next, logs) : next;
        });
        return { ...p, [key]: list, logs: logs.length ? [...logs, ...p.logs] : p.logs };
      });
    const invoice = (title, amount, gateway, status = 'paid') =>
      setS((p) => ({ ...p, invoices: [{ id: `INV-${D.rint(48300, 49999)}`, at: Date.now(), title, amount, gateway, status }, ...p.invoices] }));
    return { toast, log, patch, invoice };
  }, []);

  const me = s.users[0];
  const value = useMemo(() => ({ s, set, me, ...api }), [s, set, me, api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
