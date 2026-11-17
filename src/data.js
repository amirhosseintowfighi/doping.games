// Seed data and helpers for the in-browser simulation layer.
// Public IPs below are documentation ranges (RFC 5737): replace them with your real nodes.
export const GB = 1024 ** 3;
export const MB = 1024 ** 2;
const DAY = 86_400_000;

export const fa = (n) => Number(n).toLocaleString('fa-IR');
export const toman = (n) => `${fa(n)} تومان`;
export const gb = (bytes, d = 2) => (bytes / GB).toFixed(d);
export const clock = (t = Date.now()) => new Date(t).toLocaleTimeString('en-GB', { hour12: false });
export const faDate = (t) => new Date(t).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
export const daysLeft = (t) => Math.max(0, Math.ceil((t - Date.now()) / DAY));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const rint = (a, b) => Math.round(rnd(a, b));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const uid = () => Math.random().toString(36).slice(2, 9);

/** 32 random bytes in base64: the same shape as a WireGuard key. */
export function wgKey() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}

export const isIPv4 = (s) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s);
export const isPrivate = (s) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(s);

export const DNS = { primary: '203.0.113.53', secondary: '198.51.100.53' };
export const WG = { endpoint: 'thr1.doping.games:51820', serverKey: 'k3Qx0bV9mT1dRz8uYpHnE6sWc4aJfL2oGi7tNvB5yUM=', allowed: '0.0.0.0/0', mtu: 1380 };

export const EXITS = [
  { id: 'mct', name: 'مسقط', country: 'عمان', code: 'MCT' },
  { id: 'dxb', name: 'دبی', country: 'امارات', code: 'DXB' },
  { id: 'fra', name: 'فرانکفورت', country: 'آلمان', code: 'FRA' },
];

// isp: a typical evening route on a home connection. via: measured-style targets per exit node [ping, loss%, jitter].
export const GAMES = [
  { id: 'cs2', cover: 'cs2', name: 'CS2', full: 'Counter-Strike 2', dc: 'Valve Dubai', isp: [145, 8, 24], via: { mct: [28, 0, 2], dxb: [31, 0, 2], fra: [78, 0, 3] } },
  { id: 'fc26', cover: 'fc26', name: 'FC 26', full: 'EA SPORTS FC 26', dc: 'EA Bahrain', isp: [132, 6, 19], via: { mct: [34, 0, 2], dxb: [29, 0, 2], fra: [74, 0, 3] } },
  { id: 'val', cover: 'valorant', name: 'Valorant', full: 'VALORANT', dc: 'Riot Bahrain', isp: [118, 5, 17], via: { mct: [32, 0, 2], dxb: [26, 0, 1], fra: [81, 0, 3] } },
  { id: 'dota', cover: 'dota2', name: 'Dota 2', full: 'Dota 2', dc: 'Valve Dubai', isp: [156, 7, 26], via: { mct: [27, 0, 2], dxb: [30, 0, 2], fra: [76, 0, 3] } },
  { id: 'wz', cover: 'warzone', name: 'Warzone', full: 'Call of Duty: Warzone', dc: 'Activision ME', isp: [168, 9, 31], via: { mct: [41, 0, 3], dxb: [38, 0, 3], fra: [69, 0, 3] } },
];

/** Home connections, with how far each one's evening route to the Gulf runs from the average. Estimates. */
export const ISPS = [
  { id: 'mci', name: 'همراه اول', k: 1.0, loss: 1 },
  { id: 'irancell', name: 'ایرانسل', k: 1.08, loss: 2 },
  { id: 'tci', name: 'مخابرات', k: 0.96, loss: 0 },
  { id: 'shatel', name: 'شاتل', k: 0.92, loss: 0 },
  { id: 'asiatech', name: 'آسیاتک', k: 0.9, loss: -1 },
  { id: 'rightel', name: 'رایتل', k: 1.15, loss: 3 },
];

