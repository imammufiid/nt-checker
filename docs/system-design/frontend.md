# Frontend System Design — nt-checker M1 (Scan-to-Goal Loop)

**Author:** fe-engineer
**Date:** 2026-05-18
**Status:** Draft v1
**Source PRD:** [`docs/PRD.md`](../PRD.md)
**Source TASKS:** [`docs/TASKS.md`](../TASKS.md)
**API Contract:** [`API_CONTRACT.md`](../../API_CONTRACT.md) + PRD §6.3 additions

---

## 1. Scope

This document covers every frontend task in `docs/TASKS.md` for M1: **FE-001** (signup/login/logout in Bahasa Indonesia), **FE-002** (auth context + protected-route wrapper + token refresh), **FE-003** (profile setup screen), **FE-004** (goal setup with calculated suggestions), **FE-005** (vitamins & minerals section on result page), **FE-006** (`verdict.goal_context` card on result page), **FE-007** (daily progress page), **FE-008** (per-user history with daily grouping), **FE-009** (re-analyze last 7 days action, P1), **FE-010** (soft signup wall — held pending PM Open Question #1), **FE-011** (auth-aware nav), **FE-012** (Bahasa Indonesia localization sweep). Backend endpoints, the LLM prompt, and contract additions are owned by `be-engineer` and `ai-engineer`; this doc only consumes them. No new UI libraries are introduced — Vite 5 + React 18 + Tailwind 3 + react-router-dom v6 + `lucide-react` remain the entire kit.

---

## 2. Information Architecture

```
nt-checker (web)
├── (public)
│   ├── /                     Beranda (HomePage)              [public-but-degraded]
│   ├── /masuk                LoginPage                        [public]
│   ├── /daftar               SignupPage                       [public]
│   └── /keluar               LogoutRoute (action, redirects)  [public-trigger]
│
└── (authenticated — RequireAuth)
    ├── /                     Beranda (HomePage, signed-in)    [scan CTA, links to /hari-ini]
    ├── /scan/:id             ResultPage                       [also reachable post-anon-scan]
    ├── /riwayat              HistoryPage (per-user, daily groups)
    ├── /hari-ini             DashboardPage (daily progress)
    ├── /profil               ProfilePage (health profile)
    └── /tujuan               GoalPage (goal setup)
```

Notes:
- The legacy MVP route `/history` is renamed `/riwayat` for copy consistency; we leave a `<Navigate>` redirect in place so old bookmarks don't 404.
- `/scan/:id` is *technically* authenticated but is whitelisted for the soft-signup-wall flow (FE-010) so the one anonymous scan can render its verdict before the wall appears. The decision is gated on PRD Open Question #1; default until then is **fully authenticated**.
- There is intentionally **no separate "Login + Signup tabs" page**. Two routes, two pages, cross-linked in the footer of each form.

---

## 3. Routing & Guards

### 3.1 Route tree (react-router-dom v6, declarative)

```
<BrowserRouter>
  <AuthProvider>
    <Routes>
      <Route element={<Layout />}>                              // shared chrome
        <Route index element={<HomePage />} />                  // /
        <Route path="masuk" element={<LoginPage />} />
        <Route path="daftar" element={<SignupPage />} />
        <Route path="keluar" element={<LogoutRoute />} />

        <Route element={<RequireAuth />}>                       // guard
          <Route path="scan/:id" element={<ResultPage />} />
          <Route path="riwayat" element={<HistoryPage />} />
          <Route path="hari-ini" element={<DashboardPage />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="tujuan" element={<GoalPage />} />
        </Route>

        <Route path="history" element={<Navigate to="/riwayat" replace />} />
      </Route>
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

### 3.2 `RequireAuth` wrapper

A small component that reads `useAuth()` and renders one of three things:

- **Still bootstrapping** (refresh in flight on app open) → render a centered skeleton, do NOT redirect yet. Avoids a flash of `/masuk` on every page load.
- **Authenticated** → `<Outlet />`.
- **Unauthenticated** → `<Navigate to="/masuk" replace state={{ from: location }} />`.

The redirect carries the original location in `state.from`. `LoginPage` reads it after success and calls `navigate(from?.pathname ?? '/', { replace: true })`. This gives clean post-login redirect-back behaviour, including for deep-links like `/scan/<id>`.

### 3.3 Logout

`/keluar` is a route component (not a button handler) so it can be linked from anywhere, including the auth-aware nav. On mount: calls `authApi.logout()` (fire-and-forget — BE invalidates the refresh cookie), clears in-memory access token, then `<Navigate to="/masuk" replace />`.

---

## 4. Auth State

### 4.1 Token storage decision

| Token | Stored where | Why |
|-------|--------------|-----|
| Access token | **In-memory only** (React context state) | XSS-resistant. Lost on hard refresh — that's fine; the refresh flow rehydrates on app boot. |
| Refresh token | **httpOnly cookie**, owned and set by BE on signup/login/refresh | Not accessible from JS at all. BE rotates it on every refresh. `SameSite=Lax` for the dev proxy, `Secure` in prod. |
| User object (id, email, name, tier) | In-memory + cached in `sessionStorage` for first-paint hydration only | Non-sensitive; avoids the "who am I" flash. Wiped on logout. |

**This explicitly overrides the wording in FE-001's acceptance criteria** ("httpOnly cookie OR localStorage with documented tradeoff"). We pick httpOnly cookie for the refresh token and reject localStorage for the access token. Reasoning: an XSS in any third-party script we add later would silently exfiltrate localStorage tokens; the same XSS cannot read an httpOnly cookie or a closure-scoped variable. security-engineer (SEC-001/SEC-002) should sign off on this in the auth policy.

### 4.2 Bootstrapping on app open

```
On <AuthProvider /> mount:
  1. Try POST /auth/refresh (browser sends the httpOnly cookie automatically).
  2. If 200 → store access_token + user in context state; mark bootstrapped.
  3. If 401 or network fail → mark bootstrapped, unauthenticated. No redirect here;
     RequireAuth handles that.
```

This is the only place we ever proactively call `/auth/refresh`. Everywhere else, refresh is reactive — triggered by a 401 from a normal API call (see §5.4).

### 4.3 `AuthProvider` context, not a state library

**Decision: stick with a React context — do not introduce Redux, Zustand, Jotai, or @tanstack/react-query for auth.**

Reasoning per `fe-engineer.md` ("No premature abstraction" + "No global store until two pages need to share mutable state"):
- Auth state IS the one piece of cross-page mutable state in M1. Context covers it.
- The context surface is tiny: `{ user, accessToken, status, login, signup, logout, refresh }`.
- Re-render churn is a non-issue: auth state changes maybe once per session; we don't need fine-grained selectors.
- TanStack Query may earn its keep later (see §12) but it's the wrong tool for the *auth identity* — it's for *server-cache* data.

The context lives at `frontend/src/lib/auth.tsx` (component + hook + provider colocated; it's <120 lines).

---

## 5. API Client Layer

### 5.1 Folder shape

```
frontend/src/lib/
├── api/
│   ├── client.ts        // low-level fetch wrapper + refresh interceptor
│   ├── auth.ts          // signup, login, refresh, logout, me
│   ├── users.ts         // getProfile, putProfile, patchUser
│   ├── scans.ts         // upload, list, get, remove, reanalyze
│   ├── goals.ts         // getGoal, putGoal, deleteGoal
│   └── progress.ts      // getDaily
├── auth.tsx             // AuthProvider + useAuth hook (see §4)
├── types.ts             // mirrors API_CONTRACT.md
└── id.ts                // Bahasa Indonesia copy registry (FE-012)
```

One resource per file; each file exports a typed object (`authApi`, `scansApi`, etc.). No "magic" — components call `scansApi.upload(file)`, not `fetch('/api/scans', ...)`.

### 5.2 Types mirror the contract

Types in `lib/types.ts` are the source of truth for component props. We add to (not replace) the existing `Scan`, `Verdict`, etc.

New types this milestone:

```
type AuthUser           { id; email; name; subscription_tier; created_at }
type AuthTokens         { access_token; expires_in }              // refresh is cookie-only
type HealthProfile      { age?; gender?; weight_kg?; height_cm?;
                          activity_level?; conditions[]; allergies[]; goals[] }
type GoalType           'cutting' | 'bulking' | 'maintenance'
type Goal               { goal_type; target_calories_kcal; target_protein_g;
                          target_carbs_g; target_fat_g; updated_at }
type DailyProgress      { date; goal_snapshot; totals; status; scan_ids[] }
type DailyStatus        'behind' | 'on_track' | 'over' | 'no_goal'
type VitaminMineral     { name; value; unit; daily_value_percent: number | null }
type GoalContext        { goal_type; calories_remaining_today_kcal;
                          protein_remaining_today_g }
```

`Scan` is extended additively: `nutrition.vitamins_minerals?: VitaminMineral[]`, `verdict.goal_context?: GoalContext`, `verdict.personalized_for?: string[]`.

### 5.3 Error envelope handling

`API_CONTRACT.md` §1.3 says responses come wrapped in `{ success, data }` or `{ success, error: { code, message, details } }`. The current `lib/api.ts` does NOT respect this envelope — it does `res.json()` and reads ad-hoc `body.message`. We fix this as part of FE-002.

```
client.ts handle() pseudocode:
  if (res.status === 204) return undefined as T;
  body = await res.json();
  if (!res.ok || body.success === false) {
    throw new ApiError({
      status: res.status,
      code: body?.error?.code ?? 'UNKNOWN',
      message: body?.error?.message ?? `Request failed (${res.status})`,
      details: body?.error?.details,
    });
  }
  return body.data as T;
```

`ApiError` is a `class extends Error` carrying `code`, `status`, and optional `details`. Components branch on `err.code` (e.g., `DUPLICATE_EMAIL`, `QUOTA_EXCEEDED`, `EXTRACTION_FAILED`) to render the right Bahasa Indonesia message — never on `err.message`, because the BE may localize that independently.

### 5.4 Token refresh interceptor

The client wrapper accepts a callback bound from `AuthProvider`:

```
client.request(method, path, opts):
  res = fetch(path, { ...withAccessToken(), credentials: 'include' })
  if res.status === 401 and code in {'TOKEN_EXPIRED','UNAUTHORIZED'} and not opts.skipRefresh:
    refreshed = await authProvider.refresh()        // single in-flight promise
    if refreshed:
      res = fetch(path, { ...withAccessToken(), credentials: 'include' })  // retry once
    else:
      authProvider.forceLogout()
      throw ApiError(401, 'UNAUTHORIZED')
  return handle(res)
```

Two safeguards:
1. **Single-flight refresh**: `AuthProvider.refresh()` memoizes the in-flight promise so 10 parallel 401s trigger one `/auth/refresh`, not 10.
2. **No infinite loops**: retry is attempted at most once per request; second 401 = hard logout.

`credentials: 'include'` is mandatory so the refresh cookie reaches `/auth/refresh` through the Vite proxy. The proxy must forward cookies (verify in `vite.config.ts` before FE-001 ships).

---

## 6. Component Inventory

### 6.1 New components (M1)

| Name | Location | Props (shape) | Reused by |
|------|----------|---------------|-----------|
| `LoginForm` | `components/auth/LoginForm.tsx` | `{ onSuccess?: () => void }` | LoginPage |
| `SignupForm` | `components/auth/SignupForm.tsx` | `{ onSuccess?: () => void }` | SignupPage |
| `RequireAuth` | `components/auth/RequireAuth.tsx` | `{}` (renders `<Outlet />`) | App routes |
| `AuthNav` | `components/AuthNav.tsx` | `{}` (reads `useAuth()`) | Layout |
| `ProfileForm` | `components/profile/ProfileForm.tsx` | `{ initial?: HealthProfile; onSubmit(p): Promise<void>; submitting?: boolean }` | ProfilePage, post-signup wizard |
| `GoalForm` | `components/goal/GoalForm.tsx` | `{ initial?: Goal; profile?: HealthProfile; onSubmit(g): Promise<void>; submitting?: boolean }` | GoalPage |
| `GoalProgressCard` | `components/goal/GoalProgressCard.tsx` | `{ progress: DailyProgress }` | DashboardPage |
| `DailyTotalsBar` | `components/goal/DailyTotalsBar.tsx` | `{ label: string; current: number; target: number; unit: string }` | GoalProgressCard (×4 — calories + 3 macros) |
| `MicroNutrientsTable` | `components/MicroNutrientsTable.tsx` | `{ items: VitaminMineral[] }` | ResultPage |
| `GoalContextCard` | `components/goal/GoalContextCard.tsx` | `{ context?: GoalContext }` (renders empty-state CTA when undefined) | ResultPage |
| `ConditionsChips` | `components/profile/ConditionsChips.tsx` | `{ value: string[]; onChange(v): void; options: string[]; label: string }` | ProfileForm (×3 — conditions, allergies, goals) |
| `DatePickerInline` | `components/DatePickerInline.tsx` | `{ value: string; onChange(d): void; max?: string }` | DashboardPage |
| `LoadingStages` | `components/LoadingStages.tsx` | `{ stages: string[]; currentIndex: number }` | HomePage (scan), ResultPage (re-analyze) |
| `EmptyState` | `components/EmptyState.tsx` | `{ icon?; title: string; body?: string; cta?: { to: string; label: string } }` | History, Dashboard, anywhere with no data |
| `ApiErrorBanner` | `components/ApiErrorBanner.tsx` | `{ error: ApiError \| null }` | Forms, pages with mutations |
| `LogoutRoute` | `pages/LogoutRoute.tsx` | `{}` | Routes |

### 6.2 Existing components — additive changes only

| Name | Existing role | M1 change |
|------|---------------|-----------|
| `Layout` | App shell with header + nav (`Pindai`, `Riwayat`) | Replace the hard-coded nav with `<AuthNav />` (FE-011). No other change. |
| `ImageUploader` | Camera + file picker, current scan flow | Add a client-side **resize-before-upload** step (§8) and a `<2 MB` early-return that skips resizing. Surface a `stage` prop so the parent can swap the button label between "Mengunggah gambar…" and "Menganalisis nutrisi…". |
| `VerdictCard` | Renders tier badge + summary + explanation | Display `verdict.personalized_for` chips (small grey pills under the explanation, e.g., "bulking", "diabetes_type_2") so users can see *why* the verdict is what it is. No color/layout change. |
| `NutritionTable` | Macro rows from `nutrition` map | No change. Micros render in a sibling `MicroNutrientsTable`, not here — clearer separation, easier to collapse. |

### 6.3 Components we are NOT adding

- No `BaseCard`, no `BaseField`, no `BaseForm` abstraction. Three forms (signup, profile, goal) are not enough repetition to justify it (per `fe-engineer.md` bright line).
- No new icon library — `lucide-react` covers everything we need (`Apple`, `Camera`, `History`, `Upload`, `CheckCircle2`, `AlertTriangle`, `XCircle`, `Target`, `User`, `LogIn`, `LogOut`, `Calendar`).

---

## 7. Pages

### 7.1 LoginPage (`/masuk`) — new

**Purpose.** Sign an existing user in.

**Layout.**
```
[ Apple icon + nt-checker ]
[ "Masuk ke akunmu" h1 ]
[ form
   email     [____________________]
   password  [____________________]   (eye toggle)
   [ Masuk ] (primary button, full width)
]
[ ApiErrorBanner ]
[ "Belum punya akun? Daftar" link → /daftar ]
```

**Data dependencies.** None on mount. `POST /auth/login` on submit via `authApi.login()`.

**States.**
- **Idle** — form rendered, button enabled.
- **Submitting** — button disabled with "Masuk…" label.
- **Error** — `ApiErrorBanner` shows; map `UNAUTHORIZED` → "Email atau kata sandi salah", `RATE_LIMITED` → "Terlalu banyak percobaan. Coba lagi 10 menit lagi.", network error → "Tidak bisa menghubungi server."
- **Success** — `useAuth().login(tokens, user)` then `navigate(from ?? '/', { replace: true })`.

**Primary CTA.** Submit. Secondary: "Daftar" link.

### 7.2 SignupPage (`/daftar`) — new

**Purpose.** Create an account and immediately push the user into profile setup.

**Layout.**
```
[ Apple icon + nt-checker ]
[ "Buat akun baru" h1 ]
[ "Gratis — scan, lacak kalori dan makro harianmu." subhead ]
[ form
   nama      [____________________]
   email     [____________________]
   sandi     [____________________]    (eye toggle, helper: "Minimal 8 karakter")
   [ Daftar ] (primary, full width)
]
[ ApiErrorBanner ]
[ "Sudah punya akun? Masuk" link → /masuk ]
```

**Data dependencies.** None on mount. `POST /auth/signup` on submit.

**Validation (client-side, plain controlled state).**
- email matches a permissive regex (`/^[^@\s]+@[^@\s]+\.[^@\s]+$/`).
- password length ≥ 8.
- name non-empty.

**Error mapping.** `DUPLICATE_EMAIL` → "Email sudah terdaftar. Coba masuk."; `INVALID_INPUT` → use `error.details.field` to highlight.

**Success.** Stash tokens + user, then `navigate('/profil', { replace: true, state: { firstRun: true } })`. `ProfilePage` reads `firstRun` to show a "Lengkapi profilmu dulu" banner and, on save, auto-routes to `/tujuan`.

### 7.3 ProfilePage (`/profil`) — new

**Purpose.** Capture or edit the user's health profile (`API_CONTRACT.md` §3.3).

**Layout.**
```
[ "Profil kesehatan" h1 ]
[ "Bantu kami sarankan target kalori harianmu." subhead ]
[ ProfileForm
   Usia              [number]    Jenis kelamin   [select]
   Berat (kg)        [number]    Tinggi (cm)     [number]
   Tingkat aktivitas [radio cards: Tidak aktif | Ringan | Sedang | Aktif | Sangat aktif]
   Kondisi           [ConditionsChips multi-select]
   Alergi            [ConditionsChips multi-select]
   Tujuan diet (tag) [ConditionsChips multi-select]
   [ Simpan profil ] (full width)
]
```

**Data dependencies.** `GET /users/me/profile` on mount (skip on `firstRun`). Save: `PUT /users/me/profile`.

**States.** Skeleton on initial GET. Form disabled while submitting. Success toast "Profil tersimpan" then either stay (edit case) or auto-navigate to `/tujuan` (firstRun case).

**Empty/null fields.** All fields optional except age (needed for the Mifflin–St Jeor calc in goal setup). If user has zero saved fields, show the form blank — do not block the user.

**Primary CTA.** Submit.

### 7.4 GoalPage (`/tujuan`) — new

**Purpose.** Set the user's daily calorie + macro target.

**Layout.**
```
[ "Tujuanmu hari ini" h1 ]
[ "Pilih satu — kami sarankan angkanya, kamu bebas ubah." subhead ]
[ GoalForm
   [○ Diet (cutting)]    [○ Maintain]    [● Bulking]   (radio cards, lucide icons)
   ───────────────────────────────────────
   Suggested berdasar profil:
   Kalori     [2800] kkal     ("perkiraan — sesuaikan dengan kebutuhanmu")
   Protein    [180]  g
   Karbo      [350]  g
   Lemak      [80]   g
   [ Simpan tujuan ]
]
[ if no profile: ApiErrorBanner "Lengkapi profilmu dulu untuk saran otomatis." + link ]
```

**Data dependencies.** `GET /users/me/profile` (for suggestion math) and `GET /users/me/goal` (returns 404 if unset — render fresh form) on mount. Save: `PUT /users/me/goal`. On 404 from goal GET, render the form pre-filled with computed defaults (Mifflin–St Jeor BMR × activity multiplier ± 500 for cut/bulk; macro split per PRD F-P0-3 defaults).

**Suggestion math lives client-side** in `lib/goalMath.ts` — pure functions, easy to unit-test, no server round-trip when the user toggles between cutting/bulking/maintenance.

**States.** Skeleton while loading. Submitting disables save. On success, toast + offer (FE-009) "Analisis ulang scan 7 hari terakhir?" if a prior goal existed and changed.

**Primary CTA.** Submit. Secondary: "Reset ke saran otomatis" recomputes from profile.

### 7.5 DashboardPage (`/hari-ini`) — new

**Purpose.** The "am I on track today" answer. Closes the loop the PRD is built around.

**Layout.**
```
[ "Hari ini" h1 + DatePickerInline (default = today) ]

[ GoalProgressCard
   Status pill: [Sesuai] | [Tertinggal] | [Berlebih] | [Belum ada tujuan]
   ─────────────────────────────────────────────
   DailyTotalsBar  Kalori   1240 / 2800 kkal   ████░░░░░░░░  44%
   DailyTotalsBar  Protein  85   / 180  g      ██████░░░░░░  47%
   DailyTotalsBar  Karbo    160  / 350  g      █████░░░░░░░  46%
   DailyTotalsBar  Lemak    35   / 80   g      █████░░░░░░░  44%
]

[ "Pindaian hari ini" h2 ]
[ list of scan rows (thumbnail · name · tier badge · time)  → /scan/:id ]
[ FAB / button "+ Pindai makanan" → / ]
```

**Data dependencies.** `GET /progress/daily?date=YYYY-MM-DD` (returns `scan_ids[]`). For the scan list, two options — pick **option B** to avoid a fan-out:
- A: For each `scan_id`, call `GET /scans/:id`. Cleanest but N+1.
- B: Call `GET /scans?from=<date>&to=<date>` in parallel with the progress call. **Chosen.** Two requests total, regardless of scan count.

**States.**
- **Loading** — skeleton bars (greyed-out version of the layout, no flicker).
- **No goal** — status pill says "Belum ada tujuan", bars hidden, CTA "Atur tujuanmu" → `/tujuan`.
- **Empty (goal set, no scans today)** — bars show 0/target, EmptyState card below: "Belum ada makanan hari ini. Mulai dengan memindai." + scan CTA.
- **Error** — `ApiErrorBanner`.

**Primary CTA.** "Pindai makanan" (scan button) at the bottom, always visible on mobile.

### 7.6 HistoryPage (`/riwayat`) — additive changes

**Purpose unchanged.** Now scoped per-user (BE-007), with daily grouping.

**Layout change.**
```
Before:                            After:
[ "Riwayat" h1 ]                   [ "Riwayat" h1 ]
[ flat list of scans ]             [ "Hari ini · 1240 kkal" group header ]
                                   [ scan · scan ]
                                   [ "Kemarin · 2100 kkal" group header ]
                                   [ scan · scan · scan ]
                                   [ "Senin, 5 Mei · 1850 kkal" group header ]
                                   [ scan ]
```

**Data dependencies.** `GET /scans?limit=20&cursor=...` (per-user via BE-007). Daily total per group comes from the same response — sum `nutrition.calories` over each date bucket client-side (cheap; backend doesn't need a new endpoint for this).

**Grouping logic.** `groupByDate(scans)` in `lib/dateGroup.ts` returns `[{ label: 'Hari ini' | 'Kemarin' | <weekday, dMMM>, dateISO, scans, totalKcal }]`. Locale `id-ID`, timezone = device.

**Pagination.** "Muat lebih banyak" button at the bottom, cursor-driven. Defer infinite scroll — the user base in M1 is too small to need it.

### 7.7 HomePage (`/`) — additive changes

**Signed-out behaviour.** Marketing hero + "Daftar gratis" CTA + "Sudah punya akun? Masuk". Pending Open Question #1: if PM approves "try one scan", we render the `ImageUploader` here without auth — see FE-010. Default until then: hide uploader for signed-out users.

**Signed-in behaviour.** Renders `ImageUploader` exactly as today, but with the new staged loading copy (§9). After a successful upload, on top of the scan navigation we **also** invalidate any cached daily progress (if we adopt TanStack Query — see §12 — otherwise this is a no-op).

### 7.8 ResultPage (`/scan/:id`) — additive changes

Three additive sections, in this order, between `<VerdictCard />` and the existing nutrition + ingredients grid:

```
[ VerdictCard ]                                ← existing
[ GoalContextCard ]                            ← NEW (FE-006)
   if scan.verdict.goal_context:
     "Sisa hari ini · 1560 kkal · 95 g protein"
   else:
     EmptyState mini: "Atur tujuanmu" → /tujuan
[ grid: Info Gizi (NutritionTable) | Daftar Bahan ]   ← existing
[ MicroNutrientsTable ]                        ← NEW (FE-005)
   if scan.nutrition.vitamins_minerals?.length:
     top 5 by daily_value_percent desc + "Lihat semua" expander
[ Perlu Diwaspadai (red flags) ]               ← existing
[ Foto yang Dianalisis ]                       ← existing
[ "Analisis ulang" button (P1) ]               ← FE-009 entry point
```

**Re-analyze button.** Calls `POST /scans/:id/reanalyze`, shows the same staged loading copy, then updates the page with the new verdict (no navigation; replace state in place). On error, banner + keep old verdict visible.

---

## 8. Camera & Upload Flow

The existing `ImageUploader` is fundamentally correct — keep its architecture, add a resize step. Confirmed contract:

- **File picker path**: `<input type="file" accept="image/jpeg,image/png,image/webp">`. iOS Safari auto-shows the "Take Photo / Photo Library" sheet — no extra config needed.
- **Live camera path**: `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })`. The `<video>` element MUST have `playsInline` and `muted` set (otherwise iOS Safari refuses to autoplay). Already correct in current code.
- **Capture**: draw `<video>` to a `<canvas>`, `canvas.toBlob(_, 'image/jpeg', 0.92)`, wrap in a `File`.
- **Cleanup**: every stream gets `getTracks().forEach(t => t.stop())` on unmount and on user dismiss. Every `createObjectURL` is paired with `revokeObjectURL`.

### 8.1 Client-side resize-before-upload (NEW)

Contract:
- **Trigger threshold**: file size > 2 MB OR longest edge > 1568 px.
- **Target**: longest edge **≤ 1568 px**, JPEG quality **0.85**, format JPEG (regardless of input).
- **Reasoning**: 1568 is the resolution Claude's vision pipeline scales to internally; sending larger wastes upload bandwidth on the user (Indonesian mobile is the primary target) and burns vision tokens server-side. PNG also gets converted to JPEG since the label photos have no transparency.

Implementation lives in `lib/imageResize.ts` (pure function, `File → Promise<File>`). Pipeline: `createImageBitmap(file)` → `OffscreenCanvas` if available, else `<canvas>` → `toBlob`. Falls back to the original file if any step throws.

### 8.2 Validation order in HomePage handler

```
1. Reject HEIC / HEIF early (MIME or extension): "Format HEIC belum didukung. Konversi ke JPEG dulu."
2. Reject > 10 MB raw: "Foto terlalu besar (maks 10 MB)."
3. Resize if needed (§8.1).
4. POST /scans with the (possibly resized) file.
```

### 8.3 iOS Safari quirks to watch

- `getUserMedia` requires HTTPS in production. Dev is fine on `http://localhost`.
- `playsInline` is mandatory; without it, the video element goes fullscreen and capture breaks.
- iOS Safari does not support `OffscreenCanvas` in older versions — the resize code must fall back to a hidden `<canvas>`.
- Camera permission, once denied, can only be re-granted via the system Settings app. Surface a Bahasa Indonesia hint when `getUserMedia` rejects with `NotAllowedError`: "Izin kamera ditolak. Aktifkan di Pengaturan Safari → Kamera, atau pakai 'Pilih dari galeri'."

