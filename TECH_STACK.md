# nt-checker — Features, Tools & Tech Stack

**Date:** 2026-05-11
**Status:** Draft v1

---

## 1. Features

### 1.1 Core Features (MVP — P0)

| Feature | Description |
|---------|-------------|
| **Image Upload** | Capture nutrition label / ingredient list via camera or gallery |
| **Image Preprocessing** | Auto-crop, rotate, enhance contrast for better OCR results |
| **Nutrition Extraction** | Extract structured nutrition data (calories, fat, sugar, sodium, etc.) via vision-LLM |
| **Ingredient Extraction** | Parse and list all ingredients from the label |
| **Health Verdict** | Healthy / Moderate / Unhealthy classification with color coding |
| **Health Score** | Numeric score (0–100) per scan |
| **Reasoning Explanation** | Plain-language explanation of why the verdict was given (2–3 sentences) |
| **Per-Nutrient Breakdown** | Visual breakdown showing each nutrient vs. recommended threshold |
| **Red Flag Detection** | Highlight unhealthy ingredients (HFCS, trans fats, artificial colors) |

### 1.2 Personalization Features (P1)

| Feature | Description |
|---------|-------------|
| **User Profile** | Age, gender, weight, height, activity level |
| **Health Conditions** | Diabetes, hypertension, high cholesterol, heart disease |
| **Allergies & Intolerances** | Gluten, lactose, nuts, soy, etc. |
| **Dietary Goals** | Weight loss, muscle gain, keto, low-sodium, vegetarian, vegan, halal |
| **Personalized Verdict** | Verdict adapts based on user profile (e.g., high sugar → "Avoid" for diabetics) |
| **Daily Intake Tracking** | Track daily totals against personalized limits |

### 1.3 Engagement Features (P2)

| Feature | Description |
|---------|-------------|
| **Scan History** | List of all previously scanned products |
| **Favorites / Watchlist** | Save healthy products for easy reference |
| **Product Comparison** | Compare two products side-by-side |
| **Search by Name** | Search previously scanned products |
| **Share Results** | Share verdict card via social media or messaging |
| **Push Notifications** | Reminders, weekly health summaries |

### 1.4 Advanced Features (P3)

| Feature | Description |
|---------|-------------|
| **Barcode Scanning** | Fallback for products with poor label readability |
| **Community Database** | User-contributed product data |
| **Healthier Alternatives** | Suggest healthier products in the same category |
| **Recipe Analysis** | Analyze whole recipes, not just packaged products |
| **Family Profiles** | Multiple profiles per account (parent scanning for kids) |
| **AI Chat Assistant** | Ask follow-up questions about scan results |

---

## 2. Tools

### 2.1 Development Tools

| Category | Tool |
|----------|------|
| **IDE** | VS Code / Cursor |
| **AI Coding Assistant** | Claude Code |
| **Version Control** | Git + GitHub |
| **Project Management** | Linear / Jira / Notion |
| **API Testing** | Postman / Insomnia / Bruno |
| **Database GUI** | TablePlus / DBeaver |

### 2.2 Design Tools

| Category | Tool |
|----------|------|
| **UI/UX Design** | Figma |
| **Wireframing** | Figma / Excalidraw |
| **Prototyping** | Figma Prototype |
| **Iconography** | Lucide / Heroicons |
| **Illustrations** | unDraw / Storyset |

### 2.3 DevOps & Monitoring

| Category | Tool |
|----------|------|
| **CI/CD** | GitHub Actions |
| **Container** | Docker |
| **Error Tracking** | Sentry |
| **Analytics** | Mixpanel / PostHog |
| **Crash Reporting** | Firebase Crashlytics |
| **Logging** | Logtail / Datadog |
| **Uptime Monitoring** | Better Stack / UptimeRobot |

### 2.4 Collaboration & Communication

| Category | Tool |
|----------|------|
| **Team Chat** | Slack / Discord |
| **Documentation** | Notion / Confluence |
| **Video Meetings** | Google Meet / Zoom |
| **Customer Support** | Intercom / Crisp |

---

## 3. Tech Stack

### 3.1 Mobile (Primary Platform)

**Recommended: React Native + Expo** (cross-platform, single codebase)

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | React Native + Expo | iOS + Android from one codebase, fast iteration |
| **Language** | TypeScript | Type safety, better DX |
| **State Management** | Zustand / TanStack Query | Lightweight, modern |
| **Navigation** | Expo Router / React Navigation | File-based routing |
| **UI Components** | NativeWind (Tailwind for RN) + React Native Reusables | Fast styling |
| **Camera** | Expo Camera / react-native-vision-camera | Image capture |
| **Storage (local)** | MMKV / AsyncStorage | Fast key-value storage |
| **Forms** | React Hook Form + Zod | Validation |
| **Notifications** | Expo Notifications | Push notifications |

**Alternative: Native** (if performance/camera quality is critical)
- iOS: Swift + SwiftUI
- Android: Kotlin + Jetpack Compose

### 3.2 Web (Secondary / Admin Panel)

| Layer | Choice |
|-------|--------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State** | Zustand + TanStack Query |
| **Forms** | React Hook Form + Zod |

