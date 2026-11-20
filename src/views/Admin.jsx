'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BadgePercent, Ban, Banknote, Code2, CreditCard, Crosshair, LifeBuoy, Pause, Pencil, Play, Plus, Power,
  RefreshCw, RotateCcw, Router, ScrollText, Search, SlidersHorizontal, Send, ShieldAlert, Terminal, Trash2, UserX, Users,
} from 'lucide-react';
import { useResource, useStore } from '../store.jsx';
import Settings from './Settings.jsx';
import { ArcMeter, ModeEmblem, RouteMap } from '../art.jsx';
import { Badge, Btn, Card, cx, Dot, Drawer, Field, Modal, Mono, Progress, RailLayout, Stat, Toggle } from '../ui.jsx';
import { clock, CS2_MAPS, daysLeft, dnsSlots, durations, fa, faDate, GB, gb, isIPv4, MODES, pingTiers, priceOf, tierLabel, toman } from '../data.js';

/** Overview (routers, game servers, counters) shared by the tabs; `reload()` after a write. */
const AdminCtx = createContext(null);
const useAdmin = () => useContext(AdminCtx);

/** Runs an API write, toasts the result and reloads. Returns the response or null. */
function useAct() {
  const { api, toast } = useStore();
  return useCallback(async (path, method, body, ok) => {
    try {
      const r = await api(path, { method, body });
      if (ok) toast(ok, method === 'DELETE' ? 'warn' : 'ok');
      return r ?? {};
    } catch (e) {
      toast(e.message, 'bad');
      return null;
    }
  }, [api, toast]);
}

const U_STATUS = { active: ['Active', 'ok'], quota: ['Quota Exceeded', 'bad'], expired: ['Expired', 'warn'], disabled: ['Disabled', 'mute'], none: ['No plan', 'mute'] };

/* ───────────────────────── MikroTik cluster ───────────────────────── */

const emptyRouter = { name: '', role: 'entry', city: '', host: '', apiPort: 443, apiUser: 'doping-api', password: '', wg: 'wg-doping', subnet: '10.10.30.0/24', endpoint: '', fingerprint: '', enabled: true };
const routerBody = (r, extra = {}) => ({
  name: r.name, role: r.role, city: r.city ?? '', host: r.host, apiPort: +r.apiPort, apiUser: r.apiUser, password: '', wg: r.wg, subnet: r.subnet,
  endpoint: r.endpoint ?? '', fingerprint: r.fingerprint ?? '', enabled: r.enabled !== false, ...extra,
});

function RouterForm({ initial, onClose }) {
  const { reload } = useAdmin();
  const act = useAct();
  const editing = !!initial.id;
  const [f, setF] = useState({ ...emptyRouter, ...initial, password: '' });
  const [touched, setTouched] = useState(false);
  const [server, setServer] = useState({});
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const errs = {
    name: /^[A-Za-z0-9-]{3,24}$/.test(f.name) ? '' : '۳ تا ۲۴ کاراکتر لاتین، عدد یا خط تیره.',
    host: isIPv4(f.host) || /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(f.host) ? '' : 'آی‌پی یا هاست معتبر وارد کن.',
    apiPort: +f.apiPort >= 1 && +f.apiPort <= 65535 ? '' : 'پورت بین 1 تا 65535.',
    apiUser: /^[a-zA-Z0-9_.-]{3,32}$/.test(f.apiUser) ? '' : 'نام کاربری API نامعتبره.',
    password: (editing && !f.password) || f.password.length >= 12 ? '' : 'حداقل ۱۲ کاراکتر.',
    wg: /^[a-zA-Z0-9_-]{2,15}$/.test(f.wg) ? '' : 'نام اینترفیس نامعتبره.',
    subnet: /^(10|172|192)\.\d{1,3}\.\d{1,3}\.0\/(1[6-9]|2\d|30)$/.test(f.subnet) ? '' : 'مثل 10.10.30.0/24',
    endpoint: !f.endpoint || /^[a-z0-9.-]+:\d{2,5}$/i.test(f.endpoint) ? '' : 'به شکل host:port',
    ...server,
  };
  const valid = Object.values(errs).every((e) => !e);
  const e = (k) => (touched ? errs[k] : '');

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    const body = { ...routerBody(f), password: f.password };
    const r = await act(editing ? `/api/admin/routers/${f.id}` : '/api/admin/routers', editing ? 'PATCH' : 'POST', body,
      editing ? 'روتر به‌روزرسانی شد.' : 'روتر اضافه شد. حالا «تست اتصال و سینک» رو بزن.');
    setBusy(false);
    if (r) { await reload(); onClose(); }
  };

  return (
    <Modal
      open onClose={onClose} wide title={editing ? `ویرایش ${initial.name}` : 'افزودن روتر میکروتیک'}
      footer={<><Btn variant="ghost" onClick={onClose}>انصراف</Btn><Btn onClick={save} busy={busy}>{editing ? 'ذخیره تغییرات' : 'افزودن روتر'}</Btn></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="نام نود" error={e('name')}><input id="rt-name" dir="ltr" value={f.name} onChange={(x) => { up('name')(x); setServer({}); }} placeholder="THR-EDGE-03" className="field mono" /></Field>
        <Field label="نقش">
          <select id="rt-role" value={f.role} onChange={up('role')} className="field">
            <option value="entry">ورودی ایران (Entry)</option>
            <option value="exit">خروجی خارج (Exit)</option>
          </select>
        </Field>
        <Field label="آی‌پی یا هاست روتر" error={e('host')}><input id="rt-host" dir="ltr" value={f.host} onChange={up('host')} placeholder="203.0.113.40" className="field mono" /></Field>
        <Field label="پورت www-ssl (REST)" error={e('apiPort')}><input id="rt-port" dir="ltr" inputMode="numeric" value={f.apiPort} onChange={up('apiPort')} className="field mono" /></Field>
        <Field label="نام کاربری API" error={e('apiUser')}><input id="rt-user" dir="ltr" value={f.apiUser} onChange={up('apiUser')} className="field mono" /></Field>
        <Field label="رمز API" error={e('password')} hint={editing ? 'خالی بذار تا رمز فعلی بمونه.' : 'با AES-256-GCM رمزگذاری و ذخیره می‌شه و دیگه نمایش داده نمی‌شه.'}>
          <input id="rt-pass" dir="ltr" type="password" autoComplete="new-password" value={f.password} onChange={up('password')} className="field mono" />
        </Field>
        <Field label="اینترفیس WireGuard" error={e('wg')}><input id="rt-wg" dir="ltr" value={f.wg} onChange={up('wg')} className="field mono" /></Field>
        <Field label="Subnet Pool تانل" error={e('subnet')}><input id="rt-subnet" dir="ltr" value={f.subnet} onChange={up('subnet')} className="field mono" /></Field>
        <Field label="Endpoint عمومی کلاینت‌ها" error={e('endpoint')} hint="خالی = هاست روتر + listen-port اینترفیس، بعد از سینک."><input id="rt-endpoint" dir="ltr" value={f.endpoint} onChange={up('endpoint')} placeholder="thr1.doping.games:51820" className="field mono" /></Field>
        <Field label="محل / دیتاسنتر"><input id="rt-city" value={f.city} onChange={up('city')} placeholder="تهران · آسیاتک" className="field" /></Field>
        <Field label="اثر انگشت SHA-256 گواهی (اختیاری)" className="sm:col-span-2" hint="خالی بذاری، اولین سینک موفق گواهی رو پین می‌کنه و از اون به بعد هر گواهی دیگه‌ای رد می‌شه.">
          <input id="rt-fp" dir="ltr" value={f.fingerprint} onChange={up('fingerprint')} placeholder="AB:CD:…" className="field mono text-xs" />
        </Field>
      </div>
    </Modal>
  );
}