---

## 9. Loading + Perceived Latency

Scans take 5–15 seconds. A blank spinner is unacceptable. The contract: **two visible stages, in Bahasa Indonesia, with the second stage entered the moment the upload completes (we know this because `fetch` resolves to the streaming response).**

```
Stage 1 (POST in flight, request body still uploading):
  "Mengunggah gambar…"             + small spinner
Stage 2 (POST returned headers; waiting for body — i.e., Claude is analyzing):
  "Menganalisis nutrisi…"          + same spinner

Done → navigate(`/scan/${id}`).
```

We use the `<LoadingStages>` component with `stages = ['Mengunggah gambar…', 'Menganalisis nutrisi…']` and a `currentIndex` derived from a `useState` that flips when the upload's `onUploadProgress` reaches 100%. Since `fetch` doesn't natively expose upload progress, we use an `XMLHttpRequest` wrapper specifically for the scan POST — every other endpoint stays on `fetch`. This is a 30-line concession to UX and worth it.

**Re-analyze flow (FE-009).** Same component, different stages: `['Menyiapkan…', 'Menganalisis ulang…']`. No upload phase since the image is already on the server.

**Daily progress + history page.** These are <300 ms; a normal skeleton suffices, no staged copy.

---

## 10. Bahasa Indonesia Copy

