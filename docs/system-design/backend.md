# Backend System Design — nt-checker M1 (Scan-to-Goal Loop)

**Author:** be-engineer
**Date:** 2026-05-18
**Status:** Draft v1
**Source PRD:** [`docs/PRD.md`](../PRD.md)
**Source Tasks:** [`docs/TASKS.md`](../TASKS.md)
**API Contract:** [`API_CONTRACT.md`](../../API_CONTRACT.md)

---

## 1. Scope

This document specifies the backend design for milestone M1 ("Scan to Goal Loop"). It covers exactly the BE-prefixed tasks in `docs/TASKS.md`: **BE-001** (User entity + migration), **BE-002** (signup), **BE-003** (login), **BE-004** (JWT middleware + refresh + logout), **BE-005** (user + profile CRUD), **BE-006** (goal CRUD), **BE-007** (scope scans to user), **BE-008** (wire profile + goal into AnalysisService), **BE-009** (daily progress endpoint), **BE-010** (re-analyze, P1), **BE-011** (surface `vitamins_minerals[]` + `verdict.goal_context`), **BE-012** (per-scan goal snapshot for historical accuracy), and **BE-013** (per-user-per-day Claude call quota). It does NOT cover prompt engineering (AI-prefixed tasks, see `analysis-design.md` from ai-engineer) or UI work (FE-prefixed tasks). The auth-policy specifics (TTLs, bcrypt cost, lockout) come from SEC-001 / SEC-002 and are consumed — not defined — here.

---

## 2. Module Layout

NestJS conventions: one module = one responsibility, controller + service + DTOs + entity colocated. New modules below all live under `backend/src/`. The existing `scans/` and `analysis/` modules stay where they are; we make additive changes to `scans/` and **do not touch** `analysis/` (owned by ai-engineer; we only change its call site and the shape of the parameter we pass in, coordinated through `AI-003`).

```
backend/src/
├── main.ts                       (bootstrap — add cookie-parser middleware)
├── app.module.ts                 (wire new modules + entities into TypeORM)
├── auth/                         NEW
│   ├── auth.module.ts
│   ├── auth.controller.ts        POST /auth/{signup,login,refresh,logout}
│   ├── auth.service.ts           bcrypt, JWT sign/verify, refresh rotation
│   ├── jwt.strategy.ts           access-token guard (HS256 verify)
│   ├── jwt-auth.guard.ts         applied via APP_GUARD with @Public() opt-out
│   ├── current-user.decorator.ts param decorator → req.user
│   ├── refresh-token.entity.ts   server-side refresh row (hash, family, exp)
│   └── dto/
│       ├── signup.dto.ts         (email, password, name)
│       ├── login.dto.ts          (email, password)
│       └── refresh.dto.ts        (optional — refresh primarily via cookie)
├── users/                        NEW
│   ├── users.module.ts
│   ├── users.controller.ts       GET/PATCH /users/me
│   ├── users.service.ts          user lookup, name update, deletion
│   ├── user.entity.ts            (also imported by auth/, goals/, etc.)
│   ├── user-profile.entity.ts    1:1 with User
│   ├── profile.controller.ts     GET/PUT /users/me/profile
│   ├── profile.service.ts
│   └── dto/
│       ├── update-user.dto.ts
│       └── upsert-profile.dto.ts
├── goals/                        NEW
│   ├── goals.module.ts
│   ├── goals.controller.ts       GET/PUT/DELETE /users/me/goal
│   ├── goals.service.ts          upsert + suggestion math (Mifflin–St Jeor)
│   ├── goal.entity.ts            1:1 with User
│   └── dto/
│       └── upsert-goal.dto.ts
├── progress/                     NEW
│   ├── progress.module.ts
│   ├── progress.controller.ts    GET /progress/daily
│   ├── progress.service.ts       SQL rollup + status derivation
│   └── dto/
│       └── daily-progress.query.dto.ts  (date?: YYYY-MM-DD)
├── common/                       NEW (cross-cutting)
│   ├── filters/
│   │   └── http-exception.filter.ts   enforces standard error envelope
│   ├── interceptors/
│   │   └── success-envelope.interceptor.ts  wraps data → { success:true, data }
│   ├── exceptions/
│   │   ├── domain.exception.ts        base class with `code` field
│   │   ├── duplicate-email.exception.ts
│   │   ├── quota-exceeded.exception.ts
│   │   ├── extraction-failed.exception.ts
│   │   └── llm-unavailable.exception.ts
│   └── guards/
│       └── scan-quota.guard.ts        BE-013 daily Claude call cap
├── scans/                        EXISTING — additive changes
│   ├── scan.entity.ts            + userId, + micros JSON, + goalSnapshot JSON,
│   │                               + imageHash (forward-compat, nullable)
│   ├── scans.controller.ts       inject CurrentUser; POST /scans/:id/reanalyze
│   ├── scans.service.ts          all queries filter by userId
│   └── dto/
│       └── list-scans.query.dto.ts  (limit, cursor, from, to)
└── analysis/                     OWNED BY ai-engineer — do not touch
    ├── analysis.module.ts
    ├── analysis.service.ts        (extends signature to accept profile + goal — coordinated with AI-003)
    ├── analysis.types.ts          (extends AnalysisResult with vitamins_minerals[])
    └── prompts.ts
```

**Wiring order in `app.module.ts`:**
1. `ConfigModule` (existing, global).
2. `TypeOrmModule.forRootAsync` — extend `entities` with `[Scan, User, UserProfile, Goal, RefreshToken]`.
3. `ServeStaticModule` (existing).
4. `AuthModule` (registers global `JwtAuthGuard` via `APP_GUARD`; routes are auth-protected by default, opt out with `@Public()`).
5. `UsersModule`, `GoalsModule`, `ProgressModule`, `ScansModule`, `AnalysisModule`.
6. Global `HttpExceptionFilter` + `SuccessEnvelopeInterceptor` via `APP_FILTER` / `APP_INTERCEPTOR`.

