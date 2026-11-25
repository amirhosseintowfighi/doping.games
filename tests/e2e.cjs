// End-to-end test against a running app (`npm run build && npm start`) with its own PostgreSQL.
// It starts a fake RouterOS REST API and a fake CS2 server, then drives the real UI and API:
// sign-up → purchase through the test gateway → provisioning on the router → quota enforcement →
// wallet → DNS whitelist → tickets → admin (routers, game servers via A2S + RCON, discounts, site settings)
// and the security checks (CSRF, Origin, roles).
//
// Env: BASE_URL (default http://localhost:3000), ADMIN_EMAIL, ADMIN_PASSWORD (same as the app's), and
// DATABASE_URL (optional; enables the auto-renew check, which moves an expiry date forward in the database).
// Run the app with QUOTA_INTERVAL_SEC, SERVER_POLL_SEC and NOTIFY_INTERVAL_SEC set low (e.g. 5) for the
// worker checks, and point its outgoing channels at the mocks this suite starts:
//   SMTP_URL=smtp://127.0.0.1:2525  KAVENEGAR_API_KEY=test KAVENEGAR_API_BASE=http://127.0.0.1:2526
//   TELEGRAM_BOT_TOKEN=1:test TELEGRAM_BOT_USERNAME=doping_test_bot TELEGRAM_API_BASE=http://127.0.0.1:2527
const https = require('node:https');
const { chromium } = require('playwright');
const { startRouterOS } = require('./mocks/routeros.cjs');
const { startGameServer } = require('./mocks/gameserver.cjs');
const { startKavenegar, startSmtp, startTelegram } = require('./mocks/messaging.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@doping.test', password: process.env.ADMIN_PASSWORD || 'admin-pass-12345' };
const RUN = Date.now().toString(36).slice(-5);
const USER = { username: `gamer_${RUN}`, email: `gamer_${RUN}@test.ir`, password: 'Gamer-pass-123' };
const ROUTER_PASS = 'router-api-pass-1234';
const GB = 1024 ** 3;
const FRIEND = { username: `friend_${RUN}`, email: `friend_${RUN}@test.ir`, password: 'Friend-pass-123' };
const PHONE = `0912${String(Date.now()).slice(-7)}`;
const STEAM = `7656119${String(Date.now()).slice(-10)}`; // unique per run: a SteamID can belong to one account
const STEAM2 = (() => { const a = BigInt(STEAM) - 76561197960265728n; return `STEAM_1:${a & 1n}:${a >> 1n}`; })();
const linkIn = (text, path) => (text.match(new RegExp(`https?://[^\\s"<>]+${path}\\?token=[A-Za-z0-9_-]+`)) ?? [])[0]?.replace(/^https?:\/\/[^/]+/, BASE);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake-image-body')]);

