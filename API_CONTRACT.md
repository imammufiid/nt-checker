# nt-checker — API Contract

**Date:** 2026-05-11
**Status:** Draft v1
**Base URL:** `https://api.nt-checker.com/v1`

---

## 1. Conventions

### 1.1 Authentication

All endpoints (except `/auth/*` and `/health`) require a Bearer token:

```
Authorization: Bearer <access_token>
```

### 1.2 Content Types

- Request: `application/json` (default) or `multipart/form-data` (for image upload)
- Response: `application/json`

### 1.3 Standard Response Envelope

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Image is required",
    "details": { "field": "image" }
  }
}
```

### 1.4 HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Created |
| `204` | No Content |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (invalid/missing token) |
| `403` | Forbidden (no permission) |
| `404` | Not Found |
| `409` | Conflict (duplicate resource) |
| `422` | Unprocessable Entity (image extraction failed) |
| `429` | Too Many Requests (rate limited) |
| `500` | Internal Server Error |
| `503` | Service Unavailable (LLM provider down) |

### 1.5 Pagination

List endpoints use cursor-based pagination:

```
GET /scans?limit=20&cursor=eyJpZCI6Ii4uLiJ9
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6Ii4uLiJ9",
    "has_more": true
  }
}
```

### 1.6 Rate Limits

| Tier | Scans per day | API requests per minute |
|------|---------------|-------------------------|
| Free | 5 | 60 |
| Premium | Unlimited | 300 |

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1715472000
```

---

## 2. Authentication Endpoints

### 2.1 Sign Up

```
POST /auth/signup
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "Imam"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Imam",
      "subscription_tier": "free",
      "created_at": "2026-05-11T10:00:00Z"
    },
    "tokens": {
      "access_token": "eyJ...",
      "expires_in": 900
    }
  }
}
```

**Note:** the refresh token is delivered as an `HttpOnly; Secure; SameSite=Strict; Path=/auth` cookie (`nt_refresh`), not in the JSON body. The browser carries it back to `POST /auth/refresh` and `POST /auth/logout` automatically. JS cannot read it (per [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md) §7).

### 2.2 Login

```
POST /auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response (200):** Same as signup response.

### 2.3 Refresh Token

```
POST /auth/refresh
```

**Request:** No body required. The `nt_refresh` httpOnly cookie carries the refresh token automatically. A `{ "refresh_token": "..." }` body is accepted as a fallback for non-browser clients but is not the primary path.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "expires_in": 900
  }
}
```

### 2.4 Logout

```
POST /auth/logout
```

**Response (204):** No body.

---

## 3. User Profile Endpoints

### 3.1 Get Current User

```
GET /users/me
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Imam",
    "subscription_tier": "free",
    "created_at": "2026-05-11T10:00:00Z"
  }
}
```

### 3.2 Update Current User

```
PATCH /users/me
```

**Request:**
```json
{
  "name": "Imam Mufiid"
}
```

**Response (200):** Updated user object.

### 3.3 Get Health Profile

```
GET /users/me/profile
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "age": 28,
    "gender": "male",
    "weight_kg": 70,
    "height_cm": 175,
    "activity_level": "moderate",
    "conditions": ["diabetes_type_2"],
    "allergies": ["lactose"],
    "goals": ["weight_loss", "low_sodium"]
  }
}
```

**Allowed values:**
- `gender`: `male`, `female`, `other`, `prefer_not_to_say`
- `activity_level`: `sedentary`, `light`, `moderate`, `active`, `very_active`
- `conditions`: `diabetes_type_1`, `diabetes_type_2`, `hypertension`, `high_cholesterol`, `heart_disease`, `pcos`, `gout`, `none`
- `allergies`: `gluten`, `lactose`, `nuts`, `peanuts`, `soy`, `eggs`, `shellfish`, `fish`
- `goals`: `weight_loss`, `weight_gain`, `muscle_gain`, `keto`, `low_sodium`, `low_sugar`, `vegetarian`, `vegan`, `halal`, `kosher`

### 3.4 Update Health Profile

```
PUT /users/me/profile
```

**Request:** Same shape as GET response.

**Response (200):** Updated profile.

---

## 4. Scan Endpoints

### 4.1 Create Scan (Upload Image)

```
POST /scans
Content-Type: multipart/form-data
```

**Form fields:**
- `image` (file, required) — JPEG/PNG, max 10 MB
- `product_name` (string, optional) — user-provided name hint
- `personalize` (boolean, optional, default true) — apply user profile

