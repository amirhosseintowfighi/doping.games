import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from '../../lib/server/crypto';
import { checkCommand, decodePackets, encodePacket, parseInfo, parsePlayers } from '../../lib/server/gameq';
import { counterDelta, firstFree, generateWireGuardKeys, nextStatus, parseRouterDuration } from '../../lib/server/vpn';
import { durations, pingTiers, priceOf, seedSite, validateSite } from '../../src/data.js';

test('secrets: round trip, bound to their row', () => {
  const env = encryptSecret('router-pass', 'router:1:api_pass');
  assert.match(env, /^v1\.dev\./);
  assert.equal(decryptSecret(env, 'router:1:api_pass'), 'router-pass');
  assert.throws(() => decryptSecret(env, 'router:2:api_pass'), 'ciphertext moved to another row must fail');
  const parts = env.split('.');
  parts[4] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => decryptSecret(parts.join('.'), 'router:1:api_pass'));
});

test('passwords: scrypt hash verifies only the right password', () => {
  const h = hashPassword('Gamer-pass-123');
  assert.ok(verifyPassword('Gamer-pass-123', h));
  assert.ok(!verifyPassword('gamer-pass-123', h));
  assert.notEqual(hashPassword('x'), hashPassword('x'), 'salted');
});

test('wireguard keys are 32-byte base64 values', () => {
  const k = generateWireGuardKeys();
  for (const v of [k.privateKey, k.publicKey, k.presharedKey]) assert.equal(Buffer.from(v, 'base64').length, 32);
});

test('address pool skips network, gateway, broadcast and used addresses', () => {
  assert.equal(firstFree('10.10.30.0/24', new Set()), '10.10.30.2');
  assert.equal(firstFree('10.10.30.0/24', new Set(['10.10.30.2', '10.10.30.3'])), '10.10.30.4');
  const all = new Set(Array.from({ length: 253 }, (_, i) => `10.10.30.${i + 2}`));
  all.delete('10.10.30.254');
  assert.equal(firstFree('10.10.30.0/24', all), '10.10.30.254');
  all.add('10.10.30.254');
  assert.equal(firstFree('10.10.30.0/24', all), null);
  assert.equal(firstFree('10.66.0.0/16', new Set()), '10.66.0.2');
});

test('queue counters survive router reboots', () => {
  assert.equal(counterDelta(500n, 200n), 300n);
  assert.equal(counterDelta(50n, 200n), 50n, 'counter restarted from zero');
});

test('quota and expiry rules', () => {
  const future = new Date(Date.now() + 86_400_000);
  assert.equal(nextStatus({ status: 'active', quotaBytes: 100, expiresAt: future }, 99), 'active');
  assert.equal(nextStatus({ status: 'active', quotaBytes: 100, expiresAt: future }, 100), 'quota');
  assert.equal(nextStatus({ status: 'active', quotaBytes: null, expiresAt: future }, 1e15), 'active');
  assert.equal(nextStatus({ status: 'active', quotaBytes: null, expiresAt: new Date(Date.now() - 1) }, 0), 'expired');
  assert.equal(nextStatus({ status: 'disabled', quotaBytes: 100, expiresAt: future }, 0), 'disabled');
});

test('RouterOS durations', () => {
  assert.equal(parseRouterDuration('12s'), 12);
  assert.equal(parseRouterDuration('1w2d3h4m5s'), 604800 + 172800 + 10800 + 240 + 5);
});

const head = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const str = (s: string) => Buffer.concat([Buffer.from(s), Buffer.from([0])]);

test('A2S_INFO and A2S_PLAYER replies parse', () => {
  const info = Buffer.concat([head, Buffer.from([0x49, 17]), str('Doping #1'), str('de_nuke'), str('cs2'), str('Counter-Strike 2'), Buffer.from([0xda, 0x02, 7, 10, 2])]);
  assert.deepEqual(parseInfo(info), { name: 'Doping #1', map: 'de_nuke', folder: 'cs2', game: 'Counter-Strike 2', players: 7, max: 10, bots: 2 });
  const n = Buffer.alloc(8); n.writeInt32LE(15, 0); n.writeFloatLE(125.6, 4);
  const players = Buffer.concat([head, Buffer.from([0x44, 1, 0]), str('Arash'), n]);
  assert.deepEqual(parsePlayers(players), [{ name: 'Arash', score: 15, time: 126 }]);
  assert.throws(() => parseInfo(Buffer.concat([head, Buffer.from([0x41, 1, 2, 3, 4])])));
});

test('RCON packets encode and decode, split across chunks', () => {
  const a = encodePacket(7, 2, 'status');
  assert.equal(a.readInt32LE(0), 10 + 6);
  const both = Buffer.concat([a, encodePacket(8, 0, 'hello')]);
  const first = decodePackets(both.subarray(0, a.length + 3));
  assert.deepEqual(first.packets, [{ id: 7, type: 2, body: 'status' }]);
  const rest = decodePackets(Buffer.concat([first.rest, both.subarray(a.length + 3)]));
  assert.deepEqual(rest.packets, [{ id: 8, type: 0, body: 'hello' }]);
});

test('RCON allow-list', () => {
  assert.equal(checkCommand('changelevel de_dust2'), null);
  assert.equal(checkCommand('status'), null);
  assert.ok(checkCommand('rcon_password x'));
  assert.ok(checkCommand('say hi; quit'), 'no chained commands');
  assert.ok(checkCommand(''));
});

test('pricing: durations discount, pro multiplier', () => {
  const site = seedSite();
  const P = site.pricing;
  const tier = pingTiers(P)[0];
  const one = priceOf(P, { kind: 'ping', tier, months: 1 });
  assert.ok(one.total > 0);
  const longest = durations(P).at(-1)!;
  const many = priceOf(P, { kind: 'ping', tier, months: longest.months });
  assert.ok(many.total <= one.total * longest.months);
  const pro = priceOf(P, { kind: 'pro', tier, months: 1 });
  assert.ok(pro.total > one.total);
});

test('site validation catches bad input', () => {
  const site = seedSite();
  assert.deepEqual(validateSite(site), {});
  assert.ok(Object.keys(validateSite({ ...site, accent: 'red' })).length > 0);
});
