import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import {
  ArrowDown, ArrowUp, CalendarClock, CircleAlert, Crown, Download, Eye, EyeOff, Fingerprint, Globe, KeyRound, LayoutDashboard, LifeBuoy,
  Link2, Plus, QrCode, Receipt, RefreshCw, Send, ShieldCheck, Trash2, Unlink, Wallet, Wifi, Zap,
} from 'lucide-react';
import { useStore } from '../store.jsx';
import { Ring } from '../art.jsx';
import { Badge, Btn, Card, CopyBtn, cx, Dot, Field, Modal, Mono, Progress, RailLayout, Toggle } from '../ui.jsx';
import { daysLeft, DNS, EXITS, fa, faDate, GB, gb, isIPv4, isPrivate, PLAN_NAME, priceOf, tierLabel, toman, uid, WG, wgKey } from '../data.js';

const STATUS = {
  active: ['فعال', 'ok'], quota: ['اتمام حجم', 'bad'], expired: ['منقضی', 'warn'], disabled: ['غیرفعال', 'mute'],
};

/* ───────────────────────── Dashboard ───────────────────────── */

function PayFromWallet({ open, onClose, title, icon, price, children, onPaid, cta }) {
  const { s, set, toast } = useStore();
  const short = s.wallet < price;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>انصراف</Btn>
          <Btn
            disabled={short}
            onClick={() => { set((p) => ({ wallet: p.wallet - price })); onPaid(); onClose(); toast(`${cta} انجام شد.`); }}
          >
            {cta} · {toman(price)}
          </Btn>
        </>
      }
    >
      {children}
      <div className="mt-4 flex items-center justify-between well px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-silver"><Wallet className="size-4" /> موجودی کیف پول</span>
        <span className={cx('font-black', short && 'text-brand2')}>{toman(s.wallet)}</span>
      </div>
      {short && <p className="mt-2 text-xs text-warn">موجودی کافی نیست. از تب «مالی» کیف پولت رو شارژ کن.</p>}
    </Modal>
  );
}

