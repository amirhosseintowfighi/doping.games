// lib/crypto.ts
// AES-256-GCM encryption at rest for MikroTik API passwords and WireGuard private keys.
// Envelope format (base64url, dot separated):  v1.<keyId>.<iv>.<authTag>.<ciphertext>
// The keyId makes rotation possible: new writes use the active key, old rows stay readable.
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for
const TAG_BYTES = 16;

type KeyRing = { activeId: string; keys: Map<string, Buffer> };

let cachedRing: KeyRing | null = null;

/** DOPING_KMS_KEYS="2026a:<base64 32 bytes>,2025b:<base64 32 bytes>"  DOPING_KMS_ACTIVE="2026a" */
function keyRing(): KeyRing {
  if (cachedRing) return cachedRing;
  const raw = process.env.DOPING_KMS_KEYS;
  const activeId = process.env.DOPING_KMS_ACTIVE;
  if (!raw || !activeId) throw new Error('DOPING_KMS_KEYS / DOPING_KMS_ACTIVE are not configured');
  const keys = new Map<string, Buffer>();
  for (const part of raw.split(',')) {
    const [id, b64] = part.trim().split(':');
    const key = Buffer.from(b64 ?? '', 'base64');
    if (!id || key.length !== 32) throw new Error(`KMS key "${id}" must be exactly 32 bytes`);
    keys.set(id, key);
  }
  if (!keys.has(activeId)) throw new Error(`Active KMS key "${activeId}" is missing from the key ring`);
  cachedRing = { activeId, keys };
  return cachedRing;
}

const b64u = (b: Buffer) => b.toString('base64url');

/**
 * Encrypts a secret. `aad` binds the ciphertext to its row (e.g. "router:<uuid>:api_pass"),
 * so a ciphertext copied into another row or column fails authentication on decrypt.
 */
export function encryptSecret(plaintext: string, aad: string): string {
  const { activeId, keys } = keyRing();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keys.get(activeId)!, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, activeId, b64u(iv), b64u(cipher.getAuthTag()), b64u(ciphertext)].join('.');
}

export function decryptSecret(envelope: string, aad: string): string {
  const [version, keyId, iv, tag, ciphertext] = envelope.split('.');
  if (version !== VERSION || !keyId || !iv || !tag || ciphertext === undefined) {
    throw new Error('Malformed secret envelope');
  }
  const key = keyRing().keys.get(keyId);
  if (!key) throw new Error(`KMS key "${keyId}" is not available for decryption`);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'), { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  // final() throws if the tag, the key or the AAD does not match: tampering is never silent.
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

/** True when a row was encrypted with a retired key and should be re-encrypted. */
export function needsRotation(envelope: string): boolean {
  return envelope.split('.')[1] !== keyRing().activeId;
}

// ── Password hashing (scrypt) and token helpers ─────────────────────────────

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize('NFKC'), salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${b64u(salt)}$${b64u(hash)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, {
    ...SCRYPT,
    N: Number(n),
  });
  return timingSafeEqual(actual, expected);
}

/** Opaque random token for sessions and CSRF. Only its SHA-256 digest is ever stored. */
export const newToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
