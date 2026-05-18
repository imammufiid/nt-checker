# TASKS — nt-checker M1 (Scan-to-Goal Loop)

**Author:** pm-agent
**Date:** 2026-05-18
**Status:** Draft v1
**Source PRD:** [`docs/PRD.md`](./PRD.md)

---

## How to read this

Each task below has an ID (`BE-001`, `FE-002`, etc.), an owner role, dependencies, testable acceptance criteria, and a t-shirt effort. Owners are roles, not people: `be-engineer`, `fe-engineer`, `ai-engineer`, `qa-engineer`, `security-engineer`. Effort sizes are `S` (< ½ day), `M` (½–2 days), `L` (2–5 days). Numbering is sequential per prefix. **Acceptance is the contract** — if the criteria pass, the task is done; otherwise it isn't, regardless of how much code was written. Engineers should not start a task until all its dependencies are merged.

## Critical path

The shortest sequence that unblocks the most downstream work is:

```
BE-001 (user entity + migration)
   └─► BE-002 (signup) ──► BE-003 (login) ──► BE-004 (auth middleware)
                                                    │
                                                    ├─► BE-005 (profile CRUD)
                                                    ├─► BE-006 (goal CRUD)
                                                    ├─► BE-007 (scope scans to user)
                                                    └─► BE-009 (daily progress)
                                                                  │
                                          AI-001 (goal-aware prompt) ──► AI-002 (micros in response)
                                                                  │
                                          FE-001 (auth UI) ──► FE-002+ (everything else)
```

**Blocking tasks (start first, all hands):** `BE-001`, `BE-002`, `BE-004`. These three unblock virtually every other backend and frontend task. Auth shipping late delays the entire milestone.

Total tasks: **BE 13 · FE 12 · AI 4 · QA 6 · SEC 5 · = 40**.

---

## Backend tasks (BE)

- [ ] **[BE-001]** Add `User` entity + migration (id, email unique, password_hash, name, created_at, subscription_tier default `free`)
  - Owner: be-engineer
  - Depends on: none
  - Acceptance: TypeORM entity exists; migration applies on a fresh DB and on the existing MVP DB without data loss for existing `scans` (add `user_id` column nullable, backfill to a seeded "legacy" user); `users` table has a unique index on `email`.
  - Effort: M

- [ ] **[BE-002]** Implement signup endpoint (`POST /auth/signup`)
  - Owner: be-engineer
  - Depends on: BE-001, SEC-001
  - Acceptance: matches `API_CONTRACT.md` §2.1; password hashed via bcrypt (cost ≥ 10); returns access + refresh tokens; duplicate email returns 409 `DUPLICATE_EMAIL`.
  - Effort: M

- [ ] **[BE-003]** Implement login endpoint (`POST /auth/login`)
  - Owner: be-engineer
  - Depends on: BE-002
  - Acceptance: matches §2.2; bcrypt-compare on submitted password; returns same token shape as signup; wrong credentials return 401 `UNAUTHORIZED` (no user-existence leak in the error message).
  - Effort: S

- [ ] **[BE-004]** Implement JWT auth middleware + `/auth/refresh` + `/auth/logout`
  - Owner: be-engineer
  - Depends on: BE-003, SEC-002
  - Acceptance: Bearer token verified on every non-`/auth/*` and non-`/health` route per `API_CONTRACT.md` §1.1; refresh tokens stored server-side (DB table or Redis-equivalent — SQLite table acceptable for M1); `/auth/logout` invalidates the refresh token and a subsequent refresh returns 401.
  - Effort: M

- [ ] **[BE-005]** Implement user profile endpoints (`GET/PATCH /users/me`, `GET/PUT /users/me/profile`)
  - Owner: be-engineer
  - Depends on: BE-004
  - Acceptance: shapes match `API_CONTRACT.md` §3.1–§3.4; invalid enum values for `gender`, `activity_level`, `conditions`, `allergies`, `goals` return 400 `INVALID_INPUT`; profile persists per user; null/missing fields permitted.
  - Effort: M

- [ ] **[BE-006]** Implement goal endpoints (`GET/PUT/DELETE /users/me/goal`)
  - Owner: be-engineer
  - Depends on: BE-005
  - Acceptance: PUT upserts; GET returns 404 when unset; `goal_type` restricted to `cutting`/`bulking`/`maintenance`; numeric targets validated > 0; matches PRD §6.3 shape.
  - Effort: M

- [ ] **[BE-007]** Scope all scan endpoints to the authenticated user
  - Owner: be-engineer
  - Depends on: BE-004
  - Acceptance: `GET /scans` returns only `user_id == current_user.id`; `GET /scans/{id}` and `DELETE /scans/{id}` return 404 (not 403) for foreign scans; new scans set `user_id` from token; `from`/`to` query params filter by `created_at`.
  - Effort: M