export const CS2_MAPS = ['de_mirage', 'de_dust2', 'de_inferno', 'de_nuke', 'de_ancient', 'de_anubis', 'de_overpass', 'de_train'];
export const MODES = [
  { id: 'all', label: 'همه' },
  { id: 'retake', label: 'CS2 Retake' },
  { id: '5v5', label: 'CS2 5v5' },
  { id: 'dm', label: 'CS2 Deathmatch' },
  { id: 'aim', label: 'Aim Map' },
  { id: 'rust', label: 'Rust' },
  { id: 'mc', label: 'Minecraft' },
];
const NICKS = ['Arash_AWP', 'SiNa-', 'mmd.exe', 'Kian1v9', 'PARSA', 'Hirad.', 'amirTap', 'Nima_GG', 's1mple_tehran', 'Dr.Headshot', 'Shayan', 'rezaNT', 'ArminK', 'BaRdiA', 'Pouya_x', 'Mahan', 'Sepehr.', 'danial7', 'ErfanCT', 'TahaZ', 'Ali_Entry', 'yasin', 'MoeinRush', 'Kasra', 'Benyamin', 'omidLurk', 'Sam1', 'ArtinFPS', 'Radin', 'mehdi_B', 'HosseinOP', 'Soroush', 'Farzad', 'iLia', 'AyDiN', 'peyman', 'RaminAK', 'Navid', 'saeedM4', 'vahid'];
export const roster = (n) => [...NICKS].sort(() => Math.random() - 0.5).slice(0, n).map((name) => ({ name, k: rint(0, 28), d: rint(0, 22), ping: rint(6, 48) }));

const srv = (id, name, game, mode, map, players, max, ping, tick, host, port, vip = false) => ({
  id, name, game, mode, map, players, max, ping, tick, host, port, vip, ac: game === 'CS2' ? 'Doping AC + VAC' : game === 'Rust' ? 'EAC' : 'Grim AC', status: 'online', list: roster(players),
});
export const seedServers = () => [
  srv('s1', 'Doping Retake #1 | Tehran', 'CS2', 'retake', 'de_mirage', 18, 20, 12, 'Sub-tick 64', 'retake1.doping.games', 27015),
  srv('s2', 'Doping Retake #2 | VIP', 'CS2', 'retake', 'de_inferno', 9, 10, 11, 'Sub-tick 64', 'retake2.doping.games', 27015, true),
  srv('s3', 'Doping 5v5 Competitive #1', 'CS2', '5v5', 'de_dust2', 10, 10, 14, 'Sub-tick 64', 'comp1.doping.games', 27015),
  srv('s4', 'Doping 5v5 Competitive #2', 'CS2', '5v5', 'de_ancient', 7, 10, 13, 'Sub-tick 64', 'comp2.doping.games', 27016),
  srv('s5', 'Doping FFA Deathmatch | HS Only', 'CS2', 'dm', 'de_dust2', 22, 24, 12, 'Sub-tick 64', 'dm.doping.games', 27015),
  srv('s6', 'Doping Aim | aim_botz + 1v1', 'CS2', 'aim', 'aim_redline', 6, 16, 10, 'Sub-tick 64', 'aim.doping.games', 27015),
  srv('s7', 'Doping Rust | 2x Monthly Wipe', 'Rust', 'rust', 'Procedural 4000', 64, 150, 16, '30 FPS Server', 'rust.doping.games', 28015),
  srv('s8', 'Doping Craft | Survival 1.21', 'Minecraft', 'mc', 'world_survival', 37, 100, 15, '20 TPS', 'mc.doping.games', 25565),
];

const rtr = (id, name, role, city, host, cpu, ram, peers, queues, model) => ({
  id, name, role, city, host, apiPort: 8443, apiUser: 'doping-api', version: '7.19.4', model, cpu, ram, peers, queues,
  handshake: rint(4, 90), wg: role === 'entry' ? 'wg-doping' : 'wg-backbone', subnet: role === 'entry' ? `10.10.${id === 'r1' ? 10 : 20}.0/24` : '172.16.50.0/29',
  status: 'online', lastSync: Date.now() - rint(20, 280) * 1000, uptime: `${rint(11, 96)}d`,
});
export const seedRouters = () => [
  rtr('r1', 'THR-EDGE-01', 'entry', 'تهران · آسیاتک', '203.0.113.11', 34, 41, 212, 212, 'CCR2116-12G-4S+'),
  rtr('r2', 'SHZ-EDGE-02', 'entry', 'شیراز · پارس‌آنلاین', '203.0.113.27', 21, 33, 97, 97, 'CCR2004-16G-2S+'),
  rtr('r3', 'MCT-EXIT-01', 'exit', 'مسقط · عمان', '198.51.100.14', 47, 52, 2, 0, 'CHR P10'),
  rtr('r4', 'DXB-EXIT-01', 'exit', 'دبی · امارات', '198.51.100.62', 39, 44, 2, 0, 'CHR P10'),
  rtr('r5', 'FRA-EXIT-01', 'exit', 'فرانکفورت · آلمان', '192.0.2.80', 18, 29, 2, 0, 'CHR P1'),
];

