import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

/**
 * Authenticated encryption for credentials we hold on a user's behalf.
 *
 * This is server-only on purpose. If the browser could decrypt a stored key,
 * anything that can run script in the page could exfiltrate every key.
 *
 * Stored format: v1:<iv>:<authTag>:<ciphertext>, each part base64.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard

/** Thrown when the server is missing its encryption key. */
export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      "ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
    this.name = 'MissingEncryptionKeyError';
  }
}

function keyMaterial(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) throw new MissingEncryptionKeyError();

  // Accept a base64 32-byte key; hash anything else to exactly 32 bytes so a
  // shorter passphrase still produces a valid key rather than a runtime crash.
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32) return decoded;
  return createHash('sha256').update(raw).digest();
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY?.trim();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyMaterial(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(':');

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Stored credential is not in the expected format — re-enter the key.');
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGORITHM, keyMaterial(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * The only part of a key that is ever safe to show again: enough to recognise
 * which key it is, not enough to use it.
 */
export function keyHint(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 8) return '••••';
  return `${trimmed.slice(0, 5)}…${trimmed.slice(-4)}`;
}
