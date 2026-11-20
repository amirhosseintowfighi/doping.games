// Runs once per server process (from instrumentation.ts): migrations, first-run data, background jobs.
import path from 'node:path';
import { eq, sql as dsql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { audit } from './audit';
import { assertKeyRing, hashPassword } from './crypto';
import { db, schema } from './db';
import { env } from './env';
import { pollServers } from './gameq';
import { expireStaleOrders } from './orders';
import { ensureSite } from './site';
import { runQuotaOnce } from './vpn';

const g = globalThis as unknown as { __dopingBoot?: Promise<void> };

async function seed() {
  await ensureSite();
  await db.insert(schema.gateways).values([
    { id: 'zarinpal', name: 'زرین‌پال', kind: 'درگاه بانکی · شتاب', enabled: true },
    { id: 'wallet', name: 'کیف پول', kind: 'پرداخت از موجودی', enabled: true },
  ]).onConflictDoNothing();
  if (env.adminEmail && env.adminPassword) {
    const [{ n } = { n: 0 }] = await db.select({ n: dsql<number>`count(*)::int` }).from(schema.users).where(eq(schema.users.role, 'admin'));
    if (!n) {
      if (env.adminPassword.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
      await db.insert(schema.users).values({ email: env.adminEmail, username: env.adminUsername, passwordHash: hashPassword(env.adminPassword), role: 'admin' }).onConflictDoNothing();
      await audit('auth', 'warn', `first admin account created from ADMIN_EMAIL (${env.adminUsername})`);
    }
  }
}

function every(sec: number, name: string, fn: () => Promise<unknown>) {
  const tick = async () => {
    try { await fn(); } catch (err) { console.error(`[${name}]`, err); }
  };
  setTimeout(tick, 3_000);
  setInterval(tick, sec * 1000).unref();
}

export function boot() {
  g.__dopingBoot ??= (async () => {
    assertKeyRing();
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    await seed();
    if (env.workers) {
      every(env.quotaIntervalSec, 'quota', runQuotaOnce);
      every(env.serverPollSec, 'a2s', pollServers);
      every(600, 'orders', expireStaleOrders);
    }
    console.log(`[doping] ready · payments: ${env.paymentMode} · workers: ${env.workers ? 'on' : 'off'}`);
  })().catch((err) => {
    console.error('[doping] boot failed', err);
    g.__dopingBoot = undefined;
    throw err;
  });
  return g.__dopingBoot;
}
