import { requireStaff } from '@/lib/server/auth';
import { handle, json } from '@/lib/server/http';
import { adminUsers } from '@/lib/server/panel';

export const GET = handle(async (req) => {
  await requireStaff(req);
  return json(await adminUsers());
});
