import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bearer, bootTestApp, signup } from './util/auth';

/**
 * /users/me + /users/me/profile integration. PRD F-P0-2 and threat model
 * F-AUTHZ-2 (resource ownership) live here. Multi-user isolation is mandatory.
 */
describe('Users e2e (/users/me, /users/me/profile)', () => {
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
    it('GET /users/me → 200 with API_CONTRACT.md §3.1 shape', async () => {
      const { accessToken, email, userId } = await signup(app);
      const res = await request
        .default(app.getHttpServer())
        .get('/users/me')
        .set(bearer(accessToken))
        .expect(200);
      expect(res.body).toMatchObject({
        success: true,
        data: {
          id: userId,
          email,
          subscription_tier: 'free',
        },
      });
      // Contract: name nullable; created_at ISO-ish.
      expect(res.body.data).toHaveProperty('name');
      expect(typeof res.body.data.created_at).toBe('string');
    });

    it('PATCH /users/me { name } → 200 with new name reflected', async () => {
      const { accessToken } = await signup(app, { name: 'Old' });
      const res = await request
        .default(app.getHttpServer())
        .patch('/users/me')
        .set(bearer(accessToken))
        .send({ name: 'New Name' })
        .expect(200);
      expect(res.body.data.name).toBe('New Name');

      const verify = await request
        .default(app.getHttpServer())
        .get('/users/me')
        .set(bearer(accessToken))
        .expect(200);
      expect(verify.body.data.name).toBe('New Name');
    });

    it('PUT /users/me/profile with partial fields → 200 and GET reflects the saved values', async () => {
      const { accessToken } = await signup(app);
      const partial = {
        age: 28,
        gender: 'male',
        weight_kg: 70,
        height_cm: 175,
        activity_level: 'moderate',
        conditions: ['diabetes_type_2'],
        allergies: ['lactose'],
        goals: ['weight_loss'],
      };

      const put = await request
        .default(app.getHttpServer())
        .put('/users/me/profile')
        .set(bearer(accessToken))
        .send(partial)
        .expect(200);
      expect(put.body.data).toMatchObject(partial);

      const get = await request
        .default(app.getHttpServer())
        .get('/users/me/profile')
        .set(bearer(accessToken))
        .expect(200);
      expect(get.body.data).toMatchObject(partial);
    });

    it('GET /users/me/profile when never set → 200 with all-null shape (F-P0-2 AC)', async () => {
      const { accessToken } = await signup(app);
      const res = await request
        .default(app.getHttpServer())
        .get('/users/me/profile')
        .set(bearer(accessToken))
        .expect(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          age: null,
          gender: null,
          weight_kg: null,
          height_cm: null,
          activity_level: null,
          conditions: null,
          allergies: null,
          goals: null,
        },
      });
    });
  });

  // ─── Validation errors ───────────────────────────────────────────────────

  describe('profile validation errors', () => {
    let token: string;
    beforeAll(async () => {
      const s = await signup(app);
      token = s.accessToken;
    });

    it('invalid gender → 400 INVALID_INPUT', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put('/users/me/profile')
        .set(bearer(token))
        .send({ gender: 'martian' })
        .expect(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'INVALID_INPUT' },
      });
    });

    it('invalid activity_level → 400 INVALID_INPUT', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put('/users/me/profile')
        .set(bearer(token))
        .send({ activity_level: 'lightning' })
        .expect(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'INVALID_INPUT' },
      });
    });

    it('allergy not in enum → 400 INVALID_INPUT', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put('/users/me/profile')
        .set(bearer(token))
        .send({ allergies: ['mango'] })
        .expect(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'INVALID_INPUT' },
      });
    });

    it('extra unknown field is rejected by forbidNonWhitelisted → 400', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put('/users/me/profile')
        .set(bearer(token))
        .send({ age: 30, secret_admin_flag: true })
        .expect(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'INVALID_INPUT' },
      });
    });
  });

  // ─── Multi-user isolation (F-AUTHZ-2, QA-002) ────────────────────────────

  describe('multi-user isolation', () => {
    it("A's bearer returns A; B's bearer returns B — neither can read the other", async () => {
      const a = await signup(app, { name: 'Alpha' });
      const b = await signup(app, { name: 'Bravo' });
      expect(a.userId).not.toEqual(b.userId);

      const meA = await request
        .default(app.getHttpServer())
        .get('/users/me')
        .set(bearer(a.accessToken))
        .expect(200);
      expect(meA.body.data.id).toBe(a.userId);
      expect(meA.body.data.email).toBe(a.email);

      const meB = await request
        .default(app.getHttpServer())
        .get('/users/me')
        .set(bearer(b.accessToken))
        .expect(200);
      expect(meB.body.data.id).toBe(b.userId);
      expect(meB.body.data.email).toBe(b.email);
    });

    it('profile data is per-user — A writes, B sees null shape', async () => {
      const a = await signup(app);
      const b = await signup(app);

      await request
        .default(app.getHttpServer())
        .put('/users/me/profile')
        .set(bearer(a.accessToken))
        .send({ age: 33, gender: 'female' })
        .expect(200);

      const bProfile = await request
        .default(app.getHttpServer())
        .get('/users/me/profile')
        .set(bearer(b.accessToken))
        .expect(200);
      expect(bProfile.body.data.age).toBeNull();
      expect(bProfile.body.data.gender).toBeNull();
    });

    it("no user_id query param can pivot the result — even passing ?user_id=<B> with A's bearer returns A", async () => {
      const a = await signup(app, { name: 'Alpha2' });
      const b = await signup(app, { name: 'Bravo2' });

      const res = await request
        .default(app.getHttpServer())
        .get(`/users/me?user_id=${b.userId}`)
        .set(bearer(a.accessToken))
        .expect(200);
      expect(res.body.data.id).toBe(a.userId);
      expect(res.body.data.id).not.toBe(b.userId);
    });
  });
});
