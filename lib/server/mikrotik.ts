// Typed client for the RouterOS v7 REST API (https://<router>/rest).
// One instance per router. Credentials are decrypted in memory only for the lifetime of a call.
import https from 'node:https';
import type { TLSSocket } from 'node:tls';
import { decryptSecret } from './crypto';

export interface RouterRecord {
  id: string;
  name: string;
  host: string;
  apiPort: number; // www-ssl port, e.g. 8443
  apiUser: string;
  apiPassEnc: string; // AES-256-GCM envelope, AAD = router:<id>:api_pass
  tlsFingerprint: string | null; // "AB:CD:…" pinned SHA-256 fingerprint; null until the first sync
  wgInterface: string; // e.g. "wg-doping"
  dnsAddressList: string; // e.g. "doping-dns-allowed"
}

export interface WireGuardInterface {
  '.id': string;
  name: string;
  'public-key': string;
  'listen-port': string;
  running?: string;
}

export interface WireGuardPeer {
  '.id': string;
  interface: string;
  'public-key': string;
  'allowed-address': string;
  comment?: string;
  disabled: 'true' | 'false';
  'last-handshake'?: string;
  rx?: string;
  tx?: string;
}

export interface SimpleQueue {
  '.id': string;
  name: string;
  target: string;
  'max-limit': string; // "upload/download" in bits per second
  bytes: string; // "upload/download" counters since the last reset
  disabled: 'true' | 'false';
  comment?: string;
}

export interface AddressListEntry {
  '.id': string;
  list: string;
  address: string;
  comment?: string;
  disabled: 'true' | 'false';
}

export interface SystemResource {
  version: string;
  'cpu-load': string;
  'free-memory': string;
  'total-memory': string;
  uptime: string;
  'board-name': string;
}

export class MikroTikError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly routerId: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'MikroTikError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Naming convention shared by provisioning and the quota worker. */
export const queueName = (subscriptionId: string) => `dp-${subscriptionId}`;
export const ownerComment = (subscriptionId: string) => `doping:${subscriptionId}`;

export class MikroTikService {
  private readonly agent: https.Agent;
  /** Fingerprint seen on the last TLS handshake; stored as the pin after a first successful sync. */
  seenFingerprint: string | null = null;

  constructor(private readonly router: RouterRecord) {
    // RouterOS ships a self-signed certificate, so the usual CA chain check cannot apply. Instead the
    // certificate's SHA-256 fingerprint is pinned: any other certificate aborts the connection before a
    // single byte (and the Basic-auth password) is sent.
    this.agent = new https.Agent({ keepAlive: true, maxSockets: 4, rejectUnauthorized: false });
  }

  private pin(socket: TLSSocket): Error | null {
    const fp = socket.getPeerCertificate()?.fingerprint256?.toUpperCase() ?? '';
    this.seenFingerprint = fp || null;
    const pinned = this.router.tlsFingerprint?.toUpperCase();
    if (pinned && fp !== pinned) return new MikroTikError(`TLS fingerprint mismatch for ${this.router.name} (got ${fp || 'none'})`, 495, this.router.id);
    return null;
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  private request<T>(method: Method, path: string, body?: Record<string, unknown>, timeoutMs = 8_000): Promise<T> {
    const password = decryptSecret(this.router.apiPassEnc, `router:${this.router.id}:api_pass`);
    const payload = body ? JSON.stringify(body) : undefined;

    return new Promise<T>((resolve, reject) => {
      const req = https.request(
        {
          host: this.router.host,
          port: this.router.apiPort,
          path: `/rest${path}`,
          method,
          agent: this.agent,
          auth: `${this.router.apiUser}:${password}`,
          timeout: timeoutMs,
          headers: {
            Accept: 'application/json',
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json: unknown = null;
            try {
              json = text ? JSON.parse(text) : null;
            } catch {
              return reject(new MikroTikError('Router returned a non-JSON response', res.statusCode ?? 0, this.router.id));
            }
            const status = res.statusCode ?? 0;
            if (status >= 200 && status < 300) return resolve(json as T);
            const message = (json as { detail?: string; message?: string } | null)?.detail ?? `HTTP ${status}`;
            reject(new MikroTikError(`RouterOS ${method} ${path}: ${message}`, status, this.router.id, json));
          });
        },
      );
      req.on('socket', (sock) => {
        const tls = sock as TLSSocket;
        const check = () => { const err = this.pin(tls); if (err) req.destroy(err); };
        // A kept-alive socket has finished its handshake already; a new one is checked once it has.
        if (tls.getPeerCertificate?.()?.fingerprint256) check();
        else tls.once('secureConnect', check);
      });
      req.on('timeout', () => req.destroy(new MikroTikError(`RouterOS ${method} ${path}: timeout`, 504, this.router.id)));
      req.on('error', (err) =>
        reject(err instanceof MikroTikError ? err : new MikroTikError(err.message, 502, this.router.id)),
      );
      if (payload) req.write(payload);
      req.end();
    });
  }