All new strings collected in `frontend/src/lib/id.ts` as a flat object. FE-012's acceptance is satisfied by importing from this single registry — no inline string literals in JSX for user-visible text.

### 10.1 Glossary of new terms

| English / technical | Bahasa Indonesia | Notes |
|---------------------|------------------|-------|
| Goal | Tujuan | |
| Cutting / diet | Diet | Used in the radio card label; the API value stays `cutting`. |
| Bulking | Bulking | Loanword — common in ID fitness vocabulary; do not translate. |
| Maintenance | Maintain | Same. |
| Daily target | Sasaran harian | |
| Remaining calories today | Sisa kalori hari ini | |
| Behind / on track / over | Tertinggal · Sesuai · Berlebih | Status pill on Dashboard. |
| No goal set | Belum ada tujuan | |
| Macronutrient | Makronutrien | |
| Micronutrient | Mikronutrien | |
| Vitamins & minerals | Vitamin & Mineral | |
| Health profile | Profil kesehatan | |
| Activity level | Tingkat aktivitas | |
| Sedentary / Light / Moderate / Active / Very active | Tidak aktif · Ringan · Sedang · Aktif · Sangat aktif | |
| Conditions | Kondisi kesehatan | |
| Allergies | Alergi | |
| Sign up / Log in / Log out | Daftar · Masuk · Keluar | |
| Email | Email | Loanword. |
| Password | Kata sandi | |
| Today | Hari ini | |
| Yesterday | Kemarin | |
| Re-analyze | Analisis ulang | |
| Estimate (disclaimer word) | Perkiraan | "Sesuaikan dengan kebutuhanmu" follows. |
| Daily Value (%) | %AKG | "Angka Kecukupan Gizi" — Indonesian regulatory term, more accurate than literal "%DV". |

