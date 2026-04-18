import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';

import { findUserByUsername } from 'data-seed';
import { getSecurityCapabilities } from 'security-profile';
import { verifyPassword } from 'security-crypto';
import { decodeTicket, issueServiceTicket, issueTgt } from 'security-tickets';
import { StructuredLogger } from 'shared-logging';
import { createRequestId, nowIso } from 'shared-utils';
import { readRuntimeConfig } from 'shared-config';
import type {
  LoginRequestDto,
  LoginResponseDto,
  RequestTicketDto,
  RequestTicketResponseDto,
  SecurityAuditEvent,
  TicketClaims,
} from 'shared-contracts';

@Injectable()
export class AppService {
  private readonly config = readRuntimeConfig('identity-kdc');
  private readonly capabilities = getSecurityCapabilities(this.config.securityProfile);
  private readonly logger = new StructuredLogger('identity-kdc');

  getHealth() {
    return {
      service: this.config.serviceName,
      profile: this.config.securityProfile,
      status: 'ok',
      at: nowIso(),
    };
  }

  async login(body: LoginRequestDto): Promise<LoginResponseDto> {
    const user = findUserByUsername(body.username);

    if (!user || !verifyPassword(body.password, user.passwordSalt, user.passwordHash)) {
      await this.publishAudit({
        timestamp: nowIso(),
        eventType: 'authentication.failed',
        requestId: createRequestId(),
        severity: 'security',
        service: this.config.serviceName,
        actor: body.username,
        details: { reason: 'invalid credentials' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const { token, claims } = issueTgt({
      user,
      keyId: this.config.keyId,
      key: this.resolveMasterKey(this.config.keyId),
      ttlSeconds: this.config.tgtTtlSeconds,
    });

    await this.publishAudit({
      timestamp: nowIso(),
      eventType: 'authentication.succeeded',
      requestId: createRequestId(),
      severity: 'info',
      service: this.config.serviceName,
      actor: user.id,
      details: { ticketId: claims.ticketId, username: user.username },
    });

    return {
      tgt: token,
      clientSessionKey: claims.sessionKey,
      expiresAt: claims.expiresAt,
      user: {
        id: user.id,
        role: user.role,
        department: user.department,
        clearance: user.clearance,
      },
    };
  }

  async requestTicket(body: RequestTicketDto): Promise<RequestTicketResponseDto> {
    const tgtClaims = decodeTicket(body.tgt, (keyId) => this.resolveMasterKey(keyId));

    if (tgtClaims.typ !== 'TGT') {
      throw new BadRequestException('The provided ticket is not a TGT');
    }

    this.assertTicketValidity(tgtClaims, body.service);

    const { token, claims } = issueServiceTicket({
      tgtClaims,
      service: body.service,
      keyId: this.config.keyId,
      key: this.resolveMasterKey(this.config.keyId),
      ttlSeconds: this.config.serviceTicketTtlSeconds,
    });

    await this.publishAudit({
      timestamp: nowIso(),
      eventType: 'ticket.issued',
      requestId: createRequestId(),
      severity: 'info',
      service: this.config.serviceName,
      actor: tgtClaims.sub,
      details: { ticketId: claims.ticketId, service: body.service },
    });

    return {
      serviceTicket: token,
      serviceSessionKey: claims.sessionKey,
      service: body.service,
      expiresAt: claims.expiresAt,
    };
  }

  private assertTicketValidity(tgtClaims: TicketClaims, serviceName: string): void {
    if (this.capabilities.enforceExpiry && new Date(tgtClaims.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedException('Expired TGT');
    }

    if (this.capabilities.enforceAudience && tgtClaims.tgsAudience !== 'identity-kdc') {
      throw new UnauthorizedException('Invalid TGT audience');
    }

    if (!serviceName.startsWith('resource-')) {
      throw new BadRequestException('Unknown target service');
    }
  }

  private resolveMasterKey(keyId: string): Buffer {
    const key = this.config.masterKeys[keyId];
    if (!key) {
      throw new UnauthorizedException(`Unknown key id ${keyId}`);
    }

    return key;
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
