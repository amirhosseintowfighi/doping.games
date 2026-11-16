// lib/db.ts — PostgreSQL pool, transaction helper and audit log writer.
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  statement_timeout: 10_000,
});

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

/** Runs `fn` inside one transaction. Any throw rolls everything back. */
export async function withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');
    const result = await fn(tx);
    await tx.query('COMMIT');
    return result;
  } catch (err) {
    await tx.query('ROLLBACK');
    throw err;
  } finally {
    tx.release();
  }
}

export type AuditEvent = {
  category: 'auth' | 'mikrotik' | 'payment' | 'dns' | 'rcon' | 'admin';
  level: 'info' | 'warn' | 'critical';
  action: string;
  actorId?: string | null;
  ip?: string | null;
  detail?: Record<string, unknown>;
};

/** Append-only audit trail. Secrets never go in `detail`. Never throws into the request path. */
export async function audit(event: AuditEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (category, level, action, actor_id, ip, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event.category, event.level, event.action, event.actorId ?? null, event.ip ?? null, event.detail ?? {}],
    );
  } catch (err) {
    console.error('[audit] failed to persist event', event.action, err);
  }
}
