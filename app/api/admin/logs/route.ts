import { and, desc, eq, ilike, lt, or, type SQL } from 'drizzle-orm';
import { requireStaff } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { handle, json } from '@/lib/server/http';

export const GET = handle(async (req) => {
  await requireStaff(req);
  const p = new URL(req.url).searchParams;
  const where: SQL[] = [];
  const type = p.get('type');
  const level = p.get('level');
  const q = p.get('q')?.trim();
  const before = Number(p.get('before'));
  if (type && type !== 'all') where.push(eq(schema.auditLogs.type, type));
  if (level && level !== 'all') where.push(eq(schema.auditLogs.level, level as 'info'));
  if (q) where.push(or(ilike(schema.auditLogs.msg, `%${q.replace(/[%_\\]/g, '\\$&')}%`), ilike(schema.auditLogs.actor, `%${q.replace(/[%_\\]/g, '\\$&')}%`), ilike(schema.auditLogs.ip, `%${q.replace(/[%_\\]/g, '\\$&')}%`))!);
  if (before > 0) where.push(lt(schema.auditLogs.id, before));
  const rows = await db.select().from(schema.auditLogs).where(where.length ? and(...where) : undefined).orderBy(desc(schema.auditLogs.id)).limit(200);
  return json(rows.map((l) => ({ id: l.id, at: l.at.getTime(), type: l.type, level: l.level, msg: l.msg, actor: l.actor, ip: l.ip })));
});
