import type { AuthenticatorClaims } from 'shared-contracts';

import { hmacSha256, sha256 } from 'security-crypto';

interface SignedAuthenticator {
  claims: AuthenticatorClaims;
  signature: string;
}

export function buildRequestHash(method: string, path: string, body: unknown): string {
  return sha256(`${method.toUpperCase()}:${path}:${JSON.stringify(body ?? {})}`);
}

export function issueAuthenticator(claims: AuthenticatorClaims, sessionKey: string): string {
  const signature = hmacSha256(sessionKey, JSON.stringify(claims));
  const value: SignedAuthenticator = { claims, signature };
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function verifyAuthenticator(token: string, sessionKey: string): AuthenticatorClaims {
  const value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as SignedAuthenticator;
  const expectedSignature = hmacSha256(sessionKey, JSON.stringify(value.claims));

  if (expectedSignature !== value.signature) {
    throw new Error('Invalid authenticator signature');
  }

  return value.claims;
}
