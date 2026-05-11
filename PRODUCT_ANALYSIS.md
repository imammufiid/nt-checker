# Product Analysis: Nutrition Health Checker (nt-checker)

**Author:** Product Manager Analysis
**Date:** 2026-05-11
**Status:** Draft v1

---

## 1. Product Concept

A mobile/web app where users **upload a photo of a food or drink's nutrition facts label or ingredient list**, and the app returns a clear health verdict with a plain-language explanation.

**One-line pitch:** "Scan it, know it — instantly know if a packaged food or drink is healthy for *you*."

---

## 2. Problem Statement

Consumers face three real problems when shopping for packaged food/drinks:

1. **Information overload** — nutrition labels list 10+ values with units and percentages that require expertise to interpret.
2. **Context-blind labels** — "low fat" can still mean high sugar; "natural" is marketing, not nutrition.
3. **Hidden ingredients** — additives, preservatives, and artificial sweeteners are buried in long ingredient lists.

Existing barcode-scan apps (Yuka, Fooducate, MyFitnessPal) depend on a product database — which leaves **regional and local products uncovered**, especially in markets like Indonesia.

---

## 3. Target Users

| Priority | Segment | Need |
|----------|---------|------|
| P0 | Health-conscious shoppers | Quick in-store decisions |
| P0 | People with health conditions (diabetes, hypertension, high cholesterol) | Safety check per their condition |
| P1 | Parents | Verify products for children |
| P1 | Fitness / diet followers (keto, low-sodium, high-protein) | Match products to dietary goals |
| P2 | Allergy sufferers | Detect allergens in ingredients |

---

## 4. Value Proposition & Differentiation

**Core value:** Replaces the need to be a nutrition expert. Provides a verdict + reasoning in seconds.

**Key differentiator vs. competitors:**
- **Image-based analysis (not barcode-dependent)** — works on any product, including local/regional brands not in global databases.
- **Personalized verdict** — the same product can be "healthy" for an athlete and "unhealthy" for a diabetic. Verdict adapts to user profile.
- **Plain-language explanation** — not just a score, but *why*.

---

## 5. MVP Feature Set

| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Image upload | Camera or gallery upload of nutrition label / ingredient list |
| P0 | OCR / vision extraction | Extract structured nutrition data from image |
| P0 | Health verdict | Healthy / Moderate / Unhealthy with color coding |
| P0 | Reasoning explanation | 2-3 sentence plain-language explanation |
| P0 | Per-nutrient breakdown | Sugar, sodium, saturated fat, trans fat, additives flagged |
| P1 | User profile | Conditions (diabetes, hypertension), allergies, goals (weight loss, muscle gain) |
| P1 | Personalized verdict | Verdict adapts to profile |
| P1 | Ingredient list analysis | Flag HFCS, trans fats, artificial sweeteners, preservatives |
| P2 | History / favorites | Save scans for later reference |
| P2 | Product comparison | Compare two scans side-by-side |
| P3 | Barcode fallback | If image unclear, lookup by barcode |
| P3 | Community contributions | User-submitted product data |

---

## 6. Health Scoring Logic (Proposed)

**Inputs:**
- Serving size
- Macronutrients (calories, fat, saturated fat, trans fat, carbs, sugar, fiber, protein)
- Sodium
- Ingredient list

**Reference thresholds** (per serving, based on WHO / FDA guidelines):

| Nutrient | Healthy | Moderate | Unhealthy |
|----------|---------|----------|-----------|
| Sugar | < 5g | 5-15g | > 15g |
| Sodium | < 140mg | 140-400mg | > 400mg |
| Saturated Fat | < 1.5g | 1.5-5g | > 5g |
| Trans Fat | 0g | — | > 0g (auto-fail) |
| Fiber (positive) | > 3g | 1-3g | < 1g |

**Ingredient red flags (auto-deduct points):**
- Trans fats / hydrogenated oils
- High-fructose corn syrup (HFCS)
- Excessive artificial colorings (Red 40, Yellow 5, etc.)
- Artificial sweeteners (aspartame, sucralose) — flag for relevant profiles
- Long preservative list (BHA, BHT, sodium benzoate)

