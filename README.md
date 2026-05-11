# nt-checker — Nutrition Health Checker (MVP)

Web app that analyzes whether a packaged food/drink is healthy by reading its nutrition label or ingredient list. Upload a photo → get an instant health verdict with reasoning.

**Stack:** Vite + React (frontend) · NestJS + SQLite (backend) · Claude API (analysis)

---

## Features (MVP)

1. **Upload image and scan** — camera or file upload
2. **Result of analysis** — verdict tier (healthy / moderate / unhealthy), score, reasoning, per-nutrient breakdown, red-flag ingredients
3. **History** — list of all past scans, persisted in SQLite

---

## Project structure

```
nt-checker/
├── backend/                NestJS API + SQLite + Claude integration
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── scans/          REST endpoints for scans (CRUD)
│   │   └── analysis/       Claude API wrapper (vision + tool use)
│   ├── uploads/            (created at runtime) uploaded images
│   ├── data.sqlite         (created at runtime) scan history
│   └── .env                (you create this) — see .env.example
│
├── frontend/               Vite + React + Tailwind UI
│   └── src/
│       ├── pages/          HomePage, ResultPage, HistoryPage
│       ├── components/     Layout, ImageUploader, VerdictCard, NutritionTable
│       └── lib/            API client + types
│
├── PRODUCT_ANALYSIS.md     PM-style product analysis
├── TECH_STACK.md           Features, tools, full tech stack reference
├── ARCHITECTURE.md         System architecture (diagrams)
├── API_CONTRACT.md         REST API contract (full spec)
└── CLAUDE_API_SPEC.md      Claude API integration details
```

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
# Get one from https://console.anthropic.com/

npm install
npm run start:dev
```

The API will run on http://localhost:3000.

**Endpoints:**
- `POST   /scans`     — upload image (`multipart/form-data`, field `image`)
- `GET    /scans`     — list all scans (newest first)
- `GET    /scans/:id` — get one scan
- `DELETE /scans/:id` — delete a scan
- `GET    /uploads/:filename` — served images

### 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The web app will run on http://localhost:5173.

Vite proxies `/api/*` → `http://localhost:3000/*` and `/uploads/*` → backend, so no extra CORS config is needed in development.

---

## Environment variables (backend)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — | Get from https://console.anthropic.com/ |
| `PORT` | no | `3000` | API server port |
| `DATABASE_PATH` | no | `./data.sqlite` | SQLite DB file |
| `CLAUDE_MODEL` | no | `claude-sonnet-4-6` | Model to use |

**Model choices:**
- `claude-opus-4-7` — best quality, most expensive (~$0.10/scan)
- `claude-sonnet-4-6` — recommended balance (~$0.015/scan)
- `claude-haiku-4-5-20251001` — cheapest (~$0.004/scan), lower vision accuracy

---

## How it works

1. User uploads an image via the web UI → multipart POST to `/scans`.
2. NestJS saves the image to `backend/uploads/` and calls the `AnalysisService`.
3. `AnalysisService` calls Claude's Messages API with:
   - The image as a `base64` content block
   - A system prompt with health scoring rules
   - A `tool_use` schema (`extract_and_analyze_nutrition`) that forces structured JSON output
   - **Prompt caching** on the system prompt + tool definition (5-minute TTL)
4. Claude returns structured JSON with nutrition facts, ingredients, red flags, and a verdict.
5. NestJS persists the result to SQLite via TypeORM and returns it to the client.
6. The Result page renders the verdict card, nutrition table, ingredients, and red flags.
7. The History page lists all past scans.

---

## Cost notes

Per scan (Sonnet 4.6, with prompt cache hits): **~$0.015**

- Cached system prompt + tool definition: ~$0.001
- Image (vision tokens): ~$0.01
- Output (verdict JSON): ~$0.004

Image hash dedup is not yet implemented in this MVP — every scan calls the API. Add it later if traffic grows.

---

## Limitations of this MVP

- **No authentication** — single-user, single-device. History is shared across anyone using the backend.
- **No user profile / personalization** — verdicts use generic WHO/FDA thresholds, not condition-specific (diabetes, hypertension, etc.).
- **No image preprocessing** — large images go straight to Claude (more vision tokens = more cost).
- **No caching by image hash** — duplicates re-analyze.
- **No rate limiting** — add for production.

These are documented in `PRODUCT_ANALYSIS.md` and `ARCHITECTURE.md` as future roadmap items.

---

## Troubleshooting

**`ANTHROPIC_API_KEY is not set`** on backend startup
→ Create `backend/.env` from `backend/.env.example` and add your key.

**`sqlite3` fails to install on macOS**
→ Run `xcode-select --install` to install command line tools, then `npm install` again.

**Frontend can't reach backend (`/api/...` 404)**
→ Make sure the backend is running on port 3000 (or update `vite.config.ts` proxy target).

**Image upload returns 400 "Only JPEG, PNG, or WebP images are allowed"**
→ Verify the file is one of those formats. HEIC (default iPhone format) is not currently supported — convert first or update the `fileFilter` in `scans.controller.ts`.

---

## Next steps (post-MVP)

See `TECH_STACK.md` for the full P1/P2/P3 feature roadmap. Likely next:
- User profile + personalization (P1)
- Image hash dedup (cost saver)
- Authentication
- Mobile app (React Native)
# nt-checker
