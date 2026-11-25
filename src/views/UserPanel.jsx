'use client';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import {
  Bell, Gift, Lock, LogOut, Mail, MessageCircle, MonitorSmartphone, Navigation, Phone, Repeat, UserCog,
  ArrowDown, ArrowUp, CalendarClock, Check, Gamepad2, Monitor, Router as RouterIcon, Smartphone, CircleAlert, Crown, Download, Eye, EyeOff, Fingerprint, Globe, KeyRound, LayoutDashboard, LifeBuoy,
  Link2, Plus, QrCode, Receipt, RefreshCw, Send, ShieldCheck, Trash2, Unlink, Wallet, Wifi, Zap,
} from 'lucide-react';
import { useStore } from '../store.jsx';
import { Attachments, FilePicker } from './parts.jsx';
import { Ring } from '../art.jsx';
import { CountUp } from '../motion.jsx';
import { Badge, Btn, Card, CopyBtn, cx, Dot, Field, Modal, Mono, Progress, RailLayout, Toggle } from '../ui.jsx';
import { daysLeft, EXITS, fa, faDate, GB, gb, isIPv4, isPrivate, pingTiers, priceOf, tierLabel, toman } from '../data.js';

const Panel = createContext(null);
const usePanel = () => useContext(Panel);

const STATUS = {
  active: ['فعال', 'ok'], quota: ['اتمام حجم', 'bad'], expired: ['منقضی', 'warn'], disabled: ['غیرفعال', 'mute'],
};

/* ───────────────────────── Dashboard ───────────────────────── */

/** Pays an order from the wallet or the bank gateway (bank redirects away and back to /pay/result). */
function PayModal({ open, onClose, title, price, order, children, cta }) {
  const { d, reload } = usePanel();
  const { api, toast } = useStore();
  const gws = d.gateways;
  const [gw, setGw] = useState(null);
  const [busy, setBusy] = useState(false);
  const pick = gw ?? (gws.some((g) => g.id === 'wallet') && d.user.wallet >= price ? 'wallet' : gws.find((g) => g.id !== 'wallet')?.id ?? 'wallet');
  const short = pick === 'wallet' && d.user.wallet < price;
  const pay = async () => {
    setBusy(true);
    try {
      const r = await api('/api/orders', { method: 'POST', body: { order, gateway: pick } });
      if (r.status === 'redirect') { window.location.href = r.redirect; return; }
      await reload();
      toast(`${cta} انجام شد.`);
      onClose();
    } catch (e) {
      toast(e.message, 'bad');
    }
    setBusy(false);
  };
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      footer={<><Btn variant="ghost" onClick={onClose} disabled={busy}>انصراف</Btn><Btn disabled={short} busy={busy} onClick={pay}>{cta} · {toman(price)}</Btn></>}
    >
      {children}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {gws.map((g) => (
          <button key={g.id} type="button" onClick={() => setGw(g.id)} aria-pressed={pick === g.id} className={cx('relative flex items-center gap-3 rounded-2xl p-3 text-start transition', pick === g.id ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
            {g.id === 'wallet' ? <Wallet className="size-4 text-brand2" /> : <ShieldCheck className="size-4 text-silver" />}
            <span className="min-w-0">
              <span className="block text-sm font-bold">{g.name}</span>
              <span className="block text-[11px] text-silver">{g.id === 'wallet' ? `موجودی ${toman(d.user.wallet)}` : g.kind}</span>
            </span>
          </button>
        ))}
      </div>
      {short && <p className="mt-2 text-xs text-warn">موجودی کافی نیست. درگاه بانکی رو انتخاب کن یا از تب «مالی» کیف پولت رو شارژ کن.</p>}
    </Modal>
  );
}

function NoPlan() {
  return (
    <Card className="p-8 text-center">
      <Zap className="mx-auto size-8 text-brand2" />
      <h3 className="mt-3 text-lg font-black">هنوز اشتراکی نداری</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-silver">یکی از پلن‌های کاهش پینگ، DNS ضد تحریم یا پکیج پرو رو بخر؛ کانفیگ اتصال و QR بلافاصله همین‌جا ساخته می‌شه.</p>
      <Link href="/#pricing" className="mt-5 inline-flex h-10 items-center rounded-xl bg-brand px-5 text-[13px] font-bold text-white hover:bg-brand2">دیدن تعرفه‌ها</Link>
    </Card>
  );
}

const ago = (t) => {
  if (!t) return '—';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  return sec < 90 ? `${sec}s ago` : sec < 5400 ? `${Math.round(sec / 60)}m ago` : `${Math.round(sec / 3600)}h ago`;
};

/** Renews the same plan from the wallet during the last day of the period. */
function AutoRenew() {
  const { api, toast } = useStore();
  const { d, reload } = usePanel();
  const on = !!d.sub?.autoRenew;
  return (
    <label className="ms-auto flex items-center gap-2.5 text-xs text-silver" title="روز آخر اشتراک، همین پلن از موجودی کیف پول تمدید می‌شه.">
      <Repeat className="size-4" /> تمدید خودکار از کیف پول
      <Toggle
        label="تمدید خودکار" checked={on}
        onChange={async (v) => {
          try {
            await api('/api/me/autorenew', { method: 'PUT', body: { on: v } });
            await reload();
            toast(v ? 'تمدید خودکار روشن شد؛ روز آخر، اگه موجودی کافی باشه خودش تمدید می‌شه.' : 'تمدید خودکار خاموش شد.', v ? 'ok' : 'warn');
          } catch (e) { toast(e.message, 'bad'); }
        }}
      />
    </label>
  );
}

function Dashboard({ setTab }) {
  const { s } = useStore();
  const { d } = usePanel();
  const me = d.sub;
  const [extra, setExtra] = useState(false);
  const [renew, setRenew] = useState(false);
  const [pack, setPack] = useState(10);
  if (!me) return <NoPlan />;
  const used = me.up + me.down;
  const unlimited = me.quota == null;
  const pct = unlimited ? 0 : (used / me.quota) * 100;
  const days = daysLeft(me.expires);
  const [st, tone] = STATUS[me.status] ?? STATUS.disabled;
  const tier = me.tierGb ?? 'inf';
  const P = s.site.pricing;
  const PLAN_NAME = s.site.planNames;
  const renewPrice = priceOf(P, { kind: me.kind, tier: pingTiers(P).includes(tier) ? tier : pingTiers(P)[0], slots: me.dnsSlots, months: 1 }).total;
  const extraPrice = pack * P.extraPerGb;
  const dnsOnly = me.kind === 'dns';

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
      <Card className="min-w-0 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Zap className="size-4 text-brand2" /> وضعیت حجم و اشتراک</h3>
          <div className="flex items-center gap-2">
            <Badge tone="brand" icon={Crown}>{PLAN_NAME[me.kind]}</Badge>
            <Badge tone={tone}>{st}</Badge>
          </div>
        </div>
        {dnsOnly ? (
          <p className="mt-6 text-sm leading-7 text-zinc-300">اشتراک DNS ضد تحریم با <Mono className="font-bold text-white">{fa(me.dnsSlots)}</Mono> آی‌پی مجاز. از تب «DNS هوشمند» آی‌پی اینترنتت رو ثبت کن.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 items-center gap-8 sm:grid-cols-[200px_minmax(0,1fr)]">
            <Ring pct={unlimited ? 0 : pct} className="mx-auto w-full max-w-[200px]">
              <div>
                <Mono className="block text-4xl leading-none font-bold">{unlimited ? '∞' : <CountUp value={Math.max(0, me.quota - used) / GB} decimals={2} duration={600} format={(n) => n.toFixed(2)} />}</Mono>
                <Mono className="mt-1.5 block text-xs text-zinc-500">{unlimited ? 'Unlimited' : `GB / ${gb(me.quota, 0)} GB`}</Mono>
                <div className="mt-1 text-[11px] text-zinc-500">حجم باقی‌مانده</div>
              </div>
            </Ring>
            <div className="min-w-0">
              <p className="text-sm leading-7 text-zinc-300">
                {unlimited ? (
                  <>اشتراک زمانی بدون سقف حجم · <Mono className="font-bold text-white">{gb(used)} GB</Mono> مصرف شده</>
                ) : (
                  <><Mono className="font-bold text-white">{gb(Math.max(0, me.quota - used))} GB</Mono> باقی‌مانده از <Mono className="font-bold text-white">{gb(me.quota, 0)} GB</Mono> — <Mono className="font-bold text-white">{gb(used)} GB</Mono> مصرف شده</>
                )}
              </p>
              <dl className="mt-5 grid grid-cols-2 divide-x divide-x-reverse divide-line rounded-xl border border-line">
                <div className="px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-xs text-zinc-500"><ArrowDown className="size-3.5" /> دانلود</dt>
                  <dd><Mono className="text-xl font-bold">{gb(me.down)}</Mono> <Mono className="text-xs text-zinc-500">GB</Mono></dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-xs text-zinc-500"><ArrowUp className="size-3.5" /> آپلود</dt>
                  <dd><Mono className="text-xl font-bold">{gb(me.up)}</Mono> <Mono className="text-xs text-zinc-500">GB</Mono></dd>
                </div>
              </dl>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-600">
                <RefreshCw className="size-3 shrink-0" /> <span>همگام با Simple Queue میکروتیک · آخرین به‌روزرسانی <Mono>{me.syncedAt ? ago(me.syncedAt) : '—'}</Mono></span>
              </p>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          {!dnsOnly && <Btn icon={Plus} onClick={() => setExtra(true)} disabled={unlimited || me.status === 'expired'}>خرید حجم اضافه (ترافیک مازاد)</Btn>}
          <Btn variant="outline" icon={RefreshCw} onClick={() => setRenew(true)}>تمدید یک‌کلیکی</Btn>
          <AutoRenew />
        </div>
      </Card>

      <div className="grid min-w-0 grid-cols-1 content-start items-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-xs text-silver"><CalendarClock className="size-4" /> روزهای باقی‌مانده</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cx('text-4xl leading-none font-black', days <= 3 ? 'text-brand2' : days <= 7 ? 'text-warn' : 'text-white')}>{fa(days)}</span>
            <span className="text-silver">روز</span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">پایان اشتراک: {faDate(me.expires)}</div>
          <Progress value={(days / 30) * 100} tone="bg-white" className="mt-4" h="h-1.5" />
        </Card>
        {!dnsOnly && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-silver"><Wifi className="size-4" /> اتصال فعلی</div>
              {me.online ? <Badge tone="ok"><Dot /> متصل</Badge> : <Badge tone="mute">بدون اتصال</Badge>}
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ['نود ورودی', me.router ?? 'در انتظار تخصیص'],
                ['آی‌پی تانل', me.ip ? `${me.ip}/32` : '—'],
                ['آخرین Handshake', ago(me.lastHandshake)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-silver">{k}</dt>
                  <dd><Mono className="text-xs font-bold">{v}</Mono></dd>
                </div>
              ))}
            </dl>
            <Btn variant="ghost" size="sm" className="mt-2 w-full" icon={KeyRound} onClick={() => setTab('connect')}>کانفیگ و QR اتصال</Btn>
          </Card>
        )}
      </div>

      {!dnsOnly && <UsageChart />}

      <PayModal open={extra} onClose={() => setExtra(false)} title="خرید حجم اضافه" price={extraPrice} cta="خرید حجم" order={{ type: 'extra', gb: pack }}>
        <p className="text-sm text-silver">حجم اضافه تا پایان همین دوره اعتبار داره و بلافاصله روی صف میکروتیک اعمال می‌شه.</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[5, 10, 20, 50].map((g) => (
            <button key={g} type="button" onClick={() => setPack(g)} aria-pressed={pack === g} className={cx('relative rounded-2xl py-3 text-center transition', pack === g ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
              <Mono className="block text-lg font-black">+{g}</Mono>
              <Mono className="text-[11px] text-silver">GB</Mono>
            </button>
          ))}
        </div>
      </PayModal>

      <PayModal open={renew} onClose={() => setRenew(false)} title="تمدید یک‌کلیکی" price={renewPrice} cta="تمدید" order={{ type: 'renew' }}>
        <p className="text-sm text-silver">
          همین پلن ({PLAN_NAME[me.kind]}{dnsOnly ? ` · ${fa(me.dnsSlots)} آی‌پی` : ` · ${tierLabel(tier)}`}) برای ۳۰ روز دیگه تمدید می‌شه. شمارنده حجم صفر می‌شه و روزهای باقی‌مانده فعلی هم حفظ می‌شن.
        </p>
      </PayModal>
    </div>
  );
}


