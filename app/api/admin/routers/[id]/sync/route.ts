import { and, eq, isNull } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { clientIp, fail, handle, json } from '@/lib/server/http';
import { MikroTikService } from '@/lib/server/mikrotik';
import { adminRouter } from '@/lib/server/panel';
import { provision, routerRecord } from '@/lib/server/vpn';

type Line = { tone: 'dim' | 'ok' | 'bad' | 'out'; text: string; at: number };

/** Real connection test + reconcile, reported line by line for the admin console. */
export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  const r = (await db.select().from(schema.routers).where(eq(schema.routers.id, id)).limit(1))[0];
  if (!r) fail(404, 'روتر پیدا نشد.');
  const lines: Line[] = [];
  const say = (tone: Line['tone'], text: string) => lines.push({ tone, text, at: Date.now() });
  const m = new MikroTikService(routerRecord(r!));
  let ok = false;
  try {
    say('dim', `→ CONNECT https://${r!.host}:${r!.apiPort}/rest`);
    const t0 = Date.now();
    const res = await m.getResource();
    const fp = m.seenFingerprint;
    if (!r!.tlsFingerprint && fp) say('ok', `✓ TLS certificate pinned (first use) · sha256 ${fp.slice(0, 23)}…`);
    else say('ok', '✓ certificate fingerprint matches the pin');
    say('out', `  200 · RouterOS ${res.version} · ${res['board-name']} · cpu ${res['cpu-load']}% · uptime ${res.uptime} · ${Date.now() - t0}ms`);
    say('dim', `→ GET /rest/interface/wireguard?name=${r!.wgInterface}`);
    const wg = await m.getInterface();
    if (!wg) say('bad', `✗ interface ${r!.wgInterface} not found on the router`);
    else say('out', `  200 · listen-port ${wg['listen-port']} · public-key ${wg['public-key'].slice(0, 12)}…`);
    say('dim', '→ GET /rest/interface/wireguard/peers');
    const peers = await m.listPeers();
    say('out', `  200 · ${peers.length} peers`);
    say('dim', '→ GET /rest/queue/simple');
    const queues = await m.listQueues();
    say('out', `  200 · ${queues.length} queues`);
    await db.update(schema.routers).set({
      status: 'online', lastSyncAt: new Date(), lastError: null, version: res.version, model: res['board-name'], uptime: res.uptime,
      cpu: Number(res['cpu-load']), ram: Math.round((1 - Number(res['free-memory']) / Number(res['total-memory'])) * 100),
      peers: peers.length, queues: queues.length, tlsFingerprint: r!.tlsFingerprint ?? fp,
      ...(wg ? { serverPublicKey: wg['public-key'], endpoint: r!.endpoint ?? `${r!.host}:${wg['listen-port']}` } : {}),
    }).where(eq(schema.routers.id, r!.id));
    if (r!.role === 'entry') {
      say('dim', '→ reconcile panel ⇄ router');
      const subs = await db.select({ id: schema.subscriptions.id }).from(schema.subscriptions)
        .where(and(eq(schema.subscriptions.routerId, r!.id)));
      const orphans = await db.select({ id: schema.subscriptions.id }).from(schema.subscriptions).where(isNull(schema.subscriptions.routerId));
      let fixed = 0; let failed = 0;
      for (const s of [...subs, ...orphans]) {
        const p = await provision(s.id);
        if (p.ok) fixed++; else failed++;
      }
      say(failed ? 'bad' : 'out', `  ${fixed} subscriptions in sync${failed ? ` · ${failed} failed (see audit log)` : ''}`);
    }
    say('ok', '✓ sync complete');
    ok = true;
  } catch (err) {
    const msg = (err as Error).message;
    say('bad', `✗ ${msg}`);
    await db.update(schema.routers).set({ status: 'offline', lastError: msg.slice(0, 300) }).where(eq(schema.routers.id, r!.id));
  } finally {
    m.close();
  }
  await audit('mikrotik', ok ? 'info' : 'critical', ok ? `sync OK · ${r!.name}` : `sync failed · ${r!.name}`, user.username, clientIp(req));
  const fresh = (await db.select().from(schema.routers).where(eq(schema.routers.id, r!.id)).limit(1))[0]!;
  return json({ ok, lines, router: adminRouter(fresh) });
});
