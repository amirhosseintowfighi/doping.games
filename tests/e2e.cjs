// End-to-end test against a running app (`npm run build && npm start`) with its own PostgreSQL.
// It starts a fake RouterOS REST API and a fake CS2 server, then drives the real UI and API:
// sign-up → purchase through the test gateway → provisioning on the router → quota enforcement →
// wallet → DNS whitelist → tickets → admin (routers, game servers via A2S + RCON, discounts, site settings)
// and the security checks (CSRF, Origin, roles).
//
// Env: BASE_URL (default http://localhost:3000), ADMIN_EMAIL, ADMIN_PASSWORD (same as the app's).
// Run the app with QUOTA_INTERVAL_SEC and SERVER_POLL_SEC set low (e.g. 5) for the worker checks.
const https = require('node:https');
const { chromium } = require('playwright');
const { startRouterOS } = require('./mocks/routeros.cjs');
const { startGameServer } = require('./mocks/gameserver.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@doping.test', password: process.env.ADMIN_PASSWORD || 'admin-pass-12345' };
const RUN = Date.now().toString(36).slice(-5);
const USER = { username: `gamer_${RUN}`, email: `gamer_${RUN}@test.ir`, password: 'Gamer-pass-123' };
const ROUTER_PASS = 'router-api-pass-1234';
const GB = 1024 ** 3;

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

  /* ───────── tickets ───────── */
  await page.goto(`${BASE}/panel?tab=support`);
  await page.getByRole('button', { name: 'تیکت جدید' }).click();
  await page.fill('#tk-subject', `پینگ بالا روی Valorant ${RUN}`);
  await page.fill('#tk-text', 'از ساعت ۹ شب پینگ ۹۰ شده و پکت لاس داره.');
  await page.getByRole('button', { name: 'ثبت تیکت' }).click();
  await page.getByText(`پینگ بالا روی Valorant ${RUN}`).first().waitFor();
  check('ticket created from the panel', true);
  await rail(admin, 'تیکت‌های پشتیبانی');
  await admin.getByText(`پینگ بالا روی Valorant ${RUN}`).first().click();
  await admin.fill('#adm-reply', 'خروجی دبی رو امتحان کن؛ مسیر عمان امشب شلوغه.');
  await admin.getByRole('button', { name: 'ارسال' }).click();
  await admin.getByText('پاسخ ارسال شد.').waitFor();
  const t = (await api('/api/me')).json.tickets[0];
  check('staff reply reaches the user and marks the ticket answered', t.status === 'answered' && t.msgs.some((m) => m.from === 'staff'));

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

  /* ───────── discounts ───────── */
  const code = `E2E${RUN}`.toUpperCase().slice(0, 16);
  check('discount created', (await aapi('/api/admin/discounts', { method: 'POST', body: { code, percent: 20, max: 1 } })).status === 201);
  const q1 = await api('/api/orders/quote', { method: 'POST', body: { type: 'plan', kind: 'ping', tier: 15, months: 1, code } });
  check('discount applied in the server quote', q1.json?.discount > 0 && q1.json.total === q1.json.subtotal - q1.json.discount);
  const d1 = await api('/api/orders', { method: 'POST', body: { order: { type: 'plan', kind: 'ping', tier: 15, months: 1, code }, gateway: 'zarinpal' } });
  await pay(authorityOf(d1));
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
  await aapi(`/api/admin/users/${uid}`, { method: 'POST', body: { action: 'peer', on: true } });
  check('admin re-enables the peer', peer()?.disabled === 'false');
  const logs = (await aapi('/api/admin/logs?type=payment')).json;
  check('payments written to the audit log', logs.some((l) => l.msg.includes('verify OK')));

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
  console.log(`\n${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
