import { Body, Controller, Get, Post } from '@nestjs/common';

import type { LoginRequestDto, RequestTicketDto } from 'shared-contracts';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Post('login')
  login(@Body() body: LoginRequestDto) {
    return this.appService.login(body);
  }

  @Post('request-ticket')
  requestTicket(@Body() body: RequestTicketDto) {
    return this.appService.requestTicket(body);
  }
}
