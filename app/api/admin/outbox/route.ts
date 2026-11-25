import { and, desc, eq, type SQL } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { env } from '@/lib/server/env';
import { handle, json } from '@/lib/server/http';
import { channels } from '@/lib/server/messaging';

/** Outgoing email / SMS / Telegram, newest first, with which channels are configured. */
export const GET = handle(async (req) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const channel = url.searchParams.get('channel');
  const status = url.searchParams.get('status');
  const where: SQL[] = [];
  if (channel === 'email' || channel === 'sms' || channel === 'telegram') where.push(eq(schema.outbox.channel, channel));
  if (status === 'sent' || status === 'failed' || status === 'skipped') where.push(eq(schema.outbox.status, status));
  const rows = await db.select().from(schema.outbox).where(where.length ? and(...where) : undefined).orderBy(desc(schema.outbox.id)).limit(200);
  return json({
    channels: { email: channels.email(), sms: channels.sms(), telegram: channels.telegram() },
    devOutbox: env.devOutbox,
    rows: rows.map((r) => ({ id: r.id, channel: r.channel, to: r.to, subject: r.subject, body: r.body, status: r.status, error: r.error, at: r.createdAt.getTime() })),
  });
});
