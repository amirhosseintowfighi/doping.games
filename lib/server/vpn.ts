// Subscriptions on the router side: WireGuard keys, tunnel addresses, peer + queue provisioning,
// key rotation, client configs, DNS whitelist entries and the quota worker.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, isNotNull, lte, ne, sql as dsql } from 'drizzle-orm';
import { audit } from './audit';
import { decryptSecret, encryptSecret } from './crypto';
import { db, schema, sql, withLock, type Tx } from './db';
import { MikroTikService, parseQueueBytes, queueName, type RouterRecord } from './mikrotik';
import type { Site } from './site';

export const GB = 1024 ** 3;
const DEFAULT_POOL = '10.66.0.0/16';
// Per-user shaping on the entry router (upload/download, Mbit/s).
const SHAPE = { up: 20, down: 100 };

type Sub = typeof schema.subscriptions.$inferSelect;
type RouterRow = typeof schema.routers.$inferSelect;

export function generateWireGuardKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  const toB64 = (b64url: string) => Buffer.from(b64url, 'base64url').toString('base64');
  return {
    privateKey: toB64(privateKey.export({ format: 'jwk' }).d!),
    publicKey: toB64(publicKey.export({ format: 'jwk' }).x!),
    presharedKey: randomBytes(32).toString('base64'),
  };
}

const aad = (subId: string, col: string) => `subscription:${subId}:${col}`;
const devAad = (deviceId: string, col: string) => `device:${deviceId}:${col}`;
type Dev = typeof schema.devices.$inferSelect;

export const routerRecord = (r: RouterRow): RouterRecord => ({
  id: r.id, name: r.name, host: r.host, apiPort: r.apiPort, apiUser: r.apiUser, apiPassEnc: r.apiPassEnc,
  tlsFingerprint: r.tlsFingerprint, wgInterface: r.wgInterface, dnsAddressList: r.dnsAddressList,
});

/* ───────── address pool ───────── */

const ipToInt = (ip: string) => ip.split('.').reduce((a, o) => a * 256 + Number(o), 0);
const intToIp = (n: number) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');

/** First free host address in the pool (network + .1 are reserved for the router). */
export function firstFree(subnet: string, used: Set<string>): string | null {
  const [base, bits] = subnet.split('/');
  const size = 2 ** (32 - Number(bits));
  const net = ipToInt(base!) - (ipToInt(base!) % size);
  for (let i = 2; i < size - 1; i++) {
    const ip = intToIp(net + i);
    if (!used.has(ip)) return ip;
  }
  return null;
}

async function allocateIp(tx: Tx, router: RouterRow | null): Promise<string> {
  // One allocation at a time across all app instances; the unique index on tunnel_ip is the backstop.
  await tx.execute(dsql`select pg_advisory_xact_lock(hashtext('doping-tunnel-pool'))`);
  const rows = await tx.select({ ip: schema.subscriptions.tunnelIp }).from(schema.subscriptions).where(isNotNull(schema.subscriptions.tunnelIp));
  const devs = await tx.select({ ip: schema.devices.tunnelIp }).from(schema.devices);
  const ip = firstFree(router?.subnet ?? DEFAULT_POOL, new Set([...rows.map((r) => r.ip!), ...devs.map((d) => d.ip)]));
  if (!ip) throw new Error('Tunnel address pool is exhausted');
  return ip;
}

/** The entry router with the fewest peers that is not known to be down. */
export async function pickEntryRouter(tx: Tx | typeof db = db): Promise<RouterRow | null> {
  const list = await tx.select().from(schema.routers)
    .where(and(eq(schema.routers.role, 'entry'), eq(schema.routers.enabled, true), ne(schema.routers.status, 'offline')))
    .orderBy(asc(schema.routers.peers));
  return list[0] ?? null;
}

/* ───────── plans ───────── */

export type PlanItem = { kind: 'ping' | 'dns' | 'pro'; tier: number | 'inf'; slots: number; months: number };

/**
 * A paid plan starts a fresh period on the account's single subscription: the quota becomes the
 * new tier, usage restarts from zero and the days are added on top of any time still left.
 * Runs inside the payment transaction; router calls happen afterwards (see provision()).
 */
