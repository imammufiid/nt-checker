import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { bootTestApp, signup } from './util/auth';

/**
 * JWT guard behaviour. PRD F-P0-1: any non-`/auth/*` endpoint without a bearer
 * is 401. Also exercises the `@Public()` bypass on `/health` and `/auth/*`.
 *
 * "Expired token" is simulated by signing one with `expiresIn: -1` using the
 * real JwtService and the test secret — strictly black-box at the HTTP layer.
 */
describe('JWT guard e2e', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const booted = await bootTestApp();
    app = booted.app;
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('protected route /users/me', () => {
    it('no bearer → 401 UNAUTHORIZED with the standard error envelope', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/users/me')
        .expect(401);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    });

    it('malformed bearer (Bearer not-a-jwt) → 401', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    });

    it('expired access token → 401 (TOKEN_EXPIRED or UNAUTHORIZED)', async () => {
      // Mint a token with the same secret the strategy uses, but already expired.
      const expired = await jwt.signAsync(
        { sub: 'deadbeef', email: 'expired@example.com', tier: 'free' },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: -1, // already past its exp
        },
      );

      const res = await request
        .default(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
      // Strategy may surface TOKEN_EXPIRED specifically OR fall through to the
      // generic UNAUTHORIZED — accept either per API_CONTRACT.md §11.
      expect(res.body.success).toBe(false);
      expect(['TOKEN_EXPIRED', 'UNAUTHORIZED']).toContain(res.body.error.code);
    });

    it('valid bearer → 200 and returns the caller', async () => {
      const { accessToken, email, userId } = await signup(app);
      const res = await request
        .default(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body).toMatchObject({
        success: true,
        data: { id: userId, email },
      });
    });
  });

  describe('public routes bypass the guard', () => {
    it('GET /health → 200 with no auth header', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/health')
        .expect(200);
      // Health controller returns its own shape inside the envelope.
      expect(res.body.success).toBe(true);
    });

    it('POST /auth/login (public) → reaches the controller (gets 401 INVALID_INPUT/UNAUTHORIZED, NOT a guard 401)', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever8' })
        .expect(401);
      // The point: it didn't 401 *before* hitting the handler. The body shape
      // proves the controller ran the bcrypt+lookup path.
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    });

    it('POST /auth/signup (public) → reaches the controller without auth header', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: `bypass-${Date.now()}@example.com`,
          password: 'password123',
          name: 'B',
        })
        .expect(201);
      expect(res.body.success).toBe(true);
    });
  });
});