const usr = (n, username, plan, quotaGb, upGb, downGb, days, status = 'active') => ({
  id: `u${n}`, username, email: `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`, plan, ip: `10.10.10.${n + 1}`,
  quota: quotaGb == null ? null : quotaGb * GB, up: upGb * GB, down: downGb * GB, expires: Date.now() + days * DAY,
  status, peer: status === 'active', router: 'r1', pubkey: wgKey(), peerId: `*${(0x1a + n).toString(16).toUpperCase()}`, queueId: `*${(0x4c + n).toString(16).toUpperCase()}`,
  online: status === 'active' && Math.random() > 0.3,
});
export const seedUsers = () => [
  usr(1, 'Arash_AWP', 'pro', 15, 0.61, 2.97, 19),
  usr(2, 'SiNa_Entry', 'ping', 30, 2.1, 21.4, 11),
  usr(3, 'mmd.exe', 'ping', 15, 1.9, 13.02, 6),
  usr(4, 'Kian1v9', 'pro', null, 9.4, 88.2, 54),
  usr(5, 'ParsaLurk', 'ping', 50, 3.3, 30.9, 23),
  usr(6, 'HiradTap', 'ping', 15, 2.2, 12.8, 3, 'quota'),
  usr(7, 'NimaGG', 'dns', null, 0, 0, 27),
  usr(8, 'DrHeadshot', 'pro', 100, 6.8, 49.5, 71),
  usr(9, 'ShayanRush', 'ping', 30, 1.2, 8.8, -2, 'expired'),
  usr(10, 'RezaNT', 'ping', 50, 4.4, 37.1, 15),
  usr(11, 'ArminK', 'pro', 30, 0.4, 3.1, 28),
  usr(12, 'Bardia_M4', 'ping', 15, 0.9, 6.6, 9, 'disabled'),
  usr(13, 'PouyaX', 'ping', 100, 8.1, 70.3, 40),
  usr(14, 'MahanFPS', 'pro', 50, 2.7, 19.9, 33),
];

export const TIERS = [15, 30, 50, 100, 'inf'];
export const tierLabel = (t) => (t === 'inf' ? 'نامحدود' : `${fa(t)} گیگ`);
export const seedPricing = () => ({
  ping: { 15: 69_000, 30: 119_000, 50: 179_000, 100: 299_000, inf: 449_000 },
  dns: { 1: 39_000, 2: 59_000, 3: 79_000, 5: 109_000 },
  proMul: 1.35,
  dur: { 1: 0, 3: 10, 6: 18 },
  extraPerGb: 5_000,
});
const round = (n) => Math.round(n / 1000) * 1000;
export function priceOf(pricing, { kind, tier, slots, months }) {
  const base = kind === 'dns' ? pricing.dns[slots] : pricing.ping[tier];
  const monthly = kind === 'pro' ? round(base * pricing.proMul) : base;
  const off = pricing.dur[months];
  const gross = monthly * months;
  return { monthly, gross, off, total: round(gross * (1 - off / 100)) };
}
export const PLAN_NAME = { ping: 'کاهش پینگ', dns: 'DNS ضد تحریم', pro: 'پکیج پرو' };

export const seedDiscounts = () => [
  { id: 'd1', code: 'DOPING20', percent: 20, used: 143, max: 500, active: true },
  { id: 'd2', code: 'MAJOR2026', percent: 30, used: 88, max: 100, active: true },
  { id: 'd3', code: 'YALDA', percent: 15, used: 300, max: 300, active: false },
];
export const seedGateways = () => [
  { id: 'zarinpal', name: 'زرین‌پال', kind: 'ریالی · شتاب', enabled: true, fee: 0, key: 'merchant ••••-4f1c' },
  { id: 'nextpay', name: 'نکست‌پی', kind: 'ریالی · پشتیبان', enabled: true, fee: 0, key: 'api_key ••••-a920' },
  { id: 'tron', name: 'Tron / USDT (TRC-20)', kind: 'رمزارز', enabled: true, fee: 0, key: 'TQ7v••••••••k9Lp' },
];

