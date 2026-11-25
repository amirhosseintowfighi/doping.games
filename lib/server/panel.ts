// Read models: what the gamer panel, the admin console and the public site receive.
import { and, asc, desc, eq, gte, inArray, sql as dsql } from 'drizzle-orm';
import { attachmentsFor } from './attachments';
import { channels } from './messaging';
import { userNotifications } from './notify';
import { getSite } from './site';
import { deviceLimit } from './vpn';
import { db, schema } from './db';
import type { SessionUser } from './auth';

const ms = (d: Date | null | undefined) => (d ? d.getTime() : null);
const ONLINE_WINDOW = 3 * 60_000;

export async function panelData(user: SessionUser) {
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id)).limit(1))[0];
  const u = (await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1))[0]!;
  const site = await getSite();
  const [devs, sessions, notes, refs] = await Promise.all([
    sub ? db.select().from(schema.devices).where(eq(schema.devices.subscriptionId, sub.id)).orderBy(asc(schema.devices.createdAt)) : [],
    db.select().from(schema.sessions).where(and(eq(schema.sessions.userId, user.id), gte(schema.sessions.expiresAt, new Date()))).orderBy(desc(schema.sessions.createdAt)).limit(20),
    userNotifications(user.id),
    db.select({ n: dsql<number>`count(*)::int`, bought: dsql<number>`count(*) filter (where referral_rewarded_at is not null)::int` }).from(schema.users).where(eq(schema.users.referredBy, user.id)),
  ]);
  const earned = (await db.select({ s: dsql<number>`coalesce(sum(amount),0)::bigint` }).from(schema.walletTx).where(and(eq(schema.walletTx.userId, user.id), dsql`${schema.walletTx.reason} like 'پاداش معرفی%'`)))[0];
  const router = sub?.routerId ? (await db.select().from(schema.routers).where(eq(schema.routers.id, sub.routerId)).limit(1))[0] : null;
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const [usage, dns, orders, tickets, gateways] = await Promise.all([
    sub ? db.select().from(schema.usageDaily).where(and(eq(schema.usageDaily.subscriptionId, sub.id), gte(schema.usageDaily.day, since))).orderBy(asc(schema.usageDaily.day)) : [],
    db.select().from(schema.dnsIps).where(eq(schema.dnsIps.userId, user.id)).orderBy(desc(schema.dnsIps.createdAt)),
    db.select().from(schema.orders).where(and(eq(schema.orders.userId, user.id), inArray(schema.orders.status, ['paid', 'failed', 'canceled']))).orderBy(desc(schema.orders.createdAt)).limit(50),
    userTickets(user.id),
    db.select().from(schema.gateways).where(eq(schema.gateways.enabled, true)),
  ]);
  return {
    user: { id: user.id, username: user.username, email: user.email, role: user.role, wallet: user.wallet, steamId: user.steamId, perks: user.perks },
    account: {
      emailVerified: !!u.emailVerifiedAt, phone: u.phone, phoneVerified: !!u.phoneVerifiedAt, telegram: !!u.telegramChatId, notify: u.notify,
      refCode: u.refCode, referrals: { signups: refs[0]?.n ?? 0, bought: refs[0]?.bought ?? 0, earned: Number(earned?.s ?? 0), percent: Number(site.account.referralPercent) || 0 },
      sessions: sessions.map((x) => ({ id: x.tokenHash.slice(0, 12), current: x.tokenHash === user.tokenHash, ip: x.ip, agent: x.userAgent ?? '', at: x.createdAt.getTime() })),
    },
    channels: { email: channels.email(), sms: channels.sms(), telegram: channels.telegram() },
    notifications: notes,
    devices: devs.map((d) => ({
      id: d.id, name: d.name, ip: d.tunnelIp, provisioned: !!d.peerId, at: d.createdAt.getTime(),
      online: !!d.lastHandshake && Date.now() - d.lastHandshake.getTime() < ONLINE_WINDOW, lastHandshake: ms(d.lastHandshake),
    })),
    deviceLimit: sub ? deviceLimit(site, sub.kind) : 0,
    sub: sub ? {
      kind: sub.kind, status: sub.status, quota: sub.quotaBytes, up: sub.usedUp, down: sub.usedDown, tierGb: sub.tierGb,
      expires: sub.expiresAt.getTime(), dnsSlots: sub.dnsSlots, ip: sub.tunnelIp, exit: sub.exit,
      keysRotatedAt: ms(sub.keysRotatedAt), provisioned: !!sub.provisionedAt, provisionError: sub.provisionError,
      router: router?.name ?? null, online: [sub.lastHandshake, ...devs.map((d) => d.lastHandshake)].some((h) => !!h && Date.now() - h.getTime() < ONLINE_WINDOW),
      lastHandshake: ms(sub.lastHandshake), syncedAt: ms(sub.usageSyncedAt), hasTunnel: !!sub.tunnelIp, autoRenew: sub.autoRenew,
      mainOnline: !!sub.lastHandshake && Date.now() - sub.lastHandshake.getTime() < ONLINE_WINDOW,
    } : null,
    usage: usage.map((u) => ({ day: u.day, up: u.up, down: u.down })),
    dnsIps: dns.map((d) => ({ id: d.id, ip: d.ip, label: d.label, at: d.createdAt.getTime(), synced: Object.keys(d.routerEntries).length > 0 })),
    invoices: orders.map((o) => ({ id: o.id, number: `INV-${o.number}`, title: o.title, amount: o.amount, gateway: o.gateway === 'wallet' ? 'کیف پول' : 'زرین‌پال', status: o.status, at: o.createdAt.getTime(), refId: o.refId })),
    tickets,
    gateways: gateways.map((g) => ({ id: g.id, name: g.name, kind: g.kind })),
  };
}

