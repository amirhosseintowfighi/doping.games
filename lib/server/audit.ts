import { db, schema } from './db';

export type AuditType = 'auth' | 'mikrotik' | 'payment' | 'dns' | 'rcon' | 'admin' | 'system';
export type AuditLevel = 'info' | 'warn' | 'critical';

/** Appends one row to the audit trail. Never throws: a logging failure must not break the request. */
export async function audit(type: AuditType, level: AuditLevel, msg: string, actor = 'system', ip = '', meta: Record<string, unknown> = {}) {
  try {
    await db.insert(schema.auditLogs).values({ type, level, msg: msg.slice(0, 2000), actor, ip, meta });
  } catch (err) {
    console.error('[audit] write failed', err);
  }
}