export async function applyPlan(tx: Tx, userId: string, item: PlanItem): Promise<string> {
  const days = item.months * 30;
  const tunnel = item.kind !== 'dns';
  const quotaBytes = !tunnel || item.tier === 'inf' ? null : item.tier * GB;
  const dnsSlots = item.kind === 'dns' ? item.slots : item.kind === 'pro' ? Math.max(2, item.slots || 0) : 0;
  const existing = (await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).for('update'))[0];
  const start = existing && existing.expiresAt > new Date() ? existing.expiresAt : new Date();
  const expiresAt = new Date(start.getTime() + days * 86_400_000);
  const fields = {
    kind: item.kind, tierGb: item.tier === 'inf' || !tunnel ? null : item.tier, quotaBytes, dnsSlots: Math.max(dnsSlots, existing && existing.expiresAt > new Date() ? existing.dnsSlots : 0),
    usedUp: 0, usedDown: 0, status: 'active' as const, expiresAt,
  };
  if (existing) {
    const patch: Partial<Sub> = { ...fields };
    if (tunnel && !existing.tunnelIp) Object.assign(patch, await newTunnel(tx, existing.id));
    await tx.update(schema.subscriptions).set(patch).where(eq(schema.subscriptions.id, existing.id));
    return existing.id;
  }
  const [row] = await tx.insert(schema.subscriptions).values({ userId, ...fields }).returning({ id: schema.subscriptions.id });
  if (tunnel) await tx.update(schema.subscriptions).set(await newTunnel(tx, row!.id)).where(eq(schema.subscriptions.id, row!.id));
  return row!.id;
}

async function newTunnel(tx: Tx, subId: string) {
  const router = await pickEntryRouter(tx);
  const keys = generateWireGuardKeys();
  return {
    routerId: router?.id ?? null,
    tunnelIp: await allocateIp(tx, router),
    wgPublicKey: keys.publicKey,
    wgPrivateKeyEnc: encryptSecret(keys.privateKey, aad(subId, 'wg_private_key')),
    wgPresharedKeyEnc: encryptSecret(keys.presharedKey, aad(subId, 'wg_preshared_key')),
    keysRotatedAt: new Date(),
  };
}

/** Extra traffic on top of the current period. Re-activates a subscription that ran out of quota. */
export async function applyExtra(tx: Tx, userId: string, gb: number): Promise<string> {
  const sub = (await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).for('update'))[0];
  if (!sub || sub.quotaBytes == null) throw new Error('No metered subscription');
  const quota = sub.quotaBytes + gb * GB;
  const status = sub.status === 'quota' && sub.expiresAt > new Date() ? 'active' : sub.status;
  await tx.update(schema.subscriptions).set({ quotaBytes: quota, status }).where(eq(schema.subscriptions.id, sub.id));
  return sub.id;
}

/* ───────── router side ───────── */

async function withRouter<T>(routerId: string | null, fn: (m: MikroTikService, r: RouterRow) => Promise<T>): Promise<T | null> {
  if (!routerId) return null;
  const r = (await db.select().from(schema.routers).where(eq(schema.routers.id, routerId)).limit(1))[0];
  if (!r || !r.enabled) return null;
  const m = new MikroTikService(routerRecord(r));
  try {
    return await fn(m, r);
  } finally {
    m.close();
  }
}

/**
 * Makes the router match the subscription row: peer (enabled only while active) and queue.
 * Idempotent, so it is safe to call after every change and from the admin "sync" button.
 * Never throws: failures are stored on the row and in the audit log, and retried on the next sync.
 */