function SyncModal({ router, onClose }) {
  const { reload } = useAdmin();
  const { api } = useStore();
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    let alive = true;
    setLines([{ tone: 'dim', text: `→ sync ${router.name} …`, at: Date.now() }]);
    setDone(false);
    api(`/api/admin/routers/${router.id}/sync`, { method: 'POST' })
      .then((r) => {
        if (!alive) return;
        // Reveal the real transcript line by line so it reads like a console.
        r.lines.forEach((l, i) => setTimeout(() => alive && setLines((x) => [...x, l]), 120 * (i + 1)));
        setTimeout(() => { if (alive) { setDone(true); reload(); } }, 120 * (r.lines.length + 1));
      })
      .catch((e) => { if (alive) { setLines((x) => [...x, { tone: 'bad', text: `✗ ${e.message}`, at: Date.now() }]); setDone(true); } });
    return () => { alive = false; };
  }, [run, router.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      open onClose={onClose} wide title={`تست اتصال و سینک · ${router.name}`}
      footer={<><Btn variant="ghost" icon={RotateCcw} disabled={!done} onClick={() => setRun((n) => n + 1)}>اجرای دوباره</Btn><Btn onClick={onClose}>بستن</Btn></>}
    >
      <div dir="ltr" className="mono min-h-64 well p-4 text-left text-xs leading-6" aria-live="polite" data-sync-log>
        {lines.map((l, i) => (
          <div key={i} className={cx(l.tone === 'ok' && 'text-ok', l.tone === 'bad' && 'text-brand2', l.tone === 'dim' && 'text-silver', l.tone === 'out' && 'text-white')}>
            <span className="text-zinc-600">{clock(l.at)} </span>{l.text}
          </div>
        ))}
        {!done && <span className="inline-block h-4 w-2 animate-pulse bg-brand2 align-middle" />}
      </div>
    </Modal>
  );
}