  private static qs(params: Record<string, string>): string {
    return '?' + new URLSearchParams(params).toString();
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  getResource(): Promise<SystemResource> {
    return this.request<SystemResource>('GET', '/system/resource');
  }

  // ── WireGuard peers ────────────────────────────────────────────────────────

  async getInterface(): Promise<WireGuardInterface | null> {
    const list = await this.request<WireGuardInterface[]>('GET', '/interface/wireguard' + MikroTikService.qs({ name: this.router.wgInterface }));
    return list[0] ?? null;
  }

  listPeers(): Promise<WireGuardPeer[]> {
    return this.request<WireGuardPeer[]>(
      'GET',
      '/interface/wireguard/peers' + MikroTikService.qs({ interface: this.router.wgInterface }),
    );
  }

  /** Provisions a peer. Idempotent: an existing peer for the same subscription is updated, not duplicated. */
  async provisionPeer(input: {
    subscriptionId: string;
    publicKey: string;
    presharedKey: string;
    tunnelIp: string; // "10.10.10.14"
  }): Promise<string> {
    const comment = ownerComment(input.subscriptionId);
    const existing = await this.request<WireGuardPeer[]>(
      'GET',
      '/interface/wireguard/peers' + MikroTikService.qs({ interface: this.router.wgInterface, comment }),
    );
    const fields = {
      interface: this.router.wgInterface,
      'public-key': input.publicKey,
      'preshared-key': input.presharedKey,
      'allowed-address': `${input.tunnelIp}/32`,
      comment,
      disabled: 'false',
    };
    if (existing[0]) {
      await this.request('PATCH', `/interface/wireguard/peers/${existing[0]['.id']}`, fields);
      return existing[0]['.id'];
    }
    const created = await this.request<{ ret: string }>('POST', '/interface/wireguard/peers/add', fields);
    return created.ret;
  }

  setPeerDisabled(peerId: string, disabled: boolean): Promise<unknown> {
    return this.request('PATCH', `/interface/wireguard/peers/${peerId}`, { disabled: String(disabled) });
  }

  /** Key reset: swaps the public key and preshared key in place, the tunnel IP and queue stay untouched. */
  rotatePeerKey(peerId: string, publicKey: string, presharedKey: string): Promise<unknown> {
    return this.request('PATCH', `/interface/wireguard/peers/${peerId}`, {
      'public-key': publicKey,
      'preshared-key': presharedKey,
    });
  }

  removePeer(peerId: string): Promise<unknown> {
    return this.request('DELETE', `/interface/wireguard/peers/${peerId}`);
  }

  // ── Simple queues (per-user shaping + byte accounting) ─────────────────────

  listQueues(): Promise<SimpleQueue[]> {
    return this.request<SimpleQueue[]>(
      'GET',
      '/queue/simple' + MikroTikService.qs({ '.proplist': '.id,name,target,max-limit,bytes,disabled,comment' }),
    );
  }

  /**
   * Creates or updates the user's Simple Queue.
   * RouterOS has no native "stop at N bytes" switch on a queue, so the quota itself is stored in
   * PostgreSQL and enforced by workers/quotaWorker.ts; the queue provides shaping and the counters.
   * The quota is mirrored into the comment so the router stays readable on its own.
   */
  async upsertQueue(input: {
    subscriptionId: string;
    tunnelIp: string;
    maxUploadMbps: number;
    maxDownloadMbps: number;
    quotaBytes: bigint | null;
  }): Promise<string> {
    const name = queueName(input.subscriptionId);
    const fields = {
      name,
      target: `${input.tunnelIp}/32`,
      'max-limit': `${input.maxUploadMbps}M/${input.maxDownloadMbps}M`,
      comment: `${ownerComment(input.subscriptionId)} quota=${input.quotaBytes ?? 'unlimited'}`,
      disabled: 'false',
    };
    const existing = await this.request<SimpleQueue[]>('GET', '/queue/simple' + MikroTikService.qs({ name }));
    if (existing[0]) {
      await this.request('PATCH', `/queue/simple/${existing[0]['.id']}`, fields);
      return existing[0]['.id'];
    }
    const created = await this.request<{ ret: string }>('POST', '/queue/simple/add', fields);
    return created.ret;
  }

  resetQueueCounters(queueId: string): Promise<unknown> {
    return this.request('POST', '/queue/simple/reset-counters', { '.id': queueId });
  }

  removeQueue(queueId: string): Promise<unknown> {
    return this.request('DELETE', `/queue/simple/${queueId}`);
  }

  // ── Firewall address-list (anti-sanction DNS whitelist) ────────────────────

  countDnsWhitelist(): Promise<AddressListEntry[]> {
    return this.request<AddressListEntry[]>('GET', '/ip/firewall/address-list' + MikroTikService.qs({ list: this.router.dnsAddressList }));
  }

  listDnsWhitelist(userId: string): Promise<AddressListEntry[]> {
    return this.request<AddressListEntry[]>(
      'GET',
      '/ip/firewall/address-list' +
        MikroTikService.qs({ list: this.router.dnsAddressList, comment: `doping-user:${userId}` }),
    );
  }

  /** Adds a customer IP to the DNS allow list. Returns the existing entry id when already present. */
  async whitelistDnsIp(userId: string, address: string): Promise<string> {
    // RouterOS keeps one entry per address in a list; customers behind the same CGNAT address share it.
    const current = await this.request<AddressListEntry[]>('GET', '/ip/firewall/address-list' + MikroTikService.qs({ list: this.router.dnsAddressList, address }));
    const hit = current[0];
    if (hit) return hit['.id'];
    const created = await this.request<{ ret: string }>('POST', '/ip/firewall/address-list/add', {
      list: this.router.dnsAddressList,
      address,
      comment: `doping-user:${userId}`,
    });
    return created.ret;
  }

  removeDnsIp(entryId: string): Promise<unknown> {
    return this.request('DELETE', `/ip/firewall/address-list/${entryId}`);
  }

  close(): void {
    this.agent.destroy();
  }
}

/** Parses RouterOS "upload/download" counters. BigInt: a 100 GB counter does not fit in int32. */
export function parseQueueBytes(bytes: string): { up: bigint; down: bigint } {
  const [up, down] = bytes.split('/');
  return { up: BigInt(up || '0'), down: BigInt(down || '0') };
}