- [ ] **[BE-008]** Wire user profile + goal into the analysis service call
  - Owner: be-engineer
  - Depends on: BE-006, BE-007, AI-001
  - Acceptance: when a logged-in user with a saved profile and/or goal posts to `/scans`, the user message sent to Claude includes the profile JSON and a `goal` block (goal_type + targets); when user has neither, behavior matches today's MVP (generic).
  - Effort: M

- [ ] **[BE-009]** Implement daily progress endpoint (`GET /progress/daily?date=YYYY-MM-DD`)
  - Owner: be-engineer
  - Depends on: BE-007, BE-006
  - Acceptance: returns shape from PRD §6.3; aggregates calories + protein/carbs/fat across the day's scans for the user; status derived per PRD F-P0-6 (behind < 90%, on_track 90–110%, over > 110%, no_goal when no goal saved); response < 200ms on a day with 10 scans.
  - Effort: M

- [ ] **[BE-010]** Implement `POST /scans/{id}/reanalyze` (P1)
  - Owner: be-engineer
  - Depends on: BE-008
  - Acceptance: re-scores the stored scan with current profile + goal WITHOUT re-calling Claude vision (reuses stored `extracted` data); updates `verdict` only; preserves `nutrition` and `ingredients`; returns the updated full scan object.
  - Effort: M

- [ ] **[BE-011]** Surface `vitamins_minerals[]` and `verdict.goal_context` in `POST /scans` and `GET /scans/{id}` responses
  - Owner: be-engineer
  - Depends on: BE-008, AI-002
  - Acceptance: response includes `extracted.nutrition.vitamins_minerals[]` (empty array when none); when user has a goal, response includes `verdict.goal_context.{goal_type, calories_remaining_today_kcal, protein_remaining_today_g}`; existing macro fields unchanged.
  - Effort: S

- [ ] **[BE-012]** Persist daily goal_snapshot alongside scans for historical accuracy
  - Owner: be-engineer
  - Depends on: BE-006, BE-009
  - Acceptance: each scan row stores a `goal_snapshot` JSON of the user's goal at scan-time; `GET /progress/daily?date=<past>` uses the snapshot from that date's scans, NOT the user's current goal; if no scans on that date, returns the most-recent snapshot ≤ that date.
  - Effort: M

- [ ] **[BE-013]** Add per-user-per-day Claude call quota (defensive cost guard)
  - Owner: be-engineer
  - Depends on: BE-007
  - Acceptance: free-tier user is limited to 20 scans/day (M1 generous default — production tightens later); 21st returns 429 `QUOTA_EXCEEDED` per `API_CONTRACT.md` §11; quota resets at user-local midnight; admin/dev bypass via env var.
  - Effort: S

---

## Frontend tasks (FE)

- [ ] **[FE-001]** Build signup / login / logout flows in Bahasa Indonesia
  - Owner: fe-engineer
  - Depends on: BE-002, BE-003, BE-004
  - Acceptance: routes `/daftar`, `/masuk`, `/keluar` exist; forms validate client-side (email format, password ≥ 8 chars); tokens stored in httpOnly cookie OR localStorage with documented tradeoff (security-engineer reviews choice); after signup, user lands on profile-setup screen.
  - Effort: M

- [ ] **[FE-002]** Add auth context + protected-route wrapper + token refresh
  - Owner: fe-engineer
  - Depends on: FE-001
  - Acceptance: React context exposes `{ user, accessToken, login, logout }`; any 401 response from API triggers refresh, retries the original request once, falls back to logout; unauthenticated visit to a protected route redirects to `/masuk` with a return-URL param.
  - Effort: M

- [ ] **[FE-003]** Profile setup screen (age, gender, weight, height, activity, conditions, allergies)
  - Owner: fe-engineer
  - Depends on: BE-005, FE-002
  - Acceptance: form in Bahasa Indonesia covers every field from `API_CONTRACT.md` §3.3; conditions and allergies are multi-select chips; saving calls `PUT /users/me/profile`; supports partial save (skip optional fields).
  - Effort: M

- [ ] **[FE-004]** Goal setup screen with calculated suggestions + override
  - Owner: fe-engineer
  - Depends on: FE-003, BE-006
  - Acceptance: user picks one of three radio cards (`cutting`/`bulking`/`maintenance`); suggested calorie + macro split pre-fills from profile (Mifflin–St Jeor); user can override any field; saving calls `PUT /users/me/goal`; copy includes "perkiraan, sesuaikan dengan kebutuhanmu" disclaimer.
  - Effort: M

