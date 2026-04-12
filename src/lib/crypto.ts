import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // For GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM
 */
export function encrypt(text: string): string {
  const masterKey = process.env.CONFIG_ENCRYPTION_KEY;
  if (!masterKey || masterKey.length < 64) {
    throw new Error('CONFIG_ENCRYPTION_KEY must be at least 32 bytes (64 hex characters)');
  }

  const key = Buffer.from(masterKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: v2:iv:authTag:encryptedContent
  return `v2:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string encrypted with the above function
 */
export function decrypt(encryptedText: string): string {
  const masterKey = process.env.CONFIG_ENCRYPTION_KEY;
  if (!masterKey || masterKey.length < 64) {
    throw new Error('CONFIG_ENCRYPTION_KEY missing or invalid');
  }

  if (!encryptedText.startsWith('v2:')) {
    throw new Error('Unsupported encryption format');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted text format');
  }

  const [, ivHex, authTagHex, contentHex] = parts;
  const key = Buffer.from(masterKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const content = Buffer.from(contentHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
  return decrypted.toString('utf8');
}
