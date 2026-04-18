import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';

import type { SealedEnvelope } from 'shared-contracts';

export function randomKeyBase64Url(size = 32): string {
  return randomBytes(size).toString('base64url');
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('base64url');
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const computed = Buffer.from(hashPassword(password, salt), 'utf8');
  const expected = Buffer.from(expectedHash, 'utf8');
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function sealPayload<TPayload>(payload: TPayload, keyId: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: SealedEnvelope<TPayload> = {
    kid: keyId,
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    tag: tag.toString('base64url'),
  };

  return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
}

export function unsealPayload<TPayload>(encodedEnvelope: string, keyResolver: (keyId: string) => Buffer): TPayload {
  const envelope = JSON.parse(Buffer.from(encodedEnvelope, 'base64url').toString('utf8')) as SealedEnvelope<TPayload>;
  const key = keyResolver(envelope.kid);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(plaintext) as TPayload;
}