export async function userTickets(userId: string | null) {
  const where = userId ? eq(schema.tickets.userId, userId) : undefined;
  const list = await db.select({ t: schema.tickets, username: schema.users.username }).from(schema.tickets)
    .innerJoin(schema.users, eq(schema.users.id, schema.tickets.userId)).where(where).orderBy(desc(schema.tickets.updatedAt)).limit(200);
  const ids = list.map((x) => x.t.id);
  const msgs = ids.length ? await db.select().from(schema.ticketMessages).where(inArray(schema.ticketMessages.ticketId, ids)).orderBy(asc(schema.ticketMessages.createdAt)) : [];
  const files = await attachmentsFor(msgs.map((m) => m.id));
  return list.map(({ t, username }) => ({
    id: t.id, code: `T-${t.id}`, subject: t.subject, dept: t.dept, status: t.status, at: t.createdAt.getTime(), updated: t.updatedAt.getTime(), username,
    msgs: msgs.filter((m) => m.ticketId === t.id).map((m) => ({ id: m.id, from: m.staff ? 'staff' : 'me', text: m.text, at: m.createdAt.getTime(), files: files.get(m.id) ?? [] })),
  }));
}

/** Public server list for the storefront. Hosts are public anyway (players connect to them). */
export async function publicServers() {
  const list = await db.select().from(schema.gameServers).where(eq(schema.gameServers.enabled, true)).orderBy(asc(schema.gameServers.sort), asc(schema.gameServers.createdAt));
  return list.map((s) => ({
    id: s.id, name: s.name, game: s.game, mode: s.mode, map: s.map, max: s.max, players: s.players, host: s.host, port: s.port,
    vip: s.vip, ac: s.ac, tick: s.tick, ping: s.ping ?? 0, status: s.status === 'online' ? 'online' : 'offline',
    list: s.list.map((p) => ({ name: p.name, k: p.score, d: 0, ping: 0, time: p.time })),
  }));
}

export async function publicStats() {
  const [r] = await db.select({ n: dsql<number>`count(*)::int` }).from(schema.routers).where(eq(schema.routers.enabled, true));
  const [p] = await db.select({ n: dsql<number>`coalesce(sum(players),0)::int` }).from(schema.gameServers).where(eq(schema.gameServers.enabled, true));
  return { nodes: r?.n ?? 0, online: p?.n ?? 0 };
}