function Routers() {
  const { o, reload } = useAdmin();
  const act = useAct();
  const [form, setForm] = useState(null);
  const [sync, setSync] = useState(null);
  const [del, setDel] = useState(null);
  const routers = o.routers;
  const group = (role, title) => {
    const list = routers.filter((r) => r.role === role);
    return (
      <div>
        <div className="mb-4 flex items-center gap-3"><span className="text-sm font-black">{title}</span><span className="hairline flex-1" /></div>
        {!list.length && <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-silver">روتری با این نقش تعریف نشده.</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => {
            const on = r.status === 'online';
            return (
              <Card key={r.id} className={cx('flex flex-col gap-5 p-5', r.status === 'offline' && 'border-red-500/50', !r.enabled && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Mono className="block truncate text-base font-bold">{r.name}</Mono>
                    <div className="truncate text-xs text-silver">{r.city}</div>
                  </div>
                  <Badge tone={!r.enabled ? 'mute' : on ? 'ok' : r.status === 'offline' ? 'bad' : 'warn'}>{!r.enabled ? 'Disabled' : on ? <><Dot /> Online</> : r.status === 'offline' ? 'Offline' : 'Not synced'}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  {[['Host', r.host], ['API Port', r.apiPort], ['RouterOS', r.version === '—' ? '—' : `v${r.version}`], ['Interface', r.wg], ['Subnet', r.subnet], ['Model', r.model]].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt><Mono className="text-[11px] text-zinc-500">{k}</Mono></dt>
                      <dd><Mono className="block truncate font-bold">{v}</Mono></dd>
                    </div>
                  ))}
                </dl>
                <div className="grid grid-cols-2 gap-6">
                  <ArcMeter label="CPU" value={on ? r.cpu : 0} />
                  <ArcMeter label="RAM" value={on ? r.ram : 0} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[['WG Peers', r.peers], ['Queues', r.queues], ['Uptime', on ? r.uptime : '—']].map(([k, v]) => (
                    <div key={k} className="well py-2">
                      <Mono className="block truncate px-1 text-sm font-black">{v}</Mono>
                      <Mono className="text-[11px] text-silver">{k}</Mono>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-[11px] text-zinc-500">
                  <div>آخرین سینک: <Mono>{r.lastSync ? `${faDate(r.lastSync)} ${clock(r.lastSync)}` : 'never'}</Mono></div>
                  {r.fingerprint && <div className="truncate">TLS pin: <Mono>{r.fingerprint.slice(0, 29)}…</Mono></div>}
                  {r.lastError && <div className="text-brand2" dir="auto">{r.lastError}</div>}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Btn size="sm" icon={RefreshCw} className="w-full min-[360px]:w-auto min-[360px]:flex-1" disabled={!r.enabled} onClick={() => setSync(r)}>تست اتصال و سینک میکروتیک</Btn>
                  <Btn size="sm" variant="ghost" icon={Pencil} aria-label={`ویرایش ${r.name}`} onClick={() => setForm(r)} />
                  <Btn
                    size="sm" variant="ghost" icon={Power} aria-label={r.enabled ? `غیرفعال کردن ${r.name}` : `فعال کردن ${r.name}`} title={r.enabled ? 'خارج کردن از مدار (بدون حذف)' : 'برگرداندن به مدار'}
                    onClick={async () => { if (await act(`/api/admin/routers/${r.id}`, 'PATCH', routerBody(r, { enabled: !r.enabled }), r.enabled ? 'روتر از مدار خارج شد.' : 'روتر به مدار برگشت.')) reload(); }}
                  />
                  <Btn size="sm" variant="danger" icon={Trash2} aria-label={`حذف ${r.name}`} onClick={() => setDel(r)} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };
  const live = routers.filter((r) => r.status === 'online').length;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-silver">کلاستر RouterOS v7 · پنل فقط از طریق REST روی TLS با گواهی پین‌شده به روترها وصل می‌شه.</p>
        <Btn icon={Plus} onClick={() => setForm({})}>افزودن روتر</Btn>
      </div>
      {routers.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5">
            <span className="text-sm font-black">توپولوژی زنده کلاستر</span>
            <Badge tone={live === routers.length ? 'ok' : 'bad'}><Dot tone={live === routers.length ? 'ok' : 'bad'} /> {fa(live)} از {fa(routers.length)} نود در مدار</Badge>
          </div>
          <div className="overflow-x-auto"><RouteMap
            className="block w-full min-w-[620px]"
            status={Object.fromEntries(routers.filter((r) => /^(THR|SHZ|MCT|DXB|FRA)/i.test(r.name)).map((r) => [r.name.slice(0, 3).toLowerCase(), { tone: r.status !== 'online' ? 'bad' : r.cpu >= 85 ? 'warn' : 'ok', sub: r.status === 'online' ? `${r.peers} peers · ${r.cpu}%` : 'OFFLINE' }]))}
          /></div>
        </Card>
      )}
      {group('entry', 'روترهای ورودی ایران (Entry)')}
      {group('exit', 'روترهای خروجی عمان / امارات / اروپا (Exit)')}
      {form && <RouterForm initial={form} onClose={() => setForm(null)} />}
      {sync && <SyncModal router={sync} onClose={() => setSync(null)} />}
      <Modal
        open={!!del} onClose={() => setDel(null)} title="حذف روتر" icon={Trash2}
        footer={<><Btn variant="ghost" onClick={() => setDel(null)}>انصراف</Btn><Btn variant="danger" onClick={async () => { if (await act(`/api/admin/routers/${del.id}`, 'DELETE', undefined, 'روتر از کلاستر حذف شد.')) reload(); setDel(null); }}>حذف {del?.name}</Btn></>}
      >
        <p className="text-sm leading-7 text-silver">روتر <Mono className="font-bold text-white">{del?.name}</Mono> از پنل حذف می‌شه. تنظیمات روی خود میکروتیک دست‌نخورده می‌مونه و کاربرهاش با سینک بعدی به نود ورودی دیگه‌ای منتقل می‌شن.</p>
      </Modal>
    </div>
  );
}

/* ───────────────────────── Users & quota ───────────────────────── */

function Raw({ u, onClose }) {
  const sub = u.sub;
  const raw = {
    '/interface/wireguard/peers': { '.id': sub.peerId ?? '(not provisioned)', 'public-key': sub.pubkey, 'allowed-address': sub.ip ? `${sub.ip}/32` : null, comment: `doping:${sub.id}`, disabled: String(sub.status !== 'active') },
    '/queue/simple': { '.id': sub.queueId ?? '(not provisioned)', name: `dp-${sub.id}`, target: sub.ip ? `${sub.ip}/32` : null, 'max-limit': '20M/100M', comment: `doping:${sub.id} quota=${sub.quota ?? 'unlimited'}` },
    panel: { usedUp: sub.up, usedDown: sub.down, quotaBytes: sub.quota, expires: new Date(sub.expires).toISOString(), router: sub.router, provisionError: sub.provisionError },
  };
  return (
    <Modal open onClose={onClose} wide icon={Code2} title={`MikroTik Rule · ${u.username}`}>
      <pre dir="ltr" className="mono overflow-x-auto well p-4 text-left text-xs leading-6 text-zinc-300">{JSON.stringify(raw, null, 2)}</pre>
      <p className="mt-3 text-xs text-silver">قانون‌هایی که پنل روی <Mono>{sub.router ?? '—'}</Mono> نگه می‌داره. شمارنده‌ها هر دور quota-worker از <Mono>/queue/simple</Mono> خونده می‌شن.</p>
    </Modal>
  );
}

function UsersTable({ role }) {
  const { s } = useStore();
  const act = useAct();
  const users = useResource('/api/admin/users', { interval: 30_000 });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [raw, setRaw] = useState(null);
  const [edit, setEdit] = useState(null);
  const all = users.data ?? [];
  const st = (u) => u.sub?.status ?? 'none';
  const rows = all
    .filter((u) => filter === 'all' || st(u) === filter)
    .filter((u) => `${u.username} ${u.email} ${u.sub?.ip ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const run = async (u, body, ok) => { if (await act(`/api/admin/users/${u.id}`, 'POST', body, ok)) users.reload(); };
  const admin = role === 'admin';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input id="usr-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام کاربری، ایمیل یا آی‌پی تانل…" className="field pr-9" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {[['all', 'همه'], ['active', 'Active'], ['quota', 'Quota Exceeded'], ['expired', 'Expired'], ['disabled', 'Disabled'], ['none', 'No plan']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={cx('shrink-0 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap', filter === id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white')}>
              {label} <Mono className="opacity-60">{id === 'all' ? all.length : all.filter((u) => st(u) === id).length}</Mono>
            </button>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="max-md:p-2 overflow-x-auto">
          <table className="rtable w-full md:min-w-[980px] text-sm">
            <thead className="text-[11px] text-zinc-500">
              <tr>{['کاربر', 'MikroTik IP', 'مصرف Simple Queue (bytes-in / bytes-out)', 'انقضا', 'وضعیت', 'عملیات'].map((h) => <th key={h} className="px-3 py-3 text-start font-bold whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const sub = u.sub;
                const used = sub ? sub.up + sub.down : 0;
                const pct = sub?.quota ? (used / sub.quota) * 100 : 0;
                const [label, tone] = U_STATUS[st(u)];
                return (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]" data-user={u.username}>
                    <td data-head="1" className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cx('size-2 shrink-0 rounded-full', sub?.online ? 'bg-ok' : 'bg-zinc-600')} title={sub?.online ? 'آنلاین' : 'آفلاین'} />
                        <div className="min-w-0">
                          <Mono className="block font-bold">{u.username}{u.role !== 'user' && <span className="ms-1.5 text-[11px] text-warn">{u.role}</span>}</Mono>
                          <span className="text-[11px] text-zinc-500">{sub ? s.site.planNames[sub.kind] : u.email}{u.disabled && ' · حساب غیرفعال'}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="آی‌پی تانل" className="px-3 py-2.5"><Mono className="text-xs">{sub?.ip ? `${sub.ip}/32` : '—'}</Mono></td>
                    <td data-label="مصرف" className="px-3 py-2.5">
                      {!sub ? <span className="text-xs text-zinc-500">—</span> : sub.kind === 'dns' ? <span className="text-xs text-zinc-500">فقط DNS · بدون صف</span> : (
                        <div className="w-56">
                          <div className="mb-1 flex justify-between text-[11px]">
                            <Mono className="text-silver">↑{gb(sub.up)} / ↓{gb(sub.down)}</Mono>
                            <Mono className="font-bold">{gb(used, 1)} / {sub.quota ? `${gb(sub.quota, 0)} GB` : '∞'}</Mono>
                          </div>
                          <Progress value={sub.quota ? pct : 3} h="h-1.5" />
                        </div>
                      )}
                    </td>
                    <td data-label="انقضا" className="px-3 py-2.5 text-xs whitespace-nowrap">{!sub ? '—' : daysLeft(sub.expires) ? `${fa(daysLeft(sub.expires))} روز` : <span className="text-warn">تمام شده</span>}</td>
                    <td data-label="وضعیت" className="px-3 py-2.5"><Badge tone={tone}><Mono>{label}</Mono></Badge>{sub?.provisionError && <span className="ms-1 text-[11px] text-warn" title={sub.provisionError}>⚠</span>}</td>
                    <td data-label="عملیات" className="px-3 py-2.5">
                      {admin && (
                        <div className="flex items-center gap-1.5">
                          {sub && <Btn size="sm" variant="ok" icon={Plus} onClick={() => run(u, { action: 'traffic', gb: 5 }, `۵ گیگ به ${u.username} اضافه شد.`)} disabled={sub.quota == null} title="Add Traffic"><Mono>5GB</Mono></Btn>}
                          {sub && <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => run(u, { action: 'reset' }, `شمارنده ${u.username} صفر شد.`)} aria-label="Reset Queue Counters" title="Reset Queue Counters" />}
                          {sub && <Btn size="sm" variant="ghost" icon={Code2} onClick={() => setRaw(u)} aria-label="Inspect MikroTik Rule" title="Inspect MikroTik Rule" />}
                          <Btn size="sm" variant="ghost" icon={SlidersHorizontal} onClick={() => setEdit(u)} aria-label={`مدیریت ${u.username}`} title="کیف پول، روز، نقش" />
                          {sub && <Toggle checked={sub.status === 'active'} onChange={(v) => run(u, { action: 'peer', on: v }, v ? `Peer ${u.username} فعال شد.` : `Peer ${u.username} غیرفعال شد.`)} label={`Peer ${u.username}`} />}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-silver">{users.loading ? 'در حال بارگذاری…' : 'کاربری با این مشخصات پیدا نشد.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {raw && <Raw u={raw} onClose={() => setRaw(null)} />}
      {edit && <UserManage u={edit} onClose={() => setEdit(null)} run={async (body, ok) => { await run(edit, body, ok); }} />}
    </div>
  );
}

function UserManage({ u, onClose, run }) {
  const [amount, setAmount] = useState(0);
  const [days, setDays] = useState(30);
  return (
    <Modal open onClose={onClose} title={`مدیریت ${u.username}`} icon={SlidersHorizontal}>
      <div className="space-y-5">
        <div className="flex items-end gap-2">
          <Field label={`اصلاح کیف پول (موجودی ${toman(u.wallet)})`} hint="عدد منفی برای کسر." className="flex-1">
            <input id="um-wallet" dir="ltr" value={amount} onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d-]/g, '')) || 0)} className="field mono" />
          </Field>
          <Btn className="mb-6" disabled={!amount} onClick={() => run({ action: 'wallet', amount }, 'کیف پول اصلاح شد.')}>اعمال</Btn>
        </div>
        {u.sub && (
          <div className="flex items-end gap-2">
            <Field label="افزودن روز به اشتراک" className="flex-1">
              <input id="um-days" dir="ltr" inputMode="numeric" value={days} onChange={(e) => setDays(Number(e.target.value.replace(/\D/g, '')) || 0)} className="field mono" />
            </Field>
            <Btn disabled={!days} onClick={() => run({ action: 'days', days }, `${fa(days)} روز اضافه شد.`)}>افزودن</Btn>
          </div>
        )}
        <Field label="نقش">
          <select id="um-role" value={u.role} onChange={(e) => run({ action: 'role', role: e.target.value }, 'نقش عوض شد.')} className="field">
            <option value="user">کاربر</option><option value="support">پشتیبان</option><option value="admin">مدیر</option>
          </select>
        </Field>
        <div className="flex items-center justify-between well px-4 py-3">
          <span className="text-sm font-bold">حساب فعال</span>
          <Toggle checked={!u.disabled} onChange={(v) => run({ action: 'account', disabled: !v }, v ? 'حساب فعال شد.' : 'حساب غیرفعال شد و نشست‌هاش بسته شد.')} label="حساب فعال" />
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Game servers & RCON ───────────────────────── */

function Rcon({ id, onClose }) {
  const { o } = useAdmin();
  const { api } = useStore();
  const v = o.servers.find((x) => x.id === id);
  const [out, setOut] = useState([{ t: 'sys', text: `rcon → ${v.host}:${v.port}` }, { t: 'sys', text: 'allow-list: status · mp_restartgame · mp_warmup_end · changelevel · kick · say · users' }]);
  const [cmd, setCmd] = useState('');
  const [hist, setHist] = useState([]);
  const [hi, setHi] = useState(-1);
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [out]);
  const maps = v.game === 'CS2' ? CS2_MAPS : [v.map];

  const exec = async (raw) => {
    const line = raw.trim();
    if (!line || busy) return;
    if (line === 'clear') { setOut([]); setCmd(''); return; }
    setOut((x) => [...x, { t: 'in', text: line }]);
    setHist((h) => [line, ...h].slice(0, 30));
    setHi(-1);
    setCmd('');
    setBusy(true);
    try {
      const r = await api(`/api/admin/servers/${id}/rcon`, { method: 'POST', body: { command: line } });
      setOut((x) => [...x, ...r.output.split('\n').map((text) => ({ t: 'out', text }))]);
    } catch (e) {
      setOut((x) => [...x, { t: 'err', text: e.message }]);
    }
    setBusy(false);
  };

  return (
    <Drawer open onClose={onClose} title={`RCON · ${v.name}`}>
      {!v.hasRcon && <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs leading-6 text-amber-200">رمز RCON این سرور ثبت نشده. از «ویرایش» سرور واردش کن.</p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Map', v.map], ['Players', `${v.players}/${v.max}`], ['Ping', v.status === 'online' ? `${v.ping}ms` : '—']].map(([k, val]) => (
          <div key={k} className="well py-2.5"><Mono className="block truncate px-1 text-sm font-black">{val}</Mono><Mono className="text-[11px] text-silver">{k}</Mono></div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="تغییر مپ" className="min-w-40 flex-1">
          <select id="rcon-map" dir="ltr" value={v.map} onChange={(e) => exec(`changelevel ${e.target.value}`)} className="field mono">
            {[...new Set([v.map, ...maps])].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Btn variant="ghost" icon={RotateCcw} onClick={() => exec('mp_restartgame 1')}><Mono>mp_restartgame 1</Mono></Btn>
        <Btn variant="ghost" icon={Activity} onClick={() => exec('status')}><Mono>status</Mono></Btn>
      </div>

      <div dir="ltr" className="mono mt-4 h-64 overflow-y-auto well p-3 text-left text-xs leading-6" aria-live="polite">
        {out.map((l, i) => (
          <div key={i} className={cx('whitespace-pre-wrap', l.t === 'in' && 'text-brand2', l.t === 'sys' && 'text-zinc-500', l.t === 'out' && 'text-zinc-200', l.t === 'err' && 'text-warn')} dir={l.t === 'err' ? 'auto' : undefined}>{l.t === 'in' ? `] ${l.text}` : l.text}</div>
        ))}
        {busy && <span className="inline-block h-3 w-1.5 animate-pulse bg-brand2 align-middle" />}
        <div ref={end} />
      </div>
      <form dir="ltr" className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); exec(cmd); }}>
        <input
          id="rcon-cmd" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="status" autoComplete="off" spellCheck={false} className="field mono text-left"
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); const n = Math.min(hist.length - 1, hi + 1); setHi(n); setCmd(hist[n]); }
            if (e.key === 'ArrowDown') { e.preventDefault(); const n = hi - 1; setHi(Math.max(-1, n)); setCmd(n >= 0 ? hist[n] : ''); }
          }}
        />
        <Btn type="submit" icon={Send} busy={busy}>Run</Btn>
      </form>

      <h4 className="mt-6 mb-2 flex items-center gap-2 text-sm font-black"><Users className="size-4 text-brand2" /> بازیکن‌های آنلاین (A2S) <Mono className="text-silver">({v.list.length})</Mono></h4>
      <ul className="space-y-1.5">
        {v.list.map((p, i) => (
          <li key={`${p.name}-${i}`} className="flex items-center gap-3 well px-3 py-1.5">
            <Mono className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</Mono>
            <Mono className="text-xs text-silver">{p.k}</Mono>
            <Mono className="w-12 text-end text-xs text-silver">{Math.floor((p.time ?? 0) / 60)}m</Mono>
            <Btn size="sm" variant="danger" icon={UserX} onClick={() => exec(`kick "${p.name.replace(/"/g, '')}"`)}>Kick</Btn>
          </li>
        ))}
        {!v.list.length && <li className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-silver">{v.status === 'online' ? 'سرور خالیه.' : 'سرور به A2S جواب نمی‌ده.'}</li>}
      </ul>
    </Drawer>
  );
}

