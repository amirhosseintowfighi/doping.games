import { destroySession } from '@/lib/server/auth';
import { handle, json } from '@/lib/server/http';

export const POST = handle(async () => {
  await destroySession();
  return json({ ok: true });
});
