import { z } from 'zod';
import { isIPv4 } from '@/src/data.js';

const hostname = z.string().trim().refine((h) => isIPv4(h) || /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(h), 'هاست یا آی‌پی معتبر وارد کن.');

export const routerInput = z.object({
  name: z.string().trim().regex(/^[A-Za-z0-9-]{3,24}$/, '۳ تا ۲۴ کاراکتر لاتین، عدد یا خط تیره.'),
  role: z.enum(['entry', 'exit']),
  city: z.string().trim().max(60).default(''),
  host: hostname,
  apiPort: z.coerce.number().int().min(1, 'پورت بین 1 تا 65535.').max(65535, 'پورت بین 1 تا 65535.'),
  apiUser: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,32}$/, 'نام کاربری API نامعتبره.'),
  password: z.string().max(200).default(''),
  wg: z.string().trim().regex(/^[a-zA-Z0-9_-]{2,15}$/, 'نام اینترفیس نامعتبره.'),
  subnet: z.string().trim().regex(/^(10|172|192)\.\d{1,3}\.\d{1,3}\.0\/(1[6-9]|2\d|30)$/, 'مثل 10.10.30.0/24'),
  endpoint: z.string().trim().max(100).refine((v) => !v || /^[a-z0-9.-]+:\d{2,5}$/i.test(v), 'به شکل host:port، مثل thr1.doping.games:51820').default(''),
  fingerprint: z.string().trim().toUpperCase().refine((v) => !v || /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(v), 'اثر انگشت SHA-256 به شکل AB:CD:…').default(''),
  enabled: z.boolean().default(true),
});

export const serverInput = z.object({
  name: z.string().trim().min(4, 'حداقل ۴ کاراکتر.').max(60),
  mode: z.string().trim().regex(/^[a-z0-9]{2,16}$/, 'نوع نامعتبره.'),
  map: z.string().trim().regex(/^[A-Za-z0-9_ ]{3,32}$/, 'نام مپ نامعتبره.'),
  host: hostname,
  port: z.coerce.number().int().min(1024, 'پورت بین 1024 تا 65535.').max(65535, 'پورت بین 1024 تا 65535.'),
  max: z.coerce.number().int().min(2, 'بین ۲ تا ۲۰۰.').max(200, 'بین ۲ تا ۲۰۰.'),
  vip: z.boolean().default(false),
  enabled: z.boolean().default(true),
  rcon: z.string().max(100).default(''),
  sort: z.coerce.number().int().min(0).max(999).default(0),
});

export const gameOf = (mode: string) => (mode === 'rust' ? 'Rust' : mode === 'mc' ? 'Minecraft' : 'CS2');
export const defaultsFor = (game: string) => ({
  tick: game === 'CS2' ? 'Sub-tick 64' : game === 'Rust' ? '30 FPS Server' : '20 TPS',
  ac: game === 'CS2' ? 'Doping AC + VAC' : game === 'Rust' ? 'EAC' : 'Grim AC',
});