---

## 3. Data Model

All entities use TypeORM decorators, UUID primary keys (`@PrimaryGeneratedColumn('uuid')`), and SQLite-portable column types (`text`, `integer`, `simple-json` for serialized JSON). No SQLite-specific functions; queries go through the repository / query-builder. `DATE` / `DATETIME` are stored as ISO strings via the default TypeORM mapping.

### 3.1 `User`

| Column              | Type             | Null | Notes                                                        |
|---------------------|------------------|------|--------------------------------------------------------------|
| `id`                | uuid (PK)        | no   |                                                              |
| `email`             | text             | no   | **unique index** `idx_users_email`; stored lower-cased       |
| `passwordHash`      | text             | no   | bcrypt output, never returned in responses                   |
| `name`              | text             | yes  | display name                                                 |
| `subscriptionTier`  | text             | no   | enum `free` / `premium`, default `free`                      |
| `createdAt`         | datetime         | no   | `@CreateDateColumn`                                          |
| `updatedAt`         | datetime         | no   | `@UpdateDateColumn`                                          |

Relations:
- 1:1 `UserProfile` (`profile`) — cascade `insert`/`update`/`remove`.
- 1:1 `Goal` (`goal`) — cascade `insert`/`update`/`remove`.
- 1:N `Scan` (`scans`) — cascade `remove` (deleting a user removes their scans; see §11 Open Question on soft vs hard delete).
- 1:N `RefreshToken` (`refreshTokens`) — cascade `remove`.

### 3.2 `UserProfile`

One row per user; created lazily on first PUT `/users/me/profile`. All clinical fields nullable so a partial profile is valid (per PRD F-P0-2 acceptance: "null/missing fields permitted").

| Column          | Type           | Null | Notes                                                                    |
|-----------------|----------------|------|--------------------------------------------------------------------------|
| `id`            | uuid (PK)      | no   |                                                                          |
| `userId`        | uuid (FK)      | no   | **unique** (`idx_user_profile_user_id_uniq`); FK → `users.id` `ON DELETE CASCADE` |
| `age`           | integer        | yes  | 1..120                                                                   |
| `gender`        | text           | yes  | enum: `male` / `female` / `other` / `prefer_not_to_say`                  |
| `weightKg`      | real           | yes  | > 0                                                                      |
| `heightCm`      | real           | yes  | > 0                                                                      |
| `activityLevel` | text           | yes  | enum: `sedentary` / `light` / `moderate` / `active` / `very_active`      |
| `conditions`    | simple-json    | yes  | string[] from API §3.3 allowed enum                                      |
| `allergies`     | simple-json    | yes  | string[] from API §3.3 allowed enum                                      |
| `goals`         | simple-json    | yes  | string[] (preference tags — distinct from the M1 `Goal` row)             |
| `updatedAt`     | datetime       | no   | `@UpdateDateColumn`                                                      |

Relation: `@OneToOne(() => User, { onDelete: 'CASCADE' })`.

### 3.3 `Goal`

The macro target the user is grading themselves against today. One active row per user (the M1 PRD §F-P0-3 explicitly excludes multiple concurrent goals).

| Column                | Type        | Null | Notes                                                  |
|-----------------------|-------------|------|--------------------------------------------------------|
| `id`                  | uuid (PK)   | no   |                                                        |
| `userId`              | uuid (FK)   | no   | **unique**; FK → `users.id` `ON DELETE CASCADE`        |
| `goalType`            | text        | no   | enum: `cutting` / `bulking` / `maintenance`            |
| `targetCaloriesKcal`  | integer     | no   | > 0; validator `@Min(1)`                               |
| `targetProteinG`      | integer     | no   | >= 0                                                   |
| `targetCarbsG`        | integer     | no   | >= 0                                                   |
| `targetFatG`          | integer     | no   | >= 0                                                   |
| `createdAt`           | datetime    | no   |                                                        |
| `updatedAt`           | datetime    | no   |                                                        |

### 3.4 `Scan` (existing — additive changes)

Keep all existing columns. Add:

| Column          | Type           | Null | Notes                                                                                              |
|-----------------|----------------|------|----------------------------------------------------------------------------------------------------|
| `userId`        | uuid (FK)      | yes  | FK → `users.id` `ON DELETE CASCADE`. **Nullable on the column** to allow the BE-001 backfill to seed a "legacy" user without data loss; new rows are NOT-NULL at the service layer. Indexed: `idx_scans_user_created` on `(userId, createdAt)` to power daily rollups and the list endpoint. |
| `vitaminsMinerals` | simple-json | yes  | `Array<{ name, value, unit, daily_value_percent | null }>`. Empty array (not null) when label has none. |
| `goalSnapshot`  | simple-json    | yes  | `{ goalType, targetCaloriesKcal, targetProteinG, targetCarbsG, targetFatG } | null`. Null when the user had no goal at scan time. Frozen at scan creation (BE-012). |
| `imageHash`     | text           | yes  | SHA-256 hex of upload bytes. Stored now for cheap forward-compat dedup; not used in M1 query path. Indexed: `idx_scans_image_hash`. |

The existing `nutrition`, `ingredients`, `verdict`, `redFlagIngredients`, `extractionConfidence`, `imagePath`, `imageUrl`, `productName`, `createdAt` columns stay as-is. The `Verdict` interface gains an optional `goal_context: { goal_type, calories_remaining_today_kcal, protein_remaining_today_g } | null` field — but `goal_context` is **computed at response time** in the controller from `goalSnapshot` + today's totals; it is NOT a stored column. This keeps the snapshot truthful while letting the response track today's remaining budget.