/* ───────────────────────── Usage chart ───────────────────────── */

const DAY_MS = 86_400_000;
/** Daily traffic for the last 14 days (Tehran calendar days), in GB, with empty days filled in. */
function usageDays(rows) {
  const by = new Map(rows.map((r) => [r.day, r]));
  const key = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
  return Array.from({ length: 14 }, (_, i) => {
    const at = Date.now() - (13 - i) * DAY_MS;
    const r = by.get(key(at));
    return { at, down: (r?.down ?? 0) / GB, up: (r?.up ?? 0) / GB };
  });
}

/** Phones get the last 7 days so each bar is wide enough to tap. */
function useNarrow(px = 640) {
  const q = `(max-width: ${px - 1}px)`;
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    setNarrow(m.matches);
    const h = () => setNarrow(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, [q]);
  return narrow;
}

function UsageChart() {
  const { d: panel } = usePanel();
  const narrow = useNarrow();
  const all = useMemo(() => usageDays(panel.usage), [panel.usage]);
  const days = narrow ? all.slice(-7) : all;
  const [sel, setSel] = useState(days.length - 1);
  useEffect(() => { setSel(days.length - 1); }, [days.length]);
  const [show, setShow] = useState('both');
  const val = (d) => (show === 'down' ? d.down : show === 'up' ? d.up : d.down + d.up);
  const max = Math.max(0.001, ...days.map(val)) * 1.1;
  const d = days[sel];
  const total = days.reduce((a, x) => a + val(x), 0);
  return (
    <Card className="p-6 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-black">مصرف {fa(days.length)} روز اخیر</h3>
          <p className="text-xs text-zinc-500">جمع: <Mono className="text-zinc-300">{total.toFixed(2)} GB</Mono> · میانگین روزانه <Mono className="text-zinc-300">{(total / days.length).toFixed(2)} GB</Mono></p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line p-0.5 text-xs" role="tablist" aria-label="نوع ترافیک">
          {[['both', 'همه'], ['down', 'دانلود'], ['up', 'آپلود']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={show === id} onClick={() => setShow(id)} className={cx('rounded-md px-3 py-1.5 transition-colors', show === id ? 'bg-white/10 font-bold text-white' : 'text-zinc-400 hover:text-white')}>{label}</button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex h-36 items-end gap-1 sm:gap-1.5" dir="ltr" role="listbox" aria-label="روزها">
        {days.map((x, i) => {
          const on = i === sel;
          return (
            <button
              key={x.at} type="button" role="option" aria-selected={on} aria-label={`${faDate(x.at)}: ${val(x).toFixed(2)} GB`}
              onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <span className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${(val(x) / max) * 100}%` }}>
                {show !== 'down' && <span className={cx('w-full transition-colors', on ? 'bg-zinc-300' : 'bg-zinc-600 group-hover:bg-zinc-500')} style={{ flex: x.up }} />}
                {show !== 'up' && <span className={cx('w-full transition-colors', on ? 'bg-white' : 'bg-zinc-400 group-hover:bg-zinc-300')} style={{ flex: x.down }} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-zinc-600" dir="ltr">
        <span>{new Date(days[0].at).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}</span>
        <span>امروز</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-ink px-4 py-3 text-sm" aria-live="polite">
        <span className="font-bold">{sel === days.length - 1 ? 'امروز' : faDate(d.at)}</span>
        <span className="flex items-center gap-1.5 text-zinc-400"><span className="size-2 rounded-sm bg-white" /> دانلود <Mono className="text-white">{d.down.toFixed(2)} GB</Mono></span>
        <span className="flex items-center gap-1.5 text-zinc-400"><span className="size-2 rounded-sm bg-zinc-500" /> آپلود <Mono className="text-white">{d.up.toFixed(2)} GB</Mono></span>
      </div>
    </Card>
  );
}

/* ───────────────────────── Setup guide ───────────────────────── */

const DEVICES = [
  { id: 'windows', label: 'ویندوز', icon: Monitor },
  { id: 'android', label: 'اندروید', icon: Smartphone },
  { id: 'ios', label: 'آیفون', icon: Smartphone },
  { id: 'console', label: 'PS5 / Xbox', icon: Gamepad2 },
  { id: 'router', label: 'روتر میکروتیک', icon: RouterIcon },
];

function SetupGuide({ conf, onDownload, onQr }) {
  const { s, set } = useStore();
  const [dev, setDev] = useState('windows');
  const { dns: DNS, wg: WG } = s.site;
  const [host, port] = conf.endpoint.split(':');
  const ros = [
    `/interface wireguard add name=doping private-key="${conf.priv}" mtu=${WG.mtu}`,
    `/interface wireguard peers add interface=doping public-key="${conf.serverKey}" preshared-key="${conf.psk}" endpoint-address=${host} endpoint-port=${port} allowed-address=0.0.0.0/0 persistent-keepalive=25s`,
    `/ip address add address=${conf.address} interface=doping`,
    '/routing table add name=doping fib',
    '/ip route add dst-address=0.0.0.0/0 gateway=doping routing-table=doping',
    '/ip firewall nat add chain=srcnat out-interface=doping action=masquerade',
    '/routing rule add src-address=192.168.88.50 action=lookup table=doping',
  ].join('\n');
  const STEPS = {
    windows: [
      ['برنامه WireGuard رو از سایت رسمیش نصب کن.', <Mono key="u" className="text-zinc-300">wireguard.com/install</Mono>],
      ['فایل کانفیگ رو دانلود کن.', <Btn key="b" size="sm" variant="ghost" onClick={onDownload}>دانلود <Mono>.conf</Mono></Btn>],
      ['توی WireGuard روی Import tunnel(s) from file بزن و همین فایل رو انتخاب کن.'],
      ['Activate رو بزن. وضعیت باید Active بشه؛ بعد بازی رو باز کن.'],
    ],
    android: [
      ['WireGuard رو از Google Play نصب کن.'],
      ['توی برنامه روی + بزن و Scan from QR code رو انتخاب کن.', <Btn key="q" size="sm" variant="ghost" onClick={onQr}>نمایش QR</Btn>],
      ['یک اسم بده (مثلاً Doping) و تانل رو روشن کن.'],
    ],
    ios: [
      ['WireGuard رو از App Store نصب کن.'],
      ['روی Add a tunnel و بعد Create from QR code بزن.', <Btn key="q" size="sm" variant="ghost" onClick={onQr}>نمایش QR</Btn>],
      ['اجازه افزودن VPN رو بده و تانل رو روشن کن.'],
    ],
    console: [
      ['کنسول‌ها برنامه WireGuard ندارن. برای رفع تحریم، DNS دستی بذار:', <Mono key="d" className="text-zinc-300">{DNS.primary} · {DNS.secondary}</Mono>],
      ['آی‌پی اینترنت خونه رو از تب «DNS هوشمند» ثبت کن.'],
      ['برای کاهش پینگ، کانفیگ رو روی روتر بذار (تب «روتر میکروتیک») تا ترافیک کنسول از تانل رد بشه.'],
    ],
    router: [
      ['RouterOS نسخه ۷ لازمه. با Winbox یا SSH وارد ترمینال روتر شو.'],
      ['این دستورها رو بزن. توی دستور آخر، آی‌پی کنسول یا کامپیوترت رو به‌جای 192.168.88.50 بذار.', <div key="c" className="mt-2 w-full"><pre dir="ltr" className="mono max-h-44 overflow-auto rounded-lg bg-ink p-3 text-left text-[11px] leading-5 text-zinc-300">{ros}</pre><CopyBtn text={ros} label="کپی دستورها" className="mt-2" /></div>],
      ['از کنسول یک تست پینگ بگیر؛ باید زیر ۵۰ میلی‌ثانیه باشه.'],
    ],
  };
  const steps = STEPS[dev];
  const done = s.prefs.guide[dev] ?? [];
  const toggle = (i) => set((p) => {
    const cur = p.prefs.guide[dev] ?? [];
    return { prefs: { ...p.prefs, guide: { ...p.prefs.guide, [dev]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] } } };
  });
  const finished = done.length === steps.length;
  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-black">راهنمای اتصال</h3>
        <span className="text-xs text-zinc-500">{fa(done.length)} از {fa(steps.length)} قدم</span>
      </div>
      <div className="mt-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="دستگاه">
        {DEVICES.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={dev === d.id} onClick={() => setDev(d.id)} className={cx('flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors', dev === d.id ? 'bg-white/10 font-bold text-white' : 'text-zinc-400 hover:text-white')}>
            <d.icon className="size-4" />{d.label}
          </button>
        ))}
      </div>
      <Progress value={(done.length / steps.length) * 100} tone="bg-ok" className="mt-4" />
      <ol className="mt-4 space-y-2">
        {steps.map(([text, extra], i) => {
          const on = done.includes(i);
          return (
            <li key={`${dev}-${i}`} className="flex items-start gap-3 rounded-xl bg-ink p-3">
              <button
                type="button" onClick={() => toggle(i)} aria-pressed={on} aria-label={on ? `قدم ${i + 1} انجام شد` : `علامت زدن قدم ${i + 1}`}
                className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border text-xs transition-colors', on ? 'border-ok bg-ok text-black' : 'border-edge text-zinc-500 hover:border-zinc-400')}
              >
                {on ? <Check className="size-3.5" /> : fa(i + 1)}
              </button>
              <div className={cx('flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-7', on && 'text-zinc-500 line-through decoration-zinc-600')}>
                <span>{text}</span>{extra}
              </div>
            </li>
          );
        })}
      </ol>
      {finished && <p className="mt-3 text-sm text-ok">تمام شد. وضعیت اتصال رو از داشبورد ببین.</p>}
    </Card>
  );
}

/* ───────────────────────── Connection center ───────────────────────── */

function QR({ text }) {
  const cells = useMemo(() => {
    const q = qrcode(0, 'L');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n, d };
  }, [text]);
  return (
    <svg viewBox={`-3 -3 ${cells.n + 6} ${cells.n + 6}`} className="mx-auto w-full max-w-[300px] rounded-xl" shapeRendering="crispEdges" role="img" aria-label="QR کانفیگ WireGuard">
      <rect x="-3" y="-3" width={cells.n + 6} height={cells.n + 6} fill="#fff" />
      <path d={cells.d} fill="#050507" />
    </svg>
  );
}

function Connect({ setTab }) {
  const { api, toast } = useStore();
  const { d, reload } = usePanel();
  const me = d.sub;
  const [conf, setConf] = useState(null);
  const [err, setErr] = useState('');
  const [show, setShow] = useState(false);
  const [qr, setQr] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(null); // null = main config, otherwise a device id
  const device = d.devices.find((x) => x.id === target) ?? null;
  const load = useCallback(() => api(`/api/me/config${target ? `?device=${target}` : ''}`).then((c) => { setConf(c); setErr(''); }).catch((e) => setErr(e.message)), [api, target]);
  useEffect(() => { if (me?.hasTunnel) load(); }, [me?.hasTunnel, load]);
  useEffect(() => { if (target && !d.devices.some((x) => x.id === target)) setTarget(null); }, [d.devices, target]);

  if (!me) return <NoPlan />;
  if (!me.hasTunnel) {
    return (
      <Card className="p-8 text-center">
        <Globe className="mx-auto size-8 text-brand2" />
        <h3 className="mt-3 text-lg font-black">پلن فعلیت فقط DNS داره</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-silver">برای تانل کاهش پینگ و کانفیگ WireGuard، پلن «کاهش پینگ» یا «پکیج پرو» لازمه. DNS ضد تحریم رو از تب «DNS هوشمند» تنظیم کن.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Btn variant="ghost" onClick={() => setTab('dns')}>DNS هوشمند</Btn>
          <Link href="/#pricing" className="inline-flex h-10 items-center rounded-xl bg-brand px-5 text-[13px] font-bold text-white hover:bg-brand2">ارتقای پلن</Link>
        </div>
      </Card>
    );
  }
  if (!conf) return <Card className="p-8 text-center text-sm text-silver">{err || 'در حال آماده‌سازی کانفیگ…'}</Card>;

  const masked = conf.text.replace(conf.priv, '•'.repeat(44)).replace(conf.psk, '•'.repeat(44));
  const file = `doping-${device ? device.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'device' : (me.router ?? 'edge').toLowerCase()}.conf`;
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([conf.text], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(`فایل ${file} آماده شد. اگه دانلود شروع نشد، از «کپی کانفیگ» استفاده کن.`);
    } catch {
      toast('دانلود در این مرورگر ممکن نیست؛ کانفیگ رو کپی کن.', 'warn');
    }
  };
  const doReset = async () => {
    setBusy(true);
    try {
      const r = await api('/api/me/keys', { method: 'POST', body: target ? { device: target } : {} });
      await load();
      await reload();
      setReset(false);
      setShow(false);
      toast(r.routerUpdated ? 'کلید جدید ساخته شد و روی روتر اعمال شد. کانفیگ قبلی دیگه کار نمی‌کنه.' : 'کلید جدید ساخته شد؛ با اولین سینک روی روتر اعمال می‌شه.', 'warn');
    } catch (e) {
      toast(e.message, 'bad');
    }
    setBusy(false);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      {!me.provisioned && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm leading-7 text-amber-200 lg:col-span-2" role="status">
          <CircleAlert className="mt-1 size-4 shrink-0" />
          <span>Peer تو هنوز روی روتر ساخته نشده{me.provisionError ? ` (${me.provisionError})` : ''}. کانفیگ معتبره و به‌محض سینک روتر، بدون نیاز به کار اضافه وصل می‌شی.</span>
        </div>
      )}
      <Card className="min-w-0 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><KeyRound className="size-4 text-brand2" /> کانفیگ WireGuard{device && <span className="text-silver">· {device.name}</span>}</h3>
          <Mono className="text-xs text-silver">{file}</Mono>
        </div>
        <div className="relative mt-4">
          <pre dir="ltr" className="mono overflow-x-auto well p-4 text-left text-xs leading-6 text-zinc-300">{show ? conf.text : masked}</pre>
          <button type="button" onClick={() => setShow(!show)} className="absolute top-2 right-2 flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20">
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {show ? 'مخفی کردن کلید' : 'نمایش کلید'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn icon={Download} onClick={download}>دانلود فایل <Mono>.conf</Mono></Btn>
          <Btn variant="ghost" icon={QrCode} onClick={() => setQr(true)}>QR برای موبایل / روتر</Btn>
          <CopyBtn text={conf.text} label="کپی کانفیگ" size="md" />
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className="p-5">
          <h3 className="font-black">مشخصات اتصال</h3>
          <div className="mt-3 space-y-2">
            {[['Endpoint', conf.endpoint], ['Public Key', conf.serverKey], ['Address', conf.address]].map(([label, v]) => (
              <div key={label} className="flex items-center gap-2 well py-1 ps-3 pe-1">
                <div className="min-w-0 flex-1">
                  <Mono className="block text-[11px] text-zinc-500">{label}</Mono>
                  <Mono className="block truncate text-xs font-bold">{v}</Mono>
                </div>
                <CopyBtn text={v} />
              </div>
            ))}
          </div>
        </Card>
        <ExitPicker />
        <Devices target={target} setTarget={setTarget} />
        <Card className="border-amber-500/20 p-5">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Fingerprint className="size-4 text-warn" /> ریست کلید {device ? `«${device.name}»` : 'کانفیگ اصلی'}</h3>
          <p className="mt-2 text-xs leading-6 text-silver">
            اگه این کانفیگ لو رفته یا روی دستگاهی مونده که دیگه نمی‌خوای، کلیدش رو ریست کن. Peer همین کانفیگ روی میکروتیک با کلید جدید بازسازی می‌شه؛ بقیه دستگاه‌هات وصل می‌مونن.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-500">آخرین ریست: {me.keysRotatedAt ? faDate(me.keysRotatedAt) : '—'}</span>
            <Btn variant="danger" size="sm" icon={RefreshCw} onClick={() => setReset(true)}>ریست کلید اتصال (بازسازی کانفیگ در میکروتیک)</Btn>
          </div>
        </Card>
      </div>

      <SetupGuide conf={conf} onDownload={download} onQr={() => setQr(true)} />

      <Modal open={qr} onClose={() => setQr(false)} title="اسکن با اپ WireGuard" icon={QrCode}>
        <QR text={conf.text} />
        <p className="mt-4 text-center text-xs leading-6 text-silver">
          توی اپ WireGuard روی <Mono>+</Mono> بزن و «Scan from QR code» رو انتخاب کن. این کد شامل کلید خصوصیته؛ اسکرین‌شاتش رو برای کسی نفرست.
        </p>
      </Modal>
      <Modal
        open={reset} onClose={() => !busy && setReset(false)} title="کلید اتصال ریست بشه؟" icon={CircleAlert}
        footer={<><Btn variant="ghost" onClick={() => setReset(false)} disabled={busy}>نه، بی‌خیال</Btn><Btn variant="danger" busy={busy} onClick={doReset}>آره، کلید جدید بساز</Btn></>}
      >
        <p className="text-sm leading-7 text-silver">با این کار کانفیگ {device ? `«${device.name}»` : 'اصلی'} از کار می‌افته و باید کانفیگ جدیدش رو دوباره وارد کنی. بقیه دستگاه‌ها، حجم و زمان اشتراکت تغییری نمی‌کنن.</p>
      </Modal>
    </div>
  );
}

/** The exit node the tunnel leaves from. Changing it only moves the router-side address-lists. */
function ExitPicker() {
  const { api, toast, s } = useStore();
  const { d, reload } = usePanel();
  const [busy, setBusy] = useState(null);
  const featured = s.site.games.filter((g) => g.featured).slice(0, 3);
  const pick = async (exit) => {
    if (exit === d.sub.exit) return;
    setBusy(exit);
    try {
      const r = await api('/api/me/exit', { method: 'PUT', body: { exit } });
      await reload();
      toast(r.routerUpdated ? 'خروجی عوض شد. کانفیگ لازم نیست عوض بشه؛ از اتصال بعدی مسیر جدید فعاله.' : 'خروجی ثبت شد؛ با اولین سینک روتر اعمال می‌شه.', r.routerUpdated ? 'ok' : 'warn');
    } catch (e) { toast(e.message, 'bad'); }
    setBusy(null);
  };
  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Navigation className="size-4 text-brand2" /> نود خروجی</h3>
      <p className="mt-1 text-xs leading-6 text-silver">هر بازی به دیتاسنتر نزدیک‌ترین خروجی رو می‌خواد. کانفیگت ثابت می‌مونه.</p>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="نود خروجی">
        {EXITS.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={d.sub.exit === x.id} disabled={!!busy} onClick={() => pick(x.id)} className={cx('relative rounded-2xl p-3 text-center transition disabled:opacity-60', d.sub.exit === x.id ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
            <Mono className="block text-xs text-silver">{x.code}</Mono>
            <span className="block text-sm font-bold">{x.name}</span>
            <span className="block text-[11px] text-zinc-500">{busy === x.id ? '…' : featured.map((g) => `${g.short || g.name} ${g.via[x.id]}ms`).join(' · ')}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** Extra configs on the same subscription (phone, console router…): one quota, one queue, own keys. */
function Devices({ target, setTarget }) {
  const { api, toast } = useStore();
  const { d, reload } = usePanel();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const max = d.deviceLimit;
  const used = 1 + d.devices.length;
  const add = async () => {
    setBusy(true);
    try {
      const r = await api('/api/me/devices', { method: 'POST', body: { name: name.trim() } });
      await reload();
      setName('');
      setTarget(r.id);
      toast('دستگاه جدید ساخته شد؛ کانفیگش رو از همین صفحه وارد کن.');
    } catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  const remove = async (x) => {
    try {
      await api('/api/me/devices', { method: 'DELETE', body: { id: x.id } });
      await reload();
      toast(`«${x.name}» حذف شد و Peerش از روتر برداشته شد.`, 'warn');
    } catch (e) { toast(e.message, 'bad'); }
  };
  const Row = ({ id, label, ip, online }) => (
    <li className={cx('flex items-center gap-2 rounded-xl px-3 py-2', target === id ? 'bg-white/[0.08]' : 'well')}>
      <span className={cx('size-2 shrink-0 rounded-full', online ? 'bg-ok' : 'bg-zinc-600')} />
      <button type="button" onClick={() => setTarget(id)} aria-pressed={target === id} className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-bold">{label}</span>
        <Mono className="block text-[11px] text-zinc-500">{ip}/32{online ? ' · متصل' : ''}</Mono>
      </button>
      {id && <button type="button" aria-label={`حذف ${label}`} onClick={() => remove(d.devices.find((x) => x.id === id))} className="grid size-8 place-items-center rounded-lg text-silver hover:bg-red-500/15 hover:text-red-300"><Trash2 className="size-4" /></button>}
    </li>
  );
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><MonitorSmartphone className="size-4 text-brand2" /> دستگاه‌ها</h3>
        <Badge tone={used >= max ? 'warn' : 'mute'}><Mono>{used}/{max}</Mono></Badge>
      </div>
      <ul className="mt-3 space-y-1.5">
        <Row id={null} label="کانفیگ اصلی" ip={d.sub.ip} online={d.sub.mainOnline} />
        {d.devices.map((x) => <Row key={x.id} id={x.id} label={x.name} ip={x.ip} online={x.online} />)}
      </ul>
      {used < max ? (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) add(); }}>
          <input id="dev-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="اسم دستگاه، مثلاً موبایل" className="field" />
          <Btn type="submit" icon={Plus} busy={busy} disabled={name.trim().length < 2}>افزودن</Btn>
        </form>
      ) : <p className="mt-3 text-[11px] text-zinc-500">به سقف دستگاه‌های پلنت رسیدی. برای دستگاه جدید، یکی رو حذف کن{d.sub.kind === 'ping' ? ' یا پکیج پرو بگیر' : ''}.</p>}
    </Card>
  );
}

/* ───────────────────────── Smart DNS ───────────────────────── */

function SmartDns() {
  const { s, toast, api } = useStore();
  const { d, reload } = usePanel();
  const DNS = s.site.dns;
  const slots = d.sub && d.sub.status !== 'expired' ? d.sub.dnsSlots : 0;
  const ips = d.dnsIps;
  const [detected, setDetected] = useState({ ip: null, real: false });
  const [manual, setManual] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    fetch('https://api.ipify.org?format=json', { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => alive && isIPv4(j.ip) && setDetected({ ip: j.ip, real: true }))
      .catch(() => alive && setDetected({ ip: null, real: false, failed: true }))
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctl.abort(); };
  }, []);

  const full = ips.length >= slots;
  /** ip null = let the server use the address this request comes from. */
  const register = async (ip, label) => {
    if (ip != null) {
      if (!isIPv4(ip)) return setErr('این آی‌پی معتبر نیست.');
      if (isPrivate(ip)) return setErr('آی‌پی داخلی قبول نیست؛ آی‌پی عمومی اینترنتت رو وارد کن.');
      if (ips.some((x) => x.ip === ip)) return setErr('این آی‌پی قبلاً ثبت شده.');
    }
    if (!slots) return setErr('پلن فعالت DNS نداره. از صفحه تعرفه‌ها DNS یا پکیج پرو بخر.');
    if (full) return setErr(`سقف ${fa(slots)} آی‌پی پره. اول یکی رو حذف کن.`);
    setErr('');
    setBusy(true);
    try {
      const r = await api('/api/me/dns', { method: 'POST', body: { ...(ip ? { ip } : {}), label } });
      await reload();
      setManual('');
      toast(r.pending ? 'آی‌پی ثبت شد؛ با اولین سینک روی فایروال اعمال می‌شه.' : 'آی‌پی توی فایروال ثبت شد. DNS تا ۳۰ ثانیه دیگه برات جواب می‌ده.', r.pending ? 'warn' : 'ok');
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  const remove = async (x) => {
    try {
      await api('/api/me/dns', { method: 'DELETE', body: { id: x.id } });
      await reload();
      toast('آی‌پی از فایروال حذف شد.', 'warn');
    } catch (e) {
      toast(e.message, 'bad');
    }
  };
  const already = detected.ip && ips.some((x) => x.ip === detected.ip);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card red className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Globe className="size-4 text-brand2" /> ثبت آی‌پی برای DNS</h3>
        <p className="mt-2 text-xs leading-6 text-silver">DNS دوپینگ فقط به آی‌پی‌های ثبت‌شده جواب می‌ده. هر بار آی‌پی اینترنتت عوض شد، همین دکمه رو بزن.</p>
        <div className="mt-4 well p-4 text-center">
          <div className="text-xs text-silver">آی‌پی عمومی فعلی تو</div>
          <Mono className="mt-2 block text-2xl font-bold">{detected.ip ?? (detected.failed ? 'تشخیص سمت سرور' : '…')}</Mono>
          {detected.failed && <div className="mt-1 text-[11px] text-zinc-500">آی‌پی موقع ثبت از روی اتصال خودت تشخیص داده می‌شه.</div>}
        </div>
        <Btn size="lg" className="mt-4 w-full" icon={ShieldCheck} busy={busy} disabled={(!detected.ip && !detected.failed) || already} onClick={() => register(detected.ip, 'ثبت خودکار')}>
          {already ? 'این آی‌پی ثبت شده' : 'ثبت آی‌پی فعلی من در فایروال'}
        </Btn>
        <div className="mt-4 flex items-end gap-2">
          <Field label="ثبت دستی آی‌پی" className="flex-1">
            <input id="dns-manual" dir="ltr" value={manual} onChange={(e) => { setManual(e.target.value); setErr(''); }} placeholder="5.160.x.x" className="field mono" />
          </Field>
          <Btn variant="ghost" icon={Plus} onClick={() => register(manual.trim(), 'ثبت دستی')}>افزودن</Btn>
        </div>
        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className="p-5">
          <h3 className="font-black">آدرس‌های DNS</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[['Primary DNS', DNS.primary], ['Secondary DNS', DNS.secondary]].map(([l, v]) => (
              <div key={l} className="flex items-center gap-2 well py-1.5 ps-3 pe-1.5">
                <div className="min-w-0 flex-1">
                  <Mono className="block text-[11px] text-zinc-500">{l}</Mono>
                  <Mono className="block text-base font-black">{v}</Mono>
                </div>
                <CopyBtn text={v} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">این دو آدرس رو توی تنظیمات شبکه ویندوز، PS5، Xbox یا مودمت وارد کن.</p>
        </Card>
        <Card className="flex-1 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black">آی‌پی‌های مجاز</h3>
            <Badge tone={full ? 'warn' : 'mute'}><Mono>{ips.length}/{slots}</Mono> اسلات</Badge>
          </div>
          <ul className="mt-3 space-y-2">
            {ips.map((x) => (
              <li key={x.ip} className="flex items-center gap-3 well px-3 py-2">
                <Dot />
                <div className="min-w-0 flex-1">
                  <Mono className="block text-sm font-bold">{x.ip}</Mono>
                  <span className="block truncate text-[11px] text-zinc-500">{x.label} · {x.synced ? <>address-list: <Mono>doping-dns-allowed</Mono></> : 'در انتظار سینک روتر'}</span>
                </div>
                <button
                  type="button" aria-label={`حذف ${x.ip}`} className="grid size-8 place-items-center rounded-lg text-silver hover:bg-red-500/15 hover:text-red-300"
                  onClick={() => remove(x)}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {!ips.length && <li className="border border-dashed border-white/20 p-5 text-center text-xs text-silver">{slots ? 'هنوز آی‌پی‌ای ثبت نکردی. تا ثبت نکنی DNS جواب نمی‌ده.' : 'پلن فعالت DNS نداره؛ DNS ضد تحریم یا پکیج پرو رو از صفحه تعرفه‌ها بخر.'}</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── VIP / Steam ───────────────────────── */

function Vip() {
  const { toast, api } = useStore();
  const { d, reload } = usePanel();
  const steamId = d.user.steamId;
  const perks = d.user.perks;
  const [val, setVal] = useState(steamId ?? '');
  const [err, setErr] = useState('');
  const pro = d.sub?.kind === 'pro' && d.sub.status === 'active';
  const saveSteam = async (id) => {
    try {
      await api('/api/me/steam', { method: 'PUT', body: { steamId: id } });
      await reload();
      return true;
    } catch (e) {
      setErr(e.message);
      return false;
    }
  };
  const link = async () => {
    if (!/^7656119\d{10}$/.test(val.trim())) return setErr('SteamID64 باید ۱۷ رقم باشه و با 7656119 شروع بشه.');
    setErr('');
    if (await saveSteam(val.trim())) toast('اکانت Steam وصل شد؛ از مپ بعدی روی سرورها اعمال می‌شه.');
  };
  const PERKS = [
    ['slot', 'اسلات رزرو', 'حتی وقتی سرور پره وارد می‌شی.'],
    ['tag', 'تگ [DOPING VIP]', 'تگ قرمز کنار اسمت توی چت و اسکوربرد.'],
    ['skins', 'اسکین و چاقو (!ws / !knife)', 'انتخاب اسکین دلخواه روی سرورهای دوپینگ.'],
  ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Link2 className="size-4 text-brand2" /> اتصال اکانت Steam</h3>
        <p className="mt-2 text-xs leading-6 text-silver">امتیازهای VIP با SteamID64 شناخته می‌شن. آیدی ۱۷ رقمیت رو از پروفایل Steam یا سایت <Mono>steamid.io</Mono> بردار.</p>
        {steamId ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
            <span className="bg-brand-grad grid size-11 shrink-0 place-items-center rounded-xl text-lg font-black uppercase">{d.user.username[0]}</span>
            <div className="min-w-0 flex-1">
              <Mono className="block truncate font-bold">{d.user.username}</Mono>
              <Mono className="block truncate text-xs text-silver">{steamId}</Mono>
            </div>
            <Btn variant="danger" size="sm" icon={Unlink} onClick={async () => { if (await saveSteam(null)) { setVal(''); toast('اتصال Steam برداشته شد.', 'warn'); } }}>قطع اتصال</Btn>
          </div>
        ) : (
          <div className="mt-4 flex items-end gap-2">
            <Field label="SteamID64" error={err} className="flex-1">
              <input id="steam-id" dir="ltr" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} placeholder="7656119xxxxxxxxxx" className="field mono" />
            </Field>
            <Btn icon={Link2} onClick={link} className={err ? 'mb-6' : ''}>اتصال</Btn>
          </div>
        )}
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Crown className="size-4 text-warn" /> امتیازهای VIP سرورهای CS2</h3>
          <Badge tone={pro ? 'ok' : 'mute'}>{pro ? 'فعال با پکیج پرو' : 'نیاز به پکیج پرو'}</Badge>
        </div>
        <ul className="mt-4 space-y-2">
          {PERKS.map(([key, title, desc]) => (
            <li key={key} className="flex items-center gap-3 well px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{title}</div>
                <div className="text-xs text-silver">{desc}</div>
              </div>
              <Toggle
                label={title}
                checked={pro && !!steamId && perks[key]}
                onChange={async (v) => {
                  if (!pro) return toast('این امتیاز فقط با پکیج پرو فعاله.', 'warn');
                  if (!steamId) return toast('اول اکانت Steam رو وصل کن.', 'warn');
                  try {
                    await api('/api/me/perks', { method: 'PUT', body: { ...perks, [key]: v } });
                    await reload();
                  } catch (e) {
                    toast(e.message, 'bad');
                  }
                }}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ───────────────────────── Billing ───────────────────────── */

function Billing() {
  const { toast, api } = useStore();
  const { d } = usePanel();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(100_000);
  const gws = d.gateways.filter((g) => g.id !== 'wallet');
  const [gw, setGw] = useState(gws[0]?.id);
  const [busy, setBusy] = useState(false);
  const valid = amount >= 20_000 && amount <= 5_000_000;
  const pay = async () => {
    setBusy(true);
    try {
      const r = await api('/api/orders', { method: 'POST', body: { order: { type: 'topup', amount }, gateway: gw } });
      if (r.redirect) { window.location.href = r.redirect; return; }
    } catch (e) {
      toast(e.message, 'bad');
    }
    setBusy(false);
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card red className="flex flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs text-silver"><Wallet className="size-4" /> موجودی کیف پول</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-4xl leading-none font-black">{fa(d.user.wallet)}</span><span className="text-silver">تومان</span>
        </div>
        <p className="mt-3 text-xs leading-6 text-silver">با کیف پول، تمدید و خرید حجم اضافه یک‌کلیکی انجام می‌شه.</p>
        <Btn className="mt-auto" icon={Plus} onClick={() => setOpen(true)}>افزایش موجودی</Btn>
      </Card>
      <Card className="min-w-0 p-5">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Receipt className="size-4 text-brand2" /> تاریخچه فاکتورها</h3>
        <div className="max-md:p-2 mt-3 overflow-x-auto">
          <table className="rtable w-full md:min-w-[520px] text-sm">
            <thead className="text-xs text-silver">
              <tr className="border-b border-white/8 text-start">
                {['شماره', 'شرح', 'مبلغ', 'درگاه', 'وضعیت'].map((h) => <th key={h} className="px-2 py-2 text-start font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.invoices.map((i) => (
                <tr key={i.id} className="border-b border-white/5">
                  <td data-label="شماره" className="px-2 py-2.5"><Mono className="text-xs">{i.number}</Mono></td>
                  <td data-head="1" className="px-2 py-2.5"><div className="font-bold">{i.title}</div><div className="text-[11px] text-zinc-500">{faDate(i.at)}</div></td>
                  <td data-label="مبلغ" className="px-2 py-2.5 whitespace-nowrap">{toman(i.amount)}</td>
                  <td data-label="درگاه" className="px-2 py-2.5 text-xs text-silver">{i.gateway}</td>
                  <td data-label="وضعیت" className="px-2 py-2.5"><Badge tone={i.status === 'paid' ? 'ok' : i.status === 'canceled' ? 'mute' : 'bad'}>{i.status === 'paid' ? 'پرداخت شده' : i.status === 'canceled' ? 'لغو شده' : 'ناموفق'}</Badge></td>
                </tr>
              ))}
              {!d.invoices.length && <tr><td colSpan={5} className="px-2 py-8 text-center text-sm text-silver">هنوز فاکتوری نداری.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        open={open} onClose={() => !busy && setOpen(false)} title="افزایش موجودی کیف پول" icon={Wallet}
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)} disabled={busy}>انصراف</Btn><Btn busy={busy} disabled={!valid || !gw} onClick={pay}>رفتن به درگاه · {toman(amount || 0)}</Btn></>}
      >
        <div className="grid grid-cols-4 gap-2">
          {[50_000, 100_000, 200_000, 500_000].map((a) => (
            <button key={a} type="button" onClick={() => setAmount(a)} aria-pressed={amount === a} className={cx('relative rounded-2xl py-2.5 text-xs font-bold transition', amount === a ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
              {fa(a / 1000)} هزار
            </button>
          ))}
        </div>
        <Field label="مبلغ دلخواه (تومان)" className="mt-4" error={!valid ? 'مبلغ باید بین ۲۰ هزار تا ۵ میلیون تومان باشه.' : ''}>
          <input id="topup-amount" dir="ltr" inputMode="numeric" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')))} className="field mono" />
        </Field>
        <div className="mt-4 text-xs font-bold text-silver">درگاه پرداخت</div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {gws.map((g) => (
            <button key={g.id} type="button" onClick={() => setGw(g.id)} aria-pressed={gw === g.id} className={cx('relative rounded-2xl p-3 text-start transition', gw === g.id ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
              <span className="block text-sm font-bold">{g.name}</span>
              <span className="block text-[11px] text-silver">{g.kind}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

/* ───────────────────────── Support tickets ───────────────────────── */

const T_STATUS = { open: ['در انتظار پاسخ', 'warn'], answered: ['پاسخ داده شد', 'ok'], closed: ['بسته', 'mute'] };

function Tickets() {
  const { toast, api } = useStore();
  const { d, reload } = usePanel();
  const tickets = d.tickets;
  const [sel, setSel] = useState(tickets[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: '', dept: 'فنی', text: '' });
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const t = tickets.find((x) => x.id === sel);
  const ok = form.subject.trim().length >= 5 && form.text.trim().length >= 10;

  const create = async () => {
    setBusy(true);
    try {
      const r = await api('/api/me/tickets', { method: 'POST', body: { subject: form.subject.trim(), dept: form.dept, text: form.text.trim(), files: newFiles.map(({ name, data }) => ({ name, data })) } });
      setNewFiles([]);
      await reload();
      setSel(r.id);
      setCreating(false);
      setForm({ subject: '', dept: 'فنی', text: '' });
      toast('تیکت ثبت شد. پاسخ پشتیبانی همین‌جا نمایش داده می‌شه.');
    } catch (e) {
      toast(e.message, 'bad');
    }
    setBusy(false);
  };
  const send = async () => {
    if (!reply.trim() && !files.length) return;
    try {
      await api(`/api/me/tickets/${sel}`, { method: 'POST', body: { text: reply.trim(), files: files.map(({ name, data }) => ({ name, data })) } });
      setReply('');
      setFiles([]);
      await reload();
    } catch (e) {
      toast(e.message, 'bad');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><LifeBuoy className="size-4 text-brand2" /> تیکت‌های پشتیبانی</h3>
          <Btn size="sm" icon={Plus} onClick={() => setCreating(true)}>تیکت جدید</Btn>
        </div>
        <ul className="mt-3 space-y-2">
          {tickets.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setSel(x.id)} className={cx('w-full relative rounded-2xl p-3 text-start transition', sel === x.id ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
                <div className="flex items-center justify-between gap-2">
                  <Mono className="text-[11px] text-silver">{x.code}</Mono>
                  <Badge tone={T_STATUS[x.status][1]}>{T_STATUS[x.status][0]}</Badge>
                </div>
                <div className="mt-1 truncate text-sm font-bold">{x.subject}</div>
                <div className="text-[11px] text-zinc-500">واحد {x.dept} · {faDate(x.at)}</div>
              </button>
            </li>
          ))}
          {!tickets.length && <li className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-xs text-silver">هنوز تیکتی نفرستادی.</li>}
        </ul>
      </Card>
      <Card className="flex min-h-[360px] min-w-0 flex-col p-5">
        {t ? (
          <>
            <div className="border-b border-white/[0.07] pb-4">
              <div className="font-black">{t.subject}</div>
              <div className="text-xs text-silver"><Mono>{t.code}</Mono> · واحد {t.dept}</div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {t.msgs.map((m) => (
                <div key={m.id} className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-7', m.from === 'me' ? 'bg-brand/20' : 'ms-auto border border-white/8 bg-white/[0.04]')}>
                  <div className="mb-0.5 text-[11px] font-bold text-silver">{m.from === 'me' ? 'تو' : 'پشتیبانی دوپینگ'}</div>
                  {m.text && <span className="whitespace-pre-wrap">{m.text}</span>}
                  <Attachments files={m.files} />
                </div>
              ))}
            </div>
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <div className="flex gap-2">
                <input id="ticket-reply" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پیامت رو بنویس…" className="field" />
                <Btn type="submit" icon={Send} disabled={!reply.trim() && !files.length}>ارسال</Btn>
              </div>
              <FilePicker id="ticket-files" files={files} onChange={setFiles} onError={(m) => toast(m, 'warn')} />
            </form>
          </>
        ) : (
          <div className="m-auto text-center text-sm text-silver">تیکتی انتخاب نشده.</div>
        )}
      </Card>
      <Modal
        open={creating} onClose={() => setCreating(false)} title="تیکت جدید" icon={LifeBuoy}
        footer={<><Btn variant="ghost" onClick={() => setCreating(false)}>انصراف</Btn><Btn icon={Send} disabled={!ok} busy={busy} onClick={create}>ثبت تیکت</Btn></>}
      >
        <div className="space-y-4">
          <Field label="موضوع"><input id="tk-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="مثلاً: پینگ بالا روی Valorant" className="field" /></Field>
          <Field label="واحد">
            <select id="tk-dept" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} className="field">
              {['فنی', 'مالی', 'سرورهای بازی'].map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="توضیح" hint="بازی، ساعت مشکل و خروجی انتخابی رو بنویس تا سریع‌تر حل بشه. اسکرین‌شات یا خروجی tracert رو پیوست کن.">
            <textarea id="tk-text" rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className="field resize-none" />
          </Field>
          <FilePicker id="tk-files" files={newFiles} onChange={setNewFiles} onError={(m) => toast(m, 'warn')} />
        </div>
      </Modal>
    </div>
  );
}

/* ───────────────────────── Account ───────────────────────── */

const agentName = (ua) => {
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(' · ') || 'دستگاه ناشناس';
};

function Section({ icon: Icon, title, children, className }) {
  return (
    <Card className={cx('p-5 sm:p-6', className)}>
      <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Icon className="size-4 text-brand2" /> {title}</h3>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** Runs one account write; returns true on success and shows the server's message otherwise. */
function useWrite() {
  const { api, toast } = useStore();
  const { reload } = usePanel();
  return useCallback(async (path, method, body, ok, setErrs) => {
    try {
      const r = await api(path, { method, body });
      await reload();
      if (ok) toast(ok);
      setErrs?.({});
      return r ?? {};
    } catch (e) {
      if (setErrs && Object.keys(e.fields).length) setErrs(e.fields);
      else toast(e.message, 'bad');
      return null;
    }
  }, [api, toast, reload]);
}

function EmailBox() {
  const { d } = usePanel();
  const write = useWrite();
  const a = d.account;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ email: '', password: '' });
  const [errs, setErrs] = useState({});
  return (
    <Section icon={Mail} title="ایمیل">
      <div className="flex flex-wrap items-center gap-2">
        <Mono className="min-w-0 flex-1 truncate font-bold">{d.user.email}</Mono>
        {a.emailVerified ? <Badge tone="ok" icon={Check}>تایید شده</Badge> : <Badge tone="warn">تایید نشده</Badge>}
      </div>
      {!a.emailVerified && (
        <p className="mt-2 text-xs leading-6 text-silver">
          {d.channels.email ? 'لینک تایید به ایمیلت فرستاده شده. تا تایید نکنی، هشدارها و رسیدها با ایمیل فرستاده نمی‌شن.' : 'ارسال ایمیل هنوز روی سرور تنظیم نشده.'}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!a.emailVerified && d.channels.email && <Btn size="sm" variant="ghost" icon={Send} onClick={() => write('/api/me/email', 'POST', undefined, 'لینک تایید دوباره فرستاده شد.')}>ارسال دوباره لینک</Btn>}
        <Btn size="sm" variant="ghost" icon={Mail} onClick={() => setEdit(!edit)}>تغییر ایمیل</Btn>
      </div>
      {edit && (
        <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start" onSubmit={async (e) => { e.preventDefault(); if (await write('/api/me/email', 'PUT', f, 'ایمیل عوض شد؛ لینک تایید به آدرس جدید رفت.', setErrs)) { setEdit(false); setF({ email: '', password: '' }); } }}>
          <Field label="ایمیل جدید" error={errs.email}><input id="acc-email" type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="field mono" /></Field>
          <Field label="رمز فعلی" error={errs.password}><input id="acc-email-pass" type="password" dir="ltr" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="field mono" /></Field>
          <Btn type="submit" className="sm:mt-6" disabled={!f.email || !f.password}>ذخیره</Btn>
        </form>
      )}
    </Section>
  );
}

function PasswordBox() {
  const write = useWrite();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [errs, setErrs] = useState({});
  const mismatch = f.again && f.next !== f.again;
  const submit = async (e) => {
    e.preventDefault();
    if (mismatch) return;
    if (await write('/api/me/password', 'PUT', { current: f.current, next: f.next }, 'رمز عوض شد و بقیه دستگاه‌ها از حساب خارج شدن.', setErrs)) setF({ current: '', next: '', again: '' });
  };
  return (
    <Section icon={Lock} title="تغییر رمز">
      <form className="space-y-3" onSubmit={submit}>
        <Field label="رمز فعلی" error={errs.current}><input id="pw-current" type="password" dir="ltr" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} className="field mono" /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="رمز جدید" hint="حداقل ۸ کاراکتر." error={errs.next}><input id="pw-next" type="password" dir="ltr" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} className="field mono" /></Field>
          <Field label="تکرار رمز جدید" error={mismatch ? 'با رمز جدید یکی نیست.' : ''}><input id="pw-again" type="password" dir="ltr" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} className="field mono" /></Field>
        </div>
        <Btn type="submit" icon={Lock} disabled={!f.current || f.next.length < 8 || f.next !== f.again}>تغییر رمز</Btn>
      </form>
    </Section>
  );
}

function PhoneBox() {
  const { d } = usePanel();
  const write = useWrite();
  const a = d.account;
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [errs, setErrs] = useState({});
  if (!d.channels.sms) {
    return <Section icon={Phone} title="شماره موبایل"><p className="text-xs leading-6 text-silver">ارسال پیامک هنوز روی سرور تنظیم نشده؛ بعد از فعال شدن، با شماره موبایل هم می‌تونی وارد بشی.</p></Section>;
  }
  return (
    <Section icon={Phone} title="شماره موبایل">
      {a.phoneVerified ? (
        <div className="flex flex-wrap items-center gap-2">
          <Mono className="flex-1 font-bold">{a.phone}</Mono>
          <Badge tone="ok" icon={Check}>تایید شده</Badge>
          <Btn size="sm" variant="danger" icon={Trash2} onClick={() => write('/api/me/phone', 'DELETE', {}, 'شماره برداشته شد.')}>حذف</Btn>
          <p className="w-full text-xs leading-6 text-silver">با همین شماره از صفحه ورود، با کد پیامکی هم وارد می‌شی.</p>
        </div>
      ) : sent ? (
        <form className="flex flex-wrap items-start gap-2" onSubmit={async (e) => { e.preventDefault(); if (await write('/api/me/phone', 'PUT', { phone: sent, code }, 'شماره موبایل تایید شد.', setErrs)) { setSent(null); setCode(''); } }}>
          <Field label={`کد ارسال‌شده به ${sent}`} error={errs.code} className="flex-1"><input id="phone-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="field mono tracking-[0.4em]" /></Field>
          <Btn type="submit" className="mt-6" disabled={code.length !== 6}>تایید</Btn>
          <Btn variant="ghost" className="mt-6" onClick={() => setSent(null)}>تغییر شماره</Btn>
        </form>
      ) : (
        <form className="flex flex-wrap items-start gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await write('/api/me/phone', 'POST', { phone }, 'کد تایید پیامک شد.', setErrs); if (r) setSent(r.phone); }}>
          <Field label="شماره موبایل" error={errs.phone} className="flex-1"><input id="phone-number" dir="ltr" inputMode="tel" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} className="field mono" /></Field>
          <Btn type="submit" className="mt-6" icon={Send} disabled={phone.trim().length < 10}>ارسال کد</Btn>
        </form>
      )}
    </Section>
  );
}

function NotifyBox() {
  const { d } = usePanel();
  const write = useWrite();
  const a = d.account;
  const prefs = a.notify;
  const [busy, setBusy] = useState(false);
  const linkTelegram = async () => {
    setBusy(true);
    const r = await write('/api/me/telegram', 'POST');
    setBusy(false);
    if (r?.url) window.open(r.url, '_blank', 'noopener');
  };
  const rows = [
    ['email', 'ایمیل', a.emailVerified ? d.user.email : 'اول ایمیلت رو تایید کن', a.emailVerified && d.channels.email],
    ['telegram', 'تلگرام', a.telegram ? 'وصل شده' : d.channels.telegram ? 'وصل نیست' : 'ربات روی سرور تنظیم نشده', a.telegram],
    ['sms', 'پیامک', a.phoneVerified ? a.phone : 'اول شماره موبایل رو تایید کن', a.phoneVerified && d.channels.sms],
  ];
  return (
    <Section icon={Bell} title="هشدارها و اطلاع‌رسانی">
      <p className="text-xs leading-6 text-silver">هشدار ۸۰٪ و اتمام حجم، ۳ روز و ۱ روز مونده به انقضا، تمدید خودکار، رسید پرداخت و پاسخ تیکت‌ها. همه هشدارها توی پنل هم می‌مونن.</p>
      <ul className="mt-3 space-y-2">
        {rows.map(([k, label, sub, ready]) => (
          <li key={k} className="flex items-center gap-3 well px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{label}</div>
              <div className="truncate text-[11px] text-silver" dir="auto">{sub}</div>
            </div>
            {k === 'telegram' && d.channels.telegram && (a.telegram
              ? <Btn size="sm" variant="ghost" icon={Unlink} onClick={() => write('/api/me/telegram', 'DELETE', {}, 'اتصال تلگرام برداشته شد.')}>قطع</Btn>
              : <Btn size="sm" variant="ghost" icon={MessageCircle} busy={busy} onClick={linkTelegram}>اتصال</Btn>)}
            <Toggle label={`هشدار ${label}`} checked={!!ready && prefs[k]} onChange={(v) => (ready ? write('/api/me/notify', 'PUT', { ...prefs, [k]: v }) : null)} />
          </li>
        ))}
      </ul>
      {d.channels.telegram && !a.telegram && <p className="mt-2 text-[11px] text-zinc-500">بعد از زدن «اتصال»، توی تلگرام دکمه Start رو بزن؛ چند ثانیه بعد اینجا «وصل شده» می‌شه.</p>}
    </Section>
  );
}

function ReferralBox() {
  const { d } = usePanel();
  const r = d.account.referrals;
  // The origin is only known in the browser; set after hydration so server and client HTML match.
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  if (!r.percent) return null;
  const link = `${origin}/register?ref=${d.account.refCode}`;
  return (
    <Section icon={Gift} title="دعوت از دوستان">
      <p className="text-xs leading-6 text-silver">دوستت با لینک تو ثبت‌نام کنه، از اولین خریدش <b className="text-white">{fa(r.percent)}٪</b> به کیف پولت اضافه می‌شه.</p>
      <div className="mt-3 flex items-center gap-2 well py-1 ps-3 pe-1">
        <Mono className="min-w-0 flex-1 truncate text-xs">{link}</Mono>
        <CopyBtn text={link} label="کپی لینک" />
      </div>
      <dl className="mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-line rounded-xl border border-line text-center">
        {[['ثبت‌نام', fa(r.signups)], ['خرید کرده', fa(r.bought)], ['پاداش', toman(r.earned)]].map(([k, v]) => (
          <div key={k} className="px-2 py-3"><dt className="text-[11px] text-zinc-500">{k}</dt><dd className="mt-0.5 text-sm font-black">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-zinc-500">کد معرف: <Mono className="text-zinc-300">{d.account.refCode}</Mono></p>
    </Section>
  );
}

function SessionsBox() {
  const { d } = usePanel();
  const write = useWrite();
  const list = d.account.sessions;
  return (
    <Section icon={LogOut} title="دستگاه‌های وارد شده">
      <ul className="space-y-2">
        {list.map((x) => (
          <li key={x.id} className="flex items-center gap-3 well px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{agentName(x.agent)}{x.current && <span className="ms-2 text-[11px] text-ok">همین دستگاه</span>}</div>
              <Mono className="text-[11px] text-zinc-500">{x.ip} · {faDate(x.at)}</Mono>
            </div>
            {!x.current && <Btn size="sm" variant="ghost" icon={LogOut} aria-label="خروج این دستگاه" onClick={() => write('/api/me/sessions', 'DELETE', { id: x.id }, 'اون دستگاه از حساب خارج شد.')} />}
          </li>
        ))}
      </ul>
      {list.length > 1 && <Btn size="sm" variant="danger" className="mt-3" icon={LogOut} onClick={() => write('/api/me/sessions', 'DELETE', {}, 'همه دستگاه‌های دیگه خارج شدن.')}>خروج از همه دستگاه‌های دیگه</Btn>}
    </Section>
  );
}

function Account() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <EmailBox />
      <PhoneBox />
      <NotifyBox />
      <ReferralBox />
      <PasswordBox />
      <SessionsBox />
    </div>
  );
}

/* ───────────────────────── Notifications ───────────────────────── */

const N_TONE = { info: 'border-white/10', warn: 'border-amber-500/30', bad: 'border-red-500/30' };

function Inbox() {
  const { api } = useStore();
  const { d, reload } = usePanel();
  const [open, setOpen] = useState(false);
  const list = d.notifications;
  const unread = list.filter((n) => !n.read).length;
  const show = async () => {
    setOpen(true);
    if (unread) { try { await api('/api/me/notifications', { method: 'POST', body: { ids: 'all' } }); } catch { /* best effort */ } }
  };
  return (
    <>
      <button type="button" onClick={show} aria-label={`اعلان‌ها${unread ? ` (${fa(unread)} خوانده‌نشده)` : ''}`} className="relative grid size-10 place-items-center rounded-xl border border-line hover:bg-white/[0.05]">
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute -top-1 -left-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-black">{fa(unread)}</span>}
      </button>
      <Modal open={open} onClose={() => { setOpen(false); reload(); }} title="اعلان‌ها" icon={Bell}>
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {list.map((n) => (
            <li key={n.id} className={cx('rounded-xl border bg-white/[0.02] px-4 py-3', N_TONE[n.level])}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{!n.read && <span className="me-1.5 inline-block size-1.5 rounded-full bg-brand2 align-middle" />}{n.title}</span>
                <span className="shrink-0 text-[11px] text-zinc-500">{faDate(n.at)}</span>
              </div>
              <p className="mt-1 text-xs leading-6 text-silver">{n.body}</p>
            </li>
          ))}
          {!list.length && <li className="p-6 text-center text-sm text-silver">اعلانی نداری.</li>}
        </ul>
      </Modal>
    </>
  );
}

/* ───────────────────────── Shell ───────────────────────── */

const TABS = [
  { id: 'dash', label: 'داشبورد', icon: LayoutDashboard, C: Dashboard },
  { id: 'connect', label: 'مرکز اتصال', icon: KeyRound, C: Connect },
  { id: 'dns', label: 'DNS هوشمند', icon: Globe, C: SmartDns },
  { id: 'vip', label: 'VIP و Steam', icon: Crown, C: Vip },
  { id: 'billing', label: 'مالی', icon: Wallet, C: Billing },
  { id: 'support', label: 'پشتیبانی', icon: LifeBuoy, C: Tickets },
  { id: 'account', label: 'حساب کاربری', icon: UserCog, C: Account },
];

export default function UserPanel({ initial, tab: initialTab, verified }) {
  const { api, set, toast } = useStore();
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === initialTab) ? initialTab : 'dash'));
  const reload = useCallback(async () => {
    try {
      const next = await api('/api/me');
      setD(next);
      set((p) => ({ user: p.user ? { ...p.user, wallet: next.user.wallet } : p.user }));
    } catch { /* keep the last data */ }
  }, [api, set]);
  // Usage and handshake numbers follow the router poll; refresh while the tab is visible.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 60_000);
    return () => clearInterval(t);
  }, [reload]);
  useEffect(() => {
    if (verified == null) return;
    toast(verified === '1' ? 'ایمیلت تایید شد.' : 'لینک تایید منقضی شده؛ از همین صفحه دوباره بفرستش.', verified === '1' ? 'ok' : 'warn');
    window.history.replaceState(null, '', '/panel?tab=account');
  }, [verified, toast]);
  const ctx = useMemo(() => ({ d, reload }), [d, reload]);
  const Current = TABS.find((t) => t.id === tab).C;
  const me = d.sub;
  return (
    <Panel.Provider value={ctx}>
      <div className="gutter mx-auto max-w-6xl pt-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black">سلام {d.user.username}</h1>
            <p className="mt-1 truncate text-sm text-zinc-500">پنل گیمر · <Mono>{d.user.email}</Mono></p>
          </div>
          <Inbox />
        </div>
        {!d.account.emailVerified && d.channels.email && tab !== 'account' && (
          <button type="button" onClick={() => setTab('account')} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-start text-sm text-amber-200">
            <Mail className="size-4 shrink-0" /> ایمیلت هنوز تایید نشده؛ برای گرفتن هشدار حجم و انقضا و بازیابی رمز، تاییدش کن.
          </button>
        )}
        <RailLayout
          tabs={TABS} value={tab} onChange={setTab}
          foot={me?.hasTunnel && (
            <div className="border-t border-line px-3 pt-4 text-xs text-zinc-500">
              <div className="flex items-center gap-2 font-bold text-zinc-300">{me.online ? <><Dot /> تانل وصله</> : <><Dot tone="bad" /> تانل وصل نیست</>}</div>
              <Mono className="mt-1 block">{me.ip}/32 · {me.router ?? '—'}</Mono>
            </div>
          )}
        >
          <Current setTab={setTab} />
        </RailLayout>
      </div>
    </Panel.Provider>
  );
}
