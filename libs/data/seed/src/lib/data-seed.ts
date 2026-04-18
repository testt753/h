import { randomUUID } from 'crypto';

import type { PolicyRule, ResourceRecord, UserRecord } from 'shared-contracts';

import { hashPassword } from 'security-crypto';

function buildUser(input: Omit<UserRecord, 'passwordHash' | 'passwordSalt'> & { password: string }): UserRecord {
  const passwordSalt = `${input.username}-salt`;

  return {
    id: input.id,
    username: input.username,
    role: input.role,
    department: input.department,
    clearance: input.clearance,
    location: input.location,
    employmentStatus: input.employmentStatus,
    activeRoles: input.activeRoles,
    passwordSalt,
    passwordHash: hashPassword(input.password, passwordSalt),
  };
}

export const seededUsers: UserRecord[] = [
  buildUser({
    id: 'user-admin-001',
    username: 'admin',
    password: 'Admin123!',
    role: 'admin',
    department: 'it',
    clearance: 'secret',
    location: 'internal',
    employmentStatus: 'active',
    activeRoles: ['global-admin'],
  }),
  buildUser({
    id: 'user-finance-001',
    username: 'alice',
    password: 'Alice123!',
    role: 'manager',
    department: 'finance',
    clearance: 'secret',
    location: 'internal',
    employmentStatus: 'active',
    activeRoles: ['finance-manager', 'finance-approver'],
  }),
  buildUser({
    id: 'user-hr-001',
    username: 'bob',
    password: 'Bob123!!',
    role: 'employee',
    department: 'hr',
    clearance: 'confidential',
    location: 'internal',
    employmentStatus: 'active',
    activeRoles: ['hr-reader'],
  }),
  buildUser({
    id: 'user-ext-001',
    username: 'eve',
    password: 'Eve123!!',
    role: 'employee',
    department: 'operations',
    clearance: 'public',
    location: 'external',
    employmentStatus: 'active',
    activeRoles: ['ops-reader'],
  }),
];

export const seededResources: ResourceRecord[] = [
  {
    id: 'hr-doc-001',
    service: 'resource-hr',
    department: 'hr',
    classification: 'confidential',
    owner: 'user-hr-001',
    allowedActions: ['read', 'write'],
    content: { title: 'Employee file', payload: 'HR payroll review' },
  },
  {
    id: 'fin-doc-001',
    service: 'resource-finance',
    department: 'finance',
    classification: 'secret',
    owner: 'user-finance-001',
    allowedActions: ['read', 'write', 'delete'],
    content: { title: 'Quarter budget', payload: 'FY26 operating margin' },
  },
  {
    id: 'it-doc-001',
    service: 'resource-it',
    department: 'it',
    classification: 'confidential',
    owner: 'user-admin-001',
    allowedActions: ['read', 'write'],
    content: { title: 'Inventory', payload: 'VPN appliance list' },
  },
  {
    id: 'ops-doc-001',
    service: 'resource-operations',
    department: 'operations',
    classification: 'public',
    owner: 'user-ext-001',
    allowedActions: ['read'],
    content: { title: 'Schedule', payload: 'Shift allocations' },
  },
];

export function resourcesForService(serviceName: string): ResourceRecord[] {
  return seededResources.filter((resource) => resource.service === serviceName);
}

export function findUserByUsername(username: string): UserRecord | undefined {
  return seededUsers.find((user) => user.username === username);
}

export function nextResourceId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export const fallbackPolicies: PolicyRule[] = [
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
  {
    id: 'deny-delete-non-admin',
    description: 'Only admins can delete resources',
    effect: 'deny',
    priority: 90,
    target: { service: '*', action: 'delete' },
    conditions: [{ field: 'user.role', operator: 'neq', value: 'admin' }],
  },
];