### 10.2 Do NOT translate

`Claude`, brand product names extracted from labels (e.g., "Coca-Cola Original 330ml" stays as scanned), `JPEG`/`PNG`/`WebP`, units (`g`, `mg`, `kkal`).

### 10.3 Existing strings to keep consistent with

- Verdict tiers: "Sehat" · "Cukup" · "Tidak Sehat" (from `VerdictCard.tsx`). **Note** the PRD prompt mentions "Sehat/Sedang/Tidak Sehat" but the code uses "Cukup" for `moderate`. **Keep "Cukup"** — it's already shipped and the right register in Bahasa Indonesia for a food verdict. Document in §13 as an open question.
- "Pindai" for the scan action. "Riwayat" for history.

---

## 11. Accessibility & Visual Signals

- **Verdict tier is never color-only.** Every verdict shows the tier *word* ("Sehat" / "Cukup" / "Tidak Sehat") plus the lucide icon (`CheckCircle2` / `AlertTriangle` / `XCircle`). Color is reinforcement, not signal. Same rule for Dashboard status pill (Tertinggal / Sesuai / Berlebih).
- **Icon-only buttons need `aria-label`.** Existing code already does this ("Hapus foto", "Tutup kamera"). Audit: the new history group-delete and any reanalyze icon buttons must follow.
- **Form fields need `<label htmlFor>`.** Every input in LoginForm, SignupForm, ProfileForm, GoalForm. No placeholder-as-label.
- **Focus state must be visible.** Tailwind's default `focus:outline-none` is forbidden unless paired with `focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2`. QA-005 audits.
- **Color contrast ≥ AA on all badges.** The current emerald/amber/rose-50 backgrounds with -700 text pass AA — verified for ResultPage. Re-verify for the new status pill on light grey backgrounds.
- **Touch targets ≥ 44 px.** Buttons in the auth-aware mobile nav must be `min-h-11`. The current `Pindai`/`Riwayat` nav links are slightly tight — bump them as part of FE-011.
- **Screen-reader-friendly progress bars.** `DailyTotalsBar` uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and an `aria-label` like "Kalori, 1240 dari 2800".
- **Locale.** `<html lang="id">` (currently `en` — fix in `index.html` as part of FE-012).

