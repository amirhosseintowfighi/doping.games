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
/**
 * Default games. Every game is editable from Admin → «تنظیمات سایت» → «بازی‌ها».
 * isp / loss / jitter: an ordinary evening route; via: ping from each Doping exit node (all estimates).
 * featured: shown in the hero scene and the ping test (1–6 games).
 */
export const seedGames = () => [
  ['cs2', 'Counter-Strike 2', 'CS2', 'Valve Dubai', 145, 8, 24, { mct: 28, dxb: 31, fra: 78 }, 90, true],
  ['valorant', 'VALORANT', 'Valorant', 'Riot Bahrain', 118, 5, 17, { mct: 32, dxb: 26, fra: 81 }, 100, true],
  ['fc26', 'EA SPORTS FC 26', 'FC 26', 'EA Bahrain', 132, 6, 19, { mct: 34, dxb: 29, fra: 74 }, 80, true],
  ['dota2', 'Dota 2', 'Dota 2', 'Valve Dubai', 156, 7, 26, { mct: 27, dxb: 30, fra: 76 }, 60, true],
  ['warzone', 'Warzone', 'Warzone', 'Activision ME', 168, 9, 31, { mct: 41, dxb: 38, fra: 69 }, 200, true],
  ['apex', 'Apex Legends', 'Apex', 'EA Bahrain', 141, 6, 22, { mct: 36, dxb: 39, fra: 72 }, 140, false],
  ['pubg', 'PUBG', 'PUBG', 'KRAFTON Bahrain', 127, 5, 20, { mct: 33, dxb: 35, fra: 70 }, 130, false],
  ['fortnite', 'Fortnite', 'Fortnite', 'Epic Bahrain', 152, 7, 25, { mct: 58, dxb: 61, fra: 64 }, 120, false],
  ['rust', 'Rust', 'Rust', 'Doping Tehran', 96, 3, 14, { mct: 16, dxb: 18, fra: 44 }, 160, false],
  ['minecraft', 'Minecraft', 'Minecraft', 'Doping Tehran', 88, 2, 12, { mct: 15, dxb: 17, fra: 42 }, 50, false],
].map(([id, name, short, dc, isp, loss, jitter, via, mb, featured]) => ({ id, name, short, dc, cover: id, isp, loss, jitter, via, mb, featured }));

/** Lowest ping across the exit nodes. */
export const bestPing = (g) => Math.min(...Object.values(g.via));
/** The ping test and hero scene work with [ping, loss, jitter] triples. */
export const asTracked = (g) => ({
  id: g.id, cover: g.cover, name: g.short || g.name, full: g.name, dc: g.dc,
  isp: [g.isp, g.loss, g.jitter],
  via: Object.fromEntries(Object.entries(g.via).map(([k, v]) => [k, [v, 0, Math.max(1, Math.round(v / 15))]])),
});
export const trackedGames = (site) => site.games.filter((g) => g.featured).slice(0, 6).map(asTracked);


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