### 3.5 `RefreshToken`

Server-side refresh-token row. Each issued refresh token gets a row; logout deletes the row; rotation deletes the old row and inserts a new one in the same family.

| Column         | Type        | Null | Notes                                                                                        |
|----------------|-------------|------|----------------------------------------------------------------------------------------------|
| `id`           | uuid (PK)   | no   | Encoded in the JWT as the `jti` claim; lookup key.                                           |
| `userId`       | uuid (FK)   | no   | FK → `users.id` `ON DELETE CASCADE`. Index `idx_refresh_user`.                               |
| `tokenHash`    | text        | no   | SHA-256 of the signed JWT string. We verify by `jti` lookup + hash compare; the raw token is never stored. |
| `familyId`     | uuid        | no   | Set on login/signup; preserved across rotations. On reuse-detected revocation we delete all rows with this `familyId` (forces re-login of every device in that lineage). |
| `userAgent`    | text        | yes  | For audit / "your sessions" UI later.                                                        |
| `ip`           | text        | yes  | Audit.                                                                                       |
| `expiresAt`    | datetime    | no   | Now + refresh TTL (7 days per SEC-001).                                                      |
| `revokedAt`    | datetime    | yes  | Null = active. Set on rotation or logout. Rows are also hard-deleted by a daily cleanup job. |
| `createdAt`    | datetime    | no   |                                                                                              |

Why a table, not just a signed JWT: logout must invalidate immediately, and refresh-token reuse must be detectable (rotation-replay attack). A pure-signed token can't do either.

### 3.6 `synchronize` and the new entities

`synchronize: true` will create all five new tables and add the four new `Scan` columns on next boot. For the existing MVP DB the additive columns are NULL-tolerant, so no data loss — but see §4 for the migration recommendation.

---

## 4. Migrations Strategy

**Recommendation: keep `synchronize: true` for M1, but ship one explicit data-migration script (`backend/src/migrations/0001-backfill-legacy-user.ts`) that runs once on boot to seed the legacy user and backfill existing scans.**

Reasoning:

- The existing `app.module.ts` uses `synchronize: true` and the role definition explicitly permits it for the SQLite MVP. M1 is still pre-production; flipping to migrations costs ~1 day and we'd rather invest that day in BE-002–BE-009.
- TypeORM `synchronize` handles all our M1 schema changes safely: every added column on `scans` is nullable, and every new table is greenfield. SQLite's `ALTER TABLE` limitations (no DROP COLUMN, etc.) are not exercised.
- BE-001's acceptance criterion ("migration applies on a fresh DB and on the existing MVP DB without data loss for existing `scans` (add `user_id` column nullable, backfill to a seeded 'legacy' user)") is the **only** thing `synchronize` cannot do by itself, because it requires *data* movement (insert a `users` row, update existing `scans.userId` to point at it). For that one operation we run an idempotent boot-time backfill (a service registered with `onApplicationBootstrap`) gated by an env flag (`RUN_LEGACY_BACKFILL=1`). It's not a real TypeORM migration but it satisfies the acceptance criterion without setting up the migrations infrastructure.
- We commit to **switching to TypeORM migrations** (`typeorm migration:generate`, `synchronize: false`, `migrationsRun: true`) on the **first of three triggers**: (a) we move to Postgres, (b) we add a non-additive schema change that loses data on auto-sync (column rename, type narrowing, NOT NULL on existing nullable column), or (c) before any production deploy — whichever comes first. This is consistent with the role-definition guidance and `ARCHITECTURE.md` §9.

**Tradeoff acknowledged:** if we ship M1 directly to production without hitting trigger (c), we've shipped `synchronize: true` to prod, which is on the bright-line list. Disambiguation: "M1 to production" here means "internal staging / closed beta only". Public prod gates on the migration switch.

---

## 5. Endpoint Implementation Plan

For each new endpoint group: controller method, DTO (with `class-validator` decorators), service responsibilities, and the exception → `API_CONTRACT.md` §11 error code mapping.

### 5.1 `AuthController` (BE-002, BE-003, BE-004)

| Route                  | Method  | DTO                                                                                                  | Service responsibility                                                                                                   | Exceptions → error code                                                                                  |
|------------------------|---------|------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `POST /auth/signup`    | `signup`| `SignupDto { @IsEmail email; @IsString @MinLength(8) password; @IsString @MaxLength(80) name }`      | Lower-case email; check uniqueness; bcrypt-hash password (cost from `BCRYPT_COST`); create user; issue access + refresh; set refresh cookie. | `DuplicateEmailException` → `409 DUPLICATE_EMAIL`. Validation fail → `400 INVALID_INPUT` via ValidationPipe. |
| `POST /auth/login`     | `login` | `LoginDto { @IsEmail email; @IsString password }`                                                    | Lookup user; bcrypt-compare; rate-limited by SEC-004; issue access + refresh; set cookie.                                | Unknown user OR wrong password → `UnauthorizedException` → `401 UNAUTHORIZED` (identical message to avoid email enumeration). Lockout exceedance → `429 RATE_LIMITED` (set by SEC-004 guard). |
| `POST /auth/refresh`   | `refresh` | No body required; reads `refresh_token` from httpOnly cookie. Optional JSON body fallback for non-browser clients. | Verify JWT signature on refresh secret; lookup `RefreshToken` by `jti`; SHA-256-compare hash; reject if `revokedAt` set OR expired; if reused (revoked row matched), revoke entire `familyId` → 401; on success, rotate (delete row, issue new pair, re-set cookie). | Invalid / missing / expired → `401 UNAUTHORIZED` or `401 TOKEN_EXPIRED`. Reuse detected → `401 UNAUTHORIZED` + log security event. |
| `POST /auth/logout`    | `logout`| No body                                                                                              | Delete the refresh-token row for the current `jti`; clear the cookie via `Set-Cookie` with `Max-Age=0`.                  | No 4xx path — always 204.                                                                                |

