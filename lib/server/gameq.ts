// Live game-server data: Valve A2S queries over UDP (players, map, ping) and Source RCON over TCP.
import dgram from 'node:dgram';
import net from 'node:net';
import { eq } from 'drizzle-orm';
import { audit } from './audit';
import { db, schema } from './db';

/* ───────── A2S ───────── */

const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const INFO = Buffer.concat([HEADER, Buffer.from('TSource Engine Query\0', 'latin1')]);

export type ServerInfo = { name: string; map: string; folder: string; game: string; players: number; max: number; bots: number; ping: number };
export type PlayerInfo = { name: string; score: number; time: number };

class Reader {
  constructor(private b: Buffer, public o = 0) {}
  byte() { return this.b.readUInt8(this.o++); }
  short() { const v = this.b.readInt16LE(this.o); this.o += 2; return v; }
  long() { const v = this.b.readInt32LE(this.o); this.o += 4; return v; }
  float() { const v = this.b.readFloatLE(this.o); this.o += 4; return v; }
  str() { const end = this.b.indexOf(0, this.o); const s = this.b.toString('utf8', this.o, end < 0 ? undefined : end); this.o = end < 0 ? this.b.length : end + 1; return s; }
  get left() { return this.b.length - this.o; }
}

export function parseInfo(buf: Buffer): Omit<ServerInfo, 'ping'> {
  const r = new Reader(buf, 4);
  if (r.byte() !== 0x49) throw new Error('not an A2S_INFO reply');
  r.byte(); // protocol
  const name = r.str(); const map = r.str(); const folder = r.str(); const game = r.str();
  r.short(); // app id
  const players = r.byte(); const max = r.byte(); const bots = r.byte();
  return { name, map, folder, game, players, max, bots };
}

export function parsePlayers(buf: Buffer): PlayerInfo[] {
  const r = new Reader(buf, 4);
  if (r.byte() !== 0x44) throw new Error('not an A2S_PLAYER reply');
  const n = r.byte();
  const out: PlayerInfo[] = [];
  for (let i = 0; i < n && r.left > 9; i++) {
    r.byte();
    const name = r.str(); const score = r.long(); const time = r.float();
    if (name) out.push({ name, score, time: Math.round(time) });
  }
  return out;
}

/** Sends a query, answering the anti-spoofing challenge (0x41) when the server asks for one. */
function query(host: string, port: number, packet: Buffer, withChallenge: (c: Buffer) => Buffer, timeoutMs = 2500): Promise<{ buf: Buffer; rtt: number }> {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket(net.isIPv6(host) ? 'udp6' : 'udp4');
    let start = Date.now();
    const timer = setTimeout(() => { sock.close(); reject(new Error('timeout')); }, timeoutMs);
    sock.on('error', (e) => { clearTimeout(timer); sock.close(); reject(e); });
    sock.on('message', (msg) => {
      if (msg.length >= 9 && msg[4] === 0x41) {
        start = Date.now();
        sock.send(withChallenge(msg.subarray(5, 9)), port, host);
        return;
      }
      clearTimeout(timer);
      sock.close();
      resolve({ buf: msg, rtt: Date.now() - start });
    });
    sock.send(packet, port, host);
  });
}

export async function a2s(host: string, port: number): Promise<{ info: ServerInfo; players: PlayerInfo[] }> {
  const i = await query(host, port, INFO, (c) => Buffer.concat([INFO, c]));
  const info = { ...parseInfo(i.buf), ping: i.rtt };
  let players: PlayerInfo[] = [];
  try {
    const p = await query(host, port, Buffer.concat([HEADER, Buffer.from([0x55, 0xff, 0xff, 0xff, 0xff])]), (c) => Buffer.concat([HEADER, Buffer.from([0x55]), c]));
    players = parsePlayers(p.buf);
  } catch { /* some servers hide the player list */ }
  return { info, players };
}

