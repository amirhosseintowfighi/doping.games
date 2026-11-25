// Ticket attachments: screenshots, PDFs and text logs, sent as base64 in the JSON body and stored in
// PostgreSQL. The type is checked from the file's own bytes, not from what the browser claims.
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema, type Tx } from './db';
import { fail } from './http';

export const MAX_FILES = 3;
export const MAX_BYTES = 2 * 1024 * 1024;

export const filesInput = z.array(z.object({
  name: z.string().trim().min(1).max(120),
  data: z.string().max(Math.ceil((MAX_BYTES * 4) / 3) + 8),
})).max(MAX_FILES, `حداکثر ${MAX_FILES} فایل.`).default([]);

function sniff(b: Buffer): string | null {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  // Plain text (logs, mtr / tracert output): valid UTF-8 without control bytes.
  const text = b.toString('utf8');
  if (!text.includes('�') && !/[\x00-\x08\x0E-\x1F]/.test(text)) return 'text/plain';
  return null;
}

export function decodeFiles(files: z.infer<typeof filesInput>) {
  return files.map((f) => {
    const buf = Buffer.from(f.data.replace(/^data:[^,]*,/, ''), 'base64');
    if (!buf.length) fail(422, `فایل ${f.name} خالیه.`);
    if (buf.length > MAX_BYTES) fail(413, `فایل ${f.name} از ۲ مگابایت بزرگ‌تره.`);
    const mime = sniff(buf);
    if (!mime) fail(415, `نوع فایل ${f.name} پشتیبانی نمی‌شه؛ فقط عکس (PNG/JPG/WebP)، PDF یا متن.`);
    const name = f.name.replace(/[\\/\x00-\x1f"]/g, '_');
    return { name, mime: mime!, size: buf.length, data: buf };
  });
}

export async function saveFiles(tx: Tx | typeof db, messageId: number, files: ReturnType<typeof decodeFiles>) {
  if (files.length) await tx.insert(schema.ticketAttachments).values(files.map((f) => ({ ...f, messageId })));
}

/** Metadata (no bytes) for a set of messages. */
export async function attachmentsFor(messageIds: number[]) {
  if (!messageIds.length) return new Map<number, { id: string; name: string; mime: string; size: number }[]>();
  const rows = await db.select({ id: schema.ticketAttachments.id, messageId: schema.ticketAttachments.messageId, name: schema.ticketAttachments.name, mime: schema.ticketAttachments.mime, size: schema.ticketAttachments.size })
    .from(schema.ticketAttachments).where(inArray(schema.ticketAttachments.messageId, messageIds));
  const by = new Map<number, { id: string; name: string; mime: string; size: number }[]>();
  for (const r of rows) by.set(r.messageId, [...(by.get(r.messageId) ?? []), { id: r.id, name: r.name, mime: r.mime, size: r.size }]);
  return by;
}