`AuthController` is decorated with `@Public()` so the global `JwtAuthGuard` doesn't run on these routes (refresh is verified manually because it uses the refresh secret, not the access secret).

### 5.2 `UsersController` + `ProfileController` (BE-005)

| Route                     | Method        | DTO                                                                                                                              | Service responsibility                                                                | Exceptions → error code                                  |
|---------------------------|---------------|----------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|----------------------------------------------------------|
| `GET /users/me`           | `me`          | —                                                                                                                                | Return current user (id, email, name, subscription_tier, created_at).                 | `401 UNAUTHORIZED` from guard.                           |
| `PATCH /users/me`         | `updateMe`    | `UpdateUserDto { @IsOptional @IsString @MaxLength(80) name? }`                                                                   | Patch name only; email/password change is out of M1 scope.                            | Validation → `400 INVALID_INPUT`.                        |
| `GET /users/me/profile`   | `getProfile`  | —                                                                                                                                | Return profile or an all-nulls shape if the row doesn't exist (per PRD F-P0-2: "with nulls allowed for fields the user hasn't filled"). | —                                                        |
| `PUT /users/me/profile`   | `putProfile`  | `UpsertProfileDto` (see below)                                                                                                   | Upsert the `UserProfile` row.                                                         | Invalid enum → `400 INVALID_INPUT` with `details.field`. |

`UpsertProfileDto` (every field `@IsOptional()` to support partial save):
```
age?:           @IsInt @Min(1) @Max(120)
gender?:        @IsIn(['male','female','other','prefer_not_to_say'])
weight_kg?:     @IsNumber @IsPositive
height_cm?:     @IsNumber @IsPositive
activity_level?: @IsIn(['sedentary','light','moderate','active','very_active'])
conditions?:    @IsArray @ArrayUnique @IsIn([...], { each: true })  // API §3.3 enum
allergies?:     @IsArray @ArrayUnique @IsIn([...], { each: true })
goals?:         @IsArray @ArrayUnique @IsIn([...], { each: true })
```
Snake-case ↔ camel-case is handled by `class-transformer`'s `@Expose({ name: 'weight_kg' })` decorators on the DTO so the wire shape matches `API_CONTRACT.md` while the entity stays camelCase.

### 5.3 `GoalsController` (BE-006)

| Route                       | Method         | DTO                                                                                                              | Service responsibility                                              | Exceptions → error code                                                   |
|-----------------------------|----------------|------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|---------------------------------------------------------------------------|
| `GET /users/me/goal`        | `get`          | —                                                                                                                | Return goal row or 404.                                             | `NotFoundException` → `404 NOT_FOUND` when unset.                         |
| `PUT /users/me/goal`        | `upsert`       | `UpsertGoalDto` (below)                                                                                          | Upsert. If `targets` missing, compute from profile via Mifflin–St Jeor (helper in `goals.service.ts`). | Profile missing AND no targets provided → `400 INVALID_INPUT` (`details.field: "profile"`). |
| `DELETE /users/me/goal`     | `remove`       | —                                                                                                                | Hard-delete the row; 204.                                           | Idempotent — deleting an absent row also returns 204.                     |

```
UpsertGoalDto {
  @IsIn(['cutting','bulking','maintenance']) goal_type
  @IsInt @Min(1) target_calories_kcal
  @IsInt @Min(0) target_protein_g
  @IsInt @Min(0) target_carbs_g
  @IsInt @Min(0) target_fat_g
}
```

### 5.4 `ProgressController` (BE-009, BE-012)

| Route                                 | Method   | DTO                                                                              | Service responsibility                                                                                              | Exceptions → error code                                  |
|---------------------------------------|----------|----------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|
| `GET /progress/daily?date=YYYY-MM-DD` | `daily`  | `DailyProgressQueryDto { @IsOptional @Matches(/^\d{4}-\d{2}-\d{2}$/) date? }`   | See §7. Default `date` = user's local today. Aggregate this day's scans by `userId`. Return PRD §6.3 shape.        | Bad date format → `400 INVALID_INPUT`.                   |

### 5.5 `ScansController` additive changes (BE-007, BE-008, BE-010, BE-011, BE-013)

| Route                                | Method        | Changes                                                                                                                                                                                                                                                                                                                       | Exceptions → error code                                                                                                                                |
|--------------------------------------|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| `GET /scans` (list)                  | `list`        | Inject `CurrentUser`; filter by `userId`. Add `ListScansQueryDto { @IsOptional @IsInt @Max(100) limit?; @IsOptional cursor?; @IsOptional @IsISO8601 from?; @IsOptional @IsISO8601 to? }`. Drop `verdict` filter (per PRD §6.1). Cursor pagination per `API_CONTRACT.md` §1.5 (base64 of `{ createdAt, id }`).                  | —                                                                                                                                                       |
| `GET /scans/:id`                     | `get`         | Filter by both `id` AND `userId`. Foreign scan → `404 NOT_FOUND` (NOT 403 — per PRD F-P1-2: "don't leak existence").                                                                                                                                                                                                          | `404 NOT_FOUND`.                                                                                                                                        |
| `DELETE /scans/:id`                  | `remove`      | Same scoping. 204.                                                                                                                                                                                                                                                                                                            | `404 NOT_FOUND`.                                                                                                                                        |
| `POST /scans`                        | `create`      | (a) `@UseGuards(ScanQuotaGuard)` enforces BE-013 (≤ 20/day per free user). (b) Compute SHA-256 of file bytes → store in `imageHash`. (c) Load the user's profile + goal; pass both to `AnalysisService.analyzeLabel(...)`. (d) Persist `userId`, `vitaminsMinerals`, `goalSnapshot` (frozen copy of the user's current goal at this instant). (e) Compute `verdict.goal_context` at response time. | `400 INVALID_INPUT` (file shape), `422 EXTRACTION_FAILED` (AnalysisService throws), `422 LOW_CONFIDENCE` (AnalysisService low-conf), `429 QUOTA_EXCEEDED` (guard), `503 LLM_UNAVAILABLE` (Anthropic API error). |
| `POST /scans/:id/reanalyze`          | `reanalyze`   | P1 (BE-010). Loads the scan; verifies ownership; calls a **new** `AnalysisService.rescore(extracted, profile, goal)` method (no vision call — input is the stored `extracted` JSON). Updates only `verdict`, `goalSnapshot`, `redFlagIngredients`. Nutrition + ingredients + `imageHash` are immutable.                       | `404 NOT_FOUND`, `422 EXTRACTION_FAILED` (rescore returned no verdict), `503 LLM_UNAVAILABLE`.                                                          |

