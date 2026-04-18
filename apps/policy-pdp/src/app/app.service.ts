import { Injectable } from '@nestjs/common';

import { fallbackPolicies } from 'data-seed';
import { evaluateAbac } from 'security-abac';
import { evaluatePolicies, loadPolicies } from 'security-policy-engine';
import { getSecurityCapabilities } from 'security-profile';
import { evaluateRbac } from 'security-rbac';
import { StructuredLogger } from 'shared-logging';
import { readRuntimeConfig } from 'shared-config';
import { nowIso } from 'shared-utils';
import type { AuthorizationDecision, AuthorizationRequest, PolicyRule, SecurityAuditEvent } from 'shared-contracts';

@Injectable()
export class AppService {
  private readonly config = readRuntimeConfig('policy-pdp');
  private readonly capabilities = getSecurityCapabilities(this.config.securityProfile);
  private readonly logger = new StructuredLogger('policy-pdp');

  getHealth() {
    return {
      service: this.config.serviceName,
      profile: this.config.securityProfile,
      status: 'ok',
      at: nowIso(),
    };
  }

  async authorize(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const loadedPolicies = this.readPolicies();
    const rbacResult = evaluateRbac(request, this.capabilities.enforceSod);
    const abacResult = evaluateAbac(request, this.capabilities.enforceAbac);
    const policyResult = evaluatePolicies(request, loadedPolicies);
    const matchedPolicyDescriptions = policyResult.reasons.filter((reason) => reason.startsWith('deny:'));

    const denyReasons = [
      ...rbacResult.reasons,
      ...abacResult.reasons,
      ...matchedPolicyDescriptions,
    ];

    const decision: AuthorizationDecision = {
      decision: denyReasons.length === 0 ? 'ALLOW' : 'DENY',
      reason: denyReasons[0] || 'request allowed by RBAC, ABAC and policy engine',
      matchedPolicies: policyResult.matchedPolicies,
      obligations: ['log-security-event'],
      context: {
        requestId: request.environment.requestId,
        subject: request.subject.id,
        resource: request.resource.id,
      },
    };

    await this.publishAudit({
      timestamp: nowIso(),
      eventType: 'authorization.decision',
      requestId: request.environment.requestId,
      severity: decision.decision === 'ALLOW' ? 'info' : 'security',
      service: this.config.serviceName,
      actor: request.subject.id,
      details: {
        decision: decision.decision,
        reason: decision.reason,
        matchedPolicies: decision.matchedPolicies,
        obligations: decision.obligations,
        context: decision.context,
      },
    });

    return decision;
  }

  private readPolicies(): PolicyRule[] {
    const fromDisk = loadPolicies(this.config.policyPath);
    return fromDisk.length > 0 ? fromDisk : fallbackPolicies;
  }

  private async publishAudit(event: SecurityAuditEvent): Promise<void> {
    this.logger.log(event);

    try {
      await fetch(`${this.config.auditUrl}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch {
      this.logger.warn('audit-log unavailable', { eventType: event.eventType });
    }
  }
}
