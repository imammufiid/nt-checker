# PRD: nt-checker — From Scan to Goal Loop (Milestone M1)

**Author:** pm-agent
**Date:** 2026-05-18
**Status:** Draft v1
**Predecessor:** `PRODUCT_ANALYSIS.md` v1, MVP commit `f8270a8`

---

## 1. Vision

Today, the MVP can tell a user whether a single packaged food looks healthy in general. That's a one-shot decision tool, not a habit. **M1 turns nt-checker into a daily nutrition companion**: a logged-in user sets a personal goal (diet/cutting, bulking, or maintenance) with target calories and macros, scans food and drinks as they consume them, and at any moment can see *"am I on track to hit my goal today?"*. Verdicts stop being generic ("high sugar") and become goal-aware ("off-track for your bulk — you're 600 kcal short and this won't cover it"). This is the loop the product was promised to deliver, scoped to a 4-week build.

---

## 2. Goals & Non-Goals

### 2.1 In scope (M1)

- Multi-user accounts (email + password) with JWT auth.
- User health profile: age, gender, weight, height, activity level, conditions, allergies.
- Goal setting: pick one of `cutting` / `bulking` / `maintenance`, with system-suggested daily calorie + macro targets the user can override.
- Enhanced scan extraction: existing macros **plus** the vitamins/minerals already declared by `CLAUDE_API_SPEC.md` §4.1 (`vitamins_minerals[]`) surfaced in the response and UI.
- Goal-aware verdict: the explanation references the user's goal and remaining daily budget.
- Daily progress view: today's calories + macros consumed vs. goal, with a simple "ahead / on track / behind" status.
- History view scoped to the logged-in user (per day, with daily totals).
- Re-analyze a past scan when the user's profile or goals change.
- Bahasa Indonesia remains the UI language (per commit `f8270a8`); all new strings localized.

### 2.2 Explicit non-goals (M1)

These are mentioned in `PRODUCT_ANALYSIS.md`, `TECH_STACK.md`, or `API_CONTRACT.md` but are **out of scope** for this milestone:

