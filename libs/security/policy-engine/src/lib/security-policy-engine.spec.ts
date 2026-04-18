import type { AuthorizationRequest, PolicyRule } from 'shared-contracts';

import { evaluatePolicies } from './security-policy-engine';

describe('security-policy-engine', () => {
  const request: AuthorizationRequest = {
    subject: {
      id: 'user-ext-001',
      role: 'employee',
      department: 'operations',
      clearance: 'public',
      location: 'external',
      employmentStatus: 'active',
      activeRoles: ['ops-reader'],
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
      networkZone: 'external',
      method: 'GET',
      requestId: 'req-1',
    },
  };

  const policies: PolicyRule[] = [
    {
      id: 'deny-secret-external',
      description: 'Deny external access to secret resources',
      effect: 'deny',
      priority: 100,
      target: { service: '*', action: '*' },
      conditions: [
        { field: 'resource.classification', operator: 'eq', value: 'secret' },
        { field: 'user.location', operator: 'eq', value: 'external' },
      ],
    },
  ];

  it('matches deny policies', () => {
    const result = evaluatePolicies(request, policies);
    expect(result.matchedPolicies).toEqual(['deny-secret-external']);
    expect(result.reasons[0]).toContain('deny:');
  });
});
