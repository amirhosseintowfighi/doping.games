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
