import { handle, json } from '@/lib/server/http';
import { publicServers, publicStats } from '@/lib/server/panel';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => json({ servers: await publicServers(), stats: await publicStats() }, 200, { 'Cache-Control': 'public, max-age=10' }));