export const seedInvoices = () => [
  { id: 'INV-48213', at: Date.now() - 11 * DAY, title: 'پکیج پرو · ۱۵ گیگ · ۱ ماهه', amount: 93_000, gateway: 'زرین‌پال', status: 'paid' },
  { id: 'INV-47102', at: Date.now() - 24 * DAY, title: 'شارژ کیف پول', amount: 200_000, gateway: 'زرین‌پال', status: 'paid' },
  { id: 'INV-45877', at: Date.now() - 41 * DAY, title: 'کاهش پینگ · ۱۵ گیگ · ۱ ماهه', amount: 69_000, gateway: 'Tron / USDT', status: 'paid' },
  { id: 'INV-45870', at: Date.now() - 41 * DAY, title: 'کاهش پینگ · ۱۵ گیگ · ۱ ماهه', amount: 69_000, gateway: 'زرین‌پال', status: 'failed' },
];
export const seedTickets = () => [
  {
    id: 'T-2291', subject: 'پکت لاس روی سرور Retake #1 ساعت ۲۲', dept: 'فنی', status: 'answered', at: Date.now() - 2 * DAY,
    msgs: [
      { from: 'me', at: Date.now() - 2 * DAY, text: 'سلام. دیشب حدود ساعت ۲۲ روی Retake #1 حدود ۳٪ لاس داشتم. با تانل مسقط وصل بودم.' },
      { from: 'support', at: Date.now() - 2 * DAY + 2_400_000, text: 'سلام آرش جان. همون ساعت لینک بک‌بون مسقط اشباع شده بود و ترافیک رو روی دبی بالانس کردیم. الان مسیرت رو چک کن؛ اگه باز لاس دیدی خروجی mtr رو بفرست.' },
    ],
  },
];

const L = (ago, type, level, msg, actor, ip) => ({ id: uid(), at: Date.now() - ago * 1000, type, level, msg, actor, ip });
export const seedLogs = () => [
  L(14, 'mikrotik', 'info', 'GET /rest/queue/simple → 200 (212 queues, 184ms)', 'quota-worker', '10.0.0.5'),
  L(52, 'auth', 'info', 'ورود موفق', 'Arash_AWP', '5.160.14.92'),
  L(95, 'dns', 'info', 'address-list add doping-dns-allowed 5.160.14.92', 'Arash_AWP', '5.160.14.92'),
  L(170, 'auth', 'warn', 'ورود ناموفق (۳ از ۵) · رمز اشتباه', 'kian1v9@gmail.com', '151.238.61.7'),
  L(260, 'payment', 'info', 'zarinpal verify code=100 · INV-48213 · اعتبار اعمال شد', 'Arash_AWP', '5.160.14.92'),
  L(262, 'payment', 'warn', 'zarinpal callback تکراری · INV-48213 · بدون اعتبار مجدد (idempotent)', 'Arash_AWP', '5.160.14.92'),
  L(410, 'mikrotik', 'warn', 'PATCH /rest/interface/wireguard/peers/*20 disabled=true · اتمام حجم', 'quota-worker', '10.0.0.5'),
  L(640, 'auth', 'critical', 'rate limit: ۵ تلاش ورود در ۱۵ دقیقه · مسدود شد', 'unknown', '45.82.13.201'),
  L(900, 'rcon', 'info', 'changelevel de_mirage · Doping Retake #1', 'admin', '10.0.0.2'),
  L(1300, 'auth', 'critical', 'rbac.denied · POST /api/admin/users/…/traffic با نقش USER', 'ShayanRush', '2.181.40.6'),
];