export async function provision(subId: string): Promise<{ ok: boolean; error?: string }> {
  let sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, subId)).limit(1))[0];
  if (!sub || !sub.tunnelIp || !sub.wgPublicKey || !sub.wgPresharedKeyEnc) return { ok: true };
  if (!sub.routerId) {
    const r = await pickEntryRouter();
    if (!r) {
      await db.update(schema.subscriptions).set({ provisionError: 'هنوز روتری در پنل تعریف نشده' }).where(eq(schema.subscriptions.id, subId));
      return { ok: false, error: 'no-router' };
    }
    await db.update(schema.subscriptions).set({ routerId: r.id }).where(eq(schema.subscriptions.id, subId));
    sub = { ...sub, routerId: r.id };
  }
  try {
    const devs = await db.select().from(schema.devices).where(eq(schema.devices.subscriptionId, sub.id)).orderBy(asc(schema.devices.createdAt));
    const res = await withRouter(sub.routerId, async (m, r) => {
      const disabled = sub!.status !== 'active';
      const psk = decryptSecret(sub!.wgPresharedKeyEnc!, aad(sub!.id, 'wg_preshared_key'));
      const peerId = await m.provisionPeer({ owner: sub!.id, publicKey: sub!.wgPublicKey!, presharedKey: psk, tunnelIp: sub!.tunnelIp!, disabled });
      for (const d of devs) {
        const dPsk = decryptSecret(d.wgPresharedKeyEnc, devAad(d.id, 'wg_preshared_key'));
        const dPeer = await m.provisionPeer({ owner: `${sub!.id}:${d.id}`, publicKey: d.wgPublicKey, presharedKey: dPsk, tunnelIp: d.tunnelIp, disabled });
        if (dPeer !== d.peerId || d.routerId !== r.id) await db.update(schema.devices).set({ peerId: dPeer, routerId: r.id }).where(eq(schema.devices.id, d.id));
      }
      const ips = [sub!.tunnelIp!, ...devs.map((d) => d.tunnelIp)];
      const queueId = await m.upsertQueue({ subscriptionId: sub!.id, tunnelIps: ips, maxUploadMbps: SHAPE.up, maxDownloadMbps: SHAPE.down, quotaBytes: sub!.quotaBytes == null ? null : BigInt(sub!.quotaBytes) });
      await m.syncExitLists(sub!.id, sub!.exit, ips);
      await db.update(schema.subscriptions).set({ peerId, queueId, provisionedAt: new Date(), provisionError: null }).where(eq(schema.subscriptions.id, sub!.id));
      await audit('mikrotik', 'info', `peer ${peerId}${devs.length ? ` + ${devs.length} device peer(s)` : ''} + queue ${queueName(sub!.id)} synced · ${ips.join(',')} · exit ${sub!.exit} · disabled=${disabled}`, 'provisioner', r.host);
      return true;
    });
    return { ok: !!res };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(schema.subscriptions).set({ provisionError: msg.slice(0, 300) }).where(eq(schema.subscriptions.id, subId));
    await audit('mikrotik', 'critical', `provision failed · ${subId} · ${msg}`, 'provisioner');
    return { ok: false, error: msg };
  }
}

/** Every peer of a subscription (main config + devices) enabled or disabled together. */
async function setAllPeers(m: MikroTikService, subId: string, peerId: string | null, disabled: boolean) {
  if (peerId) await m.setPeerDisabled(peerId, disabled);
  const devs = await db.select({ peerId: schema.devices.peerId }).from(schema.devices).where(eq(schema.devices.subscriptionId, subId));
  for (const d of devs) if (d.peerId) await m.setPeerDisabled(d.peerId, disabled);
}

/** Reset queue counters on the router at the start of a new period (after applyPlan). */
export async function resetCounters(subId: string) {
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, subId)).limit(1))[0];
  if (!sub?.queueId) return;
  try {
    await withRouter(sub.routerId, (m) => m.resetQueueCounters(sub.queueId!));
    await db.update(schema.subscriptions).set({ lastSeenUp: 0, lastSeenDown: 0 }).where(eq(schema.subscriptions.id, subId));
  } catch (err) {
    await audit('mikrotik', 'warn', `reset-counters failed · ${subId} · ${(err as Error).message}`, 'provisioner');
  }
}

