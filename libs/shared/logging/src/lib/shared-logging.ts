import { Logger } from '@nestjs/common';

import type { SecurityAuditEvent } from 'shared-contracts';

export class StructuredLogger {
  private readonly logger: Logger;

  constructor(private readonly scope: string) {
    this.logger = new Logger(scope);
  }

  log(event: SecurityAuditEvent): void {
    this.logger.log(JSON.stringify(event));
  }

  warn(message: string, details?: Record<string, unknown>): void {
    this.logger.warn(JSON.stringify({ service: this.scope, message, details }));
  }

  error(message: string, details?: Record<string, unknown>): void {
    this.logger.error(JSON.stringify({ service: this.scope, message, details }));
  }
}
