import { requireUser } from '@/lib/server/auth';
import { handle, json } from '@/lib/server/http';
import { panelData } from '@/lib/server/panel';

export const GET = handle(async (req) => json(await panelData(await requireUser(req))));