let pass = 0;
let failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++; else failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ` — ${extra}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 40_000, step = 500) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(step);
  }
}

/** API helper bound to a browser context's cookies, so CSRF and session match the UI. */
function client(ctx) {
  return async (path, { method = 'GET', body, csrf = true, origin = BASE } = {}) => {
    const cookies = await ctx.cookies(BASE);
    const jar = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const token = cookies.find((c) => c.name.endsWith('dp_csrf'))?.value ?? '';
    const res = await fetch(BASE + path, {
      method,
      headers: { Cookie: jar, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}), ...(csrf && method !== 'GET' ? { 'X-CSRF-Token': token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, json };
  };
}
const pay = (authority, status = 'OK') => fetch(`${BASE}/api/pay/callback?Authority=${authority}&Status=${status}`, { redirect: 'manual' });
const authorityOf = (r) => new URL(r.json.redirect, BASE).searchParams.get('authority');

async function login(page, id, password) {
  await page.goto(`${BASE}/login`);
  await page.fill('#auth-login', id);
  await page.fill('#auth-password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}
const rail = (page, label) => page.getByText(label, { exact: true }).first().click();

function traffic(port, name, up, down) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: '127.0.0.1', port, path: '/__traffic', method: 'POST', rejectUnauthorized: false }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.end(JSON.stringify({ name, up, down }));
  });
}

(async () => {
  const ros = await startRouterOS({ pass: ROUTER_PASS });
  const game = await startGameServer();
  const mailer = await startSmtp(2525);
  const sms = await startKavenegar(2526);
  const tg = await startTelegram(2527);
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/ipify|net::ERR|status of 4\d\d/.test(m.text())) errors.push(`${page.url()} ${m.text()}`); });
  };

  /* ───────── public site ───────── */
  const uctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await uctx.newPage();
  watch(page);
  const res = await page.goto(BASE);
  check('home responds 200', res.status() === 200);
  check('home is server-rendered (hero in the HTML)', (await res.text()).includes('<h1'));
  check('pricing cards render', (await page.locator('#pricing [data-plan]').count()) >= 3);
  check('health endpoint', (await (await fetch(`${BASE}/api/healthz`)).json()).ok === true);

  /* ───────── sign-up ───────── */
  await page.goto(`${BASE}/register`);
  await page.fill('#auth-email', USER.email);
  await page.fill('#auth-username', USER.username);
  await page.fill('#auth-password', 'short');
  await page.click('button[type=submit]');
  check('register rejects a short password', await page.getByText('رمز حداقل ۸ کاراکتر.').first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.fill('#auth-password', USER.password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/panel');
  check('register signs in and opens the panel', page.url().endsWith('/panel'));
  check('panel shows the empty state before purchase', await page.getByText('هنوز اشتراکی نداری').isVisible());
  const api = client(uctx);
  const vmail = await until(async () => mailer.mails.find((m) => m.to.includes(USER.email) && linkIn(m.text, '/api/auth/verify-email')), 15_000);
  check('verification email sent on sign-up', !!vmail);
  check('panel asks to verify the email', (await api('/api/me')).json.account.emailVerified === false);
  if (vmail) await page.goto(linkIn(vmail.text, '/api/auth/verify-email'));
  check('verification link verifies the email', (await api('/api/me')).json.account.emailVerified === true);
  check('a used verification link does not work twice', !!vmail && (await fetch(linkIn(vmail.text, '/api/auth/verify-email'), { redirect: 'manual' })).headers.get('location')?.includes('verified=0'));
  check('duplicate username refused', (await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({ ...USER, email: `x${USER.email}` }) })).status === 409);

  /* ───────── purchase through the gateway (UI) ───────── */
  await page.goto(`${BASE}/#pricing`);
  await page.locator('#pricing [data-plan="15"]').getByRole('button', { name: 'فعال‌سازی' }).click();
  await page.getByRole('button', { name: /زرین‌پال/ }).click();
  await page.getByRole('button', { name: /^پرداخت/ }).click();
  await page.waitForURL('**/pay/test**');
  check('checkout redirects to the gateway', page.url().includes('/pay/test?authority=TEST'));
  const firstAuthority = new URL(page.url()).searchParams.get('authority');
  await page.getByText('پرداخت موفق').click();
  await page.waitForURL('**/pay/result**');
  check('gateway callback verifies and shows success', await page.getByText('پرداخت موفق بود').isVisible());
  let me = (await api('/api/me')).json;
  check('invoice recorded as paid with a bank reference', me.invoices[0]?.status === 'paid' && !!me.invoices[0].refId);
  check('subscription active with a 15 GB quota', me.sub?.status === 'active' && me.sub.quota === 15 * GB);
  check('tunnel address allocated', /^10\.66\.\d+\.\d+$/.test(me.sub?.ip ?? ''), me.sub?.ip);
  const conf = (await api('/api/me/config')).json;
  check('WireGuard config built from server-side keys', /PrivateKey = [A-Za-z0-9+/]{43}=/.test(conf?.text ?? ''));
  const expires = me.sub.expires;
  await pay(firstAuthority);
  me = (await api('/api/me')).json;
  check('replayed callback grants nothing twice', me.sub.expires === expires && me.invoices.length === 1);
  check('payment lands in the in-panel notifications', me.notifications.some((n) => n.title === 'پرداخت موفق'));
  check('payment receipt emailed to the verified address', !!(await until(async () => mailer.mails.some((m) => m.to.includes(USER.email) && m.text.includes('INV-')), 10_000)));
  check('notifications can be marked read', (await api('/api/me/notifications', { method: 'POST', body: { ids: 'all' } })).status === 200 && (await api('/api/me')).json.notifications.every((n) => n.read));

  /* ───────── Telegram bot ───────── */
  const tl = await api('/api/me/telegram', { method: 'POST' });
  const start = tl.json?.url ? new URL(tl.json.url).searchParams.get('start') : '';
  check('telegram deep link points at the bot', (tl.json?.url ?? '').startsWith('https://t.me/doping_test_bot?start='));
  tg.say(777001, `/start ${start}`);
  check('bot /start links the chat to the account', !!(await until(async () => (await api('/api/me')).json.account.telegram, 30_000, 1000)));
  tg.say(777001, '/status');
  check('bot /status answers with the subscription', !!(await until(async () => tg.state.sent.some((m) => m.chat === '777001' && m.text.includes(USER.username)), 30_000, 1000)));
  tg.say(777002, `/start ${start}`);
  check('a used link cannot link a second chat', !!(await until(async () => tg.state.sent.some((m) => m.chat === '777002' && m.text.includes('منقضی')), 30_000, 1000)));

  /* ───────── security ───────── */
  const ticket = { subject: 'xxxxxxx', dept: 'فنی', text: 'xxxxxxxxxxxxx' };
  check('write without CSRF token is rejected', (await api('/api/me/tickets', { method: 'POST', body: ticket, csrf: false })).status === 403);
  check('cross-origin write is rejected', (await api('/api/me/tickets', { method: 'POST', body: ticket, origin: 'https://evil.example' })).status === 403);
  check('user cannot read admin APIs', (await api('/api/admin/users')).status === 403);
  check('anonymous cannot read the panel API', (await fetch(`${BASE}/api/me`)).status === 401);
  check('invented plan tier refused by the server', (await api('/api/orders', { method: 'POST', body: { order: { type: 'plan', kind: 'ping', tier: 7, months: 1 }, gateway: 'wallet' } })).status === 422);
  check('wallet cannot go negative', (await api('/api/orders', { method: 'POST', body: { order: { type: 'plan', kind: 'ping', tier: 15, months: 1 }, gateway: 'wallet' } })).status === 402);
  const anonAdmin = await fetch(`${BASE}/admin`, { redirect: 'manual' });
  check('admin page redirects anonymous visitors to login', (anonAdmin.headers.get('location') ?? '').includes('/login') || [303, 307].includes(anonAdmin.status));

  /* ───────── admin: router + provisioning ───────── */
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await actx.newPage();
  watch(admin);
  await login(admin, ADMIN.email, ADMIN.password);
  check('admin lands on the control center', admin.url().endsWith('/admin'));
  const aapi = client(actx);
  const rname = `THR-${RUN}`.toUpperCase();
  await admin.getByRole('button', { name: 'افزودن روتر' }).click();
  await admin.fill('#rt-name', rname);
  await admin.fill('#rt-host', '127.0.0.1');
  await admin.fill('#rt-port', String(ros.port));
  await admin.fill('#rt-pass', ROUTER_PASS);
  await admin.getByRole('button', { name: 'افزودن روتر' }).last().click();
  await admin.getByText(rname).first().waitFor();
  check('router saved from the admin form', true);
  await admin.locator('div', { hasText: rname }).getByRole('button', { name: 'تست اتصال و سینک میکروتیک' }).last().click();
  const synced = await until(async () => (await admin.locator('[data-sync-log]').innerText()).includes('sync complete'), 20_000);
  const syncLog = await admin.locator('[data-sync-log]').innerText().catch(() => '');
  check('sync connects over TLS and completes', !!synced, syncLog.slice(-300));
  check('sync pins the router certificate on first use', syncLog.includes('pinned'));
  await admin.getByRole('button', { name: 'بستن' }).last().click();
  const r = (await aapi('/api/admin/overview')).json.routers.find((x) => x.name === rname);
  check('router online with RouterOS version and fingerprint', r?.status === 'online' && r.version === '7.19.4' && /^([0-9A-F]{2}:){31}/.test(r.fingerprint));
  check('router password never returned by the API', !JSON.stringify(r).includes(ROUTER_PASS));
  const subId = (await aapi('/api/admin/users')).json.find((u) => u.username === USER.username)?.sub?.id;
  const peer = () => ros.state.peers.find((p) => p.comment === `doping:${subId}`);
  check('peer created on the router for the paid subscription', peer()?.disabled === 'false');
  check('simple queue created for the subscription', ros.state.queues.some((q) => q.name === `dp-${subId}`));
  me = (await api('/api/me')).json;
  check('panel shows the subscription as provisioned', me.sub.provisioned === true && me.sub.router === rname);
  const conf2 = (await api('/api/me/config')).json;
  check('config uses the router endpoint and its WireGuard key', conf2.endpoint === '127.0.0.1:51820' && conf2.serverKey.startsWith('U2VydmVy'));

  /* ───────── key reset (UI) ───────── */
  const oldPub = peer()['public-key'];
  await page.goto(`${BASE}/panel?tab=connect`);
  await page.getByRole('button', { name: /ریست کلید اتصال \(/ }).click();
  await page.getByRole('button', { name: 'آره، کلید جدید بساز' }).click();
  await page.getByText(/کلید جدید ساخته شد/).first().waitFor();
  check('key reset rotates the peer key on the router in place', !!peer()['public-key'] && peer()['public-key'] !== oldPub);
  check('the old config stops matching', (await api('/api/me/config')).json.text !== conf2.text);

  /* ───────── quota worker ───────── */
  await traffic(ros.port, `dp-${subId}`, GB, 15 * GB);
  check('quota worker reads queue counters and suspends at the limit', !!(await until(async () => (await api('/api/me')).json.sub.status === 'quota', 60_000, 1000)));
  check('peer disabled on the router when the quota runs out', peer()?.disabled === 'true');
  me = (await api('/api/me')).json;
  check('usage recorded per day', me.usage.some((d) => d.down >= 15 * GB));
  check('handshake read from the router marks the tunnel online', me.sub.online === true);
  check('quota alert sent to Telegram', !!(await until(async () => tg.state.sent.some((m) => m.chat === '777001' && m.text.includes('حجم اشتراکت تموم شد')), 30_000, 1000)));

  /* ───────── wallet top-up + extra traffic ───────── */
  const top = await api('/api/orders', { method: 'POST', body: { order: { type: 'topup', amount: 100_000 }, gateway: 'zarinpal' } });
  await pay(authorityOf(top));
  await pay(authorityOf(top));
  me = (await api('/api/me')).json;
  check('wallet credited exactly once for a replayed callback', me.user.wallet === 100_000, String(me.user.wallet));
  const extra = await api('/api/orders', { method: 'POST', body: { order: { type: 'extra', gb: 5 }, gateway: 'wallet' } });
  check('extra traffic paid from the wallet', extra.json?.status === 'paid');
  me = (await api('/api/me')).json;
  check('extra traffic raises the quota and reactivates', me.sub.status === 'active' && me.sub.quota === 20 * GB);
  check('peer re-enabled on the router', peer()?.disabled === 'false');
  check('wallet debited by the extra-traffic price', me.user.wallet === 100_000 - 5 * 5_000, String(me.user.wallet));
  const cancel = await api('/api/orders', { method: 'POST', body: { order: { type: 'topup', amount: 50_000 }, gateway: 'zarinpal' } });
  await pay(authorityOf(cancel), 'NOK');
  check('canceled payment credits nothing', (await api('/api/me')).json.user.wallet === 75_000);

  /* ───────── DNS whitelist ───────── */
  check('DNS refused on a plan without DNS slots', (await api('/api/me/dns', { method: 'POST', body: { ip: '5.160.14.92' } })).status === 403);
  const pro = await api('/api/orders', { method: 'POST', body: { order: { type: 'plan', kind: 'pro', tier: 30, months: 1 }, gateway: 'zarinpal' } });
  await pay(authorityOf(pro));
  const ip = (await api('/api/me')).json.sub.ip;
  me = (await api('/api/me')).json;
  check('upgrade to pro adds DNS slots and keeps the tunnel', me.sub.kind === 'pro' && me.sub.dnsSlots === 2 && me.sub.ip === ip);
  check('new period resets usage and router counters', me.sub.up + me.sub.down === 0 && ros.state.queues.find((q) => q.name === `dp-${subId}`)?.bytes === '0/0');
  await page.goto(`${BASE}/panel?tab=dns`);
  await page.fill('#dns-manual', '5.160.14.92');
  await page.getByRole('button', { name: 'افزودن' }).click();
  await page.getByText('5.160.14.92').first().waitFor();
  check('DNS IP added from the panel', true);
  check('IP added to the router address-list', ros.state.lists.some((l) => l.address === '5.160.14.92' && l.list === 'doping-dns-allowed'));
  check('duplicate IP refused', (await api('/api/me/dns', { method: 'POST', body: { ip: '5.160.14.92' } })).status === 409);
  check('private IP refused', (await api('/api/me/dns', { method: 'POST', body: { ip: '10.0.0.5' } })).status === 422);

  /* ───────── extra devices + exit node ───────── */
  const dev1 = await api('/api/me/devices', { method: 'POST', body: { name: 'PS5 Router' } });
  check('extra device created', dev1.status === 201);
  me = (await api('/api/me')).json;
  const d1ip = me.devices[0]?.ip;
  check('device gets its own tunnel address', !!d1ip && d1ip !== me.sub.ip);
  const devPeer = (id) => ros.state.peers.find((p) => p.comment === `doping:${subId}:${id}`);
  check('device peer provisioned on the router', devPeer(dev1.json.id)?.['allowed-address'] === `${d1ip}/32`);
  check('one queue counts both configs', ros.state.queues.find((q) => q.name === `dp-${subId}`)?.target === `${me.sub.ip}/32,${d1ip}/32`);
  const dconf = (await api(`/api/me/config?device=${dev1.json.id}`)).json;
  check('device config has its own key and address', dconf.address === `${d1ip}/32` && dconf.priv !== (await api('/api/me/config')).json.priv);
  await page.goto(`${BASE}/panel?tab=connect`);
  await page.fill('#dev-name', 'Phone');
  await page.getByRole('button', { name: 'افزودن' }).click();
  await page.getByText('دستگاه جدید ساخته شد').first().waitFor();
  check('device added from the panel', (await api('/api/me')).json.devices.length === 2);
  check('plan device limit enforced (pro: 3)', (await api('/api/me/devices', { method: 'POST', body: { name: 'Laptop' } })).status === 409);
  await page.getByRole('radio', { name: /دبی/ }).click();
  await page.getByText('خروجی عوض شد').first().waitFor();
  const exitList = (name) => ros.state.lists.filter((l) => l.list === name && l.comment === `doping-exit:${subId}`).map((l) => l.address);
  check('exit switch moves every config to the new exit list', exitList('doping-exit-dxb').length === 3 && exitList('doping-exit-mct').length === 0, JSON.stringify(ros.state.lists.filter((l) => l.list.startsWith('doping-exit'))));
  const phoneDev = (await api('/api/me')).json.devices.find((x) => x.name === 'Phone');
  const phonePeerId = devPeer(phoneDev.id)?.['.id'];
  check('device removed', (await api('/api/me/devices', { method: 'DELETE', body: { id: phoneDev.id } })).status === 200);
  check('removed device peer deleted from the router', !ros.state.peers.some((p) => p['.id'] === phonePeerId));
  check('removed device leaves the queue and exit list', !ros.state.queues.find((q) => q.name === `dp-${subId}`).target.includes(phoneDev.ip) && !exitList('doping-exit-dxb').includes(phoneDev.ip));
  check('invalid exit refused', (await api('/api/me/exit', { method: 'PUT', body: { exit: 'mars' } })).status === 422);

  /* ───────── tickets ───────── */
  await page.goto(`${BASE}/panel?tab=support`);
  await page.getByRole('button', { name: 'تیکت جدید' }).click();
  await page.fill('#tk-subject', `پینگ بالا روی Valorant ${RUN}`);
  await page.fill('#tk-text', 'از ساعت ۹ شب پینگ ۹۰ شده و پکت لاس داره.');
  await page.getByRole('button', { name: 'ثبت تیکت' }).click();
  await page.getByText(`پینگ بالا روی Valorant ${RUN}`).first().waitFor();
  check('ticket created from the panel', true);
  const tk = (await api('/api/me')).json.tickets[0];
  const att = await api(`/api/me/tickets/${tk.id}`, { method: 'POST', body: { text: 'اسکرین‌شات', files: [{ name: 'ping.png', data: PNG.toString('base64') }] } });
  check('ticket reply with an attachment', att.status === 200);
  const file = (await api('/api/me')).json.tickets[0].msgs.flatMap((m) => m.files).find((f) => f.name === 'ping.png');
  check('attachment type detected from its bytes', file?.mime === 'image/png' && file.size === PNG.length);
  const cookies = (await uctx.cookies(BASE)).map((c) => `${c.name}=${c.value}`).join('; ');
  const dl = await fetch(`${BASE}/api/attachments/${file?.id}`, { headers: { Cookie: cookies } });
  check('owner downloads the attachment as a file', dl.status === 200 && (dl.headers.get('content-disposition') ?? '').startsWith('attachment') && Buffer.from(await dl.arrayBuffer()).equals(PNG));
  check('anonymous cannot download attachments', (await fetch(`${BASE}/api/attachments/${file?.id}`)).status === 401);
  check('executables refused as attachments', (await api(`/api/me/tickets/${tk.id}`, { method: 'POST', body: { text: 'x', files: [{ name: 'a.exe', data: Buffer.from([0x4d, 0x5a, 0x00, 0x01, 0xff]).toString('base64') }] } })).status === 415);
  await rail(admin, 'تیکت‌های پشتیبانی');
  await admin.getByText(`پینگ بالا روی Valorant ${RUN}`).first().click();
  await admin.fill('#adm-reply', 'خروجی دبی رو امتحان کن؛ مسیر عمان امشب شلوغه.');
  await admin.getByRole('button', { name: 'ارسال' }).click();
  await admin.getByText('پاسخ ارسال شد.').waitFor();
  const t = (await api('/api/me')).json.tickets[0];
  check('staff reply reaches the user and marks the ticket answered', t.status === 'answered' && t.msgs.some((m) => m.from === 'staff'));
  check('staff sees the user attachment', (await aapi('/api/admin/tickets')).json.find((x) => x.id === t.id)?.msgs.some((m) => m.files?.length));
  check('ticket answer notified on Telegram', !!(await until(async () => tg.state.sent.some((m) => m.chat === '777001' && m.text.includes(`T-${t.id}`)), 15_000)));

  /* ───────── game servers: A2S + RCON ───────── */
  await rail(admin, 'سرورهای بازی و RCON');
  await admin.getByRole('button', { name: 'افزودن سرور' }).click();
  await admin.fill('#gs-name', `Doping Retake ${RUN}`);
  await admin.fill('#gs-host', '127.0.0.1');
  await admin.fill('#gs-port', String(game.port));
  await admin.fill('#gs-rcon', 'rcon-secret');
  await admin.getByRole('button', { name: 'افزودن سرور' }).last().click();
  const srv = await until(async () => (await (await fetch(`${BASE}/api/servers`)).json()).servers.find((s) => s.port === game.port && s.status === 'online'), 40_000, 1000);
  check('A2S poller reads the live server', !!srv);
  check('player count and map come from A2S_INFO', srv?.players === 2 && srv.map === 'de_mirage');
  check('scoreboard names come from A2S_PLAYER', !!srv?.list.some((p) => p.name === 'Arash_AWP'));
  await page.goto(`${BASE}/#servers`);
  check('storefront lists the live server', await page.getByText(`Doping Retake ${RUN}`).first().isVisible());
  await admin.reload();
  await rail(admin, 'سرورهای بازی و RCON');
  await admin.locator('tr', { hasText: `Doping Retake ${RUN}` }).getByRole('button', { name: 'RCON' }).click();
  await admin.getByRole('button', { name: 'status' }).click();
  check('RCON authenticates and runs status', !!(await until(async () => (await admin.getByText('hostname: Doping Retake #1').count()) > 0, 10_000)));
  await admin.fill('#rcon-cmd', 'changelevel de_inferno');
  await admin.keyboard.press('Enter');
  check('RCON changelevel reaches the server', !!(await until(async () => game.state.map === 'de_inferno', 10_000)));
  await admin.fill('#rcon-cmd', 'rcon_password hacked');
  await admin.keyboard.press('Enter');
  check('commands outside the allow-list are blocked', !!(await until(async () => (await admin.getByText(/فهرست مجاز نیست/).count()) > 0, 5_000)) && !game.state.commands.includes('rcon_password hacked'));
  await admin.keyboard.press('Escape');

  /* ───────── Steam VIP list ───────── */
  check('steam linked', (await api('/api/me/steam', { method: 'PUT', body: { steamId: STEAM } })).status === 200);
  const gs = (await aapi('/api/admin/overview')).json.servers.find((x) => x.port === game.port);
  const vt = await aapi(`/api/admin/servers/${gs.id}/vip-token`, { method: 'POST' });
  check('VIP token issued with a cron line', vt.status === 200 && vt.json.cron.includes(vt.json.token));
  const vipRes = await fetch(`${BASE}/api/servers/vip`, { headers: { Authorization: `Bearer ${vt.json.token}` } });
  const ini = await vipRes.text();
  check('VIP list in admins_simple.ini format with the perk flags', vipRes.status === 200 && ini.includes(`"${STEAM2}" "ao"`), ini);
  check('VIP list refused with a wrong token', (await fetch(`${BASE}/api/servers/vip`, { headers: { Authorization: 'Bearer wrong-token-wrong-token-1234' } })).status === 401);
  await api('/api/me/perks', { method: 'PUT', body: { slot: true, tag: false, skins: true } });
  const vj = await (await fetch(`${BASE}/api/servers/vip?format=json`, { headers: { Authorization: `Bearer ${vt.json.token}` } })).json();
  check('perk changes show up in the VIP list', vj.players.some((x) => x.steam2 === STEAM2 && x.flags === 'ap'));
  check('server records when it pulled the list', !!(await aapi('/api/admin/overview')).json.servers.find((x) => x.id === gs.id)?.vipFetchedAt);

  /* ───────── discounts ───────── */
  const code = `E2E${RUN}`.toUpperCase().slice(0, 16);
  check('discount created', (await aapi('/api/admin/discounts', { method: 'POST', body: { code, percent: 20, max: 1 } })).status === 201);
  const q1 = await api('/api/orders/quote', { method: 'POST', body: { type: 'plan', kind: 'ping', tier: 15, months: 1, code } });
  check('discount applied in the server quote', q1.json?.discount > 0 && q1.json.total === q1.json.subtotal - q1.json.discount);
  const d1 = await api('/api/orders', { method: 'POST', body: { order: { type: 'plan', kind: 'ping', tier: 15, months: 1, code }, gateway: 'zarinpal' } });
  await pay(authorityOf(d1));
  check('switching to a plan with fewer devices trims the extras', (await api('/api/me')).json.devices.length <= 1);
  check('single-use discount exhausted after payment', (await api('/api/orders/quote', { method: 'POST', body: { type: 'plan', kind: 'ping', tier: 15, months: 1, code } })).status === 422);

  /* ───────── site settings ───────── */
  const site = (await aapi('/api/admin/site')).json;
  const line1 = `پینگت ${RUN}`;
  check('settings saved', (await aapi('/api/admin/site', { method: 'PUT', body: { ...site, hero: { ...site.hero, line1 } } })).status === 200);
  await sleep(5_200); // settings cache
  check('home page renders the new hero text', (await (await fetch(BASE)).text()).includes(line1));
  check('invalid settings rejected', (await aapi('/api/admin/site', { method: 'PUT', body: { ...site, accent: 'red' } })).status === 422);
  check('regular users cannot change settings', (await api('/api/admin/site', { method: 'PUT', body: site })).status === 403);
  await aapi('/api/admin/site', { method: 'PUT', body: site });

  /* ───────── admin user actions + audit ───────── */
  const uid = (await aapi('/api/admin/users')).json.find((u) => u.username === USER.username).id;
  await aapi(`/api/admin/users/${uid}`, { method: 'POST', body: { action: 'peer', on: false } });
  check('admin disables the peer on the router', peer()?.disabled === 'true');
  check('device peers follow the subscription state', ros.state.peers.filter((p) => p.comment?.startsWith(`doping:${subId}:`)).every((p) => p.disabled === 'true'));
  await aapi(`/api/admin/users/${uid}`, { method: 'POST', body: { action: 'peer', on: true } });
  check('admin re-enables the peer', peer()?.disabled === 'false');
  const logs = (await aapi('/api/admin/logs?type=payment')).json;
  check('payments written to the audit log', logs.some((l) => l.msg.includes('verify OK')));

  /* ───────── sales report + broadcast ───────── */
  const sales = (await aapi('/api/admin/sales')).json;
  check('sales report has daily totals and a mix by type', sales.daily.length >= 1 && sales.daily.at(-1).sales > 0 && sales.byType.some((x) => x.type === 'topup'));
  const csv = await fetch(`${BASE}/api/admin/sales/export?days=30`, { headers: { Cookie: (await actx.cookies(BASE)).map((c) => `${c.name}=${c.value}`).join('; ') } });
  const csvText = await csv.text();
  check('sales CSV export', csv.headers.get('content-type')?.startsWith('text/csv') && csvText.includes(USER.username) && csvText.includes('INV-'));
  check('users cannot export sales', (await api('/api/admin/sales/export')).status === 403);
  const bc = await aapi('/api/admin/notify', { method: 'POST', body: { title: `قطعی ${RUN}`, body: 'نود مسقط ساعت ۳ بامداد ۱۰ دقیقه قطع می‌شه.', target: 'all', push: false } });
  check('broadcast reaches user panels', bc.json?.sent >= 1 && (await api('/api/me')).json.notifications.some((n) => n.title === `قطعی ${RUN}`));

  /* ───────── referral ───────── */
  me = (await api('/api/me')).json;
  const walletBefore = me.user.wallet;
  const fctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fpage = await fctx.newPage();
  watch(fpage);
  await fpage.goto(`${BASE}/register?ref=${me.account.refCode}`);
  check('referral code shown on sign-up', await fpage.getByText(me.account.refCode).first().isVisible());
  await fpage.fill('#auth-email', FRIEND.email);
  await fpage.fill('#auth-username', FRIEND.username);
  await fpage.fill('#auth-password', FRIEND.password);
  await fpage.click('button[type=submit]');
  await fpage.waitForURL('**/panel');
  const fapi = client(fctx);
  const fbuy = await fapi('/api/orders', { method: 'POST', body: { order: { type: 'plan', kind: 'ping', tier: 15, months: 1 }, gateway: 'zarinpal' } });
  await pay(authorityOf(fbuy));
  me = (await api('/api/me')).json;
  check('referrer credited 10% of the first purchase', me.user.wallet === walletBefore + 6_900, `${walletBefore} → ${me.user.wallet}`);
  check('referral stats in the panel', me.account.referrals.signups >= 1 && me.account.referrals.bought >= 1 && me.account.referrals.earned >= 6_900);
  const fbuy2 = await fapi('/api/orders', { method: 'POST', body: { order: { type: 'renew' }, gateway: 'zarinpal' } });
  await pay(authorityOf(fbuy2));
  check('only the first purchase is rewarded', (await api('/api/me')).json.user.wallet === walletBefore + 6_900);
  check('another account cannot read your attachments', (await fapi(`/api/attachments/${file?.id}`)).status === 404);

  /* ───────── phone + SMS login ───────── */
  check('phone code sent', (await fapi('/api/me/phone', { method: 'POST', body: { phone: PHONE.replace(/^0/, '+98') } })).status === 200);
  const smsCode = (x) => x?.token || (x?.text.match(/\b\d{6}\b/) ?? [])[0];
  const code1 = smsCode(await until(async () => sms.sms.find((x) => x.to === PHONE), 10_000));
  check('wrong phone code refused', (await fapi('/api/me/phone', { method: 'PUT', body: { phone: PHONE, code: code1 === '000000' ? '111111' : '000000' } })).status === 422);
  check('phone verified with the SMS code', (await fapi('/api/me/phone', { method: 'PUT', body: { phone: PHONE, code: code1 } })).status === 200 && (await fapi('/api/me')).json.account.phoneVerified);
  check('same number cannot be claimed twice', (await api('/api/me/phone', { method: 'POST', body: { phone: PHONE } })).status === 409);
  const octx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const opage = await octx.newPage();
  watch(opage);
  await opage.goto(`${BASE}/login`);
  await opage.getByRole('tab', { name: 'کد پیامکی' }).click();
  await opage.fill('#auth-phone', PHONE);
  const smsBefore = sms.sms.length;
  await opage.getByRole('button', { name: 'ارسال کد ورود' }).click();
  const code2 = smsCode(await until(async () => sms.sms.slice(smsBefore).find((x) => x.to === PHONE), 10_000));
  await opage.fill('#auth-otp', code2 ?? '');
  await opage.getByRole('button', { name: 'ورود' }).last().click();
  await opage.waitForURL('**/panel', { timeout: 10_000 }).catch(() => {});
  check('SMS code signs in', opage.url().endsWith('/panel') && (await client(octx)('/api/me')).json?.user?.username === FRIEND.username);
  check('a used login code does not work again', (await fetch(`${BASE}/api/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({ phone: PHONE, code: code2 }) })).status === 401);
  const unknown = await fetch(`${BASE}/api/auth/otp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({ phone: '09129999999' }) });
  check('unknown numbers get the same answer and no SMS', unknown.status === 200 && !sms.sms.some((x) => x.to === '09129999999'));

  /* ───────── password reset ───────── */
  await opage.goto(`${BASE}/forgot`);
  await opage.fill('#forgot-login', FRIEND.username);
  const mailsBefore = mailer.mails.length;
  await opage.getByRole('button', { name: 'ارسال لینک بازیابی' }).click();
  await opage.getByText(/لینک بازیابی تا چند دقیقه/).waitFor();
  const rmail = await until(async () => mailer.mails.slice(mailsBefore).find((m) => m.to.includes(FRIEND.email) && linkIn(m.text, '/reset')), 10_000);
  check('reset link emailed', !!rmail);
  await opage.goto(linkIn(rmail?.text ?? '', '/reset') ?? `${BASE}/reset`);
  await opage.fill('#reset-pass', 'Brand-new-pass-9');
  await opage.fill('#reset-again', 'Brand-new-pass-9');
  await opage.getByRole('button', { name: 'ذخیره رمز جدید' }).click();
  await opage.getByText('رمزت عوض شد.').waitFor();
  check('reset signs every device out', (await fapi('/api/me')).status === 401);
  check('reset link works only once', (await fetch(`${BASE}/api/auth/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({ token: new URL(linkIn(rmail.text, '/reset')).searchParams.get('token'), password: 'Another-pass-99' }) })).status === 410);
  await login(opage, FRIEND.username, 'Brand-new-pass-9');
  check('new password works', opage.url().endsWith('/panel'));
  const forgotOther = await fetch(`${BASE}/api/auth/forgot`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({ login: `nobody_${RUN}` }) });
  check('forgot answers the same for unknown accounts', forgotOther.status === 200);

  /* ───────── account: password change + sessions ───────── */
  const oapi = client(octx);
  check('password change needs the current password', (await oapi('/api/me/password', { method: 'PUT', body: { current: 'wrong', next: 'Third-pass-123' } })).status === 422);
  check('password changed', (await oapi('/api/me/password', { method: 'PUT', body: { current: 'Brand-new-pass-9', next: 'Third-pass-123' } })).status === 200);
  check('current session survives a password change', (await oapi('/api/me')).status === 200);
  await fctx.close();
  await octx.close();

  /* ───────── auto-renew ───────── */
  if (process.env.DATABASE_URL) {
    const postgres = require('postgres');
    const db = postgres(process.env.DATABASE_URL);
    me = (await api('/api/me')).json;
    const w0 = me.user.wallet;
    check('auto-renew turned on', (await api('/api/me/autorenew', { method: 'PUT', body: { on: true } })).status === 200);
    await db`update subscriptions set expires_at = now() + interval '6 hours' where id = ${subId}`;
    const renewed = await until(async () => { const x = (await api('/api/me')).json; return x.sub.expires > Date.now() + 29 * 86_400_000 ? x : null; }, 40_000, 1000);
    check('auto-renew extends the plan from the wallet in its last day', !!renewed && renewed.user.wallet < w0, renewed ? `${w0} → ${renewed.user.wallet}` : 'not renewed');
    check('auto-renew notification', !!renewed?.notifications.some((n) => n.title.includes('خودکار تمدید')));
    await db.end();
  }

  /* ───────── outbox ───────── */
  const outbox = (await aapi('/api/admin/outbox')).json;
  check('outbox lists sent messages and channel status', outbox.channels.email && outbox.channels.sms && outbox.channels.telegram && outbox.rows.some((r) => r.status === 'sent'));
  check('codes are redacted in the outbox', !outbox.rows.some((r) => r.channel === 'sms' && r.body.includes(code1)) || outbox.devOutbox);

  /* ───────── logout ───────── */
  await page.goto(BASE);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/logout')),
    page.getByRole('button', { name: 'خروج از حساب' }).click(),
  ]);
  await page.getByRole('link', { name: 'ورود' }).waitFor();
  check('logout ends the session', (await api('/api/me')).status === 401);

  check('no browser errors', errors.length === 0, errors.slice(0, 5).join('\n'));

  // Leave nothing behind that points at the mocks, so the suite can run again on the same database.
  const o = (await aapi('/api/admin/overview')).json;
  for (const x of o.routers.filter((y) => y.host === '127.0.0.1')) await aapi(`/api/admin/routers/${x.id}`, { method: 'DELETE' });
  for (const x of o.servers.filter((y) => y.host === '127.0.0.1')) await aapi(`/api/admin/servers/${x.id}`, { method: 'DELETE' });
  await browser.close();
  ros.close();
  game.close();
  mailer.close();
  sms.close();
  tg.close();
  console.log(`\n${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
