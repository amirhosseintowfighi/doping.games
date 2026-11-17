// End-to-end smoke test. Run with `npm test` (builds the single-file bundle first).
// Needs Playwright with Chromium available on the machine: `npx playwright install chromium` once, if it is not.
const path = require('node:path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '../dist/index.html');
const failures = [];
let passed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else failures.push(`${name}${detail ? ` → ${detail}` : ''}`); };
const tab = (label) => `[role=tab]:has-text("${label}")`;

async function open(browser, viewport, hash = '') {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/ipify|ERR_|Failed to load resource/.test(m.text()) && failures.push(`console: ${m.text()}`));
  await page.goto(URL + hash);
  await page.waitForSelector('main');
  return page;
}
const go = async (page, view) => { await page.evaluate((h) => { window.location.hash = h; }, view); await page.waitForTimeout(350); };
const text = (page) => page.evaluate(() => document.body.innerText);

(async () => {
  const browser = await chromium.launch();

  // ── Phone width: no view may scroll sideways ──
  const phone = await open(browser, { width: 390, height: 800 });
  for (const view of ['store', 'panel', 'admin', 'blueprint']) {
    await go(phone, view);
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no horizontal scroll on ${view} at 390px`, overflow <= 1, `${overflow}px`);
  }
  await go(phone, 'admin');
  await phone.click(tab('تنظیمات سایت'));
  check('settings page fits a phone', (await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  await phone.close();

  const page = await open(browser, { width: 1366, height: 900 });

  // ── Storefront ──
  check('hero tagline is removed', !(await text(page)).includes('تانل اختصاصی گیمینگ · MikroTik'));
  await page.click('button:has-text("بدون دوپینگ")');
  const ispPing = Number(await page.locator('main li >> nth=0').locator('.mono >> nth=2').innerText());
  await page.click('button:has-text("با دوپینگ")');
  await page.waitForTimeout(200);
  const dpPing = Number(await page.locator('main li >> nth=0').locator('.mono >> nth=2').innerText());
  check('ping widget shows a lower ping with Doping', dpPing > 0 && dpPing < ispPing, `${ispPing} → ${dpPing}`);
  check('server list has Steam connect links', (await page.locator('a[href^="steam://connect/"]').count()) >= 5);

  // purchase with a discount code, paid from the wallet
  await page.click('#pricing button:has-text("فعال‌سازی") >> nth=1');
  await page.fill('#co-code', 'doping20');
  await page.click('button:has-text("اعمال")');
  check('discount code is applied', (await text(page)).includes('DOPING20'));
  await page.click('[role=dialog] button:has-text("پرداخت")');
  await page.waitForSelector('text=سرویس فعال شد', { timeout: 8000 });
  await page.click('text=برو به پنل');
  await page.waitForTimeout(400);

  // ── Gamer panel ──
  check('purchase resets the quota to 30 GB', (await text(page)).includes('GB / 30 GB'));
  await page.click(tab('مرکز اتصال'));
  check('config uses the default endpoint', (await text(page)).includes('thr1.doping.games:51820'));
  await page.click('text=QR برای موبایل');
  check('QR code renders', (await page.locator('[role=dialog] svg path').count()) > 0);
  await page.keyboard.press('Escape');
  await page.click(tab('DNS هوشمند'));
  await page.fill('#dns-manual', '10.0.0.1');
  await page.click('button:has-text("افزودن")');
  check('private IP is refused for DNS', (await text(page)).includes('آی‌پی داخلی قبول نیست'));
  await page.fill('#dns-manual', '85.185.20.14');
  await page.click('button:has-text("افزودن")');
  await page.waitForTimeout(1300);
  check('public IP is whitelisted', (await text(page)).includes('85.185.20.14'));

  // ── Admin: routers, users, RCON ──
  await go(page, 'admin');
  await page.click('text=تست اتصال و سینک میکروتیک >> nth=0');
  await page.waitForSelector('text=✓ sync complete', { timeout: 8000 });
  await page.keyboard.press('Escape');
  await page.click('main button:has-text("افزودن روتر")');
  await page.click('[role=dialog] button:has-text("افزودن روتر")');
  check('router form validates', (await text(page)).includes('آی‌پی نسخه ۴ معتبر وارد کن'));
  await page.keyboard.press('Escape');
  await page.click(tab('کاربران و حجم'));
  await page.click('button[title="Add Traffic"] >> nth=5');
  check('adding traffic re-activates an exceeded user', (await text(page)).includes('۵ گیگ به HiradTap اضافه شد'));
  await page.click(tab('سرورهای بازی'));
  await page.click('table button:has-text("RCON") >> nth=0');
  await page.fill('#rcon-cmd', 'changelevel de_nuke');
  await page.keyboard.press('Enter');
  await page.fill('#rcon-cmd', 'rm -rf /');
  await page.keyboard.press('Enter');
  check('RCON refuses commands outside the allow-list', (await text(page)).includes('Unknown command'));
  await page.keyboard.press('Escape');

  // ── Admin: site settings ──
  await page.click(tab('تنظیمات سایت'));
  check('save is disabled with nothing changed', await page.locator('button:has-text("ذخیره")').isDisabled());
  await page.fill('#set-dns-primary', '999.1.1.1');
  await page.click('button:has-text("ذخیره")');
  check('invalid DNS blocks saving', (await text(page)).includes('آی‌پی نسخه ۴ معتبر وارد کن'));
  await page.fill('#set-dns-primary', '185.55.226.26');
  await page.fill('#set-hero-accent', 'توربو');
  await page.fill('#set-hero-desc', 'متن آزمایشی تنظیمات.');
  await page.fill('#set-wg-endpoint', 'edge.example.ir:51820');
  await page.fill('#set-stats-0-value', '19ms');
  await page.fill('#set-games-0-name', 'Test Game X');
  await page.fill('#set-footer', 'فوتر آزمایشی');
  await page.fill('#set-accent', '#00A86B');
  await page.click('button:has-text("پرسش جدید")');
  const n = (await page.locator('[id^="set-faq-"][id$="-q"]').count()) - 1;
  await page.fill(`#set-faq-${n}-q`, 'پرسش آزمایشی؟');
  await page.fill(`#set-faq-${n}-a`, 'پاسخ آزمایشی.');
  await page.locator('button[role=switch][aria-label="نمایش پلن‌ها"]').click();
  await page.click('button:has-text("ذخیره")');
  await page.waitForTimeout(300);
  check('settings save succeeds', (await text(page)).includes('تنظیمات ذخیره شد'));

  await go(page, 'store');
  let body = await text(page);
  check('hero accent word changes', body.includes('توربو'));
  check('hero description changes', body.includes('متن آزمایشی تنظیمات.'));
  check('stat value changes', body.includes('19ms'));
  check('game name changes', body.includes('Test Game X'));
  check('new FAQ appears', body.includes('پرسش آزمایشی؟'));
  check('footer changes', body.includes('فوتر آزمایشی'));
  check('pricing section is hidden', (await page.locator('#pricing').count()) === 0);
  check('servers changed over RCON show the new map', body.includes('de_nuke'));
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim());
  check('accent colour is applied', accent.toUpperCase() === '#00A86B', accent);

  await go(page, 'panel');
  await page.click(tab('مرکز اتصال'));
  check('panel config uses the new endpoint', (await text(page)).includes('edge.example.ir:51820'));
  await page.click(tab('DNS هوشمند'));
  check('panel shows the new DNS', (await text(page)).includes('185.55.226.26'));

  // settings survive a reload
  await page.reload();
  await page.waitForSelector('main');
  await go(page, 'store');
  check('settings persist after reload', (await text(page)).includes('توربو'));

  // reset to defaults
  await go(page, 'admin');
  await page.click(tab('تنظیمات سایت'));
  await page.click('button:has-text("پیش‌فرض")');
  await page.click('button:has-text("ذخیره")');
  await go(page, 'store');
  body = await text(page);
  check('reset restores the default hero', body.includes('دوپینگ') && !body.includes('توربو'));
  check('reset restores the pricing section', (await page.locator('#pricing').count()) === 1);

  await browser.close();
  console.log(`${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
