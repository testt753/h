import type { AuthorizationRequest } from 'shared-contracts';

import { evaluateAbac } from './security-abac';

function buildRequest(): AuthorizationRequest {
  return {
    subject: {
      id: 'user-finance-001',
      role: 'manager',
      department: 'finance',
      clearance: 'secret',
      location: 'internal',
      employmentStatus: 'active',
      activeRoles: ['finance-manager'],
    },
    action: 'read',
    resource: {
      id: 'fin-doc-001',
      service: 'resource-finance',
      department: 'finance',
      classification: 'secret',
    },
    environment: {
      time: '10:00',
      ip: '127.0.0.1',
      networkZone: 'internal',
      method: 'GET',
      requestId: 'req-1',
    },
  };
}

describe('security-abac', () => {
  it('allows a compliant request', () => {
    const result = evaluateAbac(buildRequest(), true);
    expect(result.allowed).toBe(true);
  });

  it('denies external access to a secret resource', () => {
    const request = buildRequest();
    request.subject.location = 'external';
    const result = evaluateAbac(request, true);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes('external'))).toBe(true);
  });

  it('relaxes checks when ABAC enforcement is disabled', () => {
    const request = buildRequest();
    request.subject.location = 'external';
    request.subject.department = 'hr';
    const result = evaluateAbac(request, false);
    expect(result.allowed).toBe(true);
  });
});
