// PostgreSQL schema (Drizzle ORM). `npm run db:generate` turns changes here into SQL migrations
// under ./drizzle, and the app applies pending migrations on start (lib/server/boot.ts).
import { sql } from 'drizzle-orm';
import {
  bigint, bigserial, boolean, check, date, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

const now = () => timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow();
const ts = () => timestamp({ withTimezone: true, mode: 'date' });
const bytes = () => bigint({ mode: 'number' });

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull(),
  username: text().notNull(),
  passwordHash: text().notNull(),
  role: text({ enum: ['user', 'support', 'admin'] }).notNull().default('user'),
  wallet: bigint({ mode: 'number' }).notNull().default(0), // toman
  steamId: text(),
  perks: jsonb().$type<{ slot: boolean; tag: boolean; skins: boolean }>().notNull().default({ slot: true, tag: true, skins: false }),
  disabledAt: ts(),
  lastLoginAt: ts(),
  createdAt: now(),
}, (t) => [
  uniqueIndex('users_email_uq').on(sql`lower(${t.email})`),
  uniqueIndex('users_username_uq').on(sql`lower(${t.username})`),
  uniqueIndex('users_steam_uq').on(t.steamId),
  check('users_wallet_nonneg', sql`${t.wallet} >= 0`),
]);

