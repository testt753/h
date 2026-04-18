import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import type { SecurityAuditEvent } from 'shared-contracts';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('events')
  getEvents(@Query('limit') limit?: string) {
    return this.appService.getEvents(limit);
  }

  @Post('events')
  appendEvent(@Body() event: SecurityAuditEvent) {
    return this.appService.appendEvent(event);
  }
}