/** Everything an admin can change from «تنظیمات سایت». `{nodes}` and `{online}` in a stat value are filled live. */
export const seedSite = () => ({
  hero: {
    line1: 'پینگت رو', accent: 'دوپینگ', line2: 'کن.',
    desc: 'مسیر اختصاصی از ایران تا سرور بازی، از طریق عمان، امارات و اروپا. پینگ پایین، بدون پکت لاس، بدون تحریم.',
    cta1: 'خرید سرویس', cta2: 'سرورهای CS2',
  },
  stats: [
    { value: '28ms', label: 'میانگین پینگ CS2' },
    { value: '0%', label: 'پکت لاس روی تانل' },
    { value: '{nodes}', label: 'نود در ایران و خارج' },
    { value: '{online}', label: 'گیمر آنلاین روی سرورها' },
  ],
  show: { games: true, calculator: true, servers: true, pricing: true, faq: true, cta: true },
  text: {
    games: { label: 'بازی‌های تحت پوشش', title: 'هر بازی، مسیر خودش.', desc: 'برای هر بازی نزدیک‌ترین خروجی به دیتاسنتر همون بازی انتخاب می‌شه.' },
    calculator: { label: 'محاسبه‌گر حجم', title: 'چقدر حجم لازم داری؟', desc: 'بازی‌هات و ساعت بازی رو انتخاب کن تا پلن مناسب رو پیشنهاد بدیم.' },
    servers: { label: 'سرورهای بازی دوپینگ', title: 'سرور CS2، داخل ایران.', desc: 'Sub-tick، آنتی‌چیت و پینگ زیر ۱۵ روی نود داخلی. برای اتصال، Steam باید باز باشه.' },
    pricing: { label: 'فروشگاه سرویس‌ها', title: 'پلنت رو انتخاب کن.', desc: 'فعال‌سازی آنی. هر وقت حجم کم آوردی، از پنل ترافیک مازاد بخر.' },
    faq: { label: 'پرسش‌های پرتکرار', title: 'سؤالی داری؟', desc: 'جواب سؤال‌هایی که بیشتر از همه قبل از خرید پرسیده می‌شه.' },
    cta: { label: '', title: 'آماده‌ای؟ بزن بریم.', desc: 'پلن رو بگیر، کانفیگ رو وارد کن و برو توی لابی.' },
  },
  // mb: typical in-match traffic per hour (estimate), used by the traffic calculator.
  games: [
    ['Counter-Strike 2', 145, 28, 'cs2', 90], ['VALORANT', 118, 26, 'valorant', 100], ['EA SPORTS FC 26', 132, 29, 'fc26', 80],
    ['Dota 2', 156, 27, 'dota2', 60], ['Warzone', 168, 38, 'warzone', 200], ['Apex Legends', 141, 36, 'apex', 140],
    ['PUBG', 127, 33, 'pubg', 130], ['Fortnite', 152, 58, 'fortnite', 120], ['Rust', 96, 16, 'rust', 160], ['Minecraft', 88, 15, 'minecraft', 50],
  ].map(([name, isp, dp, cover, mb]) => ({ id: uid(), name, isp, dp, cover, mb })),
  faq: [
    ['دوپینگ با فیلترشکن چه فرقی داره؟', 'دوپینگ فقط ترافیک بازی رو از یک مسیر اختصاصی و کوتاه‌تر رد می‌کنه تا پینگ و پکت لاس کم بشه. برای وب‌گردی ساخته نشده و سایت‌های داخلی هم بدون تغییر کار می‌کنن.'],
    ['حجمم تموم بشه چی می‌شه؟', 'اتصال تانل تا خرید حجم متوقف می‌شه. از پنل می‌تونی ترافیک مازاد بخری یا یک‌کلیکی تمدید کنی؛ همون لحظه دوباره وصل می‌شی.'],
    ['روی کنسول هم کار می‌کنه؟', 'DNS ضد تحریم روی PS5 و Xbox مستقیم تنظیم می‌شه. برای کاهش پینگ روی کنسول، کانفیگ WireGuard رو روی روترت بذار.'],
    ['آی‌پی اینترنتم عوض بشه DNS قطع می‌شه؟', 'آره، چون DNS فقط به آی‌پی‌های ثبت‌شده جواب می‌ده. توی پنل دکمه «ثبت آی‌پی فعلی من» رو بزن تا دوباره کار کنه.'],
    ['روی چند دستگاه می‌تونم وصل بشم؟', 'هر اشتراک یک کانفیگ داره. اگه روی دستگاه دیگه‌ای جا مونده، کلید رو از پنل ریست کن.'],
  ].map(([q, a]) => ({ id: uid(), q, a })),
  feats: {
    ping: ['تانل WireGuard اختصاصی', 'خروجی عمان، امارات، اروپا', 'ویندوز، موبایل و روتر'],
    dns: ['رفع تحریم Steam، Riot، EA', 'ثبت آی‌پی با یک کلیک', 'مناسب کنسول و PC'],
    pro: ['همه امکانات کاهش پینگ', 'DNS ضد تحریم با ۲ آی‌پی', 'اسلات رزرو و تگ VIP در CS2'],
  },
  dns: { ...DNS },
  wg: { ...WG },
  accent: '#E60012',
  motion: true,
  footer: 'دوپینگ، شبکه گیمینگ ایران',
});

