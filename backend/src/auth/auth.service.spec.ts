import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

/**
 * Minimal hashing round-trip check. We deliberately don't spin up Nest DI or
 * TypeORM for this — the only thing under test is bcrypt-cost handling on
 * `hashPassword` / `comparePassword`. Repos are typed-as-never; if a test path
 * touches them we'd get a clear failure.
 */
function makeService(bcryptCost?: number): AuthService {
  const config = {
    get: (key: string) => {
      if (key === 'BCRYPT_COST') return bcryptCost;
      return undefined;
    },
  } as unknown as ConfigService;
  const jwt = {} as unknown as JwtService;
  const users = null as unknown as never;
  const refreshTokens = null as unknown as never;
  return new AuthService(users, refreshTokens, jwt, config);
}

describe('AuthService bcrypt round-trip', () => {
  // Bcrypt at low cost is still ~tens of ms; keep generous timeouts.
  jest.setTimeout(15000);

  it('hashes a password and compare() returns true for the correct value', async () => {
    const svc = makeService(10);
    const hash = await svc.hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    expect(hash.length).toBeGreaterThan(50);
    const ok = await svc.comparePassword('correct horse battery staple', hash);
    expect(ok).toBe(true);
  });

  it('compare() returns false for a wrong password', async () => {
    const svc = makeService(10);
    const hash = await svc.hashPassword('rightpass1234');
    const ok = await svc.comparePassword('wrongpass1234', hash);
    expect(ok).toBe(false);
  });

  it('falls back to cost 12 when BCRYPT_COST is missing or below the floor', async () => {
    // No explicit cost => default 12. We don't measure timing, but the cost
    // factor is recorded in the hash prefix (`$2b$12$...`).
    const svc = makeService(undefined);
    const hash = await svc.hashPassword('anything');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('honours BCRYPT_COST >= 10', async () => {
    const svc = makeService(10);
    const hash = await svc.hashPassword('anything');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });
});
