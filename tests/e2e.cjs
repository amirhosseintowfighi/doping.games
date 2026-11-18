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
  await page.evaluate(() => Promise.all([...document.querySelectorAll('main img')].map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); })));
  const covers = await page.evaluate(() => [...document.querySelectorAll('main img')].map((i) => i.complete && i.naturalWidth > 0));
  check('all game covers load', covers.length >= 15 && covers.every(Boolean), `${covers.filter(Boolean).length}/${covers.length}`);

  // hero route scene
  check('hero scene animates packets on the tunnel', (await page.locator('main svg animateMotion').count()) >= 3);
  await page.click('g[role=button][aria-label^="خروجی دبی"]');
  check('clicking an exit in the scene selects it', (await page.getAttribute('g[role=button][aria-label^="خروجی دبی"]', 'aria-pressed')) === 'true');
  check('scene exit choice reaches the ping test', (await page.inputValue('#ping-exit')) === 'dxb');
  await page.focus('g[role=button][aria-label^="خروجی مسقط"]');
  await page.keyboard.press('Enter');
  check('exits work from the keyboard', (await page.inputValue('#ping-exit')) === 'mct');
  await page.click('[role=radio][aria-label="مقصد Dota 2"]');
  check('scene game choice reaches the ping test', (await page.getAttribute('#ping-test [role=radio][aria-label="Dota 2"]', 'aria-checked')) === 'true');
  check('scene shows the chosen game', (await page.locator('main svg text:has-text("Valve Dubai")').count()) >= 1);
  await page.click('[role=tab]:has-text("بدون دوپینگ")');
  check('route switch shows the ordinary route', (await text(page)).includes('٪ پکت لاس'));
  await page.click('[role=tab]:has-text("با دوپینگ")');
  check('route switch back shows the exit', (await text(page)).includes('از خروجی مسقط'));

  // ping test: pick an ISP and a game, wait for the run to finish, compare
  await page.selectOption('#ping-isp', 'rightel');
  await page.click('#ping-test [role=radio][aria-label="VALORANT"]');
  check('ping test runs after a change', (await text(page)).includes('در حال تست'));
  await page.waitForSelector('#ping-test button:has-text("تست دوباره"):not([disabled])', { timeout: 8000 });
  const avgs = await page.$$eval('#ping-test dd.text-2xl', (els) => els.map((e) => Number(e.querySelector('.mono').textContent)));
  check('Doping ping is lower than the ISP route', avgs[1] > 0 && avgs[1] < avgs[0], avgs.join(' → '));
  check('chosen game is marked', (await page.getAttribute('#ping-test [role=radio][aria-label="VALORANT"]', 'aria-checked')) === 'true');

  // game details
  await page.click('button[aria-label="جزئیات Counter-Strike 2"]');
  check('game details open', (await text(page)).includes('پینگ از هر خروجی'));
  const box = await page.locator('[role=dialog] > div.glass').boundingBox();
  check('dialog is inside the viewport', box && box.y >= 0 && box.y + box.height <= 900, JSON.stringify(box));
  await page.click('[role=dialog] button:has-text("تست پینگ این بازی")');
  check('details close and start a test for that game', (await page.locator('[role=dialog]').count()) === 0 && (await page.getAttribute('#ping-test [role=radio][aria-label="Counter-Strike 2"]', 'aria-checked')) === 'true');
  await page.waitForSelector('#ping-test button:has-text("تست دوباره"):not([disabled])', { timeout: 8000 });

  // traffic calculator → recommended plan
  for (const el of await page.$$('button[aria-pressed="true"]:has(img)')) await el.click();
  await page.click('button[aria-pressed]:has-text("Warzone")');
  await page.fill('#calc-hours', '12');
  await page.fill('#calc-days', '7');
  check('calculator recommends 100 GB for heavy Warzone play', (await text(page)).includes('کاهش پینگ · ۱۰۰ گیگ'));
  await page.click('button:has-text("انتخاب این پلن")');
  check('pricing highlights the recommended plan', (await page.locator('[data-plan="100"]').innerText()).includes('پیشنهاد برای تو'));

  // servers: scoreboard and favourites
  await page.locator('#servers ul > li').nth(2).locator('button[aria-expanded]').click();
  check('server row opens a live scoreboard', (await text(page)).includes('جدول امتیاز زنده'));
  await page.locator('#servers ul > li').nth(2).locator('button[aria-pressed]').click();
  check('favourites tab appears', (await page.locator('#servers [role=tab]:has-text("علاقه‌مندی‌ها")').count()) === 1);
  await page.click('#servers [role=tab]:has-text("علاقه‌مندی‌ها")');
  check('favourites tab lists one server', (await page.locator('#servers ul > li').count()) === 1);
  await page.click('#servers [role=tab]:has-text("همه")');
  check('server list has Steam connect links', (await page.locator('a[href^="steam://connect/"]').count()) >= 5);

  // ── Motion ──
  const depthTransform = () => page.evaluate(() => document.querySelector('#faq [data-depth]')?.style.transform ?? '');
  await page.evaluate(() => document.getElementById('faq').scrollIntoView({ block: 'end', behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('#faq [data-depth]')?.style.transform, null, { timeout: 3000 }).catch(() => {});
  const t1 = await depthTransform();
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(250);
  const t2 = await depthTransform();
  check('FAQ parallax layers move with scroll', t1.startsWith('translate3d') && t1 !== t2, `${t1} → ${t2}`);

  await page.fill('#faq-search', 'کنسول');
  check('FAQ search filters questions', (await page.locator('#faq button[aria-expanded]').count()) === 1);
  await page.fill('#faq-search', 'قورباغه');
  check('FAQ search says when nothing matches', (await text(page)).includes('پرسشی با «قورباغه» پیدا نشد'));
  await page.fill('#faq-search', '');
  const q2 = page.locator('#faq button[aria-expanded]').nth(1);
  await q2.click();
  check('FAQ question opens', (await q2.getAttribute('aria-expanded')) === 'true');
  check('closed FAQ answers are inert', (await page.locator('#faq [id^="faq-a-"][inert]').count()) === (await page.locator('#faq [id^="faq-a-"]').count()) - 1);

  const cover = page.locator('button[aria-label="جزئیات Dota 2"]');
  await cover.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400); // let the parallax settle before aiming the cursor
  const cb = await cover.boundingBox();
  await page.mouse.move(cb.x + cb.width * 0.35, cb.y + cb.height * 0.35);
  await page.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height * 0.3);
  const rx = await cover.evaluate((el) => el.style.getPropertyValue('--rx'));
  check('covers tilt toward the cursor', rx && rx !== '0deg', rx);
  await page.mouse.move(5, 5);

  await page.evaluate(() => document.getElementById('faq').scrollIntoView());
  const shown = await page.waitForFunction(() => getComputedStyle(document.querySelector('button[aria-label="برگشت به بالای صفحه"]')).opacity === '1', null, { timeout: 3000 }).then(() => true, () => false);
  check('back-to-top appears after scrolling', shown);
  await page.click('button[aria-label="برگشت به بالای صفحه"]');
  await page.waitForFunction(() => window.scrollY < 50, null, { timeout: 4000 });
  check('back-to-top scrolls to the top', true);
  await page.waitForTimeout(1000);
  check('stats count up to their final values', (await text(page)).includes('28ms') && (await text(page)).includes('0%'));

  await page.keyboard.press('/');
  check('"/" focuses the server search', await page.evaluate(() => document.activeElement?.id === 'srv-search'));
  await page.keyboard.press('Escape');

  await page.click('#faq button:has-text("سؤالت اینجا نیست")');
  await page.waitForTimeout(300);
  check('FAQ help button opens the support tab', (await page.getAttribute('[role=tab]:has-text("پشتیبانی")', 'aria-selected')) === 'true');
  await go(page, 'store');

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
  await page.hover('[role=listbox] [role=option] >> nth=0');
  const firstDay = await page.locator('[aria-live=polite]:has-text("دانلود")').innerText();
  check('usage chart shows the hovered day', !firstDay.includes('امروز'));
  await page.click('[role=tab]:has-text("آپلود")');
  check('usage chart filters to upload', (await page.getAttribute('[role=tab]:has-text("آپلود")', 'aria-selected')) === 'true');
  await page.click(tab('مرکز اتصال'));
  check('config uses the default endpoint', (await text(page)).includes('thr1.doping.games:51820'));
  await page.click('text=QR برای موبایل');
  check('QR code renders', (await page.locator('[role=dialog] svg path').count()) > 0);
  await page.keyboard.press('Escape');
  await page.click('[role=tab]:has-text("روتر میکروتیک")');
  check('router guide uses the endpoint', (await text(page)).includes('endpoint-address=thr1.doping.games endpoint-port=51820'));
  await page.click('button[aria-label="علامت زدن قدم 1"]');
  check('guide step can be checked', (await text(page)).includes('۱ از ۳ قدم'));
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
  await page.fill('#rcon-cmd', 'sv_cheats 1');
  await page.keyboard.press('Enter');
  check('RCON refuses commands outside the allow-list', (await text(page)).includes('Unknown command'));
  await page.keyboard.press('Escape');

  // ── Admin: records that survive a reload ──
  await page.click(tab('سرورهای بازی'));
  await page.click('main button:has-text("افزودن سرور")');
  await page.fill('#gs-name', 'Doping Test Server');
  await page.fill('#gs-host', 'test.doping.games');
  await page.click('[role=dialog] button:has-text("افزودن سرور")');
  check('admin can add a game server', (await text(page)).includes('Doping Test Server'));
  await page.click(tab('فروش و درگاه'));
  await page.fill('#dc-code', 'PERSIST1');
  await page.click('button:has-text("ساخت")');
  check('admin can add a discount code', (await text(page)).includes('PERSIST1'));
  await page.click('button:has-text("ویرایش قیمت‌ها و پلن‌ها")');
  check('price shortcut opens the plans settings', (await page.getAttribute('[aria-label="بخش‌های تنظیمات"] [role=tab]:has-text("پلن‌ها و قیمت")', 'aria-selected')) === 'true');

  // ── Admin: site settings ──
  const sub = (label) => page.click(`[aria-label="بخش‌های تنظیمات"] [role=tab]:has-text("${label}")`);
  check('save is disabled with nothing changed', await page.locator('button:has-text("ذخیره")').isDisabled());
  await sub('اتصال و DNS');
  await page.fill('#set-dns-primary', '999.1.1.1');
  await sub('صفحه اصلی');
  await page.click('button:has-text("ذخیره")');
  check('invalid DNS blocks saving', (await text(page)).includes('آی‌پی نسخه ۴ معتبر وارد کن'));
  check('saving jumps to the sub-tab with the error', (await page.getAttribute('[aria-label="بخش‌های تنظیمات"] [role=tab]:has-text("اتصال و DNS")', 'aria-selected')) === 'true');
  await page.fill('#set-dns-primary', '185.55.226.26');
  await page.fill('#set-wg-endpoint', 'edge.example.ir:51820');

  await sub('صفحه اصلی');
  await page.locator('button[role=switch][aria-label="نمایش نوار اطلاعیه"]').click();
  await page.fill('#set-banner-text', 'اطلاعیه آزمایشی دوپینگ');
  await page.fill('#set-hero-accent', 'توربو');
  await page.fill('#set-hero-desc', 'متن آزمایشی تنظیمات.');
  await page.fill('#set-stats-0-value', '19ms');
  await page.fill('#set-text-ping-title', 'تیتر آزمایشی تست پینگ');
  await page.click('button[aria-label="پایین بردن بازی‌های تحت پوشش"]');
  await page.locator('button[role=switch][aria-label="نمایش بخش پایانی"]').click();

  await sub('بازی‌ها');
  await page.fill('#set-games-0-name', 'Test Game X');
  await page.click('button[aria-label="جزئیات بازی VALORANT"]');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAAPAAHZ0QJNAAAAAElFTkSuQmCC', 'base64');
  await page.setInputFiles('#set-games-1-file', { name: 'cover.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => document.querySelector('#set-games-1-cover')?.value === 'upload', null, { timeout: 5000 });
  await page.click('button:has-text("بازی جدید")');
  const g = (await page.locator('[id^="set-games-"][id$="-name"]').count()) - 1;
  await page.fill(`#set-games-${g}-name`, 'Arena Breakout');
  await page.fill(`#set-games-${g}-dc`, 'Tencent ME');
  await page.fill(`#set-games-${g}-via-dxb`, '24');
  await page.locator('button[role=switch][aria-label="تست پینگ Arena Breakout"]').click();

  await sub('پلن‌ها و قیمت');
  await page.fill('#set-planNames-ping', 'کاهش لگ');
  await page.fill('#set-pricing-ping-1-price', '125000');
  await page.click('button:has-text("حجم جدید")');
  await page.click('button:has-text("مدت جدید")');

  await sub('پرسش‌ها');
  await page.click('button:has-text("پرسش جدید")');
  const n = (await page.locator('[id^="set-faq-"][id$="-q"]').count()) - 1;
  await page.fill(`#set-faq-${n}-q`, 'پرسش آزمایشی؟');
  await page.fill(`#set-faq-${n}-a`, 'پاسخ آزمایشی.');

  await sub('ظاهر و پشتیبان');
  await page.fill('#set-footer', 'فوتر آزمایشی');
  await page.fill('#set-accent', '#00A86B');
  await page.locator('button[role=switch][aria-label="افکت‌های حرکتی"]').click();
  await page.fill('#set-import', 'this is not json');
  await page.click('button:has-text("بررسی و وارد کردن")');
  check('import rejects text that is not JSON', (await text(page)).includes('متن JSON معتبر نیست'));
  await page.fill('#set-import', '');

  await page.click('button:has-text("ذخیره")');
  await page.waitForTimeout(300);
  check('settings save succeeds', (await text(page)).includes('تنظیمات ذخیره شد'));

  await go(page, 'store');
  let body = await text(page);
  check('announcement bar shows', body.includes('اطلاعیه آزمایشی دوپینگ'));
  await page.click('button[aria-label="بستن اطلاعیه"]');
  check('announcement bar can be closed', !(await text(page)).includes('اطلاعیه آزمایشی دوپینگ'));
  check('hero accent word changes', body.includes('توربو'));
  check('hero description changes', body.includes('متن آزمایشی تنظیمات.'));
  check('stat value changes', body.includes('19ms'));
  check('ping section title changes', body.includes('تیتر آزمایشی تست پینگ'));
  check('game name changes', body.includes('Test Game X'));
  const upSrc = await page.locator('button[aria-label^="جزئیات"]').nth(1).locator('img').getAttribute('src');
  check('uploaded cover is shown', (upSrc ?? '').startsWith('data:image/'));
  check('new game appears in covered games', (await page.locator('button[aria-label="جزئیات Arena Breakout"]').count()) === 1);
  check('new featured game appears in the hero scene', (await page.locator('[role=radio][aria-label="مقصد Arena Breakout"]').count()) === 1);
  check('new featured game appears in the ping test', (await page.locator('#ping-test [role=radio][aria-label="Arena Breakout"]').count()) === 1);
  await page.click('[role=radio][aria-label="مقصد Arena Breakout"]');
  check('new game uses its own exit pings', (await text(page)).includes('24ms'));
  const order = await page.$$eval('[data-section]', (els) => els.map((e) => e.dataset.section));
  check('section order follows settings', order.indexOf('calculator') < order.indexOf('games'), order.join(','));
  check('hidden section is removed', !order.includes('cta'));
  check('plan name changes', (await page.locator('#pricing [role=tab]:has-text("کاهش لگ")').count()) === 1);
  check('tier price changes', (await page.locator('[data-plan="30"]').innerText()).includes('۱۲۵'));
  check('new tier appears', (await page.locator('[data-plan="150"]').count()) === 1);
  check('new duration appears', (await page.locator('#pricing [role=tab]:has-text("۹ ماهه")').count()) === 1);
  check('new FAQ appears', body.includes('پرسش آزمایشی؟'));
  check('footer changes', body.includes('فوتر آزمایشی'));
  await page.evaluate(() => document.getElementById('faq').scrollIntoView());
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(200);
  check('motion switch turns parallax off', (await page.evaluate(() => [...document.querySelectorAll('[data-depth]')].every((el) => !el.style.transform))));
  check('servers changed over RCON show the new map', body.includes('de_nuke'));
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim());
  check('accent colour is applied', accent.toUpperCase() === '#00A86B', accent);

  await go(page, 'panel');
  check('panel uses the new plan name', (await text(page)).includes('کاهش لگ'));
  await page.click(tab('مرکز اتصال'));
  check('panel config uses the new endpoint', (await text(page)).includes('edge.example.ir:51820'));
  await page.click(tab('DNS هوشمند'));
  check('panel shows the new DNS', (await text(page)).includes('185.55.226.26'));

  // settings and admin records survive a reload
  await page.reload();
  await page.waitForSelector('main');
  await go(page, 'store');
  check('settings persist after reload', (await text(page)).includes('توربو'));
  check('prices persist after reload', (await page.locator('[data-plan="30"]').innerText()).includes('۱۲۵'));
  check('chosen ISP persists after reload', (await page.inputValue('#ping-isp')) === 'rightel');
  check('favourite server persists after reload', (await page.locator('#servers [role=tab]:has-text("علاقه‌مندی‌ها")').count()) === 1);
  check('added game server persists after reload', (await text(page)).includes('Doping Test Server'));
  await go(page, 'admin');
  await page.click(tab('فروش و درگاه'));
  check('added discount code persists after reload', (await text(page)).includes('PERSIST1'));

  // reset to defaults
  await page.click(tab('تنظیمات سایت'));
  await page.click('button:has-text("پیش‌فرض")');
  await page.click('button:has-text("ذخیره")');
  await go(page, 'store');
  body = await text(page);
  check('reset restores the default hero', body.includes('دوپینگ') && !body.includes('توربو'));
  check('reset restores default prices', (await page.locator('[data-plan="30"]').innerText()).includes('۱۱۹'));
  check('reset restores the closing section', (await page.locator('[data-section="cta"]').count()) === 1);

  // ── Visitors who ask for reduced motion get no parallax ──
  const calm = await browser.newPage({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
  await calm.goto(URL);
  await calm.waitForSelector('main');
  await calm.evaluate(() => document.getElementById('faq').scrollIntoView());
  await calm.mouse.wheel(0, 400);
  await calm.waitForTimeout(250);
  check('reduced motion disables parallax', await calm.evaluate(() => [...document.querySelectorAll('[data-depth]')].every((el) => !el.style.transform)));
  check('reduced motion still shows final numbers', (await text(calm)).includes('28ms'));
  check('reduced motion stops the packet animation', (await calm.locator('svg animateMotion').count()) === 0);
  await calm.close();

  await browser.close();
  console.log(`${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