- Barcode scanning / barcode fallback (P3).
- Community-contributed product database (P3).
- Healthier-alternatives suggestions (P2; depends on a product corpus we don't have).
- Favorites / watchlist endpoints (`API_CONTRACT.md` §6).
- Side-by-side product comparison (`API_CONTRACT.md` §7).
- Payments / subscription / billing / Stripe webhooks (`API_CONTRACT.md` §§8–9).
- Native mobile app (React Native). Web-first this milestone; the existing PWA-style camera flow is sufficient.
- AI chat assistant / follow-up questions on scans.
- Family / multi-profile accounts.
- Recipe analysis (multi-ingredient home-cooked meals).
- Image-hash dedup cache (cost optimization, deferred — call out in risks).
- Multi-LLM fallback (GPT-4o / Gemini). Claude only.

If a stakeholder asks for one of the above during M1, the answer is "not yet — M2."

---

## 3. Target Personas

We anchor M1 on three personas from `PRODUCT_ANALYSIS.md` §3. When their needs conflict, **the fitness/diet follower wins** for M1 because they exercise the goal-tracking loop most directly, and goal-tracking is the wedge of this milestone.

1. **Andi — Fitness / diet follower (PRIMARY).** 25–35, follows a cutting or bulking plan, already counts macros casually, frustrated by manual entry. Wants: fast scan, accurate macros, "did I hit my protein today" answer.
2. **Sari — Health-conscious shopper (SECONDARY).** 30–45, no strict regimen but trying to eat better, picks `maintenance` goal. Wants: a verdict she trusts, and a passive sense that her week is OK.
3. **Pak Budi — Person with a health condition (TERTIARY).** Type-2 diabetes or hypertension. Wants: a clear "this is bad for you" with the reason. Personalization for conditions already exists in `CLAUDE_API_SPEC.md` §5 — M1 keeps that working but does not add new condition logic.

**Conflict rule:** if a tradeoff makes the macro/calorie loop slower or fuzzier in service of Pak Budi's condition flags, we ship the macro loop and document the condition gap. Pak Budi gets full attention in M2.

---

## 4. Features

### P0 — Must ship for M1 to be coherent

#### F-P0-1 — Authentication (signup, login, refresh, logout)

**Problem.** The MVP shares one history across every visitor. We can't track a user's intake without knowing who they are.

**User story.** As Andi, I want to create an account and stay logged in, so my scans and goals are mine alone.

**Acceptance criteria.**
- Given a new email, when the user submits signup with a valid password (>= 8 chars), then a user is created and access + refresh tokens are returned per `API_CONTRACT.md` §2.1.
- Given valid credentials, when the user logs in, then they receive tokens matching the §2.2 shape.
- Given an expired access token, when the client calls `/auth/refresh` with a valid refresh token, then a new access token is issued per §2.3.
- Given a logged-in user, when they call `/auth/logout`, then the refresh token is invalidated server-side and subsequent refresh attempts return 401.
- Given any other endpoint, when called without a valid bearer token, then the API returns 401 with `UNAUTHORIZED`.

**Out of scope.** OAuth/social login, password reset email, email verification, magic links — defer to M2.

#### F-P0-2 — User health profile

**Problem.** Without age/weight/activity, we can't suggest a sensible calorie target. Without conditions/allergies, verdicts stay generic.

**User story.** As Andi, I want to enter my age, gender, weight, height, and activity level once, so the app can suggest a daily calorie target.

**Acceptance criteria.**
- Given a logged-in user, when they GET `/users/me/profile`, then the API returns the shape in `API_CONTRACT.md` §3.3 (with nulls allowed for fields the user hasn't filled).
- Given a logged-in user, when they PUT `/users/me/profile` with valid values, then the profile is saved and reflected on the next GET.
- Given an invalid `activity_level` or `gender` value (not in the enums from §3.3), when the user PUTs, then the API returns 400 `INVALID_INPUT`.
- Given a saved profile, when the user opens the app on a new device, then the profile loads from `/users/me/profile` — nothing is stored client-only.

**Out of scope.** Step-counter / wearable integration; weight history charts; photo body-comp tracking.

#### F-P0-3 — Goal setting (cutting / bulking / maintenance)

**Problem.** "Healthy" is the wrong question for a user trying to bulk; they need to know if a food helps them hit their calorie surplus. The product can't close the loop without a goal.

**User story.** As Andi, I want to pick "bulking" and accept (or override) a suggested daily target of 2,800 kcal / 180g protein / 350g carbs / 80g fat, so the app has something to grade my day against.

**Acceptance criteria.**
- Given a user with a complete profile, when they open goal setup, then the app pre-fills suggested daily calories (Mifflin–St Jeor BMR × activity multiplier, ±500 kcal for cutting/bulking) and macro split (defaults: cutting 40C/40P/20F, bulking 45C/30P/25F, maintenance 50C/25P/25F by calories).
- Given a user, when they save a goal, then `GET /users/me/goal` returns `{ goal_type, target_calories_kcal, target_protein_g, target_carbs_g, target_fat_g, updated_at }`.
- Given a user with no profile, when they try to set a goal, then the UI directs them to complete the profile first (or accepts a fully manual goal with a warning).
- Given a saved goal, when the user changes it, then prior daily totals are NOT retroactively re-graded — only future progress views use the new goal. (Past *scans* can be re-analyzed; daily *grades* are snapshotted.)

**Out of scope.** Multiple concurrent goals; weekly cycling (e.g., refeed days); body recomposition mode; goal expiry / scheduling.

#### F-P0-4 — Enhanced scan analysis (macros + micros surfaced)

**Problem.** `CLAUDE_API_SPEC.md` already asks Claude for `vitamins_minerals[]` but the API response and UI throw most of it away. Users following a goal want to know if they're getting enough fiber, iron, calcium, vitamin C, etc.

**User story.** As Sari, when I scan a fortified cereal, I want to see the vitamins and minerals it provides (with % daily value when available), so I know whether it's contributing more than just calories.

**Acceptance criteria.**
- Given any new scan, when the analysis completes, then the response includes `extracted.nutrition.vitamins_minerals[]` per `CLAUDE_API_SPEC.md` §4.1, populated when present on the label.
- Given a scan with no readable vitamins/minerals panel, when it's analyzed, then `vitamins_minerals` is an empty array (NOT null, NOT missing).
- Given the result screen, when the scan has micros, then the UI renders a "Vitamin & Mineral" section in Bahasa Indonesia with the top 5 by `daily_value_percent` (descending), and a collapsible "show all".
- Given the Claude system prompt is updated, when we deploy, then the existing macro fields (calories, sugar, sodium, etc.) remain unchanged in shape — this is purely additive.

**Out of scope.** Computing % DV ourselves when the label omits it (we surface what Claude extracts; no derivation in M1). Per-condition micro thresholds (e.g., iron for anemia).

#### F-P0-5 — Goal-aware verdict explanation

**Problem.** The current verdict says "high in sugar" regardless of whether the user is cutting or bulking. The same Coke is "bad" for a cut and "irrelevant calorically" for a bulk. We need the explanation to know the user's goal.

**User story.** As Andi (bulking), when I scan a low-calorie protein drink, I want the explanation to say "good fit for your bulk — 30g protein, +180 kcal toward your 2,800 kcal goal", not just "healthy".

**Acceptance criteria.**
- Given a logged-in user with a saved goal, when they scan, then the user message sent to Claude includes the goal block (goal_type + targets) alongside the existing profile per `CLAUDE_API_SPEC.md` §6.
- Given a goal of `bulking`, when a scanned product is calorie-dense and protein-positive, then `verdict.explanation` references the goal explicitly (the word "bulking" or "bulking goal" or its Bahasa Indonesia equivalent appears).
- Given a goal of `cutting`, when a scanned product has > 15g added sugar, then `verdict.tier` is `unhealthy` and the explanation cites both the sugar and the cutting goal.
- Given a user with NO saved goal, when they scan, then the verdict behaves as today (generic) and the UI shows a soft prompt to set a goal.
- Given the response, when rendered, then `verdict.personalized_for[]` includes the goal_type when goal-aware.

**Out of scope.** Coaching tone variants ("aggressive" vs "gentle"); recommending alternatives ("try this instead").

#### F-P0-6 — Daily progress tracking

**Problem.** Goal-setting without a "did I hit it today" view is dead weight (per pm-agent bright line: goal-tracking must close the loop).

**User story.** As Andi, I want to open the app at 8pm and see "2,100 / 2,800 kcal, 140 / 180g protein — you're 700 kcal behind, eat something", so I know whether I need another meal.

**Acceptance criteria.**
- Given a user with a goal and one or more scans today, when they open the daily view, then they see totals for calories + 3 macros and a per-metric progress bar against the goal.
- Given the totals, when calories are < 90% of target by user's local end-of-day, then the status reads "behind"; when 90–110% it reads "on track"; when > 110% it reads "over". (Status is informational, not punitive.)
- Given a user with no scans today, when they open the daily view, then they see an empty state with a "scan something" CTA — NOT an error.
- Given a user scrolls back, when they pick a past date, then they see that day's snapshot of totals and the goal that was active *that day* (not today's goal).
- Given the same scan exists, when the user views daily progress, then each scan counts exactly once (no double-counting on re-analyze).

**Out of scope.** Weekly / monthly aggregate views; streak counters; goal-completion badges; export to CSV.

### P1 — Should ship if scope holds

#### F-P1-1 — Re-analyze past scans on profile/goal change

**Problem.** Users update their conditions (new diabetes diagnosis) or flip from bulk to cut. The verdicts on yesterday's scans are now wrong. `API_CONTRACT.md` §4.5 already specifies this endpoint.

**User story.** As Pak Budi, when I add "diabetes_type_2" to my profile, I want to optionally re-analyze my recent scans, so I see which ones I shouldn't have eaten.

**Acceptance criteria.**
- Given a past scan, when the user calls `POST /scans/{id}/reanalyze`, then the scan is re-scored with the current profile + goal and the stored verdict is updated.
- Given a re-analyzed scan, when daily totals are recomputed, then nutrition values do NOT change (we don't re-call vision; only re-score). Verdict + explanation are the only mutations.
- Given the user changes their goal, when they confirm, then the UI offers a one-click "re-analyze last 7 days" action; the action is asynchronous and shows progress.

**Out of scope.** Auto-reanalyze on every profile change (cost concern — see Risks §6); bulk re-analyze all-time.

#### F-P1-2 — History view scoped per user

**Problem.** The MVP's history endpoint returns everyone's scans. Multi-user makes this a privacy bug.

**User story.** As Andi, when I open history, I only see scans I created.

**Acceptance criteria.**
- Given a logged-in user, when they GET `/scans`, then only their scans are returned (filter by `user_id` server-side).
- Given another user's `scan_id`, when the current user GETs `/scans/{id}`, then the API returns 404 (NOT 403 — don't leak existence).
- Given any scan, when DELETE is called, then only the owning user can delete it; others get 404.

**Out of scope.** Sharing scans with other users (link sharing); admin views.

### P2 — Nice to have, cut first if late

#### F-P2-1 — Quick "log without scanning" entry

**Problem.** Sometimes a user knows they ate ~500 kcal of rice and doesn't want to scan rice. Without quick entry, daily totals will be chronically low and users will distrust the loop.

**User story.** As Andi, I want to log "300 kcal, 10g protein" manually for a meal I didn't scan, so my daily total is honest.

**Acceptance criteria.**
- Given a user, when they tap "log meal" and enter calories + macros, then a non-scan entry is added to today's totals.
- Given the daily view, when manual entries exist, then they are visually distinct from scans (no image, "log manual" tag).

**Out of scope.** Food database search; gram-based portion math; recipe builder.

**Why P2:** The user's stated three core features don't include manual entry. We can ship M1 without it, but every fitness/diet follower will ask for it within a week. Consider promoting to P0 only if scope allows.

---

## 5. Success Metrics (4 weeks post-launch)

Derived from `PRODUCT_ANALYSIS.md` §9, scoped to M1's loop:

| # | Metric | Target | Why |
|---|--------|--------|-----|
| 1 | **Goal-set rate** — % of signups who save a goal within 24h of signup | > 60% | If users don't set a goal, the loop never starts. Anything < 60% means the goal setup UX is wrong. |
| 2 | **Day-of-scan retention** — % of users who scan on at least 3 separate days in their first 7 | > 30% | Replaces the §9 WAU/MAU proxy. 3-day usage means the daily-progress view is being consulted, not just the scan. |
| 3 | **Scans per active user per week** | > 4 | §9 target was 3; we lift it because goal-tracking users scan more meals. |
| 4 | **Goal-aware explanation rate** — % of verdicts whose `explanation` references the user's goal_type | > 90% | Quality check on F-P0-5. Below 90% means the prompt isn't doing its job. |
| 5 | **Daily-view open rate** — % of days a user scans where they also open daily progress | > 50% | Validates that the loop closes. If users scan but never check progress, the goal feature isn't earning its weight. |

We instrument all 5 with PostHog (already in the stack). Pick one as the north star: **metric 2 (day-of-scan retention)**.

---

## 6. API Contract Diff

`API_CONTRACT.md` is largely correct; M1 uses a strict subset. Below is the explicit diff against that document.

### 6.1 Endpoints required for M1 (build these)

| Endpoint | Contract section | Notes |
|----------|------------------|-------|
| `POST /auth/signup` | §2.1 | As specified. |
| `POST /auth/login` | §2.2 | As specified. |
| `POST /auth/refresh` | §2.3 | As specified. |
| `POST /auth/logout` | §2.4 | As specified. |
| `GET /users/me` | §3.1 | As specified. |
| `PATCH /users/me` | §3.2 | As specified. |
| `GET /users/me/profile` | §3.3 | As specified. |
| `PUT /users/me/profile` | §3.4 | As specified. |
| `POST /scans` | §4.1 | Two changes — see §6.3 below. |
| `GET /scans` | §4.2 | Must filter by current user. Drop `verdict` filter for M1; keep `from`/`to` for daily view. |
| `GET /scans/{id}` | §4.3 | Must 404 for scans the user doesn't own. |
| `DELETE /scans/{id}` | §4.4 | Must 404 for scans the user doesn't own. |
| `POST /scans/{id}/reanalyze` | §4.5 | P1, behavior clarified in F-P1-1. |
| `GET /health` | §10.1 | As specified. |

### 6.2 Endpoints NOT in scope for M1 (do not build)

| Endpoint | Contract section | Why deferred |
|----------|------------------|--------------|
| `GET /products?q=...` | §5.1 | No product DB in M1. |
| `GET /products/barcode/{barcode}` | §5.2 | Barcode is a non-goal. |
| `GET /products/{id}/alternatives` | §5.3 | No corpus. |
| `POST /favorites`, `GET /favorites`, `DELETE /favorites/{id}` | §6 | Engagement feature, M2. |
| `POST /compare` | §7 | Engagement feature, M2. |
| `GET /billing/subscription`, `POST /billing/checkout`, `POST /billing/cancel` | §8 | No payments in M1. |
| `POST /webhooks/stripe` | §9.1 | No payments in M1. |

### 6.3 New endpoints / fields needed (additions to API_CONTRACT.md)

These are new and need to be appended to `API_CONTRACT.md` by be-engineer when they write the design doc.

**New endpoint: Goal CRUD.**

```
GET  /users/me/goal       → { goal_type, target_calories_kcal, target_protein_g, target_carbs_g, target_fat_g, updated_at } | 404 if unset
PUT  /users/me/goal       → same shape; upsert
DELETE /users/me/goal     → 204
```

`goal_type` enum: `cutting` | `bulking` | `maintenance`.

**New endpoint: Daily progress.**

```
GET /progress/daily?date=YYYY-MM-DD   → {
  date,
  goal_snapshot: { goal_type, target_calories_kcal, target_protein_g, target_carbs_g, target_fat_g },
  totals: { calories_kcal, protein_g, carbs_g, fat_g },
  status: "behind" | "on_track" | "over" | "no_goal",
  scan_ids: [uuid, ...]
}
```

If `date` is omitted, defaults to the user's local "today".

**Additions to `POST /scans` response (`API_CONTRACT.md` §4.1):**

- `extracted.nutrition.vitamins_minerals[]` — already present in `CLAUDE_API_SPEC.md` §4.1; surface it in the API response (it's currently dropped). Each item: `{ name, value, unit, daily_value_percent | null }`.
- `verdict.goal_context` (new, optional) — `{ goal_type, calories_remaining_today_kcal, protein_remaining_today_g }` when the user has a goal. Lets the FE render "X kcal left in your day" without a second call.

**No removed fields.** This is additive only — existing FE keeps working.

---

## 7. Risks & Tradeoffs

| Risk | Impact | Mitigation (one) |
|------|--------|------------------|
| **Multi-user multiplies Claude spend.** At ~$0.015/scan on Sonnet, 1000 users × 4 scans/week ≈ $240/mo, and that climbs linearly. | Cost overrun in week 4 if growth hits. | Keep Sonnet as default (NOT Opus); defer image-hash dedup to M2 but add structured logging of token usage per user from day 1 so we can prove or kill the case for dedup. |
| **Latency on goal-aware analysis.** Adding goal block to the user message adds ~100 tokens but no real latency. The bigger risk is users expecting *instant* daily totals while a scan is still analyzing. | Frustration / "is it broken?". | Daily progress endpoint reads from DB only — it does not block on Claude. Show optimistic UI: a scan posts an entry to today's totals as "analyzing…" before Claude returns. |
| **Trust on goal-aware verdicts.** "Good for your bulk" applied to a Snickers bar will burn trust fast. | Churn after the third bad call. | The system prompt must remain conservative; goal context *informs* the explanation but doesn't override the existing scoring rules. Add an eval set of 20 goal+product pairs before launch (QA owns). |
| **Medical liability when condition + goal interact.** A diabetic on a bulk is a legitimate case; advice that contradicts standard medical guidance is dangerous. | Legal/PR exposure. | Hard rule: condition-based warnings (diabetes, hypertension) always win over goal-based encouragement. Disclaimer "Informational, not medical advice" must appear on every verdict that cites a condition. (pm-agent bright line.) |
| **Calorie target suggestion is wrong for many bodies.** Mifflin–St Jeor + activity multipliers are a 70% approximation. | Users distrust the goal feature. | Explicitly label suggested targets as "perkiraan" (estimate) in the Bahasa Indonesia copy; make override a one-tap action; show a "your real calories will be ±15%" tooltip. |
| **Auth + profile UX adds friction before users see value.** MVP let anyone scan instantly; M1 forces signup first. | Drop-off at registration. | Allow "try a scan" (one free scan without signup) on the landing page; surface the signup wall after the user sees the verdict. (Optional — flag for design discussion in Open Questions.) |

---

## 8. Open Questions

1. **Try-before-signup?** Do we allow one anonymous scan before forcing auth, or is the signup wall the front door? (Affects metric 1.)
2. **Timezone source for "today".** Do we derive the user's day boundary from their device timezone, ask at signup, or default to WIB? Indonesia spans three timezones.
3. **What happens to the existing MVP SQLite data on multi-user migration?** Drop it as "demo data", migrate to a shared "demo" user, or seed the first signup with it?
4. **Snapshot vs. live goal in daily history.** F-P0-6 says past days show the goal active that day. Do we store a goal_snapshot per day-summary row, or per scan, or derive from a goal-history audit log? (be-engineer decision, but PM must accept the model.)
5. **Re-analyze cost throttling.** If users re-analyze a 30-scan week on every profile change, that's 30 extra Claude calls. Do we rate-limit re-analyze to N per day, batch it, or charge against a quota?
6. **Manual log entry (F-P2-1) — promote to P0 or stay P2?** Decide by week 2 of build, before goal-aware verdict copy is finalized (since copy depends on whether totals are "scan-only" or "scan + manual").
7. **Allergy presentation in M1.** Profile collects allergies; do we surface allergy violations as a hard "do not eat" banner on the verdict, or fold them into the existing red_flags list? `CLAUDE_API_SPEC.md` §5 says severity "high" — but the UI doesn't yet escalate.
8. **Goal change as a daily event.** If a user flips from cutting to bulking mid-day, does today's daily view use the new goal or the morning's goal? Recommendation: new goal applies from now, today's snapshot freezes at end of day — but confirm with design.

---

*End of PRD. Engineers should now write their domain design docs (`docs/system-design/*-design.md`) against this PRD, NOT against the original `PRODUCT_ANALYSIS.md`.*