/** Polls every enabled server and stores the live numbers shown on the site. */
export async function pollServers() {
  const list = await db.select().from(schema.gameServers).where(eq(schema.gameServers.enabled, true));
  await Promise.allSettled(list.map(async (s) => {
    try {
      const { info, players } = await a2s(s.host, s.port);
      await db.update(schema.gameServers).set({
        status: 'online', players: Math.max(0, info.players - info.bots), bots: info.bots, max: info.max || s.max, map: info.map || s.map,
        ping: info.ping, list: players.slice(0, 64), lastQueryAt: new Date(),
      }).where(eq(schema.gameServers.id, s.id));
    } catch {
      if (s.status !== 'offline') await audit('rcon', 'warn', `A2S no reply · ${s.name} · ${s.host}:${s.port}`, 'server-poller');
      await db.update(schema.gameServers).set({ status: 'offline', players: 0, bots: 0, list: [], ping: null, lastQueryAt: new Date() }).where(eq(schema.gameServers.id, s.id));
    }
  }));
}

/* ───────── RCON ───────── */

const AUTH = 3;
const EXEC = 2;
const RESPONSE = 0;

export function encodePacket(id: number, type: number, body: string): Buffer {
  const b = Buffer.from(body, 'utf8');
  const out = Buffer.alloc(14 + b.length);
  out.writeInt32LE(10 + b.length, 0);
  out.writeInt32LE(id, 4);
  out.writeInt32LE(type, 8);
  b.copy(out, 12);
  return out; // two trailing NULs are already zero
}

export function decodePackets(buf: Buffer): { packets: { id: number; type: number; body: string }[]; rest: Buffer } {
  const packets = [];
  let o = 0;
  while (buf.length - o >= 4) {
    const size = buf.readInt32LE(o);
    if (size < 10 || size > 4096 * 4) throw new Error('bad RCON packet');
    if (buf.length - o - 4 < size) break;
    packets.push({ id: buf.readInt32LE(o + 4), type: buf.readInt32LE(o + 8), body: buf.toString('utf8', o + 12, o + 4 + size - 2) });
    o += 4 + size;
  }
  return { packets, rest: buf.subarray(o) };
}

/** Allow-list: the panel can only run match-management commands, never arbitrary cvars. */
export const RCON_ALLOWED = ['status', 'mp_restartgame', 'mp_warmup_end', 'mp_pause_match', 'mp_unpause_match', 'changelevel', 'map', 'kick', 'kickid', 'say', 'sm_reloadadmins', 'bot_kick', 'users'];

export function checkCommand(line: string): string | null {
  const cmd = line.trim();
  if (!cmd || cmd.length > 200 || /[;\n\r]/.test(cmd)) return 'دستور نامعتبره (چند دستور پشت‌سرهم مجاز نیست).';
  const name = cmd.split(/\s+/)[0]!.toLowerCase();
  if (!RCON_ALLOWED.includes(name)) return `«${name}» توی فهرست مجاز نیست. مجازها: ${RCON_ALLOWED.join(' · ')}`;
  return null;
}

export function rcon(host: string, port: number, password: string, command: string, timeoutMs = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    let buf: Buffer = Buffer.alloc(0);
    let authed = false;
    let out = '';
    let idle: NodeJS.Timeout | undefined;
    const done = (err?: Error) => { clearTimeout(timer); clearTimeout(idle); sock.destroy(); if (err) reject(err); else resolve(out.trim()); };
    const timer = setTimeout(() => (authed ? done() : done(new Error('timeout'))), timeoutMs);
    sock.on('error', (e) => done(e));
    sock.on('connect', () => sock.write(encodePacket(1, AUTH, password)));
    sock.on('data', (chunk) => {
      try {
        const r = decodePackets(Buffer.concat([buf, chunk]));
        buf = r.rest;
        for (const p of r.packets) {
          if (!authed) {
            if (p.type === 2) {
              if (p.id === -1) return done(new Error('رمز RCON اشتباهه.'));
              authed = true;
              sock.write(encodePacket(2, EXEC, command));
              sock.write(encodePacket(3, RESPONSE, '')); // terminator: its echo marks the end of a long reply
            }
          } else if (p.id === 3) {
            return done();
          } else if (p.id === 2) {
            out += p.body;
            clearTimeout(idle);
            idle = setTimeout(() => done(), 600);
          }
        }
      } catch (e) {
        done(e as Error);
      }
    });
  });
}
