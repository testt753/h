import { Injectable } from '@nestjs/common';

import { StructuredLogger } from 'shared-logging';
import { readRuntimeConfig } from 'shared-config';
import { nowIso } from 'shared-utils';
import type { SecurityAuditEvent } from 'shared-contracts';

@Injectable()
export class AppService {
  private readonly config = readRuntimeConfig('audit-log');
  private readonly logger = new StructuredLogger('audit-log');
  private readonly events: SecurityAuditEvent[] = [];

  getHealth() {
    return {
      service: this.config.serviceName,
      profile: this.config.securityProfile,
      status: 'ok',
      count: this.events.length,
      at: nowIso(),
    };
  }

  getEvents(limit?: string): SecurityAuditEvent[] {
    const size = Math.max(1, Number(limit || 50));
    return this.events.slice(-size).reverse();
  }

  appendEvent(event: SecurityAuditEvent) {
    this.events.push(event);
    this.logger.log(event);
    return { accepted: true, size: this.events.length };
  }
}
