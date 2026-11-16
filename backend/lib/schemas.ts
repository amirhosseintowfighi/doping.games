// lib/schemas.ts — every byte that enters the API passes through one of these Zod schemas.
import { isIPv4 } from 'node:net';
import { z } from 'zod';

const PRIVATE_V4 = [/^10\./, /^127\./, /^0\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^(22[4-9]|2[3-5]\d)\./];

/** A public, routable IPv4 address. Private, loopback, CGNAT and multicast ranges are refused. */
export const publicIPv4 = z
  .string()
  .trim()
  .refine(isIPv4, 'آی‌پی معتبر نیست')
  .refine((ip) => !PRIVATE_V4.some((re) => re.test(ip)), 'آی‌پی باید عمومی باشد');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export const dnsWhitelistSchema = z.object({
  /** Omitted = "register the IP I am calling from". */
  ip: publicIPv4.optional(),
  label: z.string().trim().max(40).optional(),
});

export const zarinpalCallbackSchema = z.object({
  Authority: z.string().regex(/^[A-Za-z0-9]{36}$/),
  Status: z.enum(['OK', 'NOK']),
});

export const adminTrafficSchema = z.object({
  action: z.enum(['add_traffic', 'reset_counters', 'set_peer']),
  gigabytes: z.number().int().min(1).max(500).optional(),
  enabled: z.boolean().optional(),
});

export const routerSchema = z.object({
  name: z.string().trim().min(2).max(40),
  role: z.enum(['entry', 'exit']),
  host: z.string().trim().refine(isIPv4, 'آی‌پی روتر معتبر نیست'),
  apiPort: z.number().int().min(1).max(65535),
  apiUser: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,32}$/),
  apiPassword: z.string().min(12).max(128),
  wgInterface: z.string().trim().regex(/^[a-zA-Z0-9_-]{2,15}$/),
  subnet: z.string().trim().regex(/^10\.\d{1,3}\.\d{1,3}\.0\/(2[0-9]|30)$/, 'ساب‌نت باید در بازه 10.0.0.0/8 باشد'),
  tlsCertPem: z.string().includes('BEGIN CERTIFICATE'),
});

export const steamIdSchema = z.object({
  steamId64: z.string().regex(/^7656119\d{10}$/, 'SteamID64 معتبر نیست'),
});

export const rconSchema = z.object({
  serverId: z.string().uuid(),
  // Allow-list, not a free shell: only these verbs ever reach the game server.
  command: z.string().trim().max(120).regex(/^(status|mp_restartgame [1-9]|mp_warmup_end|changelevel [a-z0-9_]{3,32}|kick "[^"\n]{1,32}"|say [^\n;]{1,100})$/),
});
