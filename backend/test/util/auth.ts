import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppModule } from '../../src/app.module';
import { AnalysisService } from '../../src/analysis/analysis.service';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Sets the env vars the app + tests need. Mutates process.env in-place;
 * tests run serially per-file so this is safe. Idempotent.
 */
export function ensureTestEnv(): void {
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-32-bytes-min!!';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-32-bytes-min!!';
  process.env.BCRYPT_COST = process.env.BCRYPT_COST ?? '4';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'fake';
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  // Force every spec onto :memory: regardless of what's in .env.
  process.env.DATABASE_PATH = ':memory:';
}

export interface BootedApp {
  app: INestApplication;
  close: () => Promise<void>;
}

/**
 * Boots a Nest app against in-memory SQLite with `AnalysisService` overridden
 * to a no-op fake (so auth/users specs don't need a real Anthropic key wired
 * in the DI graph).
 */
export async function bootTestApp(): Promise<BootedApp> {
  ensureTestEnv();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AnalysisService)
    .useValue({
      analyzeLabel: jest.fn().mockResolvedValue({
        product_name: 'fake',
        nutrition: {},
        ingredients: [],
      }),
    })
    .compile();

  // Match production bootstrap (main.ts) exactly so DTO validation + envelope
  // filter run the same way Supertest sees them.
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  // Sanity-confirm we're on :memory: — otherwise tests would mutate disk DB.
  const ds = app.get<DataSource>(getDataSourceToken());
  const opts = ds.options as TypeOrmModuleOptions & { database?: string };
  if (opts.database !== ':memory:') {
    throw new Error(
      `bootTestApp must use :memory: DB (got ${opts.database}). Set DATABASE_PATH=:memory: in test env.`,
    );
  }

  return {
    app,
    close: async () => {
      await app.close();
    },
  };
}

export interface SignupResult {
  userId: string;
  email: string;
  accessToken: string;
  refreshCookie: string;
}

let counter = 0;
export function uniqueEmail(prefix = 'qa'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

/** Extracts the `nt_refresh=...` cookie line from a Supertest response. */
export function extractRefreshCookie(res: request.Response): string | null {
  const raw = res.headers['set-cookie'];
  if (!raw) return null;
  const cookies = Array.isArray(raw) ? raw : [raw];
  const c = cookies.find((s) => s.startsWith('nt_refresh='));
  return c ?? null;
}

/** Just the `nt_refresh=<val>` pair (drops attrs) for re-sending. */
export function cookiePair(setCookieLine: string): string {
  return setCookieLine.split(';')[0];
}

export async function signup(
  app: INestApplication,
  body?: Partial<{ email: string; password: string; name: string }>,
): Promise<SignupResult> {
  const email = body?.email ?? uniqueEmail();
  const password = body?.password ?? 'password123';
  const name = body?.name ?? 'Test User';
  const res = await request
    .default(app.getHttpServer())
    .post('/auth/signup')
    .send({ email, password, name })
    .expect(201);
  const setCookie = extractRefreshCookie(res);
  if (!setCookie) {
    throw new Error('signup helper: no nt_refresh Set-Cookie in response');
  }
  return {
    userId: res.body.data.user.id,
    email,
    accessToken: res.body.data.tokens.access_token,
    refreshCookie: cookiePair(setCookie),
  };
}

export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<SignupResult> {
  const res = await request
    .default(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  const setCookie = extractRefreshCookie(res);
  if (!setCookie) {
    throw new Error('login helper: no nt_refresh Set-Cookie in response');
  }
  return {
    userId: res.body.data.user.id,
    email,
    accessToken: res.body.data.tokens.access_token,
    refreshCookie: cookiePair(setCookie),
  };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
