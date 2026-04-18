import type { Action, AuthorizationRequest, Role } from 'shared-contracts';

const ROLE_ACTIONS: Record<Role, Action[]> = {
  employee: ['read'],
  manager: ['read', 'write'],
  admin: ['read', 'write', 'delete'],
};

const FORBIDDEN_ROLE_COMBINATIONS = [
  ['finance-approver', 'finance-auditor'],
  ['hr-admin', 'hr-auditor'],
];

export function evaluateRbac(request: AuthorizationRequest, enforceSod: boolean): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const allowedActions = ROLE_ACTIONS[request.subject.role] ?? [];

  if (!allowedActions.includes(request.action)) {
    reasons.push(`role ${request.subject.role} cannot perform ${request.action}`);
  }

  if (enforceSod && request.subject.activeRoles?.length) {
    for (const [leftRole, rightRole] of FORBIDDEN_ROLE_COMBINATIONS) {
      if (request.subject.activeRoles.includes(leftRole) && request.subject.activeRoles.includes(rightRole)) {
        reasons.push(`separation of duties violated by ${leftRole} and ${rightRole}`);
      }
    }
  }

  return { allowed: reasons.length === 0, reasons };
}
