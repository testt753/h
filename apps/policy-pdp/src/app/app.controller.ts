import { Body, Controller, Get, Post } from '@nestjs/common';

import type { AuthorizationRequest } from 'shared-contracts';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Post('authorize')
  authorize(@Body() body: AuthorizationRequest) {
    return this.appService.authorize(body);
  }
}