- [ ] **[FE-005]** Update result page to render `vitamins_minerals[]` section
  - Owner: fe-engineer
  - Depends on: BE-011
  - Acceptance: when scan response has non-empty `vitamins_minerals`, a "Vitamin & Mineral" section renders with top 5 by `daily_value_percent` (desc) and a "Lihat semua" expandable for the rest; empty array hides the section entirely; localized to Bahasa Indonesia.
  - Effort: S

- [ ] **[FE-006]** Display `verdict.goal_context` on result page
  - Owner: fe-engineer
  - Depends on: BE-011
  - Acceptance: when `verdict.goal_context` present, result page shows "Sisa hari ini: X kkal · Y g protein" card under the verdict; when absent (user has no goal), shows a CTA "Atur tujuanmu" linking to FE-004.
  - Effort: S

- [ ] **[FE-007]** Daily progress page (`/hari-ini` or `/progress`)
  - Owner: fe-engineer
  - Depends on: BE-009, FE-002
  - Acceptance: shows progress bars for calories + 3 macros vs. goal; status badge ("Tertinggal" / "Sesuai" / "Berlebih") follows BE-009 thresholds; empty state when no scans today with a "Scan makanan" CTA; date picker lets user view past days.
  - Effort: M

- [ ] **[FE-008]** Update history page to per-user view with daily grouping
  - Owner: fe-engineer
  - Depends on: BE-007, FE-002
  - Acceptance: history lists only the logged-in user's scans; groups visually by date (header: "Hari ini", "Kemarin", "Senin, 5 Mei", etc.); each group shows a sub-header with daily total calories.
  - Effort: M

- [ ] **[FE-009]** Add "re-analyze last 7 days" action after goal/profile changes (P1)
  - Owner: fe-engineer
  - Depends on: BE-010, FE-004
  - Acceptance: after saving a goal/profile change, a non-blocking toast offers "Analisis ulang scan minggu lalu"; tapping fires `POST /scans/{id}/reanalyze` per scan with concurrency 2 and shows progress (x of y); failures degrade gracefully (skip + log).
  - Effort: M

