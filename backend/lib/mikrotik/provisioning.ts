// lib/mikrotik/provisioning.ts
// Turns a paid order into a working tunnel: key pair, tunnel IP, WireGuard peer and Simple Queue.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { encryptSecret } from '../crypto';
import { MikroTikService, type RouterRecord } from './MikroTikService';

/** Curve25519 key pair in the base64 form WireGuard expects. */
export function generateWireGuardKeys(): { privateKey: string; publicKey: string; presharedKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  const priv = privateKey.export({ format: 'jwk' }).d!;
  const pub = publicKey.export({ format: 'jwk' }).x!;
  const toB64 = (b64url: string) => Buffer.from(b64url, 'base64url').toString('base64');
  return { privateKey: toB64(priv), publicKey: toB64(pub), presharedKey: randomBytes(32).toString('base64') };
}

const ROUTER_COLUMNS = `id, name, host, api_port AS "apiPort", api_user AS "apiUser", api_pass_enc AS "apiPassEnc",
  tls_cert_pem AS "tlsCertPem", tls_fingerprint256 AS "tlsFingerprint256",
  wg_interface AS "wgInterface", dns_address_list AS "dnsAddressList"`;

export async function loadRouter(tx: PoolClient, routerId: string): Promise<RouterRecord> {
  const res = await tx.query<RouterRecord>(`SELECT ${ROUTER_COLUMNS} FROM routers WHERE id = $1`, [routerId]);
  if (!res.rows[0]) throw new Error(`Router ${routerId} not found`);
  return res.rows[0];
}

/** Picks the first free host address in the router's pool. The row lock serialises concurrent orders. */
async function allocateTunnelIp(tx: PoolClient, routerId: string): Promise<string> {
  const res = await tx.query<{ ip: string }>(
    `WITH pool AS (SELECT subnet FROM routers WHERE id = $1 FOR UPDATE)
     SELECT host(candidate) AS ip
       FROM pool, generate_series(2, (2 ^ (32 - masklen(pool.subnet)))::int - 2) AS n,
            LATERAL (SELECT (network(pool.subnet) + n)::inet AS candidate) c
      WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.router_id = $1 AND s.tunnel_ip = candidate)
      ORDER BY n LIMIT 1`,
    [routerId],
  );
  if (!res.rows[0]) throw new Error('Tunnel address pool is exhausted on this router');
  return res.rows[0].ip;
}

export interface ProvisionInput {
  subscriptionId: string;
  routerId: string;
  quotaBytes: bigint | null; // null = unlimited (time-based plan)
  maxUploadMbps: number;
  maxDownloadMbps: number;
}

/**
 * Runs inside the caller's transaction. The database row is written first and the router calls are
 * idempotent, so a crash between the two is repaired by simply running the function again.
 */
export async function provisionSubscription(tx: PoolClient, input: ProvisionInput): Promise<void> {
  const router = await loadRouter(tx, input.routerId);
  const tunnelIp = await allocateTunnelIp(tx, input.routerId);
  const keys = generateWireGuardKeys();

  await tx.query(
    `UPDATE subscriptions
        SET tunnel_ip = $2, wg_public_key = $3, wg_private_key_enc = $4, wg_preshared_key_enc = $5
      WHERE id = $1`,
    [
      input.subscriptionId,
      tunnelIp,
      keys.publicKey,
      encryptSecret(keys.privateKey, `subscription:${input.subscriptionId}:wg_private_key`),
      encryptSecret(keys.presharedKey, `subscription:${input.subscriptionId}:wg_preshared_key`),
    ],
  );

  const mikrotik = new MikroTikService(router);
  try {
    const peerId = await mikrotik.provisionPeer({
      subscriptionId: input.subscriptionId,
      publicKey: keys.publicKey,
      presharedKey: keys.presharedKey,
      tunnelIp,
    });
    const queueId = await mikrotik.upsertQueue({
      subscriptionId: input.subscriptionId,
      tunnelIp,
      maxUploadMbps: input.maxUploadMbps,
      maxDownloadMbps: input.maxDownloadMbps,
      quotaBytes: input.quotaBytes,
    });
    await tx.query(`UPDATE subscriptions SET wg_peer_id = $2, queue_id = $3, status = 'active' WHERE id = $1`, [
      input.subscriptionId,
      peerId,
      queueId,
    ]);
  } finally {
    mikrotik.close();
  }
}

/** Builds the client .conf. The private key is decrypted by the caller for this one response. */
export function renderClientConfig(p: {
  privateKey: string;
  presharedKey: string;
  tunnelIp: string;
  dns: string[];
  serverPublicKey: string;
  endpoint: string;
  allowedIps: string[];
}): string {
  return [
    '[Interface]',
    `PrivateKey = ${p.privateKey}`,
    `Address = ${p.tunnelIp}/32`,
    `DNS = ${p.dns.join(', ')}`,
    'MTU = 1380',
    '',
    '[Peer]',
    `PublicKey = ${p.serverPublicKey}`,
    `PresharedKey = ${p.presharedKey}`,
    `Endpoint = ${p.endpoint}`,
    `AllowedIPs = ${p.allowedIps.join(', ')}`,
    'PersistentKeepalive = 25',
    '',
  ].join('\n');
}