**Positive signals (add points):**
- Whole grains, whole ingredients
- High fiber, high protein
- Minimal ingredient list (< 5 items)

**Output:**
- Score: 0-100
- Verdict tier: Healthy (70+) / Moderate (40-69) / Unhealthy (< 40)
- Explanation: highlights top 2-3 reasons for the verdict

---

## 7. Key Risks & Tradeoffs

| Risk | Impact | Mitigation |
|------|--------|------------|
| "Healthy" is subjective | Users disagree with verdicts | Personalization via profile; show reasoning transparently |
| OCR accuracy on blurry / non-standard labels | Wrong analysis → lost trust | Confidence threshold; allow manual correction; use vision-LLM (not classic OCR) |
| Medical liability | Legal exposure | Disclaimer: "Informational, not medical advice"; avoid disease claims |
| Non-English / regional labels | Limited coverage | Multilingual OCR; support Bahasa Indonesia from day 1 |
| User trust on unfamiliar verdicts | High churn | Always cite *why* (specific nutrient + threshold) |

---

## 8. Technical Approach

**Image to verdict pipeline:**

1. **Image capture** — mobile camera with framing guides for nutrition labels
2. **Vision extraction** — Vision-capable LLM (Claude Opus 4.7, GPT-4o, or Gemini) extracts structured JSON of nutrition facts
3. **Analysis engine** — Rules-based scoring + LLM-generated explanation
4. **Output** — Verdict card with score, reasoning, per-nutrient breakdown

**Why vision-LLM over classic OCR:**
- Handles irregular layouts, different languages, varying label designs
- Can extract context (e.g. "per serving" vs "per 100g")
- Structured output via JSON schema for consistency

**Cost consideration:** Vision API calls are the main per-request cost. Mitigations:
- Cache by image hash (same product = no re-analysis)
- Prompt caching for the analysis prompt template
- Tier free users (e.g., 5 scans/day) → paid for unlimited

---

## 9. Success Metrics

| Metric | Target (3 months) |
|--------|-------------------|
| **Activation:** % of first uploads completing to verdict | > 85% |
| **Retention:** weekly active users / monthly active users | > 30% |
| **Engagement:** scans per active user per week | > 3 |
| **Trust signal:** % of verdicts marked "helpful" | > 70% |
| **Conversion:** free → premium (personalization) | > 5% |

---

## 10. Competitive Landscape

| Competitor | Strength | Weakness vs. nt-checker |
|------------|----------|-------------------------|
| **Yuka** | Strong brand, simple UX | Barcode-only; weak coverage for Asian/local products |
| **Fooducate** | Detailed grades | US-focused database; limited personalization |
| **MyFitnessPal** | Tracking ecosystem | Logging-heavy; not a quick-decision tool |
| **Open Food Facts** | Free, open data | DIY interface; not consumer-friendly |

**Our wedge:** Image-based + personalized + local-market coverage.

---

## 11. Recommended Wedge & Next Steps

**Suggested go-to-market wedge:**
Focus the MVP on **personalization for specific health conditions** (diabetes, hypertension) — these users have the strongest pain point and clearest willingness to pay.

**Next steps:**
1. ✅ Validate problem with 10-15 user interviews (target: diabetics, hypertension patients)
2. Build prototype: image upload → vision-LLM extraction → rules-based verdict
3. Test OCR accuracy on 50 local Indonesian products
4. Define MVP scope cut (recommend: P0 features only for v0.1)
5. Design verdict card UX (Figma)
6. Build & launch closed beta (~50 users) in target segment

---

## 12. Open Questions

1. Monetization model — freemium (free basic, paid personalization) vs. subscription vs. ad-supported?
2. Platform priority — mobile-first (iOS/Android) or PWA?
3. Geographic launch — Indonesia-first or broader Southeast Asia?
4. Partnership opportunities — health insurers, hospitals, fitness brands?
5. Regulatory — do we need any health authority certification in target markets?

---

*End of analysis.*
