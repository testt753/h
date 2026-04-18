import type { AuthorizationRequest, Clearance } from 'shared-contracts';

const CLEARANCE_ORDER: Record<Clearance, number> = {
  public: 1,
  confidential: 2,
  secret: 3,
};

export function evaluateAbac(request: AuthorizationRequest, enforceAbac: boolean): { allowed: boolean; reasons: string[] } {
  if (!enforceAbac) {
    return { allowed: true, reasons: [] };
  }

  const reasons: string[] = [];

  if (request.subject.department !== request.resource.department && request.subject.role !== 'admin') {
    reasons.push('department isolation policy denied access');
  }

  if (CLEARANCE_ORDER[request.subject.clearance] < CLEARANCE_ORDER[request.resource.classification]) {
    reasons.push('resource classification exceeds user clearance');
  }

  if (request.subject.location === 'external' && request.resource.classification === 'secret') {
    reasons.push('external access to secret resource denied');
  }

  if (request.environment.time < '08:00' || request.environment.time > '18:00') {
    reasons.push('access requested outside allowed business hours');
  }

  return { allowed: reasons.length === 0, reasons };
}