---

## 12. Tooling Decisions

| Tool | Decision | Why |
|------|----------|-----|
| `@tanstack/react-query` | **Defer.** Plain `fetch` + `useState`/`useEffect` for M1. | Only DashboardPage has a "refetch when something else changes" need (after re-analyze) and a single `key++` ref-bump on AuthProvider handles it. If FE-009 ships and we feel the staleness pain, add it in M1.5 — the API client already returns plain promises so adoption is mechanical. |
| `react-hook-form` + `zod` | **Defer.** Plain controlled components. | Forms in M1 max out at 7 fields (ProfileForm), no cross-field validation. The cost of pulling in two libs + a schema layer outweighs the wins for forms this small. Revisit when we add manual meal entry (F-P2-1) or barcode override forms. |
| `clsx` / `tailwind-merge` | **Defer.** | The existing template-literal `className` style is fine for M1's component count. |
| `date-fns` | **Defer.** | We need (a) "Hari ini" / "Kemarin" / `weekday, dMMM` formatting and (b) ISO date math for the date picker. `Intl.DateTimeFormat('id-ID', ...)` + a 20-line `dateGroup.ts` covers it. If a third date feature appears, reconsider. |
| Vitest / Playwright | **Adopt Vitest minimally** for `goalMath.ts`, `dateGroup.ts`, `imageResize.ts`. Playwright is owned by qa-engineer (QA-001). | Pure functions earn unit tests; UI shells don't yet. |
| PostHog SDK | **Adopt in FE-011 or later** (per PRD §5 metrics 1, 2, 5). | Coordinate with security-engineer (SEC-005) — no `conditions[]` or `allergies[]` values in event payloads. |

