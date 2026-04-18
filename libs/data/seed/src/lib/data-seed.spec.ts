import { fallbackPolicies, findUserByUsername, resourcesForService, seededUsers } from './data-seed';

describe('data-seed', () => {
  it('returns seeded users by username', () => {
    const alice = findUserByUsername('alice');
    expect(alice?.department).toBe('finance');
    expect(alice?.role).toBe('manager');
  });

  it('returns resources for a specific service', () => {
    const financeResources = resourcesForService('resource-finance');
    expect(financeResources).toHaveLength(1);
    expect(financeResources[0].classification).toBe('secret');
  });

  it('exposes fallback deny policies', () => {
    expect(seededUsers.length).toBeGreaterThan(0);
    expect(fallbackPolicies.some((policy) => policy.id === 'deny-delete-non-admin')).toBe(true);
  });
});
