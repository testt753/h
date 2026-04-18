import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('resource/:id')
  getResource(@Param('id') id: string, @Req() request: Record<string, unknown>) {
    return this.appService.getResource(id, request);
  }

  @Post('resource')
  createResource(@Body() body: Record<string, unknown>, @Req() request: Record<string, unknown>) {
    return this.appService.createResource(body, request);
  }

  @Delete('resource/:id')
  deleteResource(@Param('id') id: string, @Req() request: Record<string, unknown>) {
    return this.appService.deleteResource(id, request);
  }
}