The bias is "defer until needed", per `fe-engineer.md`. We re-evaluate at the end of week 2 of the build.

---

## 13. Open Questions & Risks

1. **Verdict moderate tier wording: "Cukup" or "Sedang"?** Existing shipped code says "Cukup" (from commit `f8270a8`); the PM task description says "Sedang". They mean slightly different things in Bahasa Indonesia ("Cukup" = "good enough / acceptable", "Sedang" = "medium / in-between"). Recommendation: keep "Cukup" because it's already in production and reads more naturally as a food-verdict label, but get PM + QA-005 sign-off before FE-012 closes.

2. **Refresh-token transport across the Vite dev proxy.** The plan is httpOnly cookie set by the BE on signup/login/refresh. The Vite proxy must forward `Set-Cookie` headers and the browser must allow cookies through `localhost:5173 ↔ localhost:3000`. `credentials: 'include'` on every fetch is required, and `Access-Control-Allow-Credentials: true` on the BE side. If this doesn't work cleanly in dev, the fallback (access AND refresh both in-memory, refresh stored in `AuthProvider` state) is uglier but unblocks FE-002. Confirm with be-engineer before FE-001 implementation.

3. **Biggest risk — onboarding friction kills metric 1 (goal-set rate, >60% target).** The required path is signup → profile → goal, which is at minimum three form pages before the user sees value. If PRD Open Question #1 lands on "force signup wall", we will likely miss the goal-set-rate target. FE has two mitigations available: (a) compress the post-signup wizard into one scrollable page (profile + goal stacked, single submit), or (b) implement FE-010 (try-one-scan-before-wall) when PM unblocks it. Recommend (a) as a safe default since (b) is gated. The single-page wizard is implementable within FE-003 + FE-004 effort without re-scoping.

---

*End of frontend system design. Engineers: implement against this doc, raise deltas back into it as PRs rather than letting design and code drift.*
