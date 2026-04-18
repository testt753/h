import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readRuntimeConfig } from 'shared-config';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const config = readRuntimeConfig('audit-log');
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  await app.listen(config.port);
  Logger.log(`audit-log listening on http://localhost:${config.port}/${globalPrefix}`);
}

bootstrap();
