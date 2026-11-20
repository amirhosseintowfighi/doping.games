import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { clientIp, fail, handle, json } from '@/lib/server/http';
import { getSite, saveSite } from '@/lib/server/site';

export const GET = handle(async (req) => {
  await requireAdmin(req);
  return json(await getSite());
});

export const PUT = handle(async (req) => {
  const user = await requireAdmin(req);
  if (Number(req.headers.get('content-length') ?? 0) > 8 * 1024 * 1024) fail(413, 'حجم تنظیمات خیلی زیاده.');
  let data: unknown;
  try { data = await req.json(); } catch { fail(400, 'JSON نامعتبر.'); }
  const site = await saveSite(data, user.username);
  await audit('admin', 'info', 'site.settings.update', user.username, clientIp(req));
  return json(site);
});
