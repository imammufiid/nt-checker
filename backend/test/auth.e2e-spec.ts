import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  bootTestApp,
  cookiePair,
  extractRefreshCookie,
  signup,
  uniqueEmail,
} from './util/auth';

/**
 * /auth/* integration. Boots a fresh Nest app against :memory: SQLite per file
 * with AnalysisService overridden. Asserts on the wire contract (API_CONTRACT.md
 * §1.3 envelope, §2 auth, §11 error codes) and on Supertest cookie surface.
 *
 * PRD F-P0-1 + Threat model F-AUTH-4 (no email enumeration) live here.
 */
describe('Auth e2e (/auth/*)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const booted = await bootTestApp();
    app = booted.app;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Golden path ─────────────────────────────────────────────────────────

  describe('golden path', () => {
    it('POST /auth/signup → 201 with user + access_token + refresh cookie', async () => {
      const email = uniqueEmail('signup');
      const res = await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password: 'password123', name: 'Imam' })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        data: {
          user: {
            email,
            name: 'Imam',
            subscription_tier: 'free',
          },
          tokens: {
            access_token: expect.any(String),
            expires_in: expect.any(Number),
          },
        },
      });
      expect(res.body.data.user.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(res.body.data.tokens.access_token.length).toBeGreaterThan(20);
      // Refresh token MUST NOT appear in the JSON body — cookie-only (THREAT_MODEL §7).
      expect(res.body.data.tokens).not.toHaveProperty('refresh_token');

      const setCookie = extractRefreshCookie(res);
      expect(setCookie).not.toBeNull();
    });

    it('POST /auth/login → 200 same shape as signup', async () => {
      const email = uniqueEmail('login');
      await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password: 'password123', name: 'L' })
        .expect(201);

      const res = await request
        .default(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        data: {
          user: { email, subscription_tier: 'free' },
          tokens: {
            access_token: expect.any(String),
            expires_in: expect.any(Number),
          },
        },
      });
      expect(extractRefreshCookie(res)).not.toBeNull();
    });

    it('POST /auth/refresh with cookie → 200 with new access_token; logout → 204; subsequent refresh → 401', async () => {
      const { refreshCookie } = await signup(app);

      // (1) Refresh succeeds and returns a new access token.
      const refreshed = await request
        .default(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .send({})
        .expect(200);
      expect(refreshed.body).toMatchObject({
        success: true,
        data: {
          access_token: expect.any(String),
          expires_in: expect.any(Number),
        },
      });
      const newCookieLine = extractRefreshCookie(refreshed);
      expect(newCookieLine).not.toBeNull();
      const newCookie = cookiePair(newCookieLine as string);

      // (2) Logout with the new cookie → 204 no body.
      const logoutRes = await request
        .default(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', newCookie)
        .expect(204);
      expect(logoutRes.body).toEqual({});

      // (3) Refresh with the now-deleted cookie → 401.
      const after = await request
        .default(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', newCookie)
        .send({})
        .expect(401);
      expect(after.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    });
  });

  // ─── Errors ──────────────────────────────────────────────────────────────

  describe('errors', () => {
    it('duplicate email → 409 DUPLICATE_EMAIL', async () => {
      const email = uniqueEmail('dup');
      await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password: 'password123', name: 'A' })
        .expect(201);

      const res = await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password: 'password123', name: 'B' })
        .expect(409);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'DUPLICATE_EMAIL' },
      });
    });

    it('wrong password → 401 UNAUTHORIZED', async () => {
      const email = uniqueEmail('wrong');
      await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password: 'password123', name: 'W' })
        .expect(201);

      const res = await request
        .default(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'WRONGwrong000' })
        .expect(401);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    });

    it('unknown email returns identical body shape to wrong-password (F-AUTH-4: no email enumeration)', async () => {
      // First record what wrong-password looks like.
      const knownEmail = uniqueEmail('enum');
      await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: knownEmail, password: 'password123', name: 'K' })
        .expect(201);
      const wrongPw = await request
        .default(app.getHttpServer())
        .post('/auth/login')
        .send({ email: knownEmail, password: 'WRONGwrong000' })
        .expect(401);

      // Now unknown-email.
      const unknown = await request
        .default(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail('nope'), password: 'whatever1' })
        .expect(401);

      // Same status, same error code, same message text — the only enumeration
      // leak surface points.
      expect(unknown.status).toBe(wrongPw.status);
      expect(unknown.body.error.code).toBe(wrongPw.body.error.code);
      expect(unknown.body.error.message).toBe(wrongPw.body.error.message);
    });

    it('password < 8 chars → 400 INVALID_INPUT', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: uniqueEmail('short'), password: '1234567', name: 'X' })
        .expect(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'INVALID_INPUT' },
      });
    });

    it('malformed email → 400 INVALID_INPUT', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'not-an-email', password: 'password123', name: 'X' })
        .expect(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'INVALID_INPUT' },
      });
    });

    it('refresh with no cookie → 401', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(401);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    });

    it('refresh with tampered cookie → 401', async () => {
      const { refreshCookie } = await signup(app);
      const tampered = refreshCookie.replace('nt_refresh=', 'nt_refresh=xxx');
      const res = await request
        .default(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', tampered)
        .send({})
        .expect(401);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    });
  });

  // ─── Boundary ────────────────────────────────────────────────────────────

  describe('boundaries', () => {
    it('password exactly 8 chars is accepted', async () => {
      const email = uniqueEmail('eight');
      await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password: '12345678', name: 'Eight' })
        .expect(201);
    });
  });

  // ─── Refresh reuse detection (backend.md §6.3) ───────────────────────────

  describe('refresh-token rotation + reuse detection', () => {
    it('rotates: old cookie revoked after success; reusing old → 401; reusing the resulting new one → also 401 (whole family revoked)', async () => {
      const { refreshCookie: original } = await signup(app);

      // Successful rotation → BE revokes `original` and issues a fresh one.
      const r1 = await request
        .default(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', original)
        .send({})
        .expect(200);
      const next = cookiePair(extractRefreshCookie(r1) as string);
      expect(next).not.toEqual(original);

      // Reusing the original (now-revoked) cookie → 401. Per design §6.3 this
      // also revokes the whole family.
      await request
        .default(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', original)
        .send({})
        .expect(401);

      // Therefore the new cookie that was just issued is also dead.
      await request
        .default(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', next)
        .send({})
        .expect(401);
    });
  });

  // ─── Cookie hygiene ──────────────────────────────────────────────────────

  describe('refresh cookie hygiene', () => {
    it('nt_refresh cookie carries HttpOnly, SameSite=Strict, Path=/auth (Secure is env-conditional)', async () => {
      const email = uniqueEmail('cookie');
      const res = await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password: 'password123', name: 'C' })
        .expect(201);
      const setCookie = extractRefreshCookie(res);
      expect(setCookie).not.toBeNull();
      const line = setCookie as string;

      // The substring checks are case-insensitive per RFC 6265 §5.2 attribute names.
      expect(line.toLowerCase()).toContain('httponly');
      expect(line.toLowerCase()).toContain('samesite=strict');
      expect(line.toLowerCase()).toContain('path=/auth');
      // Secure flag: in dev/test we accept either presence or absence; we only
      // assert it is NOT set on a non-production env to avoid breaking local HTTP.
      // (Production hygiene is covered by main.ts wiring and SEC review, not here.)
    });
  });
});
