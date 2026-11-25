import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { fail, handle } from '@/lib/server/http';

/** Downloads one attachment: the ticket's owner or staff only. Served as a download, never rendered inline as HTML. */
export const GET = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) fail(404, 'فایل پیدا نشد.');
  const row = (await db.select({ a: schema.ticketAttachments, owner: schema.tickets.userId }).from(schema.ticketAttachments)
    .innerJoin(schema.ticketMessages, eq(schema.ticketMessages.id, schema.ticketAttachments.messageId))
    .innerJoin(schema.tickets, eq(schema.tickets.id, schema.ticketMessages.ticketId))
    .where(eq(schema.ticketAttachments.id, id)).limit(1))[0];
  if (!row || (row.owner !== user.id && user.role === 'user')) fail(404, 'فایل پیدا نشد.');
  const a = row!.a;
  const inline = a.mime.startsWith('image/') && new URL(req.url).searchParams.get('inline') === '1';
  return new Response(new Uint8Array(a.data), {
    headers: {
      'Content-Type': a.mime,
      'Content-Length': String(a.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
      'Cache-Control': 'private, max-age=3600',
    },
  });
});