function Dashboard({ setTab }) {
  const { s, me, patch, invoice, log } = useStore();
  const [extra, setExtra] = useState(false);
  const [renew, setRenew] = useState(false);
  const [pack, setPack] = useState(10);
  const used = me.up + me.down;
  const unlimited = me.quota == null;
  const pct = unlimited ? 0 : (used / me.quota) * 100;
  const days = daysLeft(me.expires);
  const [st, tone] = STATUS[me.status];
  const exit = EXITS.find((e) => e.id === s.exit);
  const tier = unlimited ? 'inf' : me.quota / GB;
  const renewPrice = priceOf(s.pricing, { kind: me.plan, tier: s.pricing.ping[tier] ? tier : 15, slots: 1, months: 1 }).total;
  const extraPrice = pack * s.pricing.extraPerGb;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
      <Card className="min-w-0 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Zap className="size-4 text-brand2" /> وضعیت حجم و اشتراک</h3>
          <div className="flex items-center gap-2">
            <Badge tone="brand" icon={Crown}>{PLAN_NAME[me.plan]}</Badge>
            <Badge tone={tone}>{st}</Badge>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 items-center gap-8 sm:grid-cols-[200px_minmax(0,1fr)]">
          <Ring pct={unlimited ? 0 : pct} className="mx-auto w-full max-w-[200px]">
            <div>
              <Mono className="block text-4xl leading-none font-bold">{unlimited ? '∞' : gb(Math.max(0, me.quota - used))}</Mono>
              <Mono className="mt-1.5 block text-xs text-zinc-500">{unlimited ? 'Unlimited' : `GB / ${me.quota / GB} GB`}</Mono>
              <div className="mt-1 text-[11px] text-zinc-500">حجم باقی‌مانده</div>
            </div>
          </Ring>
          <div className="min-w-0">
            <p className="text-sm leading-7 text-zinc-300">
              {unlimited ? (
                <>اشتراک زمانی بدون سقف حجم · <Mono className="font-bold text-white">{gb(used)} GB</Mono> مصرف شده</>
              ) : (
                <><Mono className="font-bold text-white">{gb(Math.max(0, me.quota - used))} GB</Mono> باقی‌مانده از <Mono className="font-bold text-white">{me.quota / GB} GB</Mono> — <Mono className="font-bold text-white">{gb(used)} GB</Mono> مصرف شده</>
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
              <RefreshCw className="size-3 shrink-0" /> <span>همگام با Simple Queue میکروتیک (<Mono>dp-{me.id}</Mono>) هر ۵ دقیقه</span>
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          <Btn icon={Plus} onClick={() => setExtra(true)} disabled={unlimited}>خرید حجم اضافه (ترافیک مازاد)</Btn>
          <Btn variant="outline" icon={RefreshCw} onClick={() => setRenew(true)}>تمدید یک‌کلیکی</Btn>
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
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-silver"><Wifi className="size-4" /> اتصال فعلی</div>
            {me.peer && me.online ? <Badge tone="ok"><Dot /> متصل</Badge> : <Badge tone="bad">قطع</Badge>}
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ['نود ورودی', 'THR-EDGE-01'],
              ['خروجی', `${exit.code} · ${exit.country}`],
              ['آی‌پی تانل', `${me.ip}/32`],
              ['آخرین Handshake', me.peer && me.online ? `${s.routers[0].handshake % 25}s ago` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="text-silver">{k}</dt>
                <dd><Mono className="text-xs font-bold">{v}</Mono></dd>
              </div>
            ))}
          </dl>
          <Btn variant="ghost" size="sm" className="mt-2 w-full" icon={KeyRound} onClick={() => setTab('connect')}>کانفیگ و QR اتصال</Btn>
        </Card>
      </div>

      <PayFromWallet
        open={extra} onClose={() => setExtra(false)} title="خرید حجم اضافه" icon={Plus} price={extraPrice} cta="خرید حجم"
        onPaid={() => {
          patch('users', 'u1', (u) => ({ quota: u.quota + pack * GB, status: u.status === 'quota' ? 'active' : u.status, peer: true, online: true }));
          invoice(`ترافیک مازاد · ${fa(pack)} گیگ`, extraPrice, 'کیف پول');
          log('mikrotik', 'info', `PATCH /rest/queue/simple/${me.queueId} comment quota+=${pack}GB · peer enabled`, 'panel', '10.0.0.4');
        }}
      >
        <p className="text-sm text-silver">حجم اضافه تا پایان همین دوره اعتبار داره و بلافاصله روی صف میکروتیک اعمال می‌شه.</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[5, 10, 20, 50].map((g) => (
            <button key={g} type="button" onClick={() => setPack(g)} aria-pressed={pack === g} className={cx('relative rounded-2xl py-3 text-center transition', pack === g ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
              <Mono className="block text-lg font-black">+{g}</Mono>
              <Mono className="text-[10px] text-silver">GB</Mono>
            </button>
          ))}
        </div>
      </PayFromWallet>

      <PayFromWallet
        open={renew} onClose={() => setRenew(false)} title="تمدید یک‌کلیکی" icon={RefreshCw} price={renewPrice} cta="تمدید"
        onPaid={() => {
          patch('users', 'u1', (u) => ({ up: 0, down: 0, expires: Math.max(u.expires, Date.now()) + 30 * 86_400_000, status: 'active', peer: true, online: true }));
          invoice(`تمدید ${PLAN_NAME[me.plan]} · ${tierLabel(tier)} · ۱ ماهه`, renewPrice, 'کیف پول');
          log('mikrotik', 'info', `POST /rest/queue/simple/reset-counters .id=${me.queueId} · تمدید Arash_AWP`, 'panel', '10.0.0.4');
        }}
      >
        <p className="text-sm text-silver">
          همین پلن ({PLAN_NAME[me.plan]} · {tierLabel(tier)}) برای ۳۰ روز دیگه تمدید می‌شه. شمارنده حجم صفر می‌شه و روزهای باقی‌مانده فعلی هم حفظ می‌شن.
        </p>
      </PayFromWallet>
    </div>
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

function Connect() {
  const { s, me, set, toast, log } = useStore();
  const [show, setShow] = useState(false);
  const [qr, setQr] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const k = s.myKeys;
  const conf = `[Interface]
PrivateKey = ${k.priv}
Address = ${me.ip}/32
DNS = ${DNS.primary}, ${DNS.secondary}
MTU = ${WG.mtu}

[Peer]
PublicKey = ${WG.serverKey}
PresharedKey = ${k.psk}
Endpoint = ${WG.endpoint}
AllowedIPs = ${WG.allowed}
PersistentKeepalive = 25
`;
  const masked = conf.replace(k.priv, '•'.repeat(44)).replace(k.psk, '•'.repeat(44));

  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([conf], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'doping-thr1.conf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('فایل doping-thr1.conf آماده شد. اگه دانلود شروع نشد، از «کپی کانفیگ» استفاده کن.');
    } catch {
      toast('دانلود در این مرورگر ممکن نیست؛ کانفیگ رو کپی کن.', 'warn');
    }
  };
  const doReset = () => {
    setBusy(true);
    setTimeout(() => {
      set({ myKeys: { priv: wgKey(), pub: wgKey(), psk: wgKey(), rotated: Date.now() } });
      log('mikrotik', 'warn', `PATCH /rest/interface/wireguard/peers/${me.peerId} public-key=… preshared-key=… · ریست کلید`, 'Arash_AWP', '5.160.14.92');
      setBusy(false);
      setReset(false);
      setShow(false);
      toast('کلید جدید ساخته شد. کانفیگ قبلی دیگه کار نمی‌کنه.', 'warn');
    }, 1300);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card className="min-w-0 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><KeyRound className="size-4 text-brand2" /> کانفیگ WireGuard</h3>
          <Mono className="text-xs text-silver">doping-thr1.conf</Mono>
        </div>
        <div className="relative mt-4">
          <pre dir="ltr" className="mono overflow-x-auto well p-4 text-left text-xs leading-6 text-zinc-300">{show ? conf : masked}</pre>
          <button type="button" onClick={() => setShow(!show)} className="absolute top-2 right-2 flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20">
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {show ? 'مخفی کردن کلید' : 'نمایش کلید'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn icon={Download} onClick={download}>دانلود فایل <Mono>.conf</Mono></Btn>
          <Btn variant="ghost" icon={QrCode} onClick={() => setQr(true)}>QR برای موبایل / روتر</Btn>
          <CopyBtn text={conf} label="کپی کانفیگ" size="md" />
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className="p-5">
          <h3 className="font-black">مشخصات اتصال</h3>
          <div className="mt-3 space-y-2">
            {[['Endpoint', WG.endpoint], ['AllowedIPs', WG.allowed], ['Public Key', WG.serverKey], ['Address', `${me.ip}/32`]].map(([label, v]) => (
              <div key={label} className="flex items-center gap-2 well py-1 ps-3 pe-1">
                <div className="min-w-0 flex-1">
                  <Mono className="block text-[10px] text-zinc-500">{label}</Mono>
                  <Mono className="block truncate text-xs font-bold">{v}</Mono>
                </div>
                <CopyBtn text={v} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="border-amber-500/20 p-5">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Fingerprint className="size-4 text-warn" /> ریست کلید اتصال</h3>
          <p className="mt-2 text-xs leading-6 text-silver">
            اگه کانفیگت لو رفته یا روی دستگاه دیگه‌ای مونده، کلید رو ریست کن. Peer روی میکروتیک با کلید جدید بازسازی می‌شه و همه دستگاه‌های قبلی قطع می‌شن.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-500">آخرین ریست: {faDate(k.rotated)}</span>
            <Btn variant="danger" size="sm" icon={RefreshCw} onClick={() => setReset(true)}>ریست کلید اتصال (بازسازی کانفیگ در میکروتیک)</Btn>
          </div>
        </Card>
      </div>

      <Modal open={qr} onClose={() => setQr(false)} title="اسکن با اپ WireGuard" icon={QrCode}>
        <QR text={conf} />
        <p className="mt-4 text-center text-xs leading-6 text-silver">
          توی اپ WireGuard روی <Mono>+</Mono> بزن و «Scan from QR code» رو انتخاب کن. این کد شامل کلید خصوصیته؛ اسکرین‌شاتش رو برای کسی نفرست.
        </p>
      </Modal>
      <Modal
        open={reset} onClose={() => !busy && setReset(false)} title="کلید اتصال ریست بشه؟" icon={CircleAlert}
        footer={<><Btn variant="ghost" onClick={() => setReset(false)} disabled={busy}>نه، بی‌خیال</Btn><Btn variant="danger" busy={busy} onClick={doReset}>آره، کلید جدید بساز</Btn></>}
      >
        <p className="text-sm leading-7 text-silver">با این کار کانفیگ فعلی روی همه دستگاه‌هات از کار می‌افته و باید کانفیگ جدید رو دوباره وارد کنی. حجم و زمان اشتراکت تغییری نمی‌کنه.</p>
      </Modal>
    </div>
  );
}

/* ───────────────────────── Smart DNS ───────────────────────── */

function SmartDns() {
  const { s, set, toast, log } = useStore();
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
      .catch(() => alive && setDetected({ ip: '5.160.27.118', real: false }))
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctl.abort(); };
  }, []);

  const full = s.dnsIps.length >= s.dnsSlots;
  const register = (ip, label) => {
    if (!isIPv4(ip)) return setErr('این آی‌پی معتبر نیست.');
    if (isPrivate(ip)) return setErr('آی‌پی داخلی قبول نیست؛ آی‌پی عمومی اینترنتت رو وارد کن.');
    if (s.dnsIps.some((x) => x.ip === ip)) return setErr('این آی‌پی قبلاً ثبت شده.');
    if (full) return setErr(`سقف ${fa(s.dnsSlots)} آی‌پی پره. اول یکی رو حذف کن.`);
    setErr('');
    setBusy(true);
    setTimeout(() => {
      set((p) => ({ dnsIps: [{ ip, label, at: Date.now() }, ...p.dnsIps] }));
      log('dns', 'info', `POST /rest/ip/firewall/address-list/add list=doping-dns-allowed address=${ip}`, 'Arash_AWP', ip);
      setBusy(false);
      setManual('');
      toast('آی‌پی توی فایروال ثبت شد. DNS تا ۳۰ ثانیه دیگه برات جواب می‌ده.');
    }, 1000);
  };
  const already = detected.ip && s.dnsIps.some((x) => x.ip === detected.ip);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card red className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Globe className="size-4 text-brand2" /> ثبت آی‌پی برای DNS</h3>
        <p className="mt-2 text-xs leading-6 text-silver">DNS دوپینگ فقط به آی‌پی‌های ثبت‌شده جواب می‌ده. هر بار آی‌پی اینترنتت عوض شد، همین دکمه رو بزن.</p>
        <div className="mt-4 well p-4 text-center">
          <div className="text-xs text-silver">آی‌پی عمومی فعلی تو</div>
          <Mono className="mt-2 block text-2xl font-bold">{detected.ip ?? '…'}</Mono>
          {detected.ip && !detected.real && <div className="mt-1 text-[11px] text-zinc-500">آی‌پی نمونه (تشخیص خودکار در این محیط در دسترس نیست)</div>}
        </div>
        <Btn size="lg" className="mt-4 w-full" icon={ShieldCheck} busy={busy} disabled={!detected.ip || already} onClick={() => register(detected.ip, 'ثبت خودکار')}>
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
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[['Primary DNS', DNS.primary], ['Secondary DNS', DNS.secondary]].map(([l, v]) => (
              <div key={l} className="flex items-center gap-2 well py-1.5 ps-3 pe-1.5">
                <div className="min-w-0 flex-1">
                  <Mono className="block text-[10px] text-zinc-500">{l}</Mono>
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
            <Badge tone={full ? 'warn' : 'mute'}><Mono>{s.dnsIps.length}/{s.dnsSlots}</Mono> اسلات</Badge>
          </div>
          <ul className="mt-3 space-y-2">
            {s.dnsIps.map((x) => (
              <li key={x.ip} className="flex items-center gap-3 well px-3 py-2">
                <Dot />
                <div className="min-w-0 flex-1">
                  <Mono className="block text-sm font-bold">{x.ip}</Mono>
                  <span className="block truncate text-[11px] text-zinc-500">{x.label} · address-list: <Mono>doping-dns-allowed</Mono></span>
                </div>
                <button
                  type="button" aria-label={`حذف ${x.ip}`} className="grid size-8 place-items-center rounded-lg text-silver hover:bg-red-500/15 hover:text-red-300"
                  onClick={() => { set((p) => ({ dnsIps: p.dnsIps.filter((y) => y.ip !== x.ip) })); log('dns', 'info', `DELETE /rest/ip/firewall/address-list address=${x.ip}`, 'Arash_AWP', x.ip); toast('آی‌پی از فایروال حذف شد.', 'warn'); }}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {!s.dnsIps.length && <li className="border border-dashed border-white/20 p-5 text-center text-xs text-silver">هنوز آی‌پی‌ای ثبت نکردی. تا ثبت نکنی DNS جواب نمی‌ده.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── VIP / Steam ───────────────────────── */

function Vip() {
  const { s, me, set, toast, log } = useStore();
  const [val, setVal] = useState(s.steamId ?? '');
  const [err, setErr] = useState('');
  const pro = me.plan === 'pro';
  const link = () => {
    if (!/^7656119\d{10}$/.test(val.trim())) return setErr('SteamID64 باید ۱۷ رقم باشه و با 7656119 شروع بشه.');
    setErr('');
    set({ steamId: val.trim() });
    log('rcon', 'info', `sm_reloadadmins · VIP sync ${val.trim()}`, 'panel', '10.0.0.4');
    toast('اکانت Steam وصل شد و روی سرورها سینک شد.');
  };
  const PERKS = [
    ['slot', 'اسلات رزرو', 'حتی وقتی سرور پره وارد می‌شی.'],
    ['tag', 'تگ [DOPING VIP]', 'تگ قرمز کنار اسمت توی چت و اسکوربرد.'],
    ['skins', 'اسکین و چاقو (!ws / !knife)', 'انتخاب اسکین دلخواه روی سرورهای دوپینگ.'],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Link2 className="size-4 text-brand2" /> اتصال اکانت Steam</h3>
        <p className="mt-2 text-xs leading-6 text-silver">امتیازهای VIP با SteamID64 شناخته می‌شن. آیدی ۱۷ رقمیت رو از پروفایل Steam یا سایت <Mono>steamid.io</Mono> بردار.</p>
        {s.steamId ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
            <span className="bg-brand-grad grid size-11 shrink-0 place-items-center rounded-xl text-lg font-black">A</span>
            <div className="min-w-0 flex-1">
              <Mono className="block truncate font-bold">Arash_AWP</Mono>
              <Mono className="block truncate text-xs text-silver">{s.steamId}</Mono>
            </div>
            <Btn variant="danger" size="sm" icon={Unlink} onClick={() => { set({ steamId: null }); setVal(''); toast('اتصال Steam برداشته شد.', 'warn'); }}>قطع اتصال</Btn>
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
                checked={pro && !!s.steamId && s.perks[key]}
                onChange={(v) => {
                  if (!pro) return toast('این امتیاز فقط با پکیج پرو فعاله.', 'warn');
                  if (!s.steamId) return toast('اول اکانت Steam رو وصل کن.', 'warn');
                  set((p) => ({ perks: { ...p.perks, [key]: v } }));
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
  const { s, set, toast, invoice, log } = useStore();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(100_000);
  const gws = s.gateways.filter((g) => g.enabled);
  const [gw, setGw] = useState(gws[0]?.id);
  const [busy, setBusy] = useState(false);
  const valid = amount >= 20_000 && amount <= 5_000_000;
  const pay = () => {
    setBusy(true);
    setTimeout(() => {
      const name = gws.find((g) => g.id === gw).name;
      set((p) => ({ wallet: p.wallet + amount }));
      invoice('شارژ کیف پول', amount, name);
      log('payment', 'info', `${gw} verify OK · wallet +${amount.toLocaleString('en-US')} T`, 'Arash_AWP', '5.160.14.92');
      setBusy(false);
      setOpen(false);
      toast(`کیف پول ${toman(amount)} شارژ شد.`);
    }, 1400);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
      <Card red className="flex flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs text-silver"><Wallet className="size-4" /> موجودی کیف پول</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-4xl leading-none font-black">{fa(s.wallet)}</span><span className="text-silver">تومان</span>
        </div>
        <p className="mt-3 text-xs leading-6 text-silver">با کیف پول، تمدید و خرید حجم اضافه یک‌کلیکی انجام می‌شه.</p>
        <Btn className="mt-auto" icon={Plus} onClick={() => setOpen(true)}>افزایش موجودی</Btn>
      </Card>
      <Card className="min-w-0 p-5">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black"><Receipt className="size-4 text-brand2" /> تاریخچه فاکتورها</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-xs text-silver">
              <tr className="border-b border-white/8 text-start">
                {['شماره', 'شرح', 'مبلغ', 'درگاه', 'وضعیت'].map((h) => <th key={h} className="px-2 py-2 text-start font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.invoices.map((i) => (
                <tr key={i.id + i.at} className="border-b border-white/5">
                  <td className="px-2 py-2.5"><Mono className="text-xs">{i.id}</Mono></td>
                  <td className="px-2 py-2.5"><div className="font-bold">{i.title}</div><div className="text-[11px] text-zinc-500">{faDate(i.at)}</div></td>
                  <td className="px-2 py-2.5 whitespace-nowrap">{toman(i.amount)}</td>
                  <td className="px-2 py-2.5 text-xs text-silver">{i.gateway}</td>
                  <td className="px-2 py-2.5"><Badge tone={i.status === 'paid' ? 'ok' : 'bad'}>{i.status === 'paid' ? 'پرداخت شده' : 'ناموفق'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        open={open} onClose={() => !busy && setOpen(false)} title="افزایش موجودی کیف پول" icon={Wallet}
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)} disabled={busy}>انصراف</Btn><Btn busy={busy} disabled={!valid || !gw} onClick={pay}>پرداخت {toman(amount || 0)}</Btn></>}
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
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
  const { s, set, toast } = useStore();
  const [sel, setSel] = useState(s.tickets[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: '', dept: 'فنی', text: '' });
  const [reply, setReply] = useState('');
  const t = s.tickets.find((x) => x.id === sel);
  const ok = form.subject.trim().length >= 5 && form.text.trim().length >= 10;

  const create = () => {
    const id = `T-${2300 + s.tickets.length}`;
    set((p) => ({ tickets: [{ id, subject: form.subject.trim(), dept: form.dept, status: 'open', at: Date.now(), msgs: [{ from: 'me', at: Date.now(), text: form.text.trim() }] }, ...p.tickets] }));
    setSel(id);
    setCreating(false);
    setForm({ subject: '', dept: 'فنی', text: '' });
    toast('تیکت ثبت شد. میانگین زمان پاسخ: ۲۰ دقیقه.');
  };
  const send = () => {
    if (!reply.trim()) return;
    set((p) => ({ tickets: p.tickets.map((x) => (x.id === sel ? { ...x, status: 'open', msgs: [...x.msgs, { from: 'me', at: Date.now(), text: reply.trim(), id: uid() }] } : x)) }));
    setReply('');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2.5 text-[15px] font-black"><LifeBuoy className="size-4 text-brand2" /> تیکت‌های پشتیبانی</h3>
          <Btn size="sm" icon={Plus} onClick={() => setCreating(true)}>تیکت جدید</Btn>
        </div>
        <ul className="mt-3 space-y-2">
          {s.tickets.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setSel(x.id)} className={cx('w-full relative rounded-2xl p-3 text-start transition', sel === x.id ? 'glass-red' : 'well hover:bg-white/[0.04]')}>
                <div className="flex items-center justify-between gap-2">
                  <Mono className="text-[11px] text-silver">{x.id}</Mono>
                  <Badge tone={T_STATUS[x.status][1]}>{T_STATUS[x.status][0]}</Badge>
                </div>
                <div className="mt-1 truncate text-sm font-bold">{x.subject}</div>
                <div className="text-[11px] text-zinc-500">واحد {x.dept} · {faDate(x.at)}</div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex min-h-[360px] min-w-0 flex-col p-5">
        {t ? (
          <>
            <div className="border-b border-white/[0.07] pb-4">
              <div className="font-black">{t.subject}</div>
              <div className="text-xs text-silver"><Mono>{t.id}</Mono> · واحد {t.dept}</div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {t.msgs.map((m, i) => (
                <div key={i} className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-7', m.from === 'me' ? 'bg-brand/20' : 'ms-auto border border-white/8 bg-white/[0.04]')}>
                  <div className="mb-0.5 text-[11px] font-bold text-silver">{m.from === 'me' ? 'تو' : 'پشتیبانی دوپینگ'}</div>
                  {m.text}
                </div>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input id="ticket-reply" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پیامت رو بنویس…" className="field" />
              <Btn type="submit" icon={Send} disabled={!reply.trim()}>ارسال</Btn>
            </form>
          </>
        ) : (
          <div className="m-auto text-center text-sm text-silver">تیکتی انتخاب نشده.</div>
        )}
      </Card>
      <Modal
        open={creating} onClose={() => setCreating(false)} title="تیکت جدید" icon={LifeBuoy}
        footer={<><Btn variant="ghost" onClick={() => setCreating(false)}>انصراف</Btn><Btn icon={Send} disabled={!ok} onClick={create}>ثبت تیکت</Btn></>}
      >
        <div className="space-y-4">
          <Field label="موضوع"><input id="tk-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="مثلاً: پینگ بالا روی Valorant" className="field" /></Field>
          <Field label="واحد">
            <select id="tk-dept" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} className="field">
              {['فنی', 'مالی', 'سرورهای بازی'].map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="توضیح" hint="بازی، ساعت مشکل و خروجی انتخابی رو بنویس تا سریع‌تر حل بشه.">
            <textarea id="tk-text" rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className="field resize-none" />
          </Field>
        </div>
      </Modal>
    </div>
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
];

export default function UserPanel() {
  const { s, me } = useStore();
  const [tab, setTab] = useState('dash');
  const Current = TABS.find((t) => t.id === tab).C;
  return (
    <div className="gutter mx-auto max-w-6xl pt-10">
      <h1 className="text-2xl font-black">سلام آرش</h1>
      <p className="mt-1 text-sm text-zinc-500">پنل گیمر · <Mono>{me.email}</Mono></p>
      <RailLayout
        tabs={TABS} value={tab} onChange={setTab}
        foot={
          <div className="border-t border-line px-3 pt-4 text-xs text-zinc-500">
            <div className="flex items-center gap-2 font-bold text-zinc-300">{me.peer && me.online ? <><Dot /> تانل وصله</> : <><Dot tone="bad" /> تانل قطعه</>}</div>
            <Mono className="mt-1 block">{me.ip}/32 · THR-EDGE-01</Mono>
          </div>
        }
      >
        <Current setTab={setTab} />
      </RailLayout>
    </div>
  );
}
