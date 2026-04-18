import { randomUUID } from 'crypto';

import { addSeconds, nowIso } from 'shared-utils';
import type { Action, TicketClaims, UserRecord } from 'shared-contracts';

import { randomKeyBase64Url, sealPayload, unsealPayload } from 'security-crypto';

const ROLE_ACTIONS: Record<UserRecord['role'], Action[]> = {
  employee: ['read'],
  manager: ['read', 'write'],
  admin: ['read', 'write', 'delete'],
};

export function issueTgt(input: {
  user: UserRecord;
  keyId: string;
  key: Buffer;
  ttlSeconds: number;
}): { token: string; claims: TicketClaims } {
  const claims: TicketClaims = {
    typ: 'TGT',
    ticketId: randomUUID(),
    sub: input.user.id,
    username: input.user.username,
    activeRoles: input.user.activeRoles,
    role: input.user.role,
    department: input.user.department,
    clearance: input.user.clearance,
    location: input.user.location,
    sessionKey: randomKeyBase64Url(),
    issuedAt: nowIso(),
    expiresAt: addSeconds(new Date(), input.ttlSeconds),
    nonce: randomUUID(),
    tgsAudience: 'identity-kdc',
    scopeActions: ROLE_ACTIONS[input.user.role],
    employmentStatus: input.user.employmentStatus,
  };

  return {
    token: sealPayload(claims, input.keyId, input.key),
    claims,
  };
}

export function issueServiceTicket(input: {
  tgtClaims: TicketClaims;
  service: string;
  keyId: string;
  key: Buffer;
  ttlSeconds: number;
}): { token: string; claims: TicketClaims } {
  const claims: TicketClaims = {
    ...input.tgtClaims,
    typ: 'ST',
    ticketId: randomUUID(),
    service: input.service,
    sessionKey: randomKeyBase64Url(),
    issuedAt: nowIso(),
    expiresAt: addSeconds(new Date(), input.ttlSeconds),
    nonce: randomUUID(),
    tgsAudience: undefined,
  };

  return {
    token: sealPayload(claims, input.keyId, input.key),
    claims,
  };
}

export function decodeTicket(token: string, keyResolver: (keyId: string) => Buffer): TicketClaims {
  return unsealPayload<TicketClaims>(token, keyResolver);
}