/** A traffic tier is its size in GB; `null` (shown as 'inf') is the unlimited, time-based plan. */
export const tierKey = (gb) => (gb == null ? 'inf' : gb);
export const tierLabel = (t) => (t === 'inf' || t == null ? 'نامحدود' : `${fa(t)} گیگ`);
export const seedPricing = () => ({
  ping: [[15, 69_000], [30, 119_000], [50, 179_000], [100, 299_000], [null, 449_000]].map(([gb, price]) => ({ id: `t${gb ?? 'inf'}`, gb, price })),
  dns: [[1, 39_000], [2, 59_000], [3, 79_000], [5, 109_000]].map(([slots, price]) => ({ id: `d${slots}`, slots, price })),
  durations: [[1, 0], [3, 10], [6, 18]].map(([months, off]) => ({ id: `m${months}`, months, off })),
  proMul: 1.35,
  extraPerGb: 5_000,
  popular: { ping: 30, dns: 2 },
});
export const pingTiers = (pricing) => [...pricing.ping].sort((a, b) => (a.gb ?? Infinity) - (b.gb ?? Infinity)).map((t) => tierKey(t.gb));
export const dnsSlots = (pricing) => [...pricing.dns].sort((a, b) => a.slots - b.slots).map((d) => d.slots);
export const durations = (pricing) => [...pricing.durations].sort((a, b) => a.months - b.months);
const round = (n) => Math.round(n / 1000) * 1000;
export function priceOf(pricing, { kind, tier, slots, months }) {
  const base = kind === 'dns'
    ? pricing.dns.find((d) => d.slots === slots)?.price ?? 0
    : (pricing.ping.find((t) => tierKey(t.gb) === tier) ?? pricing.ping[0])?.price ?? 0;
  const monthly = kind === 'pro' ? round(base * pricing.proMul) : base;
  const off = pricing.durations.find((d) => d.months === months)?.off ?? 0;
  const gross = monthly * months;
  return { monthly, gross, off, total: round(gross * (1 - off / 100)) };
}
export const PLAN_NAME = { ping: 'کاهش پینگ', dns: 'DNS ضد تحریم', pro: 'پکیج پرو' };
export const SECTION_KEYS = ['ping', 'games', 'calculator', 'servers', 'pricing', 'faq', 'cta'];

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
    pingLink: 'پینگ اینترنت خودت رو تست کن', sceneHint: 'روی خروجی‌ها بزن تا مسیر عوض بشه.',
  },
  banner: { on: false, text: 'تخفیف ۲۰٪ همه پلن‌ها با کد DOPING20 تا آخر هفته.' },
  stats: [
    { value: '28ms', label: 'میانگین پینگ CS2' },
    { value: '0%', label: 'پکت لاس روی تانل' },
    { value: '{nodes}', label: 'نود در ایران و خارج' },
    { value: '{online}', label: 'گیمر آنلاین روی سرورها' },
  ],
  show: { heroScene: true, ping: true, games: true, calculator: true, servers: true, pricing: true, faq: true, cta: true },
  order: [...SECTION_KEYS],
  text: {
    ping: {
      label: 'تست پینگ', title: 'قبل از خرید، تست کن.', desc: 'بازی، اینترنت و خروجی رو انتخاب کن تا ۲۴ نمونه پینگ از هر دو مسیر بگیریم و کنار هم ببینی.',
      items: [
        { k: 'پینگ', v: 'میانگین رفت‌وبرگشت تا سرور بازی' },
        { k: 'پکت لاس', v: 'بسته‌هایی که هیچ‌وقت نمی‌رسن' },
        { k: 'جیتر', v: 'نوسان پینگ بین بسته‌ها' },
      ],
    },
    games: { label: 'بازی‌های تحت پوشش', title: 'هر بازی، مسیر خودش.', desc: 'برای هر بازی نزدیک‌ترین خروجی به دیتاسنتر همون بازی انتخاب می‌شه.' },
    calculator: { label: 'محاسبه‌گر حجم', title: 'چقدر حجم لازم داری؟', desc: 'بازی‌هات و ساعت بازی رو انتخاب کن تا پلن مناسب رو پیشنهاد بدیم.' },
    servers: { label: 'سرورهای بازی دوپینگ', title: 'سرور CS2، داخل ایران.', desc: 'Sub-tick، آنتی‌چیت و پینگ زیر ۱۵ روی نود داخلی. برای اتصال، Steam باید باز باشه.' },
    pricing: { label: 'فروشگاه سرویس‌ها', title: 'پلنت رو انتخاب کن.', desc: 'فعال‌سازی آنی. هر وقت حجم کم آوردی، از پنل ترافیک مازاد بخر.' },
    faq: { label: 'پرسش‌های پرتکرار', title: 'سؤالی داری؟', desc: 'جواب سؤال‌هایی که بیشتر از همه قبل از خرید پرسیده می‌شه.' },
    cta: { label: '', title: 'آماده‌ای؟ بزن بریم.', desc: 'پلن رو بگیر، کانفیگ رو وارد کن و برو توی لابی.' },
  },
  games: seedGames(),
  pricing: seedPricing(),
  planNames: { ...PLAN_NAME },
  kinds: { ping: true, dns: true, pro: true },
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
  const range = (k, v, lo, hi) => { if (!(Number.isFinite(+v) && +v >= lo && +v <= hi)) e[k] = `بین ${fa(lo)} تا ${fa(hi)}`; };
  if (!c.games.length) e.games = 'حداقل یک بازی لازمه.';
  const featured = c.games.filter((g) => g.featured).length;
  if (c.games.length && (featured < 1 || featured > 6)) e['games.featured'] = 'بین ۱ تا ۶ بازی رو برای تست پینگ انتخاب کن.';
  c.games.forEach((g, i) => {
    need(`games.${i}.name`, g.name);
    need(`games.${i}.dc`, g.dc);
    range(`games.${i}.isp`, g.isp, 1, 999);
    range(`games.${i}.loss`, g.loss, 0, 100);
    range(`games.${i}.jitter`, g.jitter, 0, 300);
    range(`games.${i}.mb`, g.mb, 1, 2000);
    for (const x of ['mct', 'dxb', 'fra']) range(`games.${i}.via.${x}`, g.via?.[x], 1, 999);
    if (g.cover && !/^[a-z0-9]{2,16}$/.test(g.cover) && !/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(g.cover)) e[`games.${i}.cover`] = 'تصویر کاور معتبر نیست.';
  });
  const P = c.pricing;
  if (!P.ping.length) e['pricing.ping'] = 'حداقل یک پلن حجمی لازمه.';
  const gbs = P.ping.map((t) => tierKey(t.gb));
  P.ping.forEach((t, i) => {
    if (t.gb != null) range(`pricing.ping.${i}.gb`, t.gb, 1, 10000);
    if (gbs.indexOf(tierKey(t.gb)) !== i) e[`pricing.ping.${i}.gb`] = 'این حجم تکراریه.';
    range(`pricing.ping.${i}.price`, t.price, 1000, 100_000_000);
  });
  if (!P.dns.length) e['pricing.dns'] = 'حداقل یک پلن DNS لازمه.';
  P.dns.forEach((d, i) => {
    range(`pricing.dns.${i}.slots`, d.slots, 1, 50);
    if (P.dns.findIndex((x) => x.slots === d.slots) !== i) e[`pricing.dns.${i}.slots`] = 'تکراریه.';
    range(`pricing.dns.${i}.price`, d.price, 1000, 100_000_000);
  });
  if (!P.durations.length) e['pricing.durations'] = 'حداقل یک مدت لازمه.';
  P.durations.forEach((d, i) => {
    range(`pricing.durations.${i}.months`, d.months, 1, 36);
    if (P.durations.findIndex((x) => x.months === d.months) !== i) e[`pricing.durations.${i}.months`] = 'تکراریه.';
    range(`pricing.durations.${i}.off`, d.off, 0, 90);
  });
  range('pricing.proMul', P.proMul, 1, 5);
  range('pricing.extraPerGb', P.extraPerGb, 0, 10_000_000);
  for (const k of ['ping', 'dns', 'pro']) need(`planNames.${k}`, c.planNames[k]);
  if (!Object.values(c.kinds).some(Boolean)) e.kinds = 'حداقل یک نوع سرویس باید فعال باشه.';
  if (c.banner.on) need('banner.text', c.banner.text, 3);
  c.text.ping.items.forEach((x, i) => { need(`text.ping.items.${i}.k`, x.k); });
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
  for (const k of ['show', 'hero', 'planNames', 'kinds', 'banner', 'dns', 'wg', 'feats']) next[k] = { ...base[k], ...(saved[k] ?? {}) };
  next.text = Object.fromEntries(Object.keys(base.text).map((k) => [k, { ...base.text[k], ...(saved.text?.[k] ?? {}) }]));
  // Builds before v2 stored only { name, isp, dp, cover, mb } per game: fill the rest from the matching default.
  next.games = (saved.games ?? base.games).map((g) => {
    const cover = g.cover ?? guess(g.name);
    if (g.via) return { short: g.name, dc: '—', loss: 5, jitter: 20, mb: 100, featured: false, ...g, cover };
    const seed = base.games.find((b) => b.cover && b.cover === cover);
    const dp = g.dp ?? 30;
    return {
      ...(seed ?? { short: g.name, dc: '—', loss: 5, jitter: 20, featured: false, via: { mct: dp, dxb: dp + 3, fra: Math.round(dp * 1.9) } }),
      id: g.id, name: g.name, cover, isp: g.isp ?? seed?.isp ?? 120, mb: g.mb ?? seed?.mb ?? 100,
    };
  });
  if (!next.games.some((g) => g.featured)) next.games = next.games.map((g, i) => ({ ...g, featured: i < 5 }));
  // Prices used to live outside the site settings.
  next.pricing = saved.pricing?.ping?.length ? { ...base.pricing, ...saved.pricing } : base.pricing;
  const ord = (saved.order ?? []).filter((k) => SECTION_KEYS.includes(k));
  next.order = [...new Set([...ord, ...SECTION_KEYS])];
  return next;
}

/** Smallest plan that covers the estimate with 20% headroom. */
export function recommendTier(gbPerMonth, pricing) {
  const finite = pricing.ping.map((t) => t.gb).filter((g) => g != null).sort((a, b) => a - b);
  const hit = finite.find((t) => gbPerMonth * 1.2 <= t);
  if (hit != null) return hit;
  return pricing.ping.some((t) => t.gb == null) ? 'inf' : finite.at(-1);
}