export const sessions = pgTable('sessions', {
  tokenHash: text().primaryKey(), // sha256 of the cookie value; the token itself is never stored
  csrf: text().notNull(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  ip: text().notNull(),
  userAgent: text(),
  expiresAt: ts().notNull(),
  createdAt: now(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

export const routers = pgTable('routers', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  role: text({ enum: ['entry', 'exit'] }).notNull(),
  city: text().notNull().default(''),
  host: text().notNull(),
  apiPort: integer().notNull().default(443),
  apiUser: text().notNull(),
  apiPassEnc: text().notNull(), // AES-256-GCM envelope, AAD router:<id>:api_pass
  tlsFingerprint: text(), // pinned SHA-256 of the router certificate (trusted on first successful sync)
  wgInterface: text().notNull().default('wg-doping'),
  subnet: text().notNull(), // tunnel address pool, e.g. 10.10.30.0/24
  endpoint: text(), // public host:port clients connect to
  serverPublicKey: text(), // read from the router's WireGuard interface during sync
  dnsAddressList: text().notNull().default('doping-dns-allowed'),
  enabled: boolean().notNull().default(true),
  status: text({ enum: ['unknown', 'online', 'offline'] }).notNull().default('unknown'),
  version: text(),
  model: text(),
  cpu: integer(),
  ram: integer(),
  uptime: text(),
  peers: integer().notNull().default(0),
  queues: integer().notNull().default(0),
  lastSyncAt: ts(),
  lastError: text(),
  createdAt: now(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text({ enum: ['ping', 'dns', 'pro'] }).notNull(),
  tierGb: integer(), // the purchased traffic tier, null = unlimited
  quotaBytes: bytes(), // current quota (tier + top-ups), null = unlimited
  usedUp: bytes().notNull().default(0),
  usedDown: bytes().notNull().default(0),
  lastSeenUp: bytes().notNull().default(0), // router counters at the previous poll
  lastSeenDown: bytes().notNull().default(0),
  dnsSlots: integer().notNull().default(0),
  status: text({ enum: ['active', 'quota', 'expired', 'disabled'] }).notNull().default('active'),
  expiresAt: ts().notNull(),
  exit: text().notNull().default('mct'),
  routerId: uuid().references(() => routers.id, { onDelete: 'set null' }),
  tunnelIp: text(),
  wgPublicKey: text(),
  wgPrivateKeyEnc: text(),
  wgPresharedKeyEnc: text(),
  keysRotatedAt: ts(),
  peerId: text(), // RouterOS .id
  queueId: text(),
  provisionedAt: ts(),
  provisionError: text(),
  lastHandshake: ts(),
  usageSyncedAt: ts(),
  createdAt: now(),
}, (t) => [
  uniqueIndex('subscriptions_user_uq').on(t.userId), // one service per account; renewals extend it
  uniqueIndex('subscriptions_ip_uq').on(t.tunnelIp),
]);

export const usageDaily = pgTable('usage_daily', {
  subscriptionId: uuid().notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  day: date({ mode: 'string' }).notNull(),
  up: bytes().notNull().default(0),
  down: bytes().notNull().default(0),
}, (t) => [primaryKey({ columns: [t.subscriptionId, t.day] })]);

export const dnsIps = pgTable('dns_ips', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  ip: text().notNull(),
  label: text().notNull().default(''),
  routerEntries: jsonb().$type<Record<string, string>>().notNull().default({}), // routerId → address-list .id
  createdAt: now(),
}, (t) => [uniqueIndex('dns_ips_user_ip_uq').on(t.userId, t.ip)]); // carriers share public IPs (CGNAT), so only per account

export const discounts = pgTable('discounts', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  percent: integer().notNull(),
  maxUses: integer().notNull().default(100),
  used: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  createdAt: now(),
}, (t) => [check('discounts_percent', sql`${t.percent} between 1 and 90`)]);

export const gateways = pgTable('gateways', {
  id: text().primaryKey(), // 'zarinpal' | 'wallet'
  name: text().notNull(),
  kind: text().notNull(),
  enabled: boolean().notNull().default(true),
});

export const orders = pgTable('orders', {
  id: uuid().primaryKey().defaultRandom(),
  number: serial().notNull(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text({ enum: ['plan', 'renew', 'extra', 'topup'] }).notNull(),
  title: text().notNull(),
  item: jsonb().$type<Record<string, unknown>>().notNull(),
  subtotal: bigint({ mode: 'number' }).notNull(),
  discountId: uuid().references(() => discounts.id, { onDelete: 'set null' }),
  discountAmount: bigint({ mode: 'number' }).notNull().default(0),
  amount: bigint({ mode: 'number' }).notNull(), // toman
  gateway: text().notNull(),
  status: text({ enum: ['pending', 'paid', 'failed', 'canceled'] }).notNull().default('pending'),
  authority: text(),
  refId: text(),
  cardPan: text(),
  error: text(),
  createdAt: now(),
  paidAt: ts(),
}, (t) => [
  uniqueIndex('orders_authority_uq').on(t.gateway, t.authority),
  uniqueIndex('orders_ref_uq').on(t.gateway, t.refId),
  index('orders_user_idx').on(t.userId, t.createdAt),
  check('orders_amount_nonneg', sql`${t.amount} >= 0`),
]);

export const walletTx = pgTable('wallet_tx', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: uuid().references(() => orders.id, { onDelete: 'set null' }),
  amount: bigint({ mode: 'number' }).notNull(), // + credit, − debit
  balance: bigint({ mode: 'number' }).notNull(),
  reason: text().notNull(),
  createdAt: now(),
});

export const gameServers = pgTable('game_servers', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  game: text().notNull().default('CS2'),
  mode: text().notNull().default('retake'),
  map: text().notNull().default('de_mirage'),
  max: integer().notNull().default(10),
  host: text().notNull(),
  port: integer().notNull().default(27015),
  rconPassEnc: text(),
  vip: boolean().notNull().default(false),
  ac: text().notNull().default(''),
  tick: text().notNull().default(''),
  enabled: boolean().notNull().default(true), // shown on the site
  sort: integer().notNull().default(0),
  status: text({ enum: ['unknown', 'online', 'offline'] }).notNull().default('unknown'),
  players: integer().notNull().default(0),
  bots: integer().notNull().default(0),
  list: jsonb().$type<{ name: string; score: number; time: number }[]>().notNull().default([]),
  ping: integer(),
  lastQueryAt: ts(),
  createdAt: now(),
});

export const tickets = pgTable('tickets', {
  id: serial().primaryKey(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  subject: text().notNull(),
  dept: text().notNull(),
  status: text({ enum: ['open', 'answered', 'closed'] }).notNull().default('open'),
  createdAt: now(),
  updatedAt: now(),
}, (t) => [index('tickets_user_idx').on(t.userId)]);

export const ticketMessages = pgTable('ticket_messages', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  ticketId: integer().notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
  staff: boolean().notNull().default(false),
  text: text().notNull(),
  createdAt: now(),
}, (t) => [index('ticket_messages_ticket_idx').on(t.ticketId)]);

export const auditLogs = pgTable('audit_logs', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  at: now(),
  type: text().notNull(), // auth | mikrotik | payment | dns | rcon | admin | system
  level: text({ enum: ['info', 'warn', 'critical'] }).notNull().default('info'),
  msg: text().notNull(),
  actor: text().notNull().default('system'),
  ip: text().notNull().default(''),
  meta: jsonb().$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('audit_logs_at_idx').on(t.at)]);

export const siteSettings = pgTable('site_settings', {
  id: integer().primaryKey().default(1),
  data: jsonb().$type<Record<string, unknown>>().notNull(),
  version: integer().notNull().default(1),
  updatedAt: now(),
  updatedBy: text(),
});