export async function adminOverview() {
  const [routers, servers, users, subs, logs] = await Promise.all([
    db.select().from(schema.routers).orderBy(asc(schema.routers.createdAt)),
    db.select().from(schema.gameServers).orderBy(asc(schema.gameServers.sort), asc(schema.gameServers.createdAt)),
    db.select({ n: dsql<number>`count(*)::int` }).from(schema.users),
    db.select({ online: dsql<number>`count(*) filter (where last_handshake > now() - interval '3 minutes')::int` }).from(schema.subscriptions),
    db.select({ n: dsql<number>`count(*)::int` }).from(schema.auditLogs).where(and(eq(schema.auditLogs.level, 'critical'), gte(schema.auditLogs.at, new Date(Date.now() - 86_400_000)))),
  ]);
  return {
    routers: routers.map(adminRouter),
    servers: servers.map((s) => ({ ...publicServerRow(s), enabled: s.enabled, hasRcon: !!s.rconPassEnc, lastQueryAt: ms(s.lastQueryAt), bots: s.bots, hasVip: !!s.vipTokenHash, vipFetchedAt: ms(s.vipFetchedAt) })),
    counts: { users: users[0]?.n ?? 0, online: subs[0]?.online ?? 0, critical: logs[0]?.n ?? 0 },
  };
}

function publicServerRow(s: typeof schema.gameServers.$inferSelect) {
  return {
    id: s.id, name: s.name, game: s.game, mode: s.mode, map: s.map, max: s.max, players: s.players, host: s.host, port: s.port, vip: s.vip,
    ac: s.ac, tick: s.tick, ping: s.ping ?? 0, status: s.status, sort: s.sort,
    list: s.list.map((p) => ({ name: p.name, k: p.score, d: 0, ping: 0, time: p.time })),
  };
}

export function adminRouter(r: typeof schema.routers.$inferSelect) {
  return {
    id: r.id, name: r.name, role: r.role, city: r.city, host: r.host, apiPort: r.apiPort, apiUser: r.apiUser, wg: r.wgInterface, subnet: r.subnet,
    endpoint: r.endpoint ?? '', serverPublicKey: r.serverPublicKey ?? '', dnsAddressList: r.dnsAddressList, enabled: r.enabled, status: r.status,
    version: r.version ?? '—', model: r.model ?? '—', cpu: r.cpu ?? 0, ram: r.ram ?? 0, uptime: r.uptime ?? '—', peers: r.peers, queues: r.queues,
    lastSync: ms(r.lastSyncAt), lastError: r.lastError, fingerprint: r.tlsFingerprint ?? '',
  };
}

export async function adminUsers() {
  const rows = await db.select({ u: schema.users, s: schema.subscriptions, router: schema.routers.name })
    .from(schema.users)
    .leftJoin(schema.subscriptions, eq(schema.subscriptions.userId, schema.users.id))
    .leftJoin(schema.routers, eq(schema.routers.id, schema.subscriptions.routerId))
    .orderBy(desc(schema.users.createdAt)).limit(1000);
  const devs = await db.select({ sub: schema.devices.subscriptionId, n: dsql<number>`count(*)::int` }).from(schema.devices).groupBy(schema.devices.subscriptionId);
  const devCount = new Map(devs.map((d) => [d.sub, d.n]));
  const refs = await db.select({ by: schema.users.referredBy, n: dsql<number>`count(*)::int` }).from(schema.users).where(dsql`${schema.users.referredBy} is not null`).groupBy(schema.users.referredBy);
  const refCount = new Map(refs.map((r) => [r.by, r.n]));
  return rows.map(({ u, s, router }) => ({
    id: u.id, username: u.username, email: u.email, role: u.role, wallet: u.wallet, disabled: !!u.disabledAt, createdAt: u.createdAt.getTime(),
    emailVerified: !!u.emailVerifiedAt, phone: u.phoneVerifiedAt ? u.phone : null, telegram: !!u.telegramChatId, referrals: refCount.get(u.id) ?? 0,
    lastLogin: ms(u.lastLoginAt),
    sub: s ? {
      id: s.id, kind: s.kind, status: s.status, quota: s.quotaBytes, up: s.usedUp, down: s.usedDown, expires: s.expiresAt.getTime(), ip: s.tunnelIp,
      peerId: s.peerId, queueId: s.queueId, pubkey: s.wgPublicKey, router, provisionError: s.provisionError,
      online: !!s.lastHandshake && Date.now() - s.lastHandshake.getTime() < ONLINE_WINDOW, dnsSlots: s.dnsSlots,
      exit: s.exit, devices: devCount.get(s.id) ?? 0, autoRenew: s.autoRenew,
    } : null,
  }));
}