/** New key pair + preshared key for the main config or one device; the peer is updated in place. */
export async function rotateKeys(subId: string, deviceId?: string) {
  const keys = generateWireGuardKeys();
  if (deviceId) {
    await db.update(schema.devices).set({
      wgPublicKey: keys.publicKey,
      wgPrivateKeyEnc: encryptSecret(keys.privateKey, devAad(deviceId, 'wg_private_key')),
      wgPresharedKeyEnc: encryptSecret(keys.presharedKey, devAad(deviceId, 'wg_preshared_key')),
    }).where(and(eq(schema.devices.id, deviceId), eq(schema.devices.subscriptionId, subId)));
  } else {
    await db.update(schema.subscriptions).set({
      wgPublicKey: keys.publicKey,
      wgPrivateKeyEnc: encryptSecret(keys.privateKey, aad(subId, 'wg_private_key')),
      wgPresharedKeyEnc: encryptSecret(keys.presharedKey, aad(subId, 'wg_preshared_key')),
      keysRotatedAt: new Date(),
    }).where(eq(schema.subscriptions.id, subId));
  }
  return provision(subId);
}

/** How many configs (main + extra devices) a plan may have. DNS-only plans have no tunnel. */
export const deviceLimit = (site: Site, kind: Sub['kind']) => (kind === 'dns' ? 0 : Math.max(1, site.account.devices[kind] ?? 1));

/** Adds a device config: its own key pair and tunnel address, sharing the subscription's quota and queue. */
export async function addDevice(sub: Sub, name: string): Promise<Dev> {
  const dev = await db.transaction(async (tx) => {
    const router = sub.routerId ? (await tx.select().from(schema.routers).where(eq(schema.routers.id, sub.routerId)).limit(1))[0] ?? null : await pickEntryRouter(tx);
    const keys = generateWireGuardKeys();
    const id = crypto.randomUUID();
    const [row] = await tx.insert(schema.devices).values({
      id, subscriptionId: sub.id, name, tunnelIp: await allocateIp(tx, router), wgPublicKey: keys.publicKey,
      wgPrivateKeyEnc: encryptSecret(keys.privateKey, devAad(id, 'wg_private_key')),
      wgPresharedKeyEnc: encryptSecret(keys.presharedKey, devAad(id, 'wg_preshared_key')),
    }).returning();
    return row!;
  });
  await provision(sub.id);
  return dev;
}

/** After a plan change: drop the newest extra devices beyond what the plan allows (all of them for DNS-only). */
export async function trimDevices(subId: string) {
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, subId)).limit(1))[0];
  if (!sub) return;
  const { getSite } = await import('./site');
  const keep = Math.max(0, deviceLimit(await getSite(), sub.kind) - 1);
  const devs = await db.select().from(schema.devices).where(eq(schema.devices.subscriptionId, subId)).orderBy(asc(schema.devices.createdAt));
  for (const d of devs.slice(keep)) await removeDevice(sub, d.id);
}

export async function removeDevice(sub: Sub, deviceId: string): Promise<boolean> {
  const [d] = await db.delete(schema.devices).where(and(eq(schema.devices.id, deviceId), eq(schema.devices.subscriptionId, sub.id))).returning();
  if (!d) return false;
  if (d.peerId) {
    try {
      await withRouter(d.routerId ?? sub.routerId, (m) => m.removePeer(d.peerId!));
    } catch (err) {
      await audit('mikrotik', 'warn', `device peer remove failed · ${d.id} · ${(err as Error).message}`, 'provisioner');
    }
  }
  await provision(sub.id); // queue target and exit lists drop the address
  return true;
}

type Owner = { kind: 'subscription' | 'device'; id: string; privEnc: string | null; pskEnc: string | null; ip: string | null };
export const subOwner = (s: Sub): Owner => ({ kind: 'subscription', id: s.id, privEnc: s.wgPrivateKeyEnc, pskEnc: s.wgPresharedKeyEnc, ip: s.tunnelIp });
export const devOwner = (d: Dev): Owner => ({ kind: 'device', id: d.id, privEnc: d.wgPrivateKeyEnc, pskEnc: d.wgPresharedKeyEnc, ip: d.tunnelIp });

