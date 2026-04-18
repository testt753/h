import { buildRequestHash, issueAuthenticator, verifyAuthenticator } from './security-authenticators';

describe('security-authenticators', () => {
  it('creates and verifies an authenticator', () => {
    const claims = {
      sub: 'user-finance-001',
      service: 'resource-finance',
      timestamp: '2026-04-18T10:00:00.000Z',
      nonce: 'nonce-1',
      requestHash: buildRequestHash('GET', '/api/resource/fin-doc-001', {}),
    };

    const token = issueAuthenticator(claims, 'session-key-123');
    const decoded = verifyAuthenticator(token, 'session-key-123');

    expect(decoded).toEqual(claims);
  });

  it('rejects an authenticator with a wrong session key', () => {
    const claims = {
      sub: 'user-finance-001',
      service: 'resource-finance',
      timestamp: '2026-04-18T10:00:00.000Z',
      nonce: 'nonce-2',
      requestHash: buildRequestHash('GET', '/api/resource/fin-doc-001', {}),
    };

    const token = issueAuthenticator(claims, 'session-key-123');
    expect(() => verifyAuthenticator(token, 'other-key')).toThrow('Invalid authenticator signature');
  });
});
