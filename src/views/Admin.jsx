import { useEffect, useRef, useState } from 'react';
import {
  Activity, BadgePercent, Ban, Banknote, Code2, CreditCard, Crosshair, Pause, Pencil, Play, Plus, Power,
  RefreshCw, RotateCcw, Router, ScrollText, Search, SlidersHorizontal, Send, Server, ShieldAlert, Terminal, Trash2, UserX, Users,
} from 'lucide-react';
import { useStore } from '../store.jsx';
import Settings from './Settings.jsx';
import { ArcMeter, ModeEmblem, RouteMap } from '../art.jsx';
import { Badge, Btn, Card, cx, Dot, Drawer, Field, Modal, Mono, Progress, RailLayout, Stat, Toggle } from '../ui.jsx';
import { clock, CS2_MAPS, daysLeft, dnsSlots, durations, fa, GB, gb, isIPv4, MODES, pingTiers, priceOf, rint, roster, tierLabel, toman, uid } from '../data.js';

const U_STATUS = { active: ['Active', 'ok'], quota: ['Quota Exceeded', 'bad'], expired: ['Expired', 'warn'], disabled: ['Disabled', 'mute'] };

/* ───────────────────────── MikroTik cluster ───────────────────────── */

const emptyRouter = { name: '', role: 'entry', city: '', host: '', apiPort: 8443, apiUser: 'doping-api', password: '', wg: 'wg-doping', subnet: '10.10.30.0/24' };

function RouterForm({ initial, onClose }) {
  const { set, toast, log } = useStore();
  const editing = !!initial.id;
  const [f, setF] = useState({ ...emptyRouter, ...initial, password: '' });
  const [touched, setTouched] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const errs = {
    name: /^[A-Za-z0-9-]{3,24}$/.test(f.name) ? '' : '۳ تا ۲۴ کاراکتر لاتین، عدد یا خط تیره.',
    host: isIPv4(f.host) ? '' : 'آی‌پی نسخه ۴ معتبر وارد کن.',
    apiPort: +f.apiPort >= 1 && +f.apiPort <= 65535 ? '' : 'پورت بین 1 تا 65535.',
    apiUser: /^[a-zA-Z0-9_.-]{3,32}$/.test(f.apiUser) ? '' : 'نام کاربری API نامعتبره.',
    password: (editing && !f.password) || f.password.length >= 12 ? '' : 'حداقل ۱۲ کاراکتر.',
    wg: /^[a-zA-Z0-9_-]{2,15}$/.test(f.wg) ? '' : 'نام اینترفیس نامعتبره.',
    subnet: /^(10|172|192)\.\d{1,3}\.\d{1,3}\.0\/(2\d|30)$/.test(f.subnet) ? '' : 'مثل 10.10.30.0/24',
  };
  const valid = Object.values(errs).every((e) => !e);
  const e = (k) => (touched ? errs[k] : '');

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const { password, ...rest } = f;
    const row = { ...rest, apiPort: +f.apiPort, city: f.city || (f.role === 'entry' ? 'ایران' : 'خارج') };
    if (editing) {
      set((p) => ({ routers: p.routers.map((r) => (r.id === row.id ? { ...r, ...row } : r)) }));
    } else {
      set((p) => ({ routers: [...p.routers, { ...row, id: `r${uid()}`, version: '7.19.4', model: 'CHR P1', cpu: 9, ram: 22, peers: 0, queues: 0, handshake: 0, status: 'online', lastSync: null, uptime: '0d' }] }));
    }
    log('admin', 'info', `router.${editing ? 'update' : 'create'} ${row.name} · ${password ? 'رمز API با AES-256-GCM ذخیره شد' : 'رمز بدون تغییر'}`);
    toast(editing ? 'روتر به‌روزرسانی شد.' : 'روتر اضافه شد. یک‌بار «تست اتصال و سینک» رو بزن.');
    onClose();
  };

  return (
    <Modal
      open onClose={onClose} wide title={editing ? `ویرایش ${initial.name}` : 'افزودن روتر میکروتیک'}
      footer={<><Btn variant="ghost" onClick={onClose}>انصراف</Btn><Btn onClick={save}>{editing ? 'ذخیره تغییرات' : 'افزودن روتر'}</Btn></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="نام نود" error={e('name')}><input id="rt-name" dir="ltr" value={f.name} onChange={up('name')} placeholder="THR-EDGE-03" className="field mono" /></Field>
        <Field label="نقش">
          <select id="rt-role" value={f.role} onChange={up('role')} className="field">
            <option value="entry">ورودی ایران (Entry)</option>
            <option value="exit">خروجی خارج (Exit)</option>
          </select>
        </Field>
        <Field label="آی‌پی روتر" error={e('host')}><input id="rt-host" dir="ltr" value={f.host} onChange={up('host')} placeholder="203.0.113.40" className="field mono" /></Field>
        <Field label="پورت REST API / SSL" error={e('apiPort')}><input id="rt-port" dir="ltr" inputMode="numeric" value={f.apiPort} onChange={up('apiPort')} className="field mono" /></Field>
        <Field label="نام کاربری API" error={e('apiUser')}><input id="rt-user" dir="ltr" value={f.apiUser} onChange={up('apiUser')} className="field mono" /></Field>
        <Field label="رمز API" error={e('password')} hint={editing ? 'خالی بذار تا رمز فعلی بمونه.' : 'رمزگذاری‌شده ذخیره می‌شه و دیگه نمایش داده نمی‌شه.'}>
          <input id="rt-pass" dir="ltr" type="password" autoComplete="new-password" value={f.password} onChange={up('password')} className="field mono" />
        </Field>
        <Field label="اینترفیس WireGuard" error={e('wg')}><input id="rt-wg" dir="ltr" value={f.wg} onChange={up('wg')} className="field mono" /></Field>
        <Field label="Subnet Pool" error={e('subnet')}><input id="rt-subnet" dir="ltr" value={f.subnet} onChange={up('subnet')} className="field mono" /></Field>
        <Field label="محل / دیتاسنتر" className="sm:col-span-2"><input id="rt-city" value={f.city} onChange={up('city')} placeholder="تهران · آسیاتک" className="field" /></Field>
      </div>
    </Modal>
  );
}