Mapping rule for the controller: it should not know about `Anthropic.APIError` directly. `AnalysisService` is responsible for translating upstream errors into the domain exceptions `ExtractionFailedException` / `LowConfidenceException` / `LlmUnavailableException`, which the global exception filter maps to the envelope.

---

## 6. Auth Flow

### 6.1 Tokens

- **Access token:** JWT, HS256, signed with `JWT_ACCESS_SECRET`. TTL = **15 min** (per `.claude/agents/be-engineer.md`, SEC-001, and `ARCHITECTURE.md` §9). Claims: `sub` (userId), `email`, `iat`, `exp`, `tier` (subscription_tier — lets quota guards check without a DB hit).
- **Refresh token:** JWT, HS256, signed with `JWT_REFRESH_SECRET` (a **separate** secret per SEC-002). TTL = **7 days**. Claims: `sub`, `jti` (the `RefreshToken.id`), `family` (the `RefreshToken.familyId`), `iat`, `exp`.

### 6.2 Storage decision

Refresh token: **DB-backed row** (`RefreshToken` entity, §3.5) **AND** delivered to the client via httpOnly cookie. The DB row is the source of truth for "is this refresh token still valid"; the JWT signature alone is not trusted for logout / rotation.

Per the be-engineer role default and SEC-002:

```
Set-Cookie: nt_refresh=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800
```

- `HttpOnly` — JS cannot read it (XSS resistance).
- `Secure` — TLS-only. In dev (`NODE_ENV !== 'production'`) we omit this flag because localhost is HTTP.
- `SameSite=Strict` — defeats cross-site CSRF on the refresh endpoint.
- `Path=/auth` — only sent on `/auth/refresh` and `/auth/logout`. Reduces blast radius.

Access tokens are returned in the JSON response body (per `API_CONTRACT.md` §2.1) and the frontend keeps them in memory only. The FE design doc owns the in-memory-vs-localStorage decision (FE-001 acceptance defers this to security-engineer review); from the backend's perspective we accept either in the `Authorization: Bearer` header.

### 6.3 Rotation policy

Refresh-token rotation on every `/auth/refresh` call:

1. Verify the JWT signature with `JWT_REFRESH_SECRET`. If bad → 401.
2. Look up `RefreshToken` by `jti`. If absent → 401 (someone replayed an already-rotated or already-logged-out token).
3. SHA-256-hash the incoming JWT, compare to `tokenHash`. If mismatch → 401.
4. If `revokedAt` is set → **reuse detected**. Delete every `RefreshToken` row with the same `familyId` (forces re-auth of every device in this lineage). Log a security event. Return 401.
5. Otherwise: mark the current row `revokedAt = now()` (we don't delete immediately — having a tombstone is what lets step 4 detect reuse), issue a new access token + new refresh token with the same `familyId`, insert a new `RefreshToken` row, re-set the cookie. A daily cleanup job hard-deletes revoked-or-expired rows older than 30 days.

### 6.4 Logout

`POST /auth/logout` reads the cookie, looks up the `RefreshToken` row by `jti`, deletes it (hard delete — there's no reuse-detection value once the user has intentionally logged out), and returns `Set-Cookie: nt_refresh=; Max-Age=0`. Subsequent refresh attempts → 401.

### 6.5 Coordination with security-engineer

- TTLs (15 min / 7 days), bcrypt cost (≥ 10), and lockout (5 failed attempts → 15 min lockout) are **set by SEC-001**, consumed here via env vars `JWT_ACCESS_TTL_SEC`, `JWT_REFRESH_TTL_SEC`, `BCRYPT_COST`, `LOGIN_LOCKOUT_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_WINDOW_SEC`.
- Rate limiting on `/auth/*` is SEC-004's surface (in-memory store for M1). Implemented as a NestJS guard layered before the controller methods.
- Key rotation: SEC-002 owns the runbook; the backend supports it by accepting `JWT_ACCESS_SECRET_PREVIOUS` and `JWT_REFRESH_SECRET_PREVIOUS` env vars (optional). The `JwtStrategy` tries the current secret first and falls back to the previous during a grace window.

---

## 7. Goal & Progress Computation

### 7.1 Aggregation: SQL rollup, not a daily_log table

**Recommendation: aggregate on the fly from the `scans` table — do NOT introduce a `daily_nutrition_log` table in M1.**

Reasoning:

| Dimension                         | SQL rollup over `scans`                                                                                              | Explicit `daily_nutrition_log` table                                                                                  |
|-----------------------------------|----------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| Read cost (M1 scale: ~10 scans/day) | One indexed `SELECT SUM(...) GROUP BY date(createdAt)` filtered by `userId`. Sub-millisecond on SQLite. Acceptance target: < 200ms with 10 scans (BE-009 AC) and p95 < 300ms with 100 scans across 30 days (QA-006 AC). | One row lookup. Marginally faster.                                                                                     |
| Write cost                         | Free (the scan write *is* the data).                                                                                 | Every scan needs an additional row insert/update + a transaction.                                                      |
| Consistency on re-analyze (BE-010) | Nothing to keep in sync — `nutrition` is immutable on reanalyze (per AC), so totals never change. Verdict change is irrelevant to totals. | Risk of drift: every reanalyze must NOT touch the daily log, and any future "edit a scan" feature has to remember to update both rows. |
| Snapshot-per-day (BE-012)          | Solved by storing `goalSnapshot` on each `Scan` row directly. The progress query picks `goalSnapshot` from the most-recent scan on the queried date; if zero scans that day, falls back to the most-recent scan ≤ that date (per BE-012 AC). | Solved by storing the snapshot on the daily-log row, but the "no scans that day" path needs the same fallback query anyway. |
| Manual-entry support (F-P2-1, P2)  | Add a `ManualEntry` entity that the progress query unions in. Cheap, additive.                                       | Manual entries either go in `daily_log` directly (drift risk vs. scans) or stay in their own table (same union pattern). |
| Cost / complexity                  | Lower.                                                                                                                | Higher (extra entity, extra write path, extra reanalyze gotcha).                                                       |

Tradeoff acknowledged: if scan-count-per-day-per-user climbs to ~100s, the SUM query becomes worth caching. For M1's `> 4 scans/user/week` target (PRD §5 metric 3) this is nowhere near a concern. The `(userId, createdAt)` index keeps us safe up to a few thousand scans per user per day.

### 7.2 Query

`ProgressService.getDaily(userId, date)`:

```ts
// Pseudocode — TypeORM repository methods, not raw SQL.
const dayStart = startOfDayUtcFor(date, userTimezone);  // see Open Question §11
const dayEnd   = endOfDayUtcFor(date, userTimezone);

const scans = await scansRepo.find({
  where: { userId, createdAt: Between(dayStart, dayEnd) },
  select: ['id', 'nutrition', 'goalSnapshot', 'createdAt'],
  order: { createdAt: 'ASC' },
});

const totals = scans.reduce((acc, s) => ({
  calories_kcal: acc.calories_kcal + (s.nutrition.calories ?? 0),
  protein_g:     acc.protein_g     + (s.nutrition.protein_g ?? 0),
  carbs_g:       acc.carbs_g       + (s.nutrition.total_carbs_g ?? 0),
  fat_g:         acc.fat_g         + (s.nutrition.total_fat_g ?? 0),
}), { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

// goal_snapshot resolution per BE-012:
const goalSnapshot =
  scans.find(s => s.goalSnapshot)?.goalSnapshot
  ?? await scansRepo.findOne({
       where: { userId, createdAt: LessThanOrEqual(dayEnd) },
       order: { createdAt: 'DESC' },
       select: ['goalSnapshot'],
     })?.goalSnapshot
  ?? null;

const status = computeStatus(totals.calories_kcal, goalSnapshot);
// behind: < 90% of target; on_track: 90–110%; over: > 110%; no_goal when null.
```

The nutrition field keys (`calories`, `protein_g`, `total_carbs_g`, `total_fat_g`) match what `AnalysisService` already returns and what `Scan.nutrition` already stores.

### 7.3 Response shape (per PRD §6.3)

```json
{
  "success": true,
  "data": {
    "date": "2026-05-18",
    "goal_snapshot": {
      "goal_type": "bulking",
      "target_calories_kcal": 2800,
      "target_protein_g": 180,
      "target_carbs_g": 350,
      "target_fat_g": 80
    },
    "totals": {
      "calories_kcal": 2100,
      "protein_g": 140,
      "carbs_g": 260,
      "fat_g": 65
    },
    "status": "behind",
    "scan_ids": ["uuid-a", "uuid-b", "uuid-c"]
  }
}
```

`goal_snapshot` is `null` and `status` is `"no_goal"` when the user has never set a goal AND no past scan ≤ this date carries one.

---

## 8. Integration with AnalysisService

`AnalysisService` is owned by ai-engineer. From the backend side we define ONLY the **interface contract**; the prompt, tool schema, and Claude model selection are not our surface area.

### 8.1 Method signatures (the interface)

```ts
// analysis.service.ts — coordinated with AI-001/AI-003.
interface AnalyzeLabelInput {
  imagePath: string;
  mimeType: string;
  profile?: UserProfileSnapshot | null;
  goal?: GoalSnapshot | null;
}

interface UserProfileSnapshot {
  age: number | null;
  gender: 'male'|'female'|'other'|'prefer_not_to_say' | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: ActivityLevel | null;
  conditions: string[];
  allergies: string[];
  goals: string[];                 // preference tags from API §3.3 — distinct from the goal_type below
}

interface GoalSnapshot {
  goal_type: 'cutting' | 'bulking' | 'maintenance';
  target_calories_kcal: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
}

analyzeLabel(input: AnalyzeLabelInput): Promise<AnalysisResult>;

// BE-010 — no vision call.
rescore(
  extracted: AnalysisResult['extracted'],
  profile: UserProfileSnapshot | null,
  goal: GoalSnapshot | null,
): Promise<Pick<AnalysisResult, 'verdict' | 'red_flag_ingredients'>>;
```

### 8.2 Output (the contract we accept)

`AnalysisResult` is extended (additive only, coordinated via AI-002):

```ts
interface AnalysisResult {
  extraction_confidence: 'high' | 'medium' | 'low';
  extraction_notes?: string;
  product: { name: string|null; brand?: string; category?: string; serving_size: string; servings_per_container?: number };
  nutrition: Record<string, number | null>;
  vitamins_minerals: Array<{               // NEW — empty array when none, NOT null (per F-P0-4 AC)
    name: string;
    value: number | null;
    unit: string;
    daily_value_percent: number | null;
  }>;
  ingredients: string[];
  red_flag_ingredients: Array<{ ingredient: string; reason: string; severity: 'low'|'medium'|'high' }>;
  verdict: {
    tier: 'healthy'|'moderate'|'unhealthy';
    score: number;
    summary: string;
    explanation: string;
    personalized_for?: string[];           // NEW (optional) — includes goal_type when goal-aware (F-P0-5 AC)
  };
}
```

The backend persists this verbatim. `verdict.goal_context` is **not** part of the AnalysisService output — it's computed in the scans controller after the fact, because it depends on today's running totals (a DB query), not on the LLM.

### 8.3 Error propagation

`AnalysisService` raises domain exceptions; the global exception filter maps them.

| AnalysisService raises                       | HTTP | API_CONTRACT §11 code |
|----------------------------------------------|------|-----------------------|
| `ExtractionFailedException` (model didn't return a tool call, OR JSON missing required fields) | 422 | `EXTRACTION_FAILED`   |
| `LowConfidenceException` (`extraction_confidence === 'low'`) | 422 | `LOW_CONFIDENCE`      |
| `LlmUnavailableException` (Anthropic `APIError`, 5xx, network timeout, key error) | 503 | `LLM_UNAVAILABLE`     |
| Anything else                                | 500  | `INTERNAL_ERROR` (envelope: `{ code: 'INTERNAL_ERROR', message: 'Internal server error' }`) — no stack trace leaked. |

Per bright-line rule "Don't swallow Claude errors": no fake-200 paths. If the analysis fails, the scan is **not persisted** (the file may have been written to `uploads/` but no `Scan` row is created) and the user sees the 422/503.

---

## 9. Validation & Error Envelope

### 9.1 Success envelope

`SuccessEnvelopeInterceptor` wraps every successful response body in `{ success: true, data: <controller return value> }`, matching `API_CONTRACT.md` §1.3. Controllers return raw domain objects; the interceptor handles the envelope. Status code is whatever Nest infers (`@HttpCode(201)` on signup/create, `@HttpCode(204)` on delete/logout — the interceptor passes through 204 with no body).

### 9.2 Error envelope

`HttpExceptionFilter` is the **single source of error responses**. It handles:

- `class-validator` failures (thrown by global `ValidationPipe`) → `400 INVALID_INPUT` with `details: { field, constraints }`.
- All subclasses of `DomainException` (our base class) → the HTTP status and `code` from the exception's properties.
- Stock `NestJS` exceptions (`UnauthorizedException`, `NotFoundException`, `BadRequestException`, `ForbiddenException`, `ConflictException`) → mapped to `UNAUTHORIZED` / `NOT_FOUND` / `INVALID_INPUT` / `FORBIDDEN` / `DUPLICATE_EMAIL` codes by default. Override per-call by throwing the corresponding `DomainException` subclass when the code matters semantically (e.g., we throw `DuplicateEmailException` rather than `ConflictException` to be explicit).
- Anything else (uncaught `Error`) → `500 INTERNAL_ERROR`, logged with the stack, **never** returned to the client verbatim.

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": { "field": "email", "constraints": ["must be a valid email"] }
  }
}
```

### 9.3 Pipes / guards / interceptors registered globally in `main.ts`

- `app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))` — `forbidNonWhitelisted` newly added so we reject unknown payload fields (defense-in-depth, satisfies "validate at the boundary" bright line).
- `app.useGlobalFilters(new HttpExceptionFilter(logger))`.
- `app.useGlobalInterceptors(new SuccessEnvelopeInterceptor())`.
- `app.use(cookieParser())` — for the refresh-token cookie.
- `app.use(helmet())` if `security-engineer` requests it (SEC-002 / SEC-003 may add this; not committing here without their sign-off).

---

## 10. Configuration & Secrets

New env vars (additions to `backend/.env.example`). Variables marked **required-at-boot** cause `AuthService` / app bootstrap to throw if absent; the others have defaults.

| Env var                          | Required at boot                | Default                  | Purpose                                                                                |
|----------------------------------|---------------------------------|--------------------------|----------------------------------------------------------------------------------------|
| `ANTHROPIC_API_KEY`              | Yes (existing)                  | —                        | Claude API key. Existing.                                                              |
| `CLAUDE_MODEL`                   | No (existing)                   | `claude-sonnet-4-6`      | Existing.                                                                              |
| `DATABASE_PATH`                  | No (existing)                   | `./data.sqlite`          | Existing.                                                                              |
| `PORT`                           | No (existing)                   | `3000`                   | Existing.                                                                              |
| `JWT_ACCESS_SECRET`              | **Yes**                         | —                        | HS256 signing key for access tokens.                                                   |
| `JWT_REFRESH_SECRET`             | **Yes**                         | —                        | HS256 signing key for refresh tokens. MUST be different from `JWT_ACCESS_SECRET`.      |
| `JWT_ACCESS_SECRET_PREVIOUS`     | No                              | —                        | Grace-window key during rotation (SEC-002).                                            |
| `JWT_REFRESH_SECRET_PREVIOUS`    | No                              | —                        | Same, for refresh tokens.                                                              |
| `JWT_ACCESS_TTL_SEC`             | No                              | `900` (15 min)           | Per SEC-001.                                                                           |
| `JWT_REFRESH_TTL_SEC`            | No                              | `604800` (7 days)        | Per SEC-001.                                                                           |
| `BCRYPT_COST`                    | No                              | `12`                     | Bcrypt rounds. SEC-001 requires ≥ 10; default 12 gives some headroom.                  |
| `LOGIN_LOCKOUT_MAX_ATTEMPTS`     | No                              | `5`                      | Per SEC-001 (consumed by SEC-004's guard).                                             |
| `LOGIN_LOCKOUT_WINDOW_SEC`       | No                              | `900` (15 min)           | Per SEC-001.                                                                           |
| `COOKIE_DOMAIN`                  | No                              | unset (host-only cookie) | Set when the API and FE are on different subdomains.                                   |
| `NODE_ENV`                       | No (de-facto)                   | `development`            | Drives `Secure` cookie flag.                                                           |
| `FREE_TIER_DAILY_SCAN_QUOTA`     | No                              | `20`                     | BE-013. Generous M1 default.                                                           |
| `QUOTA_BYPASS_TOKEN`             | No                              | unset                    | Dev/admin escape hatch for QA. When `req.header('x-quota-bypass')` matches, the guard short-circuits. |
| `RUN_LEGACY_BACKFILL`            | No                              | `0`                      | When `1`, runs the BE-001 one-shot backfill at boot.                                   |

**Bright line:** none of these (especially `JWT_*_SECRET`, `ANTHROPIC_API_KEY`, `QUOTA_BYPASS_TOKEN`) are ever logged. `LoggerService` redacts on a deny-list.

---

## 11. Open Questions & Risks

### 11.1 SQLite → Postgres timing

We're sticking with SQLite per the role definition and `synchronize: true` per §4. The risk: once we have real users, the cost of a Postgres migration grows linearly with data volume, and any unique constraint we miss in SQLite (which is permissive about implicit type coercion on indexes) will become a Postgres-side bug. Mitigation: keep all queries in the TypeORM query builder / repository (no raw SQL), and run a smoke test against a Postgres dev DB once before milestone end. This is a soft "ship the milestone" risk, not a hard blocker.

### 11.2 Image-hash dedup scope

We **store** `imageHash` on every new scan (§3.4) but we do NOT check it on `POST /scans` in M1. The PRD explicitly defers dedup (§2.2). The risk: a user spamming the same image bleeds Claude budget. Mitigation: BE-013's 20-scans/day cap is the cost ceiling for M1. The hash is forward-compat — when M2 turns dedup on, we already have the column populated. Open question: should we ALSO check the hash on `POST /scans/:id/reanalyze` to short-circuit re-rescoring? Probably no — reanalyze is a no-vision-call by design (BE-010 AC), so the cost is negligible and we'd risk masking a profile-change behavior.

### 11.3 Soft-delete vs hard-delete on user deletion

Currently every FK is `ON DELETE CASCADE`, meaning deleting a user removes all their scans, profile, goal, and refresh tokens. The PRD does not yet specify a user-deletion endpoint (DELETE /users/me is out of M1 scope per task list), so this is a forward question. Tradeoff: hard-delete is GDPR-friendly and simpler but loses audit ability; soft-delete (an `isDeleted` flag) preserves history but bleeds disk and risks accidental re-disclosure. Default for M1: cascade-hard-delete in the schema, and **defer building the user-deletion endpoint to M2** so we don't ship it half-baked. If product wants self-service deletion sooner, the soft-delete decision is the gating call.

### 11.4 Timezone source for "today" (PRD Open Question §8.2)

The progress endpoint defaults `date` to "the user's local today" — but we don't store a user timezone yet. M1 fallback: trust an optional `X-User-Timezone` IANA-name header from the FE; fall back to `Asia/Jakarta` (WIB) if absent. Risk: an Andi in Makassar (WITA) gets a one-hour-shifted "today" on edge-of-day scans. Long-term fix: add `timezone` to `User` (or `UserProfile`) — but that needs a UI affordance and PM approval, so it's an explicit M2 item. **This is the biggest open question on the data model.**

### 11.5 Goal change mid-day (PRD Open Question §8)

BE-012 stores a `goalSnapshot` at scan-time. If the user changes their goal at 2pm: scans from 8am–2pm carry the morning goal in their snapshot; scans from 2pm onward carry the afternoon goal. The progress query picks the snapshot from "the most recent scan whose snapshot is non-null" (§7.2). For a day with scans on both sides of the change, that's the *afternoon* goal, which means the morning's totals get graded against the afternoon's target. This is mildly wrong but the simplest defensible rule. Alternative: pick the snapshot from the **first** scan of the day (morning's goal wins for today). PM Open Question §8 leans toward "new goal applies from now, today's snapshot freezes at end of day" — confirm before launch; the difference is one line in `ProgressService.getDaily`.

### 11.6 Refresh token cookie + non-browser clients

The httpOnly-cookie design is browser-first. If a future mobile client (React Native, per PRD §2.2 non-goals — but eventually) can't easily handle cookies, we'd need a JSON-body fallback for `/auth/refresh` and `/auth/logout`. The `RefreshDto` already supports an optional body — but using it loses the SameSite=Strict CSRF protection, so it must be paired with another defense (e.g., requiring a CSRF header that JS-controlled clients can set but cross-site forms can't). Defer the actual decision until mobile work begins; document the constraint here.

### 11.7 Re-analyze quota and cost throttling (PRD Open Question §5)

BE-010 is no-vision (rescore-only), so the cost is the Anthropic *text* path price, not the vision price — call it < $0.001/call. Even FE-009's "re-analyze last 7 days" is ~30 calls × $0.001 = $0.03. We won't quota this in M1; if a user really wants to spam reanalyze, they can. Risk acknowledged: a script kiddie could fire 100k reanalyze calls and burn ~$100/day. Mitigation: keep BE-013's per-day scan quota AND add a soft "reanalyze cooldown" of 1 call per scan per minute. Implement only if observed in logs.

---

*End of backend design.*