/** Validates a site config. Returns { 'path': 'message' }; empty object means valid. */
export function validateSite(c) {
  const e = {};
  const need = (k, v, n = 1) => { if (String(v ?? '').trim().length < n) e[k] = 'این فیلد نباید خالی باشه.'; };
  need('hero.accent', c.hero.accent); need('hero.cta1', c.hero.cta1); need('hero.cta2', c.hero.cta2);
  if (!c.hero.line1.trim() && !c.hero.line2.trim() && !c.hero.accent.trim()) e['hero.line1'] = 'تیتر نباید خالی باشه.';
  c.stats.forEach((x, i) => { need(`stats.${i}.value`, x.value); need(`stats.${i}.label`, x.label); });
  c.games.forEach((g, i) => {
    need(`games.${i}.name`, g.name);
    if (!(g.isp > 0 && g.isp < 1000)) e[`games.${i}.isp`] = 'بین ۱ تا ۹۹۹';
    if (!(g.dp > 0 && g.dp < 1000)) e[`games.${i}.dp`] = 'بین ۱ تا ۹۹۹';
    if (!(g.mb > 0 && g.mb <= 2000)) e[`games.${i}.mb`] = 'بین ۱ تا ۲۰۰۰';
    if (g.cover && !/^[a-z0-9]{2,16}$/.test(g.cover) && !/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(g.cover)) e[`games.${i}.cover`] = 'تصویر کاور معتبر نیست.';
  });
  c.faq.forEach((f, i) => { need(`faq.${i}.q`, f.q, 3); need(`faq.${i}.a`, f.a, 3); });
  for (const k of ['primary', 'secondary']) if (!isIPv4(c.dns[k])) e[`dns.${k}`] = 'آی‌پی نسخه ۴ معتبر وارد کن.';
  if (!/^[a-z0-9.-]+:\d{2,5}$/i.test(c.wg.endpoint) || +c.wg.endpoint.split(':')[1] > 65535) e['wg.endpoint'] = 'به شکل host:port وارد کن.';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(c.wg.serverKey)) e['wg.serverKey'] = 'کلید عمومی WireGuard باید ۴۴ کاراکتر base64 باشه.';
  if (!/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}(\s*,\s*(\d{1,3}\.){3}\d{1,3}\/\d{1,2})*$/.test(c.wg.allowed)) e['wg.allowed'] = 'مثل 0.0.0.0/0 یا چند CIDR با ویرگول.';
  if (!(+c.wg.mtu >= 1280 && +c.wg.mtu <= 1500)) e['wg.mtu'] = 'بین 1280 تا 1500';
  if (!/^#[0-9a-f]{6}$/i.test(c.accent)) e.accent = 'کد رنگ مثل #E60012';
  return e;
}

/**
 * Brings settings saved by an older build up to date: new sections and texts get their defaults,
 * and games saved before covers existed get a cover guessed from their name.
 */
export function migrateSite(saved, base, guess) {
  const next = { ...base, ...saved };
  next.show = { ...base.show, ...saved.show };
  next.text = { ...base.text, ...saved.text };
  next.hero = { ...base.hero, ...saved.hero };
  next.games = (saved.games ?? base.games).map((g) => ({ mb: 100, ...g, cover: g.cover ?? guess(g.name) }));
  return next;
}

/** Smallest plan that covers the estimate with 20% headroom. */
export function recommendTier(gbPerMonth) {
  return [15, 30, 50, 100].find((t) => gbPerMonth * 1.2 <= t) ?? 'inf';
}
