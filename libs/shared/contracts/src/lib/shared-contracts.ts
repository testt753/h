export type Department = 'hr' | 'finance' | 'it' | 'operations';

export type Role = 'employee' | 'manager' | 'admin';

export type Clearance = 'public' | 'confidential' | 'secret';

export type Location = 'internal' | 'external';

export type SecurityProfile = 'secure' | 'vulnerable';

export type TicketType = 'TGT' | 'ST';

export type Action = 'read' | 'write' | 'delete';

export interface UserAttributes {
  department: Department;
  role: Role;
  clearance: Clearance;
  location: Location;
  employmentStatus: 'active' | 'suspended';
}

export interface UserRecord extends UserAttributes {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  activeRoles: string[];
}

export interface ResourceRecord {
  id: string;
  service: string;
  department: Department;
  classification: Clearance;
  content: Record<string, unknown>;
  owner: string;
  allowedActions?: Action[];
}

export interface TicketClaims extends UserAttributes {
  typ: TicketType;
  ticketId: string;
  sub: string;
  username: string;
  activeRoles: string[];
  sessionKey: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  scopeActions: Action[];
  tgsAudience?: string;
  service?: string;
}

export interface AuthenticatorClaims {
  sub: string;
  service: string;
  timestamp: string;
  nonce: string;
  requestHash: string;
}

export interface SealedEnvelope<TPayload> {
  kid: string;
  iv: string;
  ciphertext: string;
  tag: string;
  payload?: TPayload;
}

export interface AuthorizationRequest {
  subject: UserAttributes & {
    id: string;
    username?: string;
    activeRoles?: string[];
  };
  action: Action;
  resource: {
    id: string;
    service?: string;
    department: Department;
    classification: Clearance;
    owner?: string;
    allowedActions?: Action[];
  };
  environment: {
    time: string;
    ip: string;
    networkZone: string;
    method: string;
    requestId: string;
  };
}

export interface AuthorizationDecision {
  decision: 'ALLOW' | 'DENY';
  reason: string;
  matchedPolicies: string[];
  obligations: string[];
  context: {
    requestId: string;
    subject: string;
    resource: string;
  };
}

export type PolicyOperator = 'eq' | 'neq' | 'in' | 'includes' | 'betweenTime';

export interface PolicyCondition {
  field: string;
  operator: PolicyOperator;
  value: string | string[];
}

export interface PolicyRule {
  id: string;
  description: string;
  effect: 'allow' | 'deny';
  priority: number;
  target: {
    service: string;
    action: string;
  };
  conditions: PolicyCondition[];
}

export interface SecurityAuditEvent {
  timestamp: string;
  eventType: string;
  requestId: string;
  severity: 'info' | 'warn' | 'error' | 'security';
  service: string;
  actor: string;
  details: Record<string, unknown>;
}

export interface ServiceDescriptor {
  name: string;
  department?: Department;
  port: number;
}

export interface LoginRequestDto {
  username: string;
  password: string;
}

export interface LoginResponseDto {
  tgt: string;
  clientSessionKey: string;
  expiresAt: string;
  user: {
    id: string;
    role: Role;
    department: Department;
    clearance: Clearance;
  };
}

export interface RequestTicketDto {
  tgt: string;
  service: string;
}

export interface RequestTicketResponseDto {
  serviceTicket: string;
  serviceSessionKey: string;
  service: string;
  expiresAt: string;
}
