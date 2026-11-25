import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env';
import * as schema from './schema';

// One pool per process. Next.js reloads modules in development, so the pool lives on globalThis.
const g = globalThis as unknown as { __dopingSql?: postgres.Sql };
export const sql = g.__dopingSql ?? postgres(env.databaseUrl, { max: 10, idle_timeout: 30, onnotice: () => {} });
if (!env.prod) g.__dopingSql = sql;

export const db = drizzle(sql, { schema, casing: 'snake_case' });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export { schema };

/**
 * Runs `fn` only if no other instance holds the advisory lock `id`. The lock is taken and released on
 * one reserved connection: session-level advisory locks belong to a connection, not to the pool.
 */
export async function withLock(id: number, fn: () => Promise<unknown>): Promise<boolean> {
  const conn = await sql.reserve();
  try {
    const [{ locked } = { locked: false }] = await conn<{ locked: boolean }[]>`select pg_try_advisory_lock(${id}) as locked`;
    if (!locked) return false;
    try {
      await fn();
    } finally {
      await conn`select pg_advisory_unlock(${id})`;
    }
    return true;
  } finally {
    conn.release();
  }
}
