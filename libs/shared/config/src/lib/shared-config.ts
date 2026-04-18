import { createHash } from 'crypto';

import type { SecurityProfile, ServiceDescriptor } from 'shared-contracts';

const DEFAULT_SERVICES: Record<string, ServiceDescriptor> = {
  'identity-kdc': { name: 'identity-kdc', port: 3001 },
  'policy-pdp': { name: 'policy-pdp', port: 3002 },
  'audit-log': { name: 'audit-log', port: 3003 },
  'resource-hr': { name: 'resource-hr', port: 3011, department: 'hr' },
  'resource-finance': { name: 'resource-finance', port: 3012, department: 'finance' },
  'resource-it': { name: 'resource-it', port: 3013, department: 'it' },
  'resource-operations': { name: 'resource-operations', port: 3014, department: 'operations' },
};

export interface RuntimeConfig {
  serviceName: string;
  port: number;
  securityProfile: SecurityProfile;
  keyId: string;
  masterKeys: Record<string, Buffer>;
  tgtTtlSeconds: number;
  serviceTicketTtlSeconds: number;
  allowedClockSkewSeconds: number;
  policyPath: string;
  pdpUrl: string;
  auditUrl: string;
  redisUrl?: string;
  databaseUrl?: string;
}

function buildDefaultMasterKey(): string {
  return createHash('sha256').update('securecorp-default-master-key').digest('base64url');
}

function parseSecurityProfile(value: string | undefined): SecurityProfile {
  return value === 'vulnerable' ? 'vulnerable' : 'secure';
}

function parseMasterKeys(value: string | undefined): Record<string, Buffer> {
  const source = value?.trim() || `v1:${buildDefaultMasterKey()}`;
  return source.split(',').reduce<Record<string, Buffer>>((accumulator, pair) => {
    const [keyId, encodedSecret] = pair.split(':');
    if (!keyId || !encodedSecret) {
      return accumulator;
    }

    accumulator[keyId.trim()] = createHash('sha256').update(encodedSecret.trim()).digest();
    return accumulator;
  }, {});
}

export function getServiceDescriptor(serviceName: string): ServiceDescriptor {
  return DEFAULT_SERVICES[serviceName] ?? { name: serviceName, port: 3000 };
}

export function readRuntimeConfig(serviceName: string): RuntimeConfig {
  const descriptor = getServiceDescriptor(serviceName);
  const securityProfile = parseSecurityProfile(process.env['SECURITY_PROFILE']);
  const masterKeys = parseMasterKeys(process.env['KDC_MASTER_KEYS']);
  const keyId = process.env['KDC_ACTIVE_KID'] || Object.keys(masterKeys)[0] || 'v1';

  return {
    serviceName,
    port: Number(process.env['PORT'] || descriptor.port),
    securityProfile,
    keyId,
    masterKeys,
    tgtTtlSeconds: Number(process.env['TGT_TTL_SECONDS'] || 900),
    serviceTicketTtlSeconds: Number(process.env['SERVICE_TICKET_TTL_SECONDS'] || 300),
    allowedClockSkewSeconds: Number(process.env['ALLOWED_CLOCK_SKEW_SECONDS'] || 30),
    policyPath: process.env['POLICY_PATH'] || `policies/${securityProfile}`,
    pdpUrl: process.env['PDP_URL'] || 'http://localhost:3002/api',
    auditUrl: process.env['AUDIT_URL'] || 'http://localhost:3003/api',
    redisUrl: process.env['REDIS_URL'],
    databaseUrl: process.env['DATABASE_URL'],
  };
}