export function clientConfig(o: Owner, router: RouterRow | null, site: Site) {
  if (!o.privEnc || !o.pskEnc || !o.ip) return null;
  const a = o.kind === 'device' ? devAad : aad;
  const priv = decryptSecret(o.privEnc, a(o.id, 'wg_private_key'));
  const psk = decryptSecret(o.pskEnc, a(o.id, 'wg_preshared_key'));
  const endpoint = router?.endpoint || site.wg.endpoint;
  const serverKey = router?.serverPublicKey || site.wg.serverKey;
  const text = [
    '[Interface]', `PrivateKey = ${priv}`, `Address = ${o.ip}/32`, `DNS = ${site.dns.primary}, ${site.dns.secondary}`, `MTU = ${site.wg.mtu}`, '',
    '[Peer]', `PublicKey = ${serverKey}`, `PresharedKey = ${psk}`, `Endpoint = ${endpoint}`, `AllowedIPs = ${site.wg.allowed}`, 'PersistentKeepalive = 25', '',
  ].join('\n');
  return { text, priv, psk, endpoint, serverKey, address: `${o.ip}/32` };
}

/* ───────── DNS whitelist ───────── */

async function dnsRouters() {
  return db.select().from(schema.routers).where(and(eq(schema.routers.role, 'entry'), eq(schema.routers.enabled, true)));
}

export async function whitelistIp(userId: string, entryId: string, ip: string) {
  const entries: Record<string, string> = {};
  const errors: string[] = [];
  for (const r of await dnsRouters()) {
    const m = new MikroTikService(routerRecord(r));
    try {
      entries[r.id] = await m.whitelistDnsIp(userId, ip);
    } catch (err) {
      errors.push(`${r.name}: ${(err as Error).message}`);
    } finally {
      m.close();
    }
  }
  if (Object.keys(entries).length) await db.update(schema.dnsIps).set({ routerEntries: entries }).where(eq(schema.dnsIps.id, entryId));
  return errors;
}

export async function unwhitelistIp(ip: string, entries: Record<string, string>) {
  // Another account still uses this address (shared CGNAT IP): keep the router entry.
  const others = await db.select({ id: schema.dnsIps.id }).from(schema.dnsIps).where(eq(schema.dnsIps.ip, ip)).limit(1);
  if (others.length) return;
  const routers = await db.select().from(schema.routers).where(inArray(schema.routers.id, Object.keys(entries).length ? Object.keys(entries) : ['00000000-0000-0000-0000-000000000000']));
  for (const r of routers) {
    const m = new MikroTikService(routerRecord(r));
    try {
      await m.removeDnsIp(entries[r.id]!);
    } catch (err) {
      await audit('dns', 'warn', `address-list remove failed · ${r.name} · ${(err as Error).message}`);
    } finally {
      m.close();
    }
  }
}

/* ───────── quota worker ───────── */

/** Router counters restart from zero after a reboot or reset: anything shown then is new traffic. */
export const counterDelta = (current: bigint, lastSeen: bigint) => (current >= lastSeen ? current - lastSeen : current);

/** Decides the state a subscription should be in after a usage update. */
export function nextStatus(sub: { status: string; quotaBytes: number | null; expiresAt: Date }, used: number, now = Date.now()) {
  if (sub.status === 'disabled') return 'disabled';
  if (sub.expiresAt.getTime() <= now) return 'expired';
  if (sub.quotaBytes != null && used >= sub.quotaBytes) return 'quota';
  return 'active';
}