**Response (201):**
```json
{
  "success": true,
  "data": {
    "scan_id": "uuid",
    "image_url": "https://r2.../signed-url",
    "extracted": {
      "product_name": "Coca-Cola Original 330ml",
      "serving_size": "330ml",
      "servings_per_container": 1,
      "nutrition": {
        "calories": 139,
        "total_fat_g": 0,
        "saturated_fat_g": 0,
        "trans_fat_g": 0,
        "cholesterol_mg": 0,
        "sodium_mg": 35,
        "total_carbs_g": 35,
        "fiber_g": 0,
        "sugar_g": 35,
        "added_sugar_g": 35,
        "protein_g": 0
      },
      "ingredients": [
        "Carbonated water",
        "Sugar",
        "Caramel color (E150d)",
        "Phosphoric acid",
        "Natural flavors",
        "Caffeine"
      ]
    },
    "verdict": {
      "tier": "unhealthy",
      "score": 18,
      "color": "red",
      "summary": "High in added sugar. Not recommended for daily consumption.",
      "explanation": "This product contains 35g of added sugar in a single serving — that's 70% of the WHO daily recommended limit. Based on your diabetes profile, regular consumption is strongly discouraged.",
      "red_flags": [
        {
          "type": "high_sugar",
          "value": 35,
          "threshold": 15,
          "unit": "g",
          "severity": "high"
        },
        {
          "type": "personalized_diabetes",
          "message": "High glycemic impact for diabetic users",
          "severity": "high"
        }
      ],
      "positive_signals": [],
      "personalized_for": ["diabetes_type_2"]
    },
    "created_at": "2026-05-11T10:30:00Z"
  }
}
```

**Errors:**
- `400` — invalid image format / too large
- `422` — extraction failed (image unreadable)

### 4.2 List Scans

```
GET /scans?limit=20&cursor=...
```

**Query params:**
- `limit` (int, default 20, max 100)
- `cursor` (string, optional)
- `verdict` (string, optional) — filter by `healthy` / `moderate` / `unhealthy`
- `from` (ISO date, optional)
- `to` (ISO date, optional)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "scan_id": "uuid",
      "product_name": "Coca-Cola Original 330ml",
      "verdict_tier": "unhealthy",
      "score": 18,
      "image_url": "https://r2.../signed-url",
      "created_at": "2026-05-11T10:30:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6Ii4uLiJ9",
    "has_more": true
  }
}
```

### 4.3 Get Scan Details

```
GET /scans/{scan_id}
```

**Response (200):** Full scan object (same shape as create response `data`).

### 4.4 Delete Scan

```
DELETE /scans/{scan_id}
```

**Response (204):** No body.

### 4.5 Re-analyze with Updated Profile

```
POST /scans/{scan_id}/reanalyze
```

Use case: user updates their conditions; re-run scoring on past scans.

**Response (200):** Updated scan object with new verdict.

---

## 5. Product Endpoints

### 5.1 Search Products

```
GET /products?q=coca-cola&limit=10
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Coca-Cola Original",
      "brand": "Coca-Cola",
      "category": "soft_drinks",
      "barcode": "8992696405875"
    }
  ]
}
```

### 5.2 Lookup by Barcode

```
GET /products/barcode/{barcode}
```

**Response (200):** Single product object (full nutrition).
**Response (404):** Product not in database.

### 5.3 Get Healthier Alternatives

```
GET /products/{product_id}/alternatives?limit=5
```

**Response (200):** List of products in the same category with higher health scores.

---

## 6. Favorites & Watchlist

### 6.1 Add to Favorites

```
POST /favorites
```

**Request:**
```json
{
  "scan_id": "uuid"
}
```

**Response (201):** Favorite object.

### 6.2 List Favorites

```
GET /favorites
```

### 6.3 Remove Favorite

```
DELETE /favorites/{favorite_id}
```

---

## 7. Comparison

### 7.1 Compare Two Scans

```
POST /compare
```

**Request:**
```json
{
  "scan_ids": ["uuid_1", "uuid_2"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "scans": [...],
    "comparison": {
      "winner": "uuid_1",
      "reason": "Lower sugar and sodium per serving",
      "differences": {
        "sugar_g": { "scan_1": 5, "scan_2": 35, "delta": -30 },
        "sodium_mg": { "scan_1": 100, "scan_2": 35, "delta": +65 }
      }
    }
  }
}
```

---

## 8. Subscription / Billing

### 8.1 Get Subscription Status

```
GET /billing/subscription
```

### 8.2 Create Checkout Session

```
POST /billing/checkout
```

**Request:**
```json
{
  "plan": "premium_monthly",
  "return_url": "ntchecker://billing/return"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "checkout_url": "https://checkout.stripe.com/..."
  }
}
```

### 8.3 Cancel Subscription

```
POST /billing/cancel
```

---

## 9. Webhooks (Inbound)

### 9.1 Stripe Webhook

```
POST /webhooks/stripe
```

Handles: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`.

---

## 10. System Endpoints

### 10.1 Health Check

```
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-05-11T10:00:00Z"
}
```

---

## 11. Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_INPUT` | 400 | Validation failure |
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `TOKEN_EXPIRED` | 401 | Access token expired — refresh |
| `FORBIDDEN` | 403 | No permission for resource |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `DUPLICATE_EMAIL` | 409 | Email already registered |
| `EXTRACTION_FAILED` | 422 | Could not read nutrition from image |
| `LOW_CONFIDENCE` | 422 | Extracted data has low confidence; ask user to retry |
| `RATE_LIMITED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 429 | Free tier daily scan limit reached |
| `LLM_UNAVAILABLE` | 503 | Vision provider down; fallback also failed |

---

## 12. OpenAPI Spec

A machine-readable OpenAPI 3.1 spec will be generated from the route definitions (via Hono + Zod → `@hono/zod-openapi`) and exposed at:

```
GET /openapi.json
GET /docs   (Swagger UI)
```

---

*End of API contract document.*