function SyncModal({ router, onClose }) {
  const { s, set, log } = useStore();
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);
  const snap = useRef(null);

  useEffect(() => {
    const r = s.routers.find((x) => x.id === router.id) ?? router;
    const peers = r.role === 'entry' ? s.users.filter((u) => u.router === r.id).length + Math.max(0, r.peers - 14) : r.peers;
    snap.current = { peers, queues: r.role === 'entry' ? peers : 0 };
    const off = r.status !== 'online';
    const script = off
      ? [[300, 'dim', `→ CONNECT ${r.host}:${r.apiPort}`], [2200, 'bad', '✗ timeout after 8000ms · روتر جواب نمی‌ده']]
      : [
          [250, 'dim', `→ CONNECT ${r.host}:${r.apiPort} (TLS 1.2)`],
          [550, 'ok', '✓ certificate fingerprint pinned · sha256 match'],
          [850, 'dim', '→ GET /rest/system/resource'],
          [1150, 'out', `  200 · RouterOS ${r.version} · ${r.model} · cpu ${r.cpu}% · uptime ${r.uptime}`],
          [1450, 'dim', `→ GET /rest/interface/wireguard/peers?interface=${r.wg}`],
          [1800, 'out', `  200 · ${peers} peers · ${rint(60, 80)}% handshake < 3m`],
          [2100, 'dim', '→ GET /rest/queue/simple?.proplist=.id,name,target,bytes'],
          [2450, 'out', `  200 · ${snap.current.queues} queues · ${rint(140, 260)}ms`],
          [2750, 'dim', '→ reconcile panel ⇄ router'],
          [3050, 'out', '  0 missing peers · 0 orphan queues · counters merged'],
          [3300, 'ok', '✓ sync complete'],
        ];
    setLines([]);
    setDone(false);
    const timers = script.map(([t, tone, text]) => setTimeout(() => setLines((l) => [...l, { tone, text, at: clock() }]), t));
    const end = setTimeout(() => {
      setDone(true);
      if (!off) set((p) => ({ routers: p.routers.map((x) => (x.id === r.id ? { ...x, peers: snap.current.peers, queues: snap.current.queues, lastSync: Date.now() } : x)) }));
      log('mikrotik', off ? 'critical' : 'info', off ? `sync failed · ${r.name} · timeout` : `sync OK · ${r.name} · ${snap.current.peers} peers / ${snap.current.queues} queues`);
    }, script.at(-1)[0] + 200);
    return () => { timers.forEach(clearTimeout); clearTimeout(end); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, router.id]);

  return (
    <Modal
      open onClose={onClose} wide title={`تست اتصال و سینک · ${router.name}`}
      footer={<><Btn variant="ghost" icon={RotateCcw} disabled={!done} onClick={() => setRun((n) => n + 1)}>اجرای دوباره</Btn><Btn onClick={onClose}>بستن</Btn></>}
    >
      <div dir="ltr" className="mono min-h-64 well p-4 text-left text-xs leading-6" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={cx(l.tone === 'ok' && 'text-ok', l.tone === 'bad' && 'text-brand2', l.tone === 'dim' && 'text-silver', l.tone === 'out' && 'text-white')}>
            <span className="text-zinc-600">{l.at} </span>{l.text}
          </div>
        ))}
        {!done && <span className="inline-block h-4 w-2 animate-pulse bg-brand2 align-middle" />}
      </div>
    </Modal>
  );
}

