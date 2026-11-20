import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { routerInput } from '@/lib/server/adminInputs';
import { encryptSecret } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json } from '@/lib/server/http';
import { adminRouter } from '@/lib/server/panel';

export const POST = handle(async (req) => {
  const user = await requireAdmin(req);
  const b = await body(req, routerInput);
  if (b.password.length < 12) fail(422, 'رمز API حداقل ۱۲ کاراکتر.', { password: 'حداقل ۱۲ کاراکتر.' });
  const id = crypto.randomUUID();
  try {
    const [r] = await db.insert(schema.routers).values({
      id, name: b.name, role: b.role, city: b.city || (b.role === 'entry' ? 'ایران' : 'خارج'), host: b.host, apiPort: b.apiPort, apiUser: b.apiUser,
      apiPassEnc: encryptSecret(b.password, `router:${id}:api_pass`), wgInterface: b.wg, subnet: b.subnet, endpoint: b.endpoint || null,
      tlsFingerprint: b.fingerprint || null, enabled: b.enabled,
    }).returning();
    await audit('admin', 'info', `router.create ${b.name} · رمز API با AES-256-GCM ذخیره شد`, user.username, clientIp(req));
    return json(adminRouter(r!), 201);
  } catch (err) {
    if (String((err as { code?: string }).code) === '23505') fail(409, 'روتری با این نام هست.', { name: 'روتری با این نام هست.' });
    throw err;
  }
});