- [ ] **[FE-010]** Soft signup wall — let visitor scan once before forcing signup (pending Open Question #1)
  - Owner: fe-engineer
  - Depends on: FE-001
  - Acceptance: anonymous user can perform one scan; result page shows the verdict; saving the scan or seeing history triggers a "Daftar untuk simpan" modal. *Hold this task until PM resolves Open Question #1; do not start until then.*
  - Effort: M

- [ ] **[FE-011]** Replace the global header/nav with auth-aware nav (Beranda, Hari ini, Riwayat, Profil)
  - Owner: fe-engineer
  - Depends on: FE-002, FE-007
  - Acceptance: signed-out users see only Beranda + Masuk/Daftar; signed-in users see the four-item nav; active route highlighted; works on mobile (≤ 375px).
  - Effort: S

- [ ] **[FE-012]** Localize all new strings to Bahasa Indonesia
  - Owner: fe-engineer
  - Depends on: FE-001 through FE-011
  - Acceptance: no English visible to a logged-in user except product-name extracts (which come from labels and may legitimately be English); strings collected in a single `id.ts` (or equivalent) for future i18n; QA-001 signs off.
  - Effort: S

---

## AI / Analysis tasks (AI)

- [ ] **[AI-001]** Extend system prompt with goal-aware verdict rules
  - Owner: ai-engineer
  - Depends on: none (can start in parallel with BE-001)
  - Acceptance: system prompt in `backend/src/analysis/` adds a "Goal personalization" section telling Claude to incorporate `goal_type` and remaining macro budget into the explanation; condition-based warnings still override goal encouragement (per PRD Risk §7); change is additive — existing extraction behavior unchanged.
  - Effort: M

- [ ] **[AI-002]** Ensure `vitamins_minerals[]` is returned in the tool response and surfaced upstream
  - Owner: ai-engineer
  - Depends on: AI-001
  - Acceptance: existing tool schema (already includes the field) is verified end-to-end; if the label has no vitamin/mineral panel, Claude returns `[]` not `null`; the AnalysisService passes the field through to the caller unchanged.
  - Effort: S

- [ ] **[AI-003]** Add user message construction that includes `goal` block when provided
  - Owner: ai-engineer
  - Depends on: AI-001, BE-006
  - Acceptance: when `analyzeLabel()` receives a `goal` parameter, the user text content includes `Goal:\n{json}` after the profile block per `CLAUDE_API_SPEC.md` §6; when goal is undefined, no goal block is sent and the existing behavior is preserved.
  - Effort: S

- [ ] **[AI-004]** Build a 20-pair eval set (product × goal_type) and run before launch
  - Owner: ai-engineer
  - Depends on: AI-001, AI-002, AI-003
  - Acceptance: 20 fixtures committed under `backend/test/eval-fixtures/` (image + expected goal-aware behavior keywords); a runner script outputs pass/fail per fixture; ≥ 18/20 must pass to ship; failures documented in a one-page eval report.
  - Effort: M

---

## QA tasks (QA)

- [ ] **[QA-001]** Build end-to-end smoke test for the core M1 loop (signup → profile → goal → scan → daily view)
  - Owner: qa-engineer
  - Depends on: FE-007
  - Acceptance: Playwright or equivalent script runs the full happy path against a fresh DB; passes on CI; takes < 90s; mocks the Claude call with a fixture response.
  - Effort: M

- [ ] **[QA-002]** Manual test pass on auth + multi-user isolation
  - Owner: qa-engineer
  - Depends on: BE-007
  - Acceptance: with two test accounts A and B, verify: A's scans never appear in B's history; A cannot GET or DELETE B's scan_id (returns 404); A's daily progress excludes B's scans; logout invalidates refresh.
  - Effort: S

- [ ] **[QA-003]** Verify goal-aware verdict copy on a manual matrix
  - Owner: qa-engineer
  - Depends on: AI-004, FE-006
  - Acceptance: for each goal_type × verdict_tier (3×3 = 9 cells), at least one real scan produces an explanation that mentions the goal_type word in Bahasa Indonesia or English; explanations never recommend ignoring a condition-based warning.
  - Effort: M

- [ ] **[QA-004]** Daily progress edge cases
  - Owner: qa-engineer
  - Depends on: BE-009, BE-012
  - Acceptance: verify (a) day with zero scans shows empty state, (b) day with goal change mid-day uses morning's goal for that day, (c) re-analyzed scan does not double-count, (d) timezone boundary: a scan at 23:55 belongs to that calendar day.
  - Effort: M

- [ ] **[QA-005]** Accessibility + Bahasa Indonesia copy review
  - Owner: qa-engineer
  - Depends on: FE-012
  - Acceptance: all interactive elements have visible focus state; color contrast ≥ AA on the verdict tier badges (healthy/moderate/unhealthy); copy reviewed by a native Bahasa Indonesia speaker; no untranslated English strings on signed-in screens.
  - Effort: S

- [ ] **[QA-006]** Performance check on daily progress and history endpoints
  - Owner: qa-engineer
  - Depends on: BE-009, FE-008
  - Acceptance: seed a user with 100 scans across 30 days; `GET /progress/daily` p95 < 300ms; `GET /scans?limit=20` p95 < 200ms; history page initial render < 1.5s on throttled 3G.
  - Effort: S

---

## Security tasks (SEC)

- [ ] **[SEC-001]** Define password & token policy
  - Owner: security-engineer
  - Depends on: none
  - Acceptance: written policy committed to `docs/security/auth-policy.md` covering min length (8), bcrypt cost (≥10), JWT access TTL (15 min), refresh TTL (7 days), refresh rotation rule, and lockout policy (≥ 5 failed attempts → 15 min lockout); BE-002 and BE-004 must implement to spec.
  - Effort: S

- [ ] **[SEC-002]** JWT secret management + key rotation runbook
  - Owner: security-engineer
  - Depends on: SEC-001
  - Acceptance: JWT signing secret loaded from env (NOT hardcoded); a separate refresh-token secret; documented rotation procedure with zero-downtime path (old + new secret accepted during a grace window); secrets never logged.
  - Effort: S

- [ ] **[SEC-003]** Multi-user isolation review (data + storage)
  - Owner: security-engineer
  - Depends on: BE-007, BE-011
  - Acceptance: review confirms every scan query filters by `user_id`; uploaded images served from `/uploads/:filename` either become user-scoped or migrate to signed URLs; foreign scan_id access returns 404 (not 403); IDOR test suite in QA-002 passes.
  - Effort: M

- [ ] **[SEC-004]** Rate limiting on `/auth/*` endpoints
  - Owner: security-engineer
  - Depends on: BE-004
  - Acceptance: `/auth/login` rate-limited at 10 attempts / IP / 10 minutes; `/auth/signup` at 5 / IP / hour; exceedance returns 429 `RATE_LIMITED` per `API_CONTRACT.md` §11; in-memory implementation acceptable for M1.
  - Effort: S

- [ ] **[SEC-005]** Sensitive-data audit on logs and analytics
  - Owner: security-engineer
  - Depends on: BE-005, BE-008
  - Acceptance: server logs do NOT include passwords, full JWTs, raw images, or unredacted health conditions; PostHog events do NOT include `conditions[]` or `allergies[]` values (use boolean flags like `has_condition` only); written checklist committed for future feature reviews.
  - Effort: S

---

*End of TASKS. Engineers: pick a task, confirm dependencies are met, and write your domain design doc before implementing if the task is M or L.*
