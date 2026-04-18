import type { UserRecord } from 'shared-contracts';

import { decodeTicket, issueServiceTicket, issueTgt } from './security-tickets';

describe('security-tickets', () => {
  const keyId = 'v1';
  const key = Buffer.alloc(32, 7);
  const user: UserRecord = {
    id: 'user-finance-001',
    username: 'alice',
    role: 'manager',
    department: 'finance',
    clearance: 'secret',
    location: 'internal',
    employmentStatus: 'active',
    activeRoles: ['finance-manager'],
    passwordHash: 'hash',
    passwordSalt: 'salt',
  };

  it('issues and decodes a TGT', () => {
    const issued = issueTgt({ user, keyId, key, ttlSeconds: 300 });
    const decoded = decodeTicket(issued.token, () => key);

    expect(decoded.typ).toBe('TGT');
    expect(decoded.sub).toBe(user.id);
    expect(decoded.department).toBe('finance');
    expect(decoded.scopeActions).toEqual(['read', 'write']);
  });

  it('issues a service ticket from a TGT', () => {
    const tgt = issueTgt({ user, keyId, key, ttlSeconds: 300 });
    const serviceTicket = issueServiceTicket({
      tgtClaims: tgt.claims,
      service: 'resource-finance',
      keyId,
      key,
      ttlSeconds: 120,
    });

    const decoded = decodeTicket(serviceTicket.token, () => key);
    expect(decoded.typ).toBe('ST');
    expect(decoded.service).toBe('resource-finance');
    expect(decoded.activeRoles).toEqual(['finance-manager']);
  });
});
