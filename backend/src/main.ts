import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function assertRequiredEnv(): void {
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    // Fail fast — never boot without signing keys.
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    );
  }
}

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Filters + interceptors are registered globally via APP_FILTER / APP_INTERCEPTOR
  // in AppModule, so the DI container manages them and tests can override.

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  Logger.log(`nt-checker API listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
