import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';

import { createRedisClient, RedisReplayStore } from 'data-redis';
import { nextResourceId, resourcesForService } from 'data-seed';
import { buildRequestHash, verifyAuthenticator } from 'security-authenticators';
import { getSecurityCapabilities } from 'security-profile';
import { buildReplayKey, InMemoryReplayStore } from 'security-replay';
import { decodeTicket } from 'security-tickets';
import { StructuredLogger } from 'shared-logging';
import { getServiceDescriptor, readRuntimeConfig } from 'shared-config';
import { createRequestId, normalizeTimeForPolicies, nowIso } from 'shared-utils';
import type {
  AuthorizationDecision,
  AuthorizationRequest,
  ResourceRecord,
  SecurityAuditEvent,
  TicketClaims,
} from 'shared-contracts';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly config = readRuntimeConfig('resource-finance');
  private readonly capabilities = getSecurityCapabilities(this.config.securityProfile);
  private readonly logger = new StructuredLogger('resource-finance');
  private readonly serviceDescriptor = getServiceDescriptor(this.config.serviceName);
  private readonly resources = new Map(
    resourcesForService(this.config.serviceName).map((resource) => [resource.id, { ...resource }]),
  );
  private readonly fallbackReplayStore = new InMemoryReplayStore();
  private readonly redisClient = createRedisClient(this.config.redisUrl);
  private readonly replayStore = this.redisClient ? new RedisReplayStore(this.redisClient) : this.fallbackReplayStore;

  async onModuleInit(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.connect();
      } catch {
        this.logger.warn('redis unavailable, replay protection fallback in-memory');
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient?.quit();
  }

  getHealth() {
    return {
      service: this.config.serviceName,
      profile: this.config.securityProfile,
      status: 'ok',
      resources: this.resources.size,
      at: nowIso(),
    };
  }

  async getResource(id: string, request: Record<string, unknown>) {
    const resource = this.getExistingResource(id);
    await this.authorize(request, resource, 'read');
    return resource;
  }

  async createResource(body: Record<string, unknown>, request: Record<string, unknown>) {
    const resource: ResourceRecord = {
      id: nextResourceId(this.getResourcePrefix()),
      service: this.config.serviceName,
      department: this.serviceDescriptor.department || 'finance',
      classification: (body.classification as ResourceRecord['classification']) || 'public',
      owner: (body.owner as string) || 'system',
      allowedActions: ['read', 'write', 'delete'],
      content: {
        title: (body.title as string) || 'Untitled',
        payload: body.payload || body,
      },
    };

    await this.authorize(request, resource, 'write');
    this.resources.set(resource.id, resource);
    return resource;
  }

  async deleteResource(id: string, request: Record<string, unknown>) {
    const resource = this.getExistingResource(id);
    await this.authorize(request, resource, 'delete');
    this.resources.delete(id);
    return { deleted: true, id };
  }

  private getExistingResource(id: string): ResourceRecord {
    const resource = this.resources.get(id);
    if (!resource) {
      throw new NotFoundException(`Resource ${id} not found`);
    }

    return resource;
  }

  private async authorize(
    request: Record<string, unknown>,
    resource: ResourceRecord,
    action: AuthorizationRequest['action'],
  ): Promise<void> {
    const ticket = this.getHeader(request, 'x-service-ticket');
    const authenticatorToken = this.getHeader(request, 'x-authenticator');
    const requestId = this.getHeader(request, 'x-request-id') || createRequestId();

    if (!ticket || !authenticatorToken) {
      throw new UnauthorizedException('Missing ticket headers');
    }

    const ticketClaims = decodeTicket(ticket, (keyId) => this.resolveMasterKey(keyId));
    this.assertTicketClaims(ticketClaims);

    const requestHash = buildRequestHash(
      this.getMethod(request),
      this.getPath(request),
      (request.body as Record<string, unknown>) || {},
    );
    const authenticatorClaims = verifyAuthenticator(authenticatorToken, ticketClaims.sessionKey);

    if (this.capabilities.enforceRequestHash && authenticatorClaims.requestHash !== requestHash) {
      throw new UnauthorizedException('Request hash mismatch');
    }

    if (authenticatorClaims.service !== this.config.serviceName) {
      throw new UnauthorizedException('Authenticator audience mismatch');
    }

    const authTimestamp = new Date(authenticatorClaims.timestamp).getTime();
    if (
      this.capabilities.enforceExpiry &&
      Math.abs(Date.now() - authTimestamp) > this.config.allowedClockSkewSeconds * 1000
    ) {
      throw new UnauthorizedException('Authenticator timestamp outside allowed skew');
    }

    if (this.capabilities.enforceReplayProtection) {
      const replayKey = buildReplayKey(ticketClaims.ticketId, authenticatorClaims.nonce);
      if (await this.replayStore.has(replayKey)) {
        throw new UnauthorizedException('Replay attack detected');
      }

      await this.replayStore.set(replayKey, this.config.serviceTicketTtlSeconds);
    }

    const authorizationRequest: AuthorizationRequest = {
      subject: {
        id: ticketClaims.sub,
        username: ticketClaims.username,
        role: ticketClaims.role,
        department: ticketClaims.department,
        clearance: ticketClaims.clearance,
        location: ticketClaims.location,
        employmentStatus: ticketClaims.employmentStatus,
        activeRoles: ticketClaims.activeRoles,
      },
      action,
      resource: {
        id: resource.id,
        service: this.config.serviceName,
        department: resource.department,
        classification: resource.classification,
        owner: resource.owner,
        allowedActions: resource.allowedActions,
      },
      environment: {
        time: normalizeTimeForPolicies(),
        ip: this.getIp(request),
        networkZone: ticketClaims.location === 'external' ? 'external' : 'internal',
        method: this.getMethod(request),
        requestId,
      },
    };

    const decision = await this.callPolicyDecisionPoint(authorizationRequest);
    await this.publishAudit({
      timestamp: nowIso(),
      eventType: 'resource.access',
      requestId,
      severity: decision.decision === 'ALLOW' ? 'info' : 'security',
      service: this.config.serviceName,
      actor: ticketClaims.sub,
      details: {
        action,
        resourceId: resource.id,
        decision: decision.decision,
        reason: decision.reason,
      },
    });

    if (decision.decision !== 'ALLOW') {
      throw new ForbiddenException(decision.reason);
    }
  }

  private assertTicketClaims(ticketClaims: TicketClaims): void {
    if (ticketClaims.typ !== 'ST') {
      throw new UnauthorizedException('A service ticket is required');
    }

    if (this.capabilities.enforceExpiry && new Date(ticketClaims.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedException('Expired service ticket');
    }

    if (this.capabilities.enforceAudience && ticketClaims.service !== this.config.serviceName) {
      throw new UnauthorizedException('Ticket audience mismatch');
    }
  }

  private async callPolicyDecisionPoint(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const response = await fetch(`${this.config.pdpUrl}/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }).catch(() => undefined);

    if (!response?.ok) {
      throw new BadGatewayException('policy-pdp unavailable');
    }

    return (await response.json()) as AuthorizationDecision;
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

  private resolveMasterKey(keyId: string): Buffer {
    const key = this.config.masterKeys[keyId];
    if (!key) {
      throw new UnauthorizedException(`Unknown key id ${keyId}`);
    }

    return key;
  }

  private getHeader(request: Record<string, unknown>, key: string): string | undefined {
    const headers = (request.headers as Record<string, unknown>) || {};
    const value = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(value) ? String(value[0]) : value ? String(value) : undefined;
  }

  private getMethod(request: Record<string, unknown>): string {
    return String(request.method || 'GET');
  }

  private getPath(request: Record<string, unknown>): string {
    return String(request.originalUrl || request.url || request.path || '/');
  }

  private getIp(request: Record<string, unknown>): string {
    return String(request.ip || '127.0.0.1');
  }

  private getResourcePrefix(): string {
    switch (this.config.serviceName) {
      case 'resource-finance':
        return 'fin-doc';
      case 'resource-it':
        return 'it-doc';
      case 'resource-operations':
        return 'ops-doc';
      default:
        return 'hr-doc';
    }
  }
}