const emptyServer = { name: '', mode: 'retake', map: 'de_mirage', max: 10, host: '', port: 27015, vip: false, enabled: true, rcon: '', sort: 0 };
const serverBody = (f, extra = {}) => ({ name: f.name.trim(), mode: f.mode, map: f.map, host: f.host.trim(), port: +f.port, max: +f.max, vip: !!f.vip, enabled: f.enabled !== false, rcon: f.rcon ?? '', sort: +(f.sort ?? 0), ...extra });

function ServerForm({ initial, onClose }) {
  const { reload } = useAdmin();
  const act = useAct();
  const editing = !!initial.id;
  const [f, setF] = useState({ ...emptyServer, ...initial, rcon: '' });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const errs = {
    name: f.name.trim().length >= 4 ? '' : 'حداقل ۴ کاراکتر.',
    host: /^([a-z0-9-]+\.)+[a-z]{2,}$|^(\d{1,3}\.){3}\d{1,3}$/i.test(f.host.trim()) ? '' : 'هاست یا آی‌پی معتبر وارد کن.',
    port: +f.port >= 1024 && +f.port <= 65535 ? '' : 'پورت بین 1024 تا 65535.',
    max: +f.max >= 2 && +f.max <= 200 ? '' : 'بین ۲ تا ۲۰۰.',
    map: /^[A-Za-z0-9_ ]{3,32}$/.test(f.map) ? '' : 'نام مپ نامعتبره.',
  };
  const e = (k) => (touched ? errs[k] : '');
  const save = async () => {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    const r = await act(editing ? `/api/admin/servers/${f.id}` : '/api/admin/servers', editing ? 'PATCH' : 'POST', serverBody(f),
      editing ? 'سرور به‌روزرسانی شد.' : 'سرور اضافه شد؛ تا ۳۰ ثانیه دیگه وضعیت زنده‌ش (A2S) خونده می‌شه.');
    setBusy(false);
    if (r) { await reload(); onClose(); }
  };
  return (
    <Modal open onClose={onClose} wide title={editing ? 'ویرایش سرور بازی' : 'افزودن سرور بازی'} footer={<><Btn variant="ghost" onClick={onClose}>انصراف</Btn><Btn onClick={save} busy={busy}>{editing ? 'ذخیره' : 'افزودن سرور'}</Btn></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="نام سرور" error={e('name')} className="sm:col-span-2"><input id="gs-name" dir="ltr" value={f.name} onChange={up('name')} placeholder="Doping Retake #3" className="field mono" /></Field>
        <Field label="نوع">
          <select id="gs-mode" value={f.mode} onChange={up('mode')} className="field">{MODES.filter((m) => m.id !== 'all').map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </Field>
        <Field label="مپ پیش‌فرض" error={e('map')}><input id="gs-map" dir="ltr" value={f.map} onChange={up('map')} className="field mono" /></Field>
        <Field label="هاست / آی‌پی" error={e('host')}><input id="gs-host" dir="ltr" value={f.host} onChange={up('host')} placeholder="retake3.doping.games" className="field mono" /></Field>
        <Field label="پورت (بازی، A2S و RCON)" error={e('port')}><input id="gs-port" dir="ltr" inputMode="numeric" value={f.port} onChange={up('port')} className="field mono" /></Field>
        <Field label="ظرفیت" error={e('max')}><input id="gs-max" dir="ltr" inputMode="numeric" value={f.max} onChange={up('max')} className="field mono" /></Field>
        <Field label="رمز RCON" hint={editing ? (initial.hasRcon ? 'ثبت شده؛ خالی بذار تا بمونه.' : 'هنوز ثبت نشده.') : 'رمزگذاری‌شده ذخیره می‌شه.'}>
          <input id="gs-rcon" dir="ltr" type="password" autoComplete="new-password" value={f.rcon} onChange={up('rcon')} className="field mono" />
        </Field>
        <div className="flex items-center justify-between well px-4 py-3"><span className="text-sm font-bold">فقط VIP</span><Toggle checked={f.vip} onChange={(v) => setF({ ...f, vip: v })} label="فقط VIP" /></div>
        <div className="flex items-center justify-between well px-4 py-3"><span className="text-sm font-bold">نمایش در سایت</span><Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="نمایش در سایت" /></div>
      </div>
    </Modal>
  );
}

function GameServers() {
  const { o, reload } = useAdmin();
  const act = useAct();
  const [form, setForm] = useState(null);
  const [rcon, setRcon] = useState(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-silver">وضعیت، مپ و بازیکن‌ها هر ۳۰ ثانیه با کوئری A2S از خود سرورها خونده می‌شه و توی صفحه اصلی نمایش داده می‌شه.</p>
        <Btn icon={Plus} onClick={() => setForm({})}>افزودن سرور</Btn>
      </div>
      <Card className="overflow-hidden">
        <div className="max-md:p-2 overflow-x-auto">
          <table className="rtable w-full md:min-w-[860px] text-sm">
            <thead className="text-[11px] text-zinc-500">
              <tr>{['سرور', 'آدرس', 'مپ', 'بازیکن', 'پینگ', 'وضعیت', 'عملیات'].map((h) => <th key={h} className="px-3 py-3 text-start font-bold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {o.servers.map((v) => (
                <tr key={v.id} className={cx('border-t border-white/5 hover:bg-white/[0.02]', !v.enabled && 'opacity-60')}>
                  <td data-head="1" className="px-3 py-2.5"><div className="flex items-center gap-3"><ModeEmblem mode={v.mode} vip={v.vip} className="size-9 shrink-0" /><div className="min-w-0"><Mono className="block font-bold">{v.name}</Mono><Mono className="text-[11px] text-zinc-500">{v.game} · {v.tick}</Mono></div></div></td>
                  <td data-label="آدرس" className="px-3 py-2.5"><Mono className="text-xs">{v.host}:{v.port}</Mono></td>
                  <td data-label="مپ" className="px-3 py-2.5"><Mono className="text-xs font-bold">{v.map}</Mono></td>
                  <td data-label="بازیکن" className="px-3 py-2.5"><div className="w-28"><Mono className="text-xs">{v.players}/{v.max}</Mono><Progress value={(v.players / v.max) * 100} h="h-1.5" className="mt-1" /></div></td>
                  <td data-label="پینگ" className="px-3 py-2.5"><Mono className="text-xs text-ok">{v.status === 'online' ? `${v.ping}ms` : '—'}</Mono></td>
                  <td data-label="وضعیت" className="px-3 py-2.5"><Badge tone={!v.enabled ? 'mute' : v.status === 'online' ? 'ok' : v.status === 'offline' ? 'bad' : 'warn'}>{!v.enabled ? 'Hidden' : v.status === 'online' ? 'Online' : v.status === 'offline' ? 'No reply' : 'Pending'}</Badge></td>
                  <td data-label="عملیات" className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Btn size="sm" icon={Terminal} onClick={() => setRcon(v.id)}>RCON</Btn>
                      <Btn size="sm" variant="ghost" icon={Pencil} aria-label="ویرایش" onClick={() => setForm(v)} />
                      <Btn
                        size="sm" variant="ghost" icon={v.enabled ? Ban : Play} aria-label={v.enabled ? 'پنهان کردن از سایت' : 'نمایش در سایت'} title={v.enabled ? 'پنهان کردن از سایت و توقف کوئری' : 'نمایش در سایت'}
                        onClick={async () => { if (await act(`/api/admin/servers/${v.id}`, 'PATCH', serverBody(v, { enabled: !v.enabled, rcon: '' }), v.enabled ? 'سرور از سایت پنهان شد.' : 'سرور توی سایت نمایش داده می‌شه.')) reload(); }}
                      />
                      <Btn size="sm" variant="danger" icon={Trash2} aria-label="حذف" onClick={async () => { if (await act(`/api/admin/servers/${v.id}`, 'DELETE', undefined, 'سرور حذف شد.')) reload(); }} />
                    </div>
                  </td>
                </tr>
              ))}
              {!o.servers.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-silver">هنوز سروری اضافه نشده.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {form && <ServerForm initial={form} onClose={() => setForm(null)} />}
      {rcon && o.servers.some((x) => x.id === rcon) && <Rcon id={rcon} onClose={() => setRcon(null)} />}
    </div>
  );
}

/* ───────────────────────── Sales, gateways, discounts ───────────────────────── */

function NumInput({ id, value, onChange, suffix }) {
  return (
    <div className="relative">
      <input id={id} dir="ltr" inputMode="numeric" value={value} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)} className="field mono pe-12 text-left" />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-zinc-500">{suffix}</span>}
    </div>
  );
}