async function pollRouter(r: RouterRow) {
  const m = new MikroTikService(routerRecord(r));
  let suspended = 0;
  try {
    const [queues, peers, res] = await Promise.all([m.listQueues(), m.listPeers(), m.getResource()]);
    const byName = new Map(queues.map((q) => [q.name, q]));
    const peerById = new Map(peers.map((p) => [p['.id'], p]));
    const subs = await db.select().from(schema.subscriptions).where(and(eq(schema.subscriptions.routerId, r.id), isNotNull(schema.subscriptions.queueId)));
    for (const sub of subs) {
      const q = byName.get(queueName(sub.id));
      if (!q) continue;
      const now = parseQueueBytes(q.bytes);
      const dUp = Number(counterDelta(now.up, BigInt(sub.lastSeenUp)));
      const dDown = Number(counterDelta(now.down, BigInt(sub.lastSeenDown)));
      const usedUp = sub.usedUp + dUp;
      const usedDown = sub.usedDown + dDown;
      const status = nextStatus(sub, usedUp + usedDown);
      const hs = peerById.get(sub.peerId ?? '')?.['last-handshake'];
      for (const d of await db.select().from(schema.devices).where(eq(schema.devices.subscriptionId, sub.id))) {
        const dh = peerById.get(d.peerId ?? '')?.['last-handshake'];
        if (dh) await db.update(schema.devices).set({ lastHandshake: new Date(Date.now() - parseRouterDuration(dh) * 1000) }).where(eq(schema.devices.id, d.id));
      }
      await db.update(schema.subscriptions).set({
        usedUp, usedDown, lastSeenUp: Number(now.up), lastSeenDown: Number(now.down), status, usageSyncedAt: new Date(),
        lastHandshake: hs ? new Date(Date.now() - parseRouterDuration(hs) * 1000) : sub.lastHandshake,
      }).where(eq(schema.subscriptions.id, sub.id));
      if (dUp || dDown) {
        await sql`insert into usage_daily (subscription_id, day, up, down)
                  values (${sub.id}, (now() at time zone 'Asia/Tehran')::date, ${dUp}, ${dDown})
                  on conflict (subscription_id, day) do update set up = usage_daily.up + excluded.up, down = usage_daily.down + excluded.down`;
      }
      if (status !== 'active' && sub.status === 'active' && sub.peerId) {
        await setAllPeers(m, sub.id, sub.peerId, true);
        suspended++;
        await audit('mikrotik', 'warn', `PATCH /rest/interface/wireguard/peers/${sub.peerId} disabled=true · ${status === 'quota' ? 'اتمام حجم' : 'پایان اشتراک'}`, 'quota-worker', r.host, { sub: sub.id });
      }
    }
    await db.update(schema.routers).set({
      status: 'online', lastSyncAt: new Date(), lastError: null, peers: peers.length, queues: queues.length,
      cpu: Number(res['cpu-load']), ram: Math.round((1 - Number(res['free-memory']) / Number(res['total-memory'])) * 100),
      version: res.version, model: res['board-name'], uptime: res.uptime,
      ...(r.tlsFingerprint ? {} : { tlsFingerprint: m.seenFingerprint }),
    }).where(eq(schema.routers.id, r.id));
    if (suspended) (await import('./vip')).scheduleVipReload();
    return { suspended, checked: subs.length };
  } finally {
    m.close();
  }
}

/** "1w2d3h4m5s" → seconds. */
export function parseRouterDuration(s: string): number {
  const unit: Record<string, number> = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
  let total = 0;
  for (const [, n, u] of s.matchAll(/(\d+)([wdhms])/g)) total += Number(n) * unit[u!]!;
  return total;
}

let running = false;
/** One poll of every entry router plus expiry for subscriptions without a router. */
export async function runQuotaOnce() {
  if (running) return;
  running = true;
  try {
    // Another instance may be polling: then this run is skipped.
    await withLock(1685024873, async () => {
      // Expiry applies even when no router is reachable.
      await db.update(schema.subscriptions).set({ status: 'expired' })
        .where(and(eq(schema.subscriptions.status, 'active'), lte(schema.subscriptions.expiresAt, new Date())));
      const routers = await db.select().from(schema.routers).where(and(eq(schema.routers.role, 'entry'), eq(schema.routers.enabled, true)));
      const results = await Promise.allSettled(routers.map(pollRouter));
      for (const [i, r] of results.entries()) {
        if (r.status === 'rejected') {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          await db.update(schema.routers).set({ status: 'offline', lastError: msg.slice(0, 300) }).where(eq(schema.routers.id, routers[i]!.id));
          if (routers[i]!.status !== 'offline') await audit('mikrotik', 'critical', `poll failed · ${routers[i]!.name} · ${msg}`, 'quota-worker');
        }
      }
    });
  } finally {
    running = false;
  }
}

/** Enables or disables the peer to match the row (used after admin actions and top-ups). */
export async function syncPeerState(subId: string) {
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, subId)).limit(1))[0];
  if (!sub?.peerId) return provision(subId);
  try {
    await withRouter(sub.routerId, (m) => setAllPeers(m, sub.id, sub.peerId, sub.status !== 'active'));
    return { ok: true };
  } catch (err) {
    await audit('mikrotik', 'warn', `peer state sync failed · ${subId} · ${(err as Error).message}`, 'provisioner');
    return { ok: false, error: (err as Error).message };
  }
}