function Routers() {
  const { s, set, toast, log } = useStore();
  const [form, setForm] = useState(null);
  const [sync, setSync] = useState(null);
  const [del, setDel] = useState(null);
  const group = (role, title) => (
    <div>
      <div className="mb-4 flex items-center gap-3"><span className="text-sm font-black">{title}</span><span className="hairline flex-1" /></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {s.routers.filter((r) => r.role === role).map((r) => {
          const on = r.status === 'online';
          return (
            <Card key={r.id} className={cx('flex flex-col gap-5 p-5', !on && 'border-red-500/50')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Mono className="block truncate text-base font-bold">{r.name}</Mono>
                  <div className="truncate text-xs text-silver">{r.city}</div>
                </div>
                <Badge tone={on ? 'ok' : 'bad'}>{on ? <><Dot /> Online</> : 'Offline'}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                {[['IP', r.host], ['API Port', r.apiPort], ['RouterOS', `v${r.version}`], ['Interface', r.wg], ['Subnet', r.subnet], ['Model', r.model]].map(([k, v]) => (
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
                {[['WG Peers', r.peers], ['Queues', r.queues], ['Handshake', on ? `${r.handshake}s` : '—']].map(([k, v]) => (
                  <div key={k} className="well py-2">
                    <Mono className={cx('block text-sm font-black', k === 'Handshake' && on && (r.handshake < 120 ? 'text-ok' : 'text-warn'))}>{v}</Mono>
                    <Mono className="text-[11px] text-silver">{k}</Mono>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-zinc-500">آخرین سینک: <Mono>{r.lastSync ? clock(r.lastSync) : 'never'}</Mono></div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Btn size="sm" icon={RefreshCw} className="w-full min-[360px]:w-auto min-[360px]:flex-1" onClick={() => setSync(r)}>تست اتصال و سینک میکروتیک</Btn>
                <Btn size="sm" variant="ghost" icon={Pencil} aria-label={`ویرایش ${r.name}`} onClick={() => setForm(r)} />
                <Btn
                  size="sm" variant="ghost" icon={Power} aria-label={on ? 'شبیه‌سازی قطعی' : 'برگرداندن به مدار'} title={on ? 'شبیه‌سازی قطعی نود' : 'برگرداندن به مدار'}
                  onClick={() => { set((p) => ({ routers: p.routers.map((x) => (x.id === r.id ? { ...x, status: on ? 'offline' : 'online' } : x)) })); log('mikrotik', on ? 'critical' : 'info', `${r.name} ${on ? 'unreachable' : 'back online'}`); }}
                />
                <Btn size="sm" variant="danger" icon={Trash2} aria-label={`حذف ${r.name}`} onClick={() => setDel(r)} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-silver">کلاستر RouterOS v7 · اتصال پنل فقط از طریق REST روی TLS با گواهی پین‌شده.</p>
        <Btn icon={Plus} onClick={() => setForm({})}>افزودن روتر</Btn>
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="text-sm font-black">توپولوژی زنده کلاستر</span>
          <Badge tone={s.routers.every((r) => r.status === 'online') ? 'ok' : 'bad'}><Dot tone={s.routers.every((r) => r.status === 'online') ? 'ok' : 'bad'} /> {fa(s.routers.filter((r) => r.status === 'online').length)} از {fa(s.routers.length)} نود در مدار</Badge>
        </div>
        <div className="overflow-x-auto"><RouteMap
          className="block w-full min-w-[620px]"
          status={Object.fromEntries(s.routers.filter((r) => /^(THR|SHZ|MCT|DXB|FRA)/.test(r.name)).map((r) => [r.name.slice(0, 3).toLowerCase(), { tone: r.status !== 'online' ? 'bad' : r.cpu >= 85 ? 'warn' : 'ok', sub: r.status === 'online' ? `${r.peers} peers · ${r.cpu}%` : 'OFFLINE' }]))}
        /></div>
      </Card>
      {group('entry', 'روترهای ورودی ایران (Entry)')}
      {group('exit', 'روترهای خروجی عمان / امارات / اروپا (Exit)')}
      {form && <RouterForm initial={form} onClose={() => setForm(null)} />}
      {sync && <SyncModal router={sync} onClose={() => setSync(null)} />}
      <Modal
        open={!!del} onClose={() => setDel(null)} title="حذف روتر" icon={Trash2}
        footer={<><Btn variant="ghost" onClick={() => setDel(null)}>انصراف</Btn><Btn variant="danger" onClick={() => { set((p) => ({ routers: p.routers.filter((x) => x.id !== del.id) })); log('admin', 'warn', `router.delete ${del.name}`); toast('روتر از کلاستر حذف شد.', 'warn'); setDel(null); }}>حذف {del?.name}</Btn></>}
      >
        <p className="text-sm leading-7 text-silver">روتر <Mono className="font-bold text-white">{del?.name}</Mono> از پنل حذف می‌شه. تنظیمات روی خود میکروتیک دست‌نخورده می‌مونه و کاربرهاش باید به نود دیگه‌ای منتقل بشن.</p>
      </Modal>
    </div>
  );
}

/* ───────────────────────── Users & quota ───────────────────────── */

function Raw({ u, onClose }) {
  const raw = {
    '/interface/wireguard/peers': { '.id': u.peerId, interface: 'wg-doping', 'public-key': u.pubkey, 'allowed-address': `${u.ip}/32`, comment: `doping:${u.id}`, disabled: String(!u.peer), 'last-handshake': u.online ? '14s' : 'never' },
    '/queue/simple': { '.id': u.queueId, name: `dp-${u.id}`, target: `${u.ip}/32`, 'max-limit': '20M/100M', bytes: `${Math.round(u.up)}/${Math.round(u.down)}`, comment: `doping:${u.id} quota=${u.quota ?? 'unlimited'}`, disabled: 'false' },
  };
  return (
    <Modal open onClose={onClose} wide icon={Code2} title={`MikroTik Raw Rule · ${u.username}`}>
      <pre dir="ltr" className="mono overflow-x-auto well p-4 text-left text-xs leading-6 text-zinc-300">{JSON.stringify(raw, null, 2)}</pre>
      <p className="mt-3 text-xs text-silver">خروجی خام REST از <Mono>THR-EDGE-01</Mono>. شمارنده <Mono>bytes</Mono> به‌صورت <Mono>upload/download</Mono> است.</p>
    </Modal>
  );
}

function UsersTable() {
  const { s, patch, toast, log } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [raw, setRaw] = useState(null);
  const rows = s.users
    .filter((u) => filter === 'all' || u.status === filter)
    .filter((u) => `${u.username} ${u.email} ${u.ip}`.toLowerCase().includes(q.trim().toLowerCase()));
  const act = {
    add: (u) => {
      if (u.quota == null) return toast('این کاربر پلن نامحدود داره.', 'warn');
      patch('users', u.id, (x) => ({ quota: x.quota + 5 * GB, ...(x.status === 'quota' ? { status: 'active', peer: true } : {}) }));
      log('mikrotik', 'info', `quota +5GB · ${u.username} · PATCH /rest/queue/simple/${u.queueId}`);
      toast(`۵ گیگ به ${u.username} اضافه شد.`);
    },
    reset: (u) => {
      patch('users', u.id, (x) => ({ up: 0, down: 0, ...(x.status === 'quota' ? { status: 'active', peer: true } : {}) }));
      log('mikrotik', 'warn', `POST /rest/queue/simple/reset-counters .id=${u.queueId} · ${u.username}`);
      toast(`شمارنده صف ${u.username} صفر شد.`, 'warn');
    },
    toggle: (u) => {
      const on = !u.peer;
      if (on && u.status === 'quota') return toast('حجم این کاربر تموم شده؛ اول حجم اضافه کن.', 'warn');
      if (on && u.status === 'expired') return toast('اشتراک منقضی شده؛ اول تمدید لازمه.', 'warn');
      patch('users', u.id, () => ({ peer: on, status: on ? 'active' : 'disabled', online: false }));
      log('mikrotik', on ? 'info' : 'warn', `PATCH /rest/interface/wireguard/peers/${u.peerId} disabled=${!on} · ${u.username}`);
      toast(on ? `Peer ${u.username} فعال شد.` : `Peer ${u.username} غیرفعال شد.`, on ? 'ok' : 'warn');
    },
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input id="usr-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام کاربری، ایمیل یا آی‌پی تانل…" className="field pr-9" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {[['all', 'همه'], ['active', 'Active'], ['quota', 'Quota Exceeded'], ['expired', 'Expired'], ['disabled', 'Disabled']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={cx('shrink-0 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap', filter === id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white')}>
              {label} <Mono className="opacity-60">{id === 'all' ? s.users.length : s.users.filter((u) => u.status === id).length}</Mono>
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
                const used = u.up + u.down;
                const pct = u.quota ? (used / u.quota) * 100 : 0;
                const [label, tone] = U_STATUS[u.status];
                return (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td data-head="1" className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cx('size-2 shrink-0 rounded-full', u.online ? 'bg-ok' : 'bg-zinc-600')} title={u.online ? 'آنلاین' : 'آفلاین'} />
                        <div className="min-w-0">
                          <Mono className="block font-bold">{u.username}</Mono>
                          <span className="text-[11px] text-zinc-500">{s.site.planNames[u.plan]}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="آی‌پی تانل" className="px-3 py-2.5"><Mono className="text-xs">{u.ip}/32</Mono></td>
                    <td data-label="مصرف" className="px-3 py-2.5">
                      {u.plan === 'dns' ? <span className="text-xs text-zinc-500">فقط DNS · بدون صف</span> : (
                        <div className="w-56">
                          <div className="mb-1 flex justify-between text-[11px]">
                            <Mono className="text-silver">↑{gb(u.up)} / ↓{gb(u.down)}</Mono>
                            <Mono className="font-bold">{gb(used, 1)} / {u.quota ? `${u.quota / GB} GB` : '∞'}</Mono>
                          </div>
                          <Progress value={u.quota ? pct : 3} h="h-1.5" />
                        </div>
                      )}
                    </td>
                    <td data-label="انقضا" className="px-3 py-2.5 text-xs whitespace-nowrap">{daysLeft(u.expires) ? `${fa(daysLeft(u.expires))} روز` : <span className="text-warn">تمام شده</span>}</td>
                    <td data-label="وضعیت" className="px-3 py-2.5"><Badge tone={tone}><Mono>{label}</Mono></Badge></td>
                    <td data-label="عملیات" className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Btn size="sm" variant="ok" icon={Plus} onClick={() => act.add(u)} title="Add Traffic"><Mono>5GB</Mono></Btn>
                        <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => act.reset(u)} aria-label="Reset Queue Counters" title="Reset Queue Counters" />
                        <Btn size="sm" variant="ghost" icon={Code2} onClick={() => setRaw(u)} aria-label="Inspect MikroTik Raw Rule" title="Inspect MikroTik Raw Rule" />
                        <Toggle checked={u.peer} onChange={() => act.toggle(u)} label={`Peer ${u.username}`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-silver">کاربری با این مشخصات پیدا نشد.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {raw && <Raw u={s.users.find((x) => x.id === raw.id)} onClose={() => setRaw(null)} />}
    </div>
  );
}

/* ───────────────────────── Game servers & RCON ───────────────────────── */

function Rcon({ id, onClose }) {
  const { s, patch, log } = useStore();
  const v = s.servers.find((x) => x.id === id);
  const [out, setOut] = useState([{ t: 'sys', text: `rcon connected → ${v.host}:${v.port}` }, { t: 'sys', text: 'type "help" for commands' }]);
  const [cmd, setCmd] = useState('');
  const [hist, setHist] = useState([]);
  const [hi, setHi] = useState(-1);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [out]);
  const maps = v.game === 'CS2' ? CS2_MAPS : [v.map];

  const exec = (raw) => {
    const line = raw.trim();
    if (!line) return;
    const [name, ...args] = line.split(/\s+/);
    const arg = args.join(' ').replace(/^"|"$/g, '');
    let res = [];
    let level = 'info';
    switch (name.toLowerCase()) {
      case 'help':
        res = ['status · mp_restartgame <1-9> · mp_warmup_end · changelevel <map> · kick <name> · say <text> · clear'];
        break;
      case 'status':
        res = [`hostname: ${v.name}`, `map     : ${v.map}`, `players : ${v.players} humans, 0 bots (${v.max} max)`, '# userid name                 ping  K/D',
          ...v.list.map((p, i) => `# ${String(i + 2).padStart(6)} ${`"${p.name}"`.padEnd(20)} ${String(p.ping).padStart(4)}  ${p.k}/${p.d}`)];
        break;
      case 'mp_restartgame':
        if (!/^[1-9]$/.test(arg)) { res = ['usage: mp_restartgame <1-9>']; break; }
        patch('servers', id, (x) => ({ list: x.list.map((p) => ({ ...p, k: 0, d: 0 })) }));
        res = [`Game will restart in ${arg} second${arg === '1' ? '' : 's'}`];
        break;
      case 'mp_warmup_end':
        res = ['Warmup ended. Match is LIVE.'];
        break;
      case 'changelevel':
        if (!/^[a-z0-9_]{3,32}$/.test(arg)) { res = ['usage: changelevel <map>']; break; }
        if (v.game === 'CS2' && !CS2_MAPS.includes(arg) && !arg.startsWith('aim_')) { res = [`changelevel failed: map "${arg}" not found on server`]; level = 'warn'; break; }
        patch('servers', id, () => ({ map: arg }));
        res = [`Changing level to ${arg}…`, 'Host_NewGame on ' + arg];
        break;
      case 'kick': {
        const p = v.list.find((x) => x.name.toLowerCase() === arg.toLowerCase());
        if (!p) { res = [`kick: no player named "${arg}"`]; level = 'warn'; break; }
        patch('servers', id, (x) => ({ list: x.list.filter((y) => y !== p && y.name !== p.name), players: Math.max(0, x.players - 1) }));
        res = [`Kicked ${p.name} (Kicked by Console)`];
        level = 'warn';
        break;
      }
      case 'say':
        res = arg ? [`Console: ${arg}`] : ['usage: say <text>'];
        break;
      case 'clear':
        setOut([]);
        setCmd('');
        return;
      default:
        res = [`Unknown command "${name}" (فقط دستورهای allow-list از پنل قابل اجراست)`];
        level = 'warn';
    }
    setOut((o) => [...o, { t: 'in', text: line }, ...res.map((text) => ({ t: 'out', text }))]);
    setHist((h) => [line, ...h].slice(0, 30));
    setHi(-1);
    setCmd('');
    log('rcon', level, `${line} · ${v.name}`);
  };

  return (
    <Drawer open onClose={onClose} title={`RCON · ${v.name}`}>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Map', v.map], ['Players', `${v.players}/${v.max}`], ['Ping', `${v.ping}ms`]].map(([k, val]) => (
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
          <div key={i} className={cx('whitespace-pre-wrap', l.t === 'in' && 'text-brand2', l.t === 'sys' && 'text-zinc-500', l.t === 'out' && 'text-zinc-200')}>{l.t === 'in' ? `] ${l.text}` : l.text}</div>
        ))}
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
        <Btn type="submit" icon={Send}>Run</Btn>
      </form>

      <h4 className="mt-6 mb-2 flex items-center gap-2 text-sm font-black"><Users className="size-4 text-brand2" /> بازیکن‌های آنلاین <Mono className="text-silver">({v.list.length})</Mono></h4>
      <ul className="space-y-1.5">
        {v.list.map((p) => (
          <li key={p.name} className="flex items-center gap-3 well px-3 py-1.5">
            <Mono className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</Mono>
            <Mono className="text-xs text-silver">{p.k}/{p.d}</Mono>
            <Mono className={cx('w-12 text-end text-xs', p.ping < 30 ? 'text-ok' : 'text-warn')}>{p.ping}ms</Mono>
            <Btn size="sm" variant="danger" icon={UserX} onClick={() => exec(`kick "${p.name}"`)}>Kick</Btn>
          </li>
        ))}
        {!v.list.length && <li className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-silver">سرور خالیه.</li>}
      </ul>
    </Drawer>
  );
}

const emptyServer = { name: '', game: 'CS2', mode: 'retake', map: 'de_mirage', max: 10, host: '', port: 27015, vip: false };

function ServerForm({ initial, onClose }) {
  const { set, toast, log } = useStore();
  const editing = !!initial.id;
  const [f, setF] = useState({ ...emptyServer, ...initial });
  const [touched, setTouched] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const errs = {
    name: f.name.trim().length >= 4 ? '' : 'حداقل ۴ کاراکتر.',
    host: /^([a-z0-9-]+\.)+[a-z]{2,}$|^(\d{1,3}\.){3}\d{1,3}$/i.test(f.host) ? '' : 'هاست یا آی‌پی معتبر وارد کن.',
    port: +f.port >= 1024 && +f.port <= 65535 ? '' : 'پورت بین 1024 تا 65535.',
    max: +f.max >= 2 && +f.max <= 200 ? '' : 'بین ۲ تا ۲۰۰.',
    map: /^[A-Za-z0-9_ ]{3,32}$/.test(f.map) ? '' : 'نام مپ نامعتبره.',
  };
  const e = (k) => (touched ? errs[k] : '');
  const save = () => {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const game = f.mode === 'rust' ? 'Rust' : f.mode === 'mc' ? 'Minecraft' : 'CS2';
    const row = { ...f, game, port: +f.port, max: +f.max, name: f.name.trim() };
    if (editing) set((p) => ({ servers: p.servers.map((x) => (x.id === row.id ? { ...x, ...row, players: Math.min(x.players, row.max), list: x.list.slice(0, row.max) } : x)) }));
    else set((p) => ({ servers: [...p.servers, { ...row, id: `s${uid()}`, players: 0, list: [], ping: 12, tick: game === 'CS2' ? 'Sub-tick 64' : game === 'Rust' ? '30 FPS Server' : '20 TPS', ac: game === 'CS2' ? 'Doping AC + VAC' : game === 'Rust' ? 'EAC' : 'Grim AC', status: 'online' }] }));
    log('admin', 'info', `gameserver.${editing ? 'update' : 'create'} ${row.name}`);
    toast(editing ? 'سرور به‌روزرسانی شد.' : 'سرور اضافه شد و توی صفحه اصلی دیده می‌شه.');
    onClose();
  };
  return (
    <Modal open onClose={onClose} wide title={editing ? 'ویرایش سرور بازی' : 'افزودن سرور بازی'} footer={<><Btn variant="ghost" onClick={onClose}>انصراف</Btn><Btn onClick={save}>{editing ? 'ذخیره' : 'افزودن سرور'}</Btn></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="نام سرور" error={e('name')} className="sm:col-span-2"><input id="gs-name" dir="ltr" value={f.name} onChange={up('name')} placeholder="Doping Retake #3" className="field mono" /></Field>
        <Field label="نوع">
          <select id="gs-mode" value={f.mode} onChange={up('mode')} className="field">{MODES.filter((m) => m.id !== 'all').map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </Field>
        <Field label="مپ پیش‌فرض" error={e('map')}><input id="gs-map" dir="ltr" value={f.map} onChange={up('map')} className="field mono" /></Field>
        <Field label="هاست / آی‌پی" error={e('host')}><input id="gs-host" dir="ltr" value={f.host} onChange={up('host')} placeholder="retake3.doping.games" className="field mono" /></Field>
        <Field label="پورت" error={e('port')}><input id="gs-port" dir="ltr" inputMode="numeric" value={f.port} onChange={up('port')} className="field mono" /></Field>
        <Field label="ظرفیت" error={e('max')}><input id="gs-max" dir="ltr" inputMode="numeric" value={f.max} onChange={up('max')} className="field mono" /></Field>
        <div className="flex items-center justify-between well px-4"><span className="text-sm font-bold">فقط VIP</span><Toggle checked={f.vip} onChange={(v) => setF({ ...f, vip: v })} label="فقط VIP" /></div>
      </div>
    </Modal>
  );
}

function GameServers() {
  const { s, set, patch, toast, log } = useStore();
  const [form, setForm] = useState(null);
  const [rcon, setRcon] = useState(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-silver">تغییرها همون لحظه توی «سرورهای بازی» صفحه اصلی دیده می‌شن.</p>
        <Btn icon={Plus} onClick={() => setForm({})}>افزودن سرور</Btn>
      </div>
      <Card className="overflow-hidden">
        <div className="max-md:p-2 overflow-x-auto">
          <table className="rtable w-full md:min-w-[860px] text-sm">
            <thead className="text-[11px] text-zinc-500">
              <tr>{['سرور', 'آدرس', 'مپ', 'بازیکن', 'پینگ', 'وضعیت', 'عملیات'].map((h) => <th key={h} className="px-3 py-3 text-start font-bold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {s.servers.map((v) => (
                <tr key={v.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td data-head="1" className="px-3 py-2.5"><div className="flex items-center gap-3"><ModeEmblem mode={v.mode} vip={v.vip} className="size-9 shrink-0" /><div className="min-w-0"><Mono className="block font-bold">{v.name}</Mono><Mono className="text-[11px] text-zinc-500">{v.game} · {v.tick}</Mono></div></div></td>
                  <td data-label="آدرس" className="px-3 py-2.5"><Mono className="text-xs">{v.host}:{v.port}</Mono></td>
                  <td data-label="مپ" className="px-3 py-2.5"><Mono className="text-xs font-bold">{v.map}</Mono></td>
                  <td data-label="بازیکن" className="px-3 py-2.5"><div className="w-28"><Mono className="text-xs">{v.players}/{v.max}</Mono><Progress value={(v.players / v.max) * 100} h="h-1.5" className="mt-1" /></div></td>
                  <td data-label="پینگ" className="px-3 py-2.5"><Mono className="text-xs text-ok">{v.status === 'online' ? `${v.ping}ms` : '—'}</Mono></td>
                  <td data-label="وضعیت" className="px-3 py-2.5"><Badge tone={v.status === 'online' ? 'ok' : 'bad'}>{v.status === 'online' ? 'Online' : 'Stopped'}</Badge></td>
                  <td data-label="عملیات" className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Btn size="sm" icon={Terminal} disabled={v.status !== 'online'} onClick={() => setRcon(v.id)}>RCON</Btn>
                      <Btn size="sm" variant="ghost" icon={Pencil} aria-label="ویرایش" onClick={() => setForm(v)} />
                      <Btn
                        size="sm" variant="ghost" icon={v.status === 'online' ? Ban : Play} aria-label={v.status === 'online' ? 'توقف' : 'استارت'} title={v.status === 'online' ? 'توقف سرور' : 'استارت سرور'}
                        onClick={() => { const on = v.status === 'online'; patch('servers', v.id, () => (on ? { status: 'offline', players: 0, list: [] } : { status: 'online', players: 2, list: roster(2) })); log('admin', 'warn', `gameserver.${on ? 'stop' : 'start'} ${v.name}`); }}
                      />
                      <Btn size="sm" variant="danger" icon={Trash2} aria-label="حذف" onClick={() => { set((p) => ({ servers: p.servers.filter((x) => x.id !== v.id) })); log('admin', 'warn', `gameserver.delete ${v.name}`); toast('سرور حذف شد.', 'warn'); }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {form && <ServerForm initial={form} onClose={() => setForm(null)} />}
      {rcon && s.servers.some((x) => x.id === rcon) && <Rcon id={rcon} onClose={() => setRcon(null)} />}
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
  const { s, set, toast, log } = useStore();
  const P = s.site.pricing;
  const [code, setCode] = useState({ code: '', percent: 10, max: 100 });
  const [err, setErr] = useState('');
  const paid = s.invoices.filter((i) => i.status === 'paid');
  const addCode = () => {
    const c = code.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(c)) return setErr('کد باید ۴ تا ۱۶ حرف لاتین یا عدد باشه.');
    if (code.percent < 1 || code.percent > 90) return setErr('درصد بین ۱ تا ۹۰.');
    if (s.discounts.some((d) => d.code === c)) return setErr('این کد قبلاً ساخته شده.');
    setErr('');
    set((p) => ({ discounts: [{ id: uid(), code: c, percent: code.percent, used: 0, max: code.max || 100, active: true }, ...p.discounts] }));
    log('admin', 'info', `discount.create ${c} ${code.percent}%`);
    setCode({ code: '', percent: 10, max: 100 });
    toast('کد تخفیف ساخته شد.');
  };
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
          {s.discounts.map((d) => (
            <li key={d.id} className="flex items-center gap-3 well px-3 py-2">
              <div className="min-w-0 flex-1">
                <Mono className="block font-bold">{d.code}</Mono>
                <Mono className="text-[11px] text-silver">{d.percent}% · {d.used}/{d.max} used</Mono>
              </div>
              {d.used >= d.max && <Badge tone="warn">ظرفیت پر</Badge>}
              <Toggle checked={d.active} label={`فعال بودن ${d.code}`} onChange={(v) => set((p) => ({ discounts: p.discounts.map((x) => (x.id === d.id ? { ...x, active: v } : x)) }))} />
              <Btn size="sm" variant="danger" icon={Trash2} aria-label={`حذف ${d.code}`} onClick={() => set((p) => ({ discounts: p.discounts.filter((x) => x.id !== d.id) }))} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><CreditCard className="size-4 text-brand2" /> درگاه‌های پرداخت</h3>
        <ul className="mt-4 space-y-2">
          {s.gateways.map((g) => (
            <li key={g.id} className="flex items-center gap-3 well px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{g.name}</div>
                <div className="text-[11px] text-silver">{g.kind} · <Mono>{g.key}</Mono></div>
              </div>
              <Badge tone={g.enabled ? 'ok' : 'mute'}>{g.enabled ? 'فعال' : 'خاموش'}</Badge>
              <Toggle
                checked={g.enabled} label={`فعال بودن ${g.name}`}
                onChange={(v) => {
                  if (!v && s.gateways.filter((x) => x.enabled).length === 1) return toast('حداقل یک درگاه باید فعال بمونه.', 'warn');
                  set((p) => ({ gateways: p.gateways.map((x) => (x.id === g.id ? { ...x, enabled: v } : x)) }));
                  log('admin', 'warn', `gateway.${v ? 'enable' : 'disable'} ${g.id}`);
                }}
              />
            </li>
          ))}
        </ul>
        <div className="mt-4 well p-4">
          <div className="text-xs text-silver">فروش ثبت‌شده در این نشست (حساب نمونه)</div>
          <div className="mt-1 text-2xl font-black">{toman(paid.reduce((a, i) => a + i.amount, 0))}</div>
          <div className="text-[11px] text-zinc-500">{fa(paid.length)} تراکنش موفق · {fa(s.invoices.length - paid.length)} ناموفق</div>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── Security audit log ───────────────────────── */

const L_TYPES = [['all', 'همه'], ['auth', 'Auth'], ['mikrotik', 'MikroTik API'], ['payment', 'Payment'], ['dns', 'DNS / IP'], ['rcon', 'RCON'], ['admin', 'Admin']];
const L_TONE = { info: 'mute', warn: 'warn', critical: 'bad' };

function Logs() {
  const { s } = useStore();
  const [type, setType] = useState('all');
  const [level, setLevel] = useState('all');
  const [q, setQ] = useState('');
  const [frozen, setFrozen] = useState(null);
  const src = frozen ?? s.logs;
  const rows = src
    .filter((l) => type === 'all' || l.type === type)
    .filter((l) => level === 'all' || l.level === level)
    .filter((l) => `${l.msg} ${l.actor} ${l.ip}`.toLowerCase().includes(q.trim().toLowerCase()));
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
        <Btn variant={frozen ? 'primary' : 'ghost'} icon={frozen ? Play : Pause} onClick={() => setFrozen(frozen ? null : s.logs)}>{frozen ? 'ادامه پخش زنده' : 'توقف'}</Btn>
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
              {!rows.length && <tr><td className="px-3 py-10 text-center text-sm text-silver">رویدادی با این فیلتر ثبت نشده.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── Shell ───────────────────────── */

export default function Admin() {
  const { s } = useStore();
  const [tab, setTab] = useState('routers');
  const [sub, setSub] = useState(null);
  const open = (t, inner = null) => { setTab(t); setSub(inner); window.scrollTo({ top: 0 }); };
  const online = s.users.filter((u) => u.online).length;
  const peers = s.routers.filter((r) => r.role === 'entry').reduce((a, r) => a + r.peers, 0);
  const alerts = s.logs.filter((l) => l.level === 'critical').length + s.routers.filter((r) => r.status !== 'online').length;
  const TABS = [
    { id: 'routers', label: 'روترها و نودها', icon: Router, count: s.routers.length, C: Routers },
    { id: 'users', label: 'کاربران و حجم', icon: Users, count: s.users.length, C: UsersTable },
    { id: 'servers', label: 'سرورهای بازی و RCON', icon: Crosshair, count: s.servers.length, C: GameServers },
    { id: 'sales', label: 'فروش و درگاه', icon: Banknote, C: Sales },
    { id: 'logs', label: 'لاگ امنیتی و API', icon: ScrollText, C: Logs },
    { id: 'settings', label: 'تنظیمات سایت', icon: SlidersHorizontal, C: Settings },
  ];
  const Current = TABS.find((t) => t.id === tab).C;
  return (
    <div className="gutter mx-auto max-w-6xl pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">مرکز کنترل</h1>
          <p className="mt-1 text-sm text-zinc-500">نقش <Mono className="font-bold text-white">SUPER_ADMIN</Mono> · نشست از <Mono>10.0.0.2</Mono></p>
        </div>
        <Badge tone={alerts ? 'bad' : 'ok'} icon={ShieldAlert}>{alerts ? `${fa(alerts)} هشدار باز` : 'بدون هشدار'}</Badge>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        <Stat label="کاربر آنلاین (حساب‌های نمونه)" value={<Mono>{online}/{s.users.length}</Mono>} />
        <Stat label="WireGuard Peers فعال" value={<Mono>{peers}</Mono>} sub="روی نودهای ورودی" />
        <Stat label="بیشترین بار CPU" value={<Mono>{Math.max(...s.routers.map((r) => r.cpu))}%</Mono>} tone={Math.max(...s.routers.map((r) => r.cpu)) > 80 ? 'text-brand2' : 'text-white'} />
        <Stat label="بازیکن روی سرورها" value={<Mono>{s.servers.reduce((a, v) => a + v.players, 0)}</Mono>} />
      </div>
      <RailLayout tabs={TABS} value={tab} onChange={(t) => open(t)}><Current key={`${tab}-${sub}`} open={open} sub={sub} /></RailLayout>
    </div>
  );
}