function Sales({ open }) {
  const { s } = useStore();
  const act = useAct();
  const sales = useResource('/api/admin/sales');
  const P = s.site.pricing;
  const [code, setCode] = useState({ code: '', percent: 10, max: 100 });
  const [err, setErr] = useState('');
  const d = sales.data;
  const addCode = async () => {
    const c = code.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(c)) return setErr('کد باید ۴ تا ۱۶ حرف لاتین یا عدد باشه.');
    if (code.percent < 1 || code.percent > 90) return setErr('درصد بین ۱ تا ۹۰.');
    setErr('');
    if (await act('/api/admin/discounts', 'POST', { code: c, percent: code.percent, max: code.max || 100 }, 'کد تخفیف ساخته شد.')) {
      setCode({ code: '', percent: 10, max: 100 });
      sales.reload();
    }
  };
  const O_STATUS = { paid: ['پرداخت شده', 'ok'], pending: ['در انتظار', 'warn'], failed: ['ناموفق', 'bad'], canceled: ['لغو', 'mute'] };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Banknote className="size-4 text-brand2" /> قیمت پلن‌ها (تومان · ماهانه)</h3>
            <p className="mt-1 text-xs text-silver">قیمت‌ها، حجم‌ها، مدت‌ها و تخفیف‌ها در تنظیمات سایت ویرایش می‌شن.</p>
          </div>
          <Btn size="sm" icon={Pencil} onClick={() => open?.('settings', 'plans')}>ویرایش قیمت‌ها و پلن‌ها</Btn>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm sm:grid-cols-3 lg:grid-cols-5">
          {pingTiers(P).map((t) => (
            <div key={t} className="bg-card px-4 py-3">
              <dt className="text-xs text-zinc-500">{s.site.planNames.ping} · {tierLabel(t)}</dt>
              <dd className="mt-0.5 font-bold">{toman(priceOf(P, { kind: 'ping', tier: t, months: 1 }).total)}</dd>
            </div>
          ))}
          {dnsSlots(P).map((n) => (
            <div key={`d${n}`} className="bg-card px-4 py-3">
              <dt className="text-xs text-zinc-500">{s.site.planNames.dns} · {fa(n)} آی‌پی</dt>
              <dd className="mt-0.5 font-bold">{toman(priceOf(P, { kind: 'dns', slots: n, months: 1 }).total)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-zinc-500">
          {durations(P).filter((d) => d.off).map((d) => `${fa(d.months)} ماهه ${fa(d.off)}٪ تخفیف`).join(' · ') || 'بدون تخفیف مدت'} · {s.site.planNames.pro} {fa(Math.round((P.proMul - 1) * 100))}٪ گران‌تر · هر گیگ مازاد {toman(P.extraPerGb)}
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><BadgePercent className="size-4 text-brand2" /> کدهای تخفیف</h3>
        <div className="mt-4 grid grid-cols-[1fr_5rem_5rem_auto] items-end gap-2">
          <Field label="کد"><input id="dc-code" dir="ltr" value={code.code} onChange={(e) => setCode({ ...code, code: e.target.value })} placeholder="NOWRUZ" className="field mono uppercase" /></Field>
          <Field label="درصد"><NumInput id="dc-pct" value={code.percent} onChange={(v) => setCode({ ...code, percent: v })} /></Field>
          <Field label="سقف"><NumInput id="dc-max" value={code.max} onChange={(v) => setCode({ ...code, max: v })} /></Field>
          <Btn icon={Plus} onClick={addCode}>ساخت</Btn>
        </div>
        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        <ul className="mt-4 space-y-2">
          {(d?.discounts ?? []).map((x) => (
            <li key={x.id} className="flex items-center gap-3 well px-3 py-2">
              <div className="min-w-0 flex-1">
                <Mono className="block font-bold">{x.code}</Mono>
                <Mono className="text-[11px] text-silver">{x.percent}% · {x.used}/{x.max} used</Mono>
              </div>
              {x.used >= x.max && <Badge tone="warn">ظرفیت پر</Badge>}
              <Toggle checked={x.active} label={`فعال بودن ${x.code}`} onChange={async (v) => { if (await act(`/api/admin/discounts/${x.id}`, 'PATCH', { active: v })) sales.reload(); }} />
              <Btn size="sm" variant="danger" icon={Trash2} aria-label={`حذف ${x.code}`} onClick={async () => { if (await act(`/api/admin/discounts/${x.id}`, 'DELETE', undefined, 'کد حذف شد.')) sales.reload(); }} />
            </li>
          ))}
          {d && !d.discounts.length && <li className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-silver">هنوز کد تخفیفی نساختی.</li>}
        </ul>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><CreditCard className="size-4 text-brand2" /> درگاه‌های پرداخت</h3>
        <ul className="mt-4 space-y-2">
          {(d?.gateways ?? []).map((g) => (
            <li key={g.id} className="flex items-center gap-3 well px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{g.name}</div>
                <div className="text-[11px] text-silver">{g.kind}{g.mode && <> · حالت <Mono>{g.mode}</Mono>{g.mode === 'test' && ' (ZARINPAL_MERCHANT_ID تنظیم نشده)'}</>}</div>
              </div>
              <Badge tone={g.enabled ? 'ok' : 'mute'}>{g.enabled ? 'فعال' : 'خاموش'}</Badge>
              <Toggle checked={g.enabled} label={`فعال بودن ${g.name}`} onChange={async (v) => { if (await act(`/api/admin/gateways/${g.id}`, 'PATCH', { enabled: v })) sales.reload(); }} />
            </li>
          ))}
        </ul>
        {d && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="well p-4">
              <div className="text-xs text-silver">فروش ۳۰ روز اخیر</div>
              <div className="mt-1 text-xl font-black">{toman(d.totals.month)}</div>
            </div>
            <div className="well p-4">
              <div className="text-xs text-silver">کل فروش · شارژ کیف پول</div>
              <div className="mt-1 text-sm font-black">{toman(d.totals.paid)}</div>
              <div className="text-[11px] text-zinc-500">{toman(d.totals.topups)} شارژ · {fa(d.totals.ok)} موفق · {fa(d.totals.bad)} ناموفق</div>
            </div>
          </div>
        )}
      </Card>

      <Card className="min-w-0 p-5 lg:col-span-2">
        <h3 className="text-[15px] font-black">آخرین سفارش‌ها</h3>
        <div className="max-md:p-2 mt-3 overflow-x-auto">
          <table className="rtable w-full md:min-w-[760px] text-sm">
            <thead className="text-[11px] text-zinc-500"><tr>{['فاکتور', 'شرح', 'کاربر', 'مبلغ', 'درگاه', 'وضعیت'].map((h) => <th key={h} className="px-2 py-2 text-start font-bold">{h}</th>)}</tr></thead>
            <tbody>
              {(d?.orders ?? []).map((x) => (
                <tr key={x.id} className="border-t border-white/5">
                  <td data-label="فاکتور" className="px-2 py-2"><Mono className="text-xs">{x.number}</Mono></td>
                  <td data-head="1" className="px-2 py-2"><div className="font-bold">{x.title}</div><div className="text-[11px] text-zinc-500">{faDate(x.at)} {clock(x.at)}{x.refId && <> · ref <Mono>{x.refId}</Mono></>}</div></td>
                  <td data-label="کاربر" className="px-2 py-2"><Mono className="text-xs">{x.username}</Mono></td>
                  <td data-label="مبلغ" className="px-2 py-2 whitespace-nowrap">{toman(x.amount)}</td>
                  <td data-label="درگاه" className="px-2 py-2 text-xs text-silver">{x.gateway === 'wallet' ? 'کیف پول' : 'زرین‌پال'}</td>
                  <td data-label="وضعیت" className="px-2 py-2"><Badge tone={O_STATUS[x.status][1]}>{O_STATUS[x.status][0]}</Badge></td>
                </tr>
              ))}
              {d && !d.orders.length && <tr><td colSpan={6} className="px-2 py-8 text-center text-sm text-silver">هنوز سفارشی ثبت نشده.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── Support tickets ───────────────────────── */

const T_STATUS = { open: ['در انتظار پاسخ', 'warn'], answered: ['پاسخ داده شد', 'ok'], closed: ['بسته', 'mute'] };

function Tickets() {
  const act = useAct();
  const tickets = useResource('/api/admin/tickets', { interval: 30_000 });
  const [sel, setSel] = useState(null);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('open');
  const all = tickets.data ?? [];
  const list = all.filter((t) => filter === 'all' || t.status === filter);
  const t = all.find((x) => x.id === sel) ?? list[0];
  const send = async (body, ok) => { if (await act(`/api/admin/tickets/${t.id}`, 'POST', body, ok)) { setReply(''); tickets.reload(); } };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Card className="p-5">
        <div className="flex gap-1.5 overflow-x-auto">
          {[['open', 'باز'], ['answered', 'پاسخ‌داده'], ['closed', 'بسته'], ['all', 'همه']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={cx('shrink-0 rounded-lg px-3 py-1.5 text-xs', filter === id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white')}>
              {label} <Mono className="opacity-60">{id === 'all' ? all.length : all.filter((x) => x.status === id).length}</Mono>
            </button>
          ))}
        </div>
        <ul className="mt-3 space-y-2">
          {list.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setSel(x.id)} className={cx('relative w-full rounded-2xl p-3 text-start transition', t?.id === x.id ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
                <div className="flex items-center justify-between gap-2"><Mono className="text-[11px] text-silver">{x.code} · {x.username}</Mono><Badge tone={T_STATUS[x.status][1]}>{T_STATUS[x.status][0]}</Badge></div>
                <div className="mt-1 truncate text-sm font-bold">{x.subject}</div>
                <div className="text-[11px] text-zinc-500">واحد {x.dept} · {faDate(x.updated)}</div>
              </button>
            </li>
          ))}
          {!list.length && <li className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-xs text-silver">{tickets.loading ? 'در حال بارگذاری…' : 'تیکتی نیست.'}</li>}
        </ul>
      </Card>
      <Card className="flex min-h-[360px] min-w-0 flex-col p-5">
        {t ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.07] pb-4">
              <div><div className="font-black">{t.subject}</div><div className="text-xs text-silver"><Mono>{t.code}</Mono> · <Mono>{t.username}</Mono> · واحد {t.dept}</div></div>
              {t.status !== 'closed' && <Btn size="sm" variant="ghost" onClick={() => send({ status: 'closed' }, 'تیکت بسته شد.')}>بستن تیکت</Btn>}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {t.msgs.map((m) => (
                <div key={m.id} className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-7', m.from === 'staff' ? 'bg-brand/20' : 'ms-auto border border-white/8 bg-white/[0.04]')}>
                  <div className="mb-0.5 text-[11px] font-bold text-silver">{m.from === 'staff' ? 'پشتیبانی' : t.username} · {clock(m.at)}</div>
                  <span className="whitespace-pre-wrap">{m.text}</span>
                </div>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send({ text: reply.trim() }, 'پاسخ ارسال شد.'); }}>
              <input id="adm-reply" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ پشتیبانی…" className="field" />
              <Btn type="submit" icon={Send} disabled={!reply.trim()}>ارسال</Btn>
            </form>
          </>
        ) : <div className="m-auto text-center text-sm text-silver">تیکتی انتخاب نشده.</div>}
      </Card>
    </div>
  );
}

/* ───────────────────────── Security audit log ───────────────────────── */

const L_TYPES = [['all', 'همه'], ['auth', 'Auth'], ['mikrotik', 'MikroTik API'], ['payment', 'Payment'], ['dns', 'DNS / IP'], ['rcon', 'RCON'], ['admin', 'Admin'], ['system', 'System']];
const L_TONE = { info: 'mute', warn: 'warn', critical: 'bad' };

function Logs() {
  const [type, setType] = useState('all');
  const [level, setLevel] = useState('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [frozen, setFrozen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const url = `/api/admin/logs?type=${type}&level=${level}&q=${encodeURIComponent(query)}`;
  const logs = useResource(url, { interval: frozen ? 0 : 5_000 });
  const rows = logs.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {L_TYPES.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setType(id)} aria-pressed={type === id} className={cx('shrink-0 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap', type === id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white')}>{label}</button>
          ))}
        </div>
        <select id="log-level" value={level} onChange={(e) => setLevel(e.target.value)} className="field w-auto" aria-label="سطح">
          <option value="all">همه سطح‌ها</option><option value="info">info</option><option value="warn">warn</option><option value="critical">critical</option>
        </select>
        <input id="log-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در لاگ…" className="field w-full sm:w-52" />
        <Btn variant={frozen ? 'primary' : 'ghost'} icon={frozen ? Play : Pause} onClick={() => setFrozen(!frozen)}>{frozen ? 'ادامه پخش زنده' : 'توقف'}</Btn>
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5 text-xs text-silver">
          <span className="flex items-center gap-2">{frozen ? <Pause className="size-3.5 text-warn" /> : <Dot />}{frozen ? 'متوقف شده' : 'زنده'} · {fa(rows.length)} رویداد</span>
          <span>append-only · بدون امکان ویرایش یا حذف</span>
        </div>
        <div className="max-md:p-2 max-h-[560px] overflow-auto">
          <table className="rtable w-full md:min-w-[820px] text-xs">
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className={cx('border-t border-white/5', l.level === 'critical' && 'bg-red-500/[0.06]')}>
                  <td data-label="زمان" className="px-3 py-2 whitespace-nowrap"><Mono className="text-zinc-500">{clock(l.at)}</Mono></td>
                  <td data-label="سطح" className="px-2 py-2"><Badge tone={L_TONE[l.level]}><Mono>{l.level}</Mono></Badge></td>
                  <td data-label="نوع" className="px-2 py-2"><Mono className="text-brand2">{l.type}</Mono></td>
                  <td data-head="1" className="w-full px-2 py-2"><span dir="auto" className="mono block text-zinc-200" style={{ unicodeBidi: 'plaintext' }}>{l.msg}</span></td>
                  <td data-label="کاربر" className="px-2 py-2 whitespace-nowrap"><Mono className="text-silver">{l.actor}</Mono></td>
                  <td data-label="آی‌پی" className="px-3 py-2 whitespace-nowrap"><Mono className="text-zinc-500">{l.ip}</Mono></td>
                </tr>
              ))}
              {!rows.length && <tr><td className="px-3 py-10 text-center text-sm text-silver">{logs.loading ? 'در حال بارگذاری…' : 'رویدادی با این فیلتر ثبت نشده.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── Shell ───────────────────────── */

export default function Admin({ initial, role }) {
  const { api } = useStore();
  const [o, setO] = useState(initial);
  const [tab, setTab] = useState(role === 'admin' ? 'routers' : 'users');
  const [sub, setSub] = useState(null);
  const reload = useCallback(async () => {
    try { setO(await api('/api/admin/overview')); } catch { /* keep last */ }
  }, [api]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 15_000);
    return () => clearInterval(t);
  }, [reload]);
  const ctx = useMemo(() => ({ o, reload }), [o, reload]);
  const open = (t, inner = null) => { setTab(t); setSub(inner); window.scrollTo({ top: 0 }); };
  const peers = o.routers.filter((r) => r.role === 'entry').reduce((a, r) => a + r.peers, 0);
  const maxCpu = Math.max(0, ...o.routers.filter((r) => r.status === 'online').map((r) => r.cpu));
  const alerts = o.counts.critical + o.routers.filter((r) => r.enabled && r.status === 'offline').length;
  const ALL = [
    { id: 'routers', label: 'روترها و نودها', icon: Router, count: o.routers.length, C: Routers, admin: true },
    { id: 'users', label: 'کاربران و حجم', icon: Users, count: o.counts.users, C: UsersTable },
    { id: 'servers', label: 'سرورهای بازی و RCON', icon: Crosshair, count: o.servers.length, C: GameServers, admin: true },
    { id: 'sales', label: 'فروش و درگاه', icon: Banknote, C: Sales, admin: true },
    { id: 'tickets', label: 'تیکت‌های پشتیبانی', icon: LifeBuoy, C: Tickets },
    { id: 'logs', label: 'لاگ امنیتی و API', icon: ScrollText, C: Logs },
    { id: 'settings', label: 'تنظیمات سایت', icon: SlidersHorizontal, C: Settings, admin: true },
  ];
  const TABS = ALL.filter((t) => role === 'admin' || !t.admin);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const Current = current.C;
  return (
    <AdminCtx.Provider value={ctx}>
      <div className="gutter mx-auto max-w-6xl pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">مرکز کنترل</h1>
            <p className="mt-1 text-sm text-zinc-500">نقش <Mono className="font-bold text-white">{role === 'admin' ? 'ADMIN' : 'SUPPORT'}</Mono></p>
          </div>
          <Badge tone={alerts ? 'bad' : 'ok'} icon={ShieldAlert}>{alerts ? `${fa(alerts)} هشدار در ۲۴ ساعت` : 'بدون هشدار'}</Badge>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          <Stat label="تانل‌های متصل (handshake < ۳ دقیقه)" value={<Mono>{o.counts.online}/{o.counts.users}</Mono>} />
          <Stat label="WireGuard Peers" value={<Mono>{peers}</Mono>} sub="روی نودهای ورودی" />
          <Stat label="بیشترین بار CPU" value={<Mono>{maxCpu}%</Mono>} tone={maxCpu > 80 ? 'text-brand2' : 'text-white'} />
          <Stat label="بازیکن روی سرورها" value={<Mono>{o.servers.reduce((a, v) => a + v.players, 0)}</Mono>} />
        </div>
        <RailLayout tabs={TABS} value={current.id} onChange={(t) => open(t)}><Current key={`${current.id}-${sub}`} open={open} sub={sub} role={role} /></RailLayout>
      </div>
    </AdminCtx.Provider>
  );
}
