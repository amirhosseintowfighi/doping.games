import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFiles } from '../../lib/server/attachments';
import { HttpError } from '../../lib/server/http';
import { normalizePhone, otpCode } from '../../lib/server/tokens';
import { adminsSimple, steam2 } from '../../lib/server/vip';
import { migrateSite, seedSite, validateSite } from '../../src/data.js';

test('phone numbers: every common Iranian shape becomes 09xxxxxxxxx', () => {
  for (const v of ['09121234567', '+989121234567', '00989121234567', '989121234567', '9121234567', '۰۹۱۲۱۲۳۴۵۶۷', '0912 123 4567', '0912-123-4567']) {
    assert.equal(normalizePhone(v), '09121234567', v);
  }
  for (const v of ['0812345678', '091212345', '+14155550100', 'abc', '']) assert.equal(normalizePhone(v), null, v);
});

test('one-time codes are 6 digits', () => {
  for (let i = 0; i < 50; i++) assert.match(otpCode(), /^\d{6}$/);
});

test('SteamID64 → STEAM_1:Y:Z for SourceMod', () => {
  assert.equal(steam2('76561197960287930'), 'STEAM_1:0:11101'); // Gabe Newell
  assert.equal(steam2('76561197960265729'), 'STEAM_1:1:0');
  const ini = adminsSimple([{ steamId64: '76561197960287930', steam2: 'STEAM_1:0:11101', username: 'gabe"; drop', flags: 'ao' }]);
  assert.match(ini, /^"STEAM_1:0:11101" "ao" \/\/ gabedrop$/m);
});

test('attachments: type comes from the bytes, size and type are enforced', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  const [a] = decodeFiles([{ name: 'shot.png', data: png.toString('base64') }]);
  assert.equal(a!.mime, 'image/png');
  assert.equal(a!.size, png.length);
  const [t] = decodeFiles([{ name: '../tracert.txt', data: Buffer.from('Tracing route to 1.1.1.1\n  1  <1 ms').toString('base64') }]);
  assert.equal(t!.mime, 'text/plain');
  assert.equal(t!.name, '.._tracert.txt');
  const html = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]).toString('base64');
  assert.throws(() => decodeFiles([{ name: 'x.exe', data: html }]), (e: unknown) => e instanceof HttpError && e.status === 415);
  const big = Buffer.alloc(2 * 1024 * 1024 + 1, 0x41).toString('base64');
  assert.throws(() => decodeFiles([{ name: 'big.txt', data: big }]), (e: unknown) => e instanceof HttpError && e.status === 413);
});

test('site settings: device limits and referral share are validated and migrated', () => {
  const site = seedSite();
  assert.deepEqual(validateSite(site), {});
  assert.deepEqual(site.account.devices, { ping: 2, pro: 3 });
  const bad = { ...site, account: { devices: { ping: 0, pro: 3 }, referralPercent: 80 } };
  const e = validateSite(bad);
  assert.ok(e['account.devices.ping']);
  assert.ok(e['account.referralPercent']);
  // Settings saved before this build have no "account" block: defaults fill in.
  const old = JSON.parse(JSON.stringify(site));
  delete old.account;
  const m = migrateSite(old, seedSite(), () => 'cs2');
  assert.equal(m.account.devices.pro, 3);
  assert.equal(m.account.referralPercent, 10);
  const partial = migrateSite({ ...old, account: { devices: { ping: 4 } } }, seedSite(), () => 'cs2');
  assert.deepEqual(partial.account.devices, { ping: 4, pro: 3 });
});
