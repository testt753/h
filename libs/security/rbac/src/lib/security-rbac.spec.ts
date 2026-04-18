import type { AuthorizationRequest } from 'shared-contracts';

import { evaluateRbac } from './security-rbac';

function buildRequest(role: AuthorizationRequest['subject']['role'], action: AuthorizationRequest['action']): AuthorizationRequest {
  return {
    subject: {
      id: 'user-1',
      role,
      department: 'finance',
      clearance: 'secret',
      location: 'internal',
      employmentStatus: 'active',
      activeRoles: ['finance-manager'],
    },
    action,
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

describe('security-rbac', () => {
  it('allows a manager to write', () => {
    const result = evaluateRbac(buildRequest('manager', 'write'), true);
    expect(result.allowed).toBe(true);
  });

  it('denies an employee from deleting', () => {
    const result = evaluateRbac(buildRequest('employee', 'delete'), true);
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toContain('cannot perform delete');
  });

  it('detects separation of duties conflicts when enforced', () => {
    const request = buildRequest('admin', 'delete');
    request.subject.activeRoles = ['finance-approver', 'finance-auditor'];
    const result = evaluateRbac(request, true);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes('separation of duties'))).toBe(true);
  });
});