### 3.3 Backend

| Layer | Choice | Why |
|-------|--------|-----|
| **Runtime** | Node.js (Bun for dev speed) | JS ecosystem alignment |
| **Framework** | Hono / Fastify / NestJS | Hono = lightweight, fast |
| **Language** | TypeScript | Shared types with frontend |
| **API Style** | REST + tRPC (optional) | Simple, well-supported |
| **Auth** | Clerk / Supabase Auth / Auth.js | Managed auth |
| **Validation** | Zod | Schema-first validation |

**Alternative: Python** (if ML-heavy)
- FastAPI + Pydantic
- Better for custom ML model serving

### 3.4 Database

| Type | Choice | Use Case |
|------|--------|----------|
| **Primary DB** | PostgreSQL (Supabase / Neon) | Users, scans, products, profiles |
| **ORM** | Drizzle / Prisma | Type-safe queries |
| **Cache** | Redis (Upstash) | Session, image hash cache, rate limiting |
| **Vector DB** (P2+) | pgvector / Pinecone | Product similarity, "healthier alternatives" |
| **Object Storage** | Cloudflare R2 / AWS S3 | Uploaded label images |

### 3.5 AI & Vision

| Capability | Service | Notes |
|------------|---------|-------|
| **Primary Vision-LLM** | **Claude Opus 4.7** (Anthropic API) | Best vision + reasoning, structured JSON output |
| **Secondary Vision-LLM** | GPT-4o (OpenAI) | Fallback / A-B test |
| **Tertiary Vision-LLM** | Gemini 2.x Flash | Lower-cost option for high volume |
| **Fallback OCR** | Google Cloud Vision API / Tesseract | If LLM uncertain |
| **Translation** | Built into LLM | For non-English labels |
| **Embeddings** | Voyage AI / OpenAI text-embedding-3 | Product similarity search |

**LLM features to leverage:**
- **Prompt caching** — cache analysis prompt template (reduces cost dramatically)
- **Structured outputs (JSON schema)** — consistent verdict format
- **Streaming** — better UX during analysis

### 3.6 Infrastructure & Hosting

| Component | Choice |
|-----------|--------|
| **Backend Hosting** | Railway / Fly.io / Vercel (serverless) / AWS ECS |
| **Web Hosting** | Vercel / Cloudflare Pages |
| **Mobile Distribution** | App Store + Google Play (via Expo EAS) |
| **CDN** | Cloudflare |
| **DNS** | Cloudflare |
| **Secrets Management** | Doppler / AWS Secrets Manager |

### 3.7 Third-Party APIs & Data

| Purpose | Service |
|---------|---------|
| **Nutrition Reference Data** | Open Food Facts API (free, open) |
| **Barcode Lookup** | UPCitemdb / Open Food Facts |
| **Payments** | Stripe / Xendit (for Indonesia) |
| **Email** | Resend / Postmark |
| **SMS / OTP** | Twilio / Vonage |

### 3.8 Testing

| Type | Tool |
|------|------|
| **Unit Testing** | Vitest / Jest |
| **Component Testing** | React Native Testing Library |
| **E2E (Mobile)** | Maestro / Detox |
| **E2E (Web)** | Playwright |
| **API Testing** | Vitest + Supertest |
| **Load Testing** | k6 |

### 3.9 Security

| Concern | Tool / Practice |
|---------|----------------|
| **Auth Tokens** | JWT + refresh tokens / session cookies |
| **Rate Limiting** | Upstash Ratelimit |
| **API Security** | Helmet, CORS, input validation (Zod) |
| **Secrets Scanning** | GitGuardian / TruffleHog |
| **Dependency Scanning** | Dependabot / Snyk |
| **PII Handling** | Encrypt user health data at rest |
| **Compliance** | GDPR-ready, regional health data regulations |

---

## 4. Recommended Stack Summary (MVP)

For fastest time-to-market with a small team:

```
Mobile:    React Native + Expo + TypeScript
           NativeWind + Zustand + TanStack Query

Backend:   Hono (Node.js / Bun) + TypeScript
           Drizzle ORM + Zod validation

Database:  Supabase (PostgreSQL + Auth + Storage)
           Upstash Redis (cache)

AI:        Claude Opus 4.7 (vision + analysis)
           Prompt caching enabled
           Structured JSON output

Hosting:   Railway (backend) + Supabase (DB) + Cloudflare R2 (images)
           Expo EAS (mobile builds & OTA updates)

Tools:     Sentry + PostHog + GitHub Actions
```

---

## 5. Stack Decisions to Make

1. **Mobile-first vs. web-first?** — Recommend mobile-first (camera UX is core).
2. **React Native vs. Native (Swift/Kotlin)?** — Recommend RN for speed, switch to native only if camera or perf is bottleneck.
3. **Self-hosted DB vs. Supabase?** — Recommend Supabase for MVP (auth + DB + storage in one).
4. **Single LLM provider vs. multi-provider?** — Start single (Claude), add fallback later.
5. **REST vs. tRPC?** — Recommend REST for mobile (better tooling), tRPC if web-heavy.

---

*End of tech stack document.*
