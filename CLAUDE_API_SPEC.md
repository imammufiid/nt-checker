# nt-checker — Claude API Integration Spec

**Date:** 2026-05-11
**Status:** Draft v1
**Anthropic SDK:** `@anthropic-ai/sdk` (Node.js / TypeScript)

---

## 1. Overview

This document specifies how `nt-checker` integrates with the Anthropic Claude API for vision-based nutrition label extraction and health verdict generation.

**Two integration points:**
1. **Extraction call** — image → structured JSON of nutrition facts and ingredients
2. **Explanation call** — structured data + user profile → personalized verdict explanation

We use **a single call with tool use** (forced) to do both in one round-trip, minimizing latency and cost.

---

## 2. Model Selection

| Use Case | Model | Reason |
|----------|-------|--------|
| **Production (default)** | `claude-opus-4-7` | Best vision accuracy + reasoning quality |
| **High-volume / cost-optimized** | `claude-sonnet-4-6` | ~5x cheaper, still strong vision |
| **Quick checks / dev** | `claude-haiku-4-5-20251001` | Fastest, cheapest |

**Recommendation:** Start with `claude-opus-4-7` for MVP to maximize verdict quality. Move volume traffic to Sonnet once we have a baseline of acceptable outputs.

---

## 3. Prompt Caching Strategy

The system prompt + tool definition is large (~2K tokens) and identical across every request. We use **prompt caching** to avoid re-processing it each call.

**Cache structure:**

```
┌─────────────────────────────────────────────┐
│  System Prompt (cached, 5min TTL)           │  ← cache_control: ephemeral
│  - Role definition                          │
│  - Health scoring rules                     │
│  - Threshold reference tables               │
│  - Output schema description                │
├─────────────────────────────────────────────┤
│  Tool Definition (cached)                   │  ← cache_control: ephemeral
│  - extract_and_analyze_nutrition tool       │
├─────────────────────────────────────────────┤
│  User Message (NOT cached, varies per call) │
│  - Image of nutrition label                 │
│  - User profile JSON                        │
└─────────────────────────────────────────────┘
```

**Expected hit rate:** > 90% after warm-up (5-minute TTL is enough for steady traffic).

**Cost impact:** Cached input tokens cost 10% of regular input tokens — large savings on the static system prompt.

---

## 4. Structured Output via Tool Use

We use **forced tool use** to get reliable structured JSON. Claude will be required to call our `extract_and_analyze_nutrition` tool, and the tool's `input` field gives us validated structured data.

### 4.1 Tool Definition

```typescript
const NUTRITION_TOOL = {
  name: "extract_and_analyze_nutrition",
  description: "Extract nutrition facts and ingredients from a food/drink label image, then provide a health verdict.",
  input_schema: {
    type: "object",
    required: [
      "extraction_confidence",
      "product",
      "nutrition",
      "ingredients",
      "verdict"
    ],
    properties: {
      extraction_confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "How confident you are in the data extracted from the image."
      },
      extraction_notes: {
        type: "string",
        description: "Optional notes about what was hard to read, e.g. 'sodium value partially obscured'."
      },
      product: {
        type: "object",
        required: ["name", "serving_size"],
        properties: {
          name: { type: "string", description: "Product name if visible, else null." },
          brand: { type: "string" },
          category: {
            type: "string",
            enum: ["beverage", "snack", "dairy", "bakery", "frozen", "canned", "condiment", "cereal", "other"]
          },
          serving_size: { type: "string", description: "e.g. '330ml', '30g', '1 cup'" },
          servings_per_container: { type: "number" }
        }
      },
      nutrition: {
        type: "object",
        description: "All values per single serving. Use null if a value is not on the label.",
        required: ["calories"],
        properties: {
          calories: { type: "number" },
          total_fat_g: { type: "number" },
          saturated_fat_g: { type: "number" },
          trans_fat_g: { type: "number" },
          cholesterol_mg: { type: "number" },
          sodium_mg: { type: "number" },
          total_carbs_g: { type: "number" },
          fiber_g: { type: "number" },
          sugar_g: { type: "number" },
          added_sugar_g: { type: "number" },
          protein_g: { type: "number" },
          vitamins_minerals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "number" },
                unit: { type: "string" },
                daily_value_percent: { type: "number" }
              }
            }
          }
        }
      },
      ingredients: {
        type: "array",
        description: "Ordered list of ingredients as printed on the label.",
        items: { type: "string" }
      },
      red_flag_ingredients: {
        type: "array",
        description: "Ingredients flagged as unhealthy or controversial.",
        items: {
          type: "object",
          required: ["ingredient", "reason", "severity"],
          properties: {
            ingredient: { type: "string" },
            reason: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] }
          }
        }
      },
      verdict: {
        type: "object",
        required: ["tier", "score", "summary", "explanation"],
        properties: {
          tier: { type: "string", enum: ["healthy", "moderate", "unhealthy"] },
          score: { type: "number", minimum: 0, maximum: 100 },
          summary: { type: "string", description: "Single-sentence verdict (max 20 words)." },
          explanation: { type: "string", description: "2-3 sentence reasoning citing specific nutrients and the user's profile." },
          personalized_for: {
            type: "array",
            description: "User conditions/goals this verdict accounts for.",
            items: { type: "string" }
          }
        }
      }
    }
  }
};
```

---

## 5. System Prompt

```
You are a nutrition analyst for the nt-checker app. Your job is to:

1. Read the food/drink nutrition label image provided by the user.
2. Extract structured nutrition facts and ingredients accurately.
3. Provide a health verdict personalized to the user's profile.

## Extraction Rules

- Values are always PER SERVING, not per container.
- If a value is not visible or unreadable, return null — do not guess.
- For ingredient lists, preserve the order shown on the label.
- Indicate extraction_confidence: "high" if all key fields are clearly readable, "medium" if some are estimated, "low" if the image is blurry or partial.

## Health Scoring Reference (per serving)

### Negative thresholds (lower is better):
- Sugar:        Healthy < 5g,    Moderate 5-15g,   Unhealthy > 15g
- Added sugar:  Healthy 0g,      Moderate 1-10g,   Unhealthy > 10g
- Sodium:       Healthy < 140mg, Moderate 140-400mg, Unhealthy > 400mg
- Saturated fat: Healthy < 1.5g, Moderate 1.5-5g,  Unhealthy > 5g
- Trans fat:    Healthy 0g,      AUTO-UNHEALTHY if > 0g

### Positive thresholds (higher is better):
- Fiber:        Healthy > 3g,  Moderate 1-3g,  Low < 1g
- Protein:      Healthy > 5g,  Moderate 2-5g,  Low < 2g

### Red flag ingredients (auto-deduct):
- Trans fats / hydrogenated oils → -20 points
- High-fructose corn syrup (HFCS) → -15 points
- Artificial sweeteners (aspartame, sucralose) → -5 points (more if user goal includes "no_artificial_sweeteners")
- Artificial colors (Red 40, Yellow 5, etc.) → -5 points each
- Sodium nitrite, BHA, BHT → -10 points
- > 10 total ingredients → -5 points (suggests ultra-processed)

### Bonus points:
- Whole grains as first ingredient: +10
- < 5 total ingredients: +10
- High fiber (> 5g): +10
- High protein (> 10g): +10

## Personalization Rules

When a user profile is provided, adjust the verdict:

- **Diabetes (type 1 or 2)**: Treat sugar > 5g as severe; flag any added sugar.
- **Hypertension**: Treat sodium > 140mg as severe.
- **High cholesterol**: Treat saturated fat > 1.5g as severe; flag trans fats.
- **Keto goal**: Treat carbs > 5g as red flag.
- **Low-sodium goal**: Treat sodium > 140mg as red flag.
- **Vegetarian/Vegan/Halal**: Flag any disallowed ingredients (gelatin, lard, alcohol, etc.).
- **Allergies**: Flag any allergen present in ingredients as severity "high".

In the `explanation` field, ALWAYS cite specific numbers (e.g., "35g sugar per serving") and reference the user's conditions if they affected the verdict.

## Output

You MUST call the `extract_and_analyze_nutrition` tool with the structured result. Do not respond in plain text.
```

---

## 6. User Message Format

```typescript
const userMessage = {
  role: "user",
  content: [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: base64ImageData
      }
    },
    {
      type: "text",
      text: `Analyze this nutrition label.

User profile:
${JSON.stringify(userProfile, null, 2)}

If no user profile is provided or fields are missing, give a general verdict based on standard health guidelines.`
    }
  ]
};
```

---

## 7. Full SDK Implementation (TypeScript)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface UserProfile {
  age?: number;
  gender?: string;
  conditions?: string[];
  allergies?: string[];
  goals?: string[];
}

interface AnalysisResult {
  extraction_confidence: "high" | "medium" | "low";
  extraction_notes?: string;
  product: { name: string; brand?: string; category?: string; serving_size: string; servings_per_container?: number };
  nutrition: Record<string, number | null>;
  ingredients: string[];
  red_flag_ingredients: Array<{ ingredient: string; reason: string; severity: "low" | "medium" | "high" }>;
  verdict: {
    tier: "healthy" | "moderate" | "unhealthy";
    score: number;
    summary: string;
    explanation: string;
    personalized_for: string[];
  };
}

export async function analyzeLabel(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  userProfile: UserProfile = {}
): Promise<AnalysisResult> {
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        ...NUTRITION_TOOL,
        cache_control: { type: "ephemeral" },
      },
    ],
    tool_choice: { type: "tool", name: "extract_and_analyze_nutrition" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `Analyze this nutrition label.\n\nUser profile:\n${JSON.stringify(userProfile, null, 2)}`,
          },
        ],
      },
    ],
  });

  // Extract tool use response
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM did not return a tool call");
  }

  // Log cache metrics for cost tracking
  console.log("Cache usage:", {
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });

  return toolUse.input as AnalysisResult;
}
```

---

## 8. Streaming (Optional, for Better UX)

For mobile UX where users wait several seconds, stream the response and show a skeleton/progress UI:

```typescript
const stream = client.messages.stream({
  model: "claude-opus-4-7",
  max_tokens: 2048,
  system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  tools: [{ ...NUTRITION_TOOL, cache_control: { type: "ephemeral" } }],
  tool_choice: { type: "tool", name: "extract_and_analyze_nutrition" },
  messages: [/* ... */],
});

stream.on("text", (chunk) => {
  // For tool use, we don't get text — but we can stream the tool input as it builds
});

stream.on("inputJson", (partial, snapshot) => {
  // Send partial JSON to client via WebSocket for progressive rendering
  websocket.send({ type: "partial_extraction", data: snapshot });
});

const finalMessage = await stream.finalMessage();
```

---

## 9. Error Handling

```typescript
async function analyzeWithFallback(imageBase64: string, mediaType: string, profile: UserProfile) {
  try {
    return await analyzeLabel(imageBase64, mediaType, profile);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      // Backoff and retry once
      await sleep(2000);
      return analyzeLabel(imageBase64, mediaType, profile);
    }

    if (err instanceof Anthropic.APIError && err.status >= 500) {
      // Fallback to secondary provider (GPT-4o or Gemini)
      return analyzeWithGPT4o(imageBase64, mediaType, profile);
    }

    if (err instanceof Anthropic.BadRequestError) {
      // Likely a malformed image — surface to client
      throw new ExtractionFailedError("Could not process image");
    }

    throw err;
  }
}
```

**Error types to handle:**
- `RateLimitError` (429) — back off + retry
- `APIError` 5xx — fall back to GPT-4o
- `BadRequestError` (400) — bad image, surface to client
- `AuthenticationError` (401) — config error, page on-call
- `extraction_confidence === "low"` — return 422 to client with retake prompt

---

## 10. Cost Model

**Per scan (assumed):**

| Component | Tokens (typical) | Cost (Opus 4.7) |
|-----------|------------------|----------------|
| System prompt (cached read) | ~1,500 | $0.0023 |
| Tool definition (cached read) | ~500 | $0.0008 |
| Image (Claude vision tokenization) | ~1,600 | $0.024 |
| User profile + instructions | ~200 | $0.003 |
| Output (tool use JSON) | ~600 | $0.045 |
| **Total per scan (cache hit)** | | **~$0.075** |
| **Total per scan (cache miss)** | | **~$0.10** |

**Per-scan cost on Sonnet 4.6:** ~$0.015 (5x cheaper)
**Per-scan cost on Haiku 4.5:** ~$0.004 (20x cheaper)

**Monthly projection:**
- 1,000 active users × 10 scans/month = 10,000 scans
- @ $0.075 per scan = **$750/month on Opus**
- @ $0.015 per scan = **$150/month on Sonnet**

**Cost optimizations applied:**
1. ✅ Prompt caching (system + tool definitions)
2. ✅ Image hash dedup (skip API call if user re-scans same label)
3. ✅ Compress images to 1024×1024 before sending (reduces vision tokens)
4. ✅ Single round-trip (extraction + verdict in one call via tool use)

---

## 11. Quality Assurance

**Eval set:**
- Maintain a golden test set of 100+ labeled nutrition images (with human-verified ground truth)
- Run on every prompt change before deploying
- Track metrics: extraction accuracy per field, verdict tier agreement, false positive/negative rate for red flags

**Monitoring (production):**
- Log every scan: model, latency, cache hit/miss, tokens, confidence
- Alert when `extraction_confidence === "low"` rate exceeds 10%
- Alert when verdict distribution skews unnaturally (e.g., everything "unhealthy")

**A/B testing:**
- Run Opus vs Sonnet in shadow mode; compare verdicts on the same scans
- Promote Sonnet if agreement > 95% to cut costs

---

## 12. Security Considerations

- **API key**: stored in secrets manager, never client-side
- **Image transmission**: server-side only — mobile uploads to our API, then we forward to Anthropic
- **PII in prompts**: user profile is sent to Anthropic; document this in privacy policy
- **Logging**: redact raw images from logs; keep only hashes + extracted JSON

---

## 13. Future Enhancements

| Idea | Notes |
|------|-------|
| **Batch API** | Use Anthropic Message Batches for non-urgent re-analyses (50% discount) |
| **Fine-tuning** | Once we have ground-truth data, consider fine-tuned model for cheaper inference |
| **Multi-language prompts** | Translate system prompt for Bahasa Indonesia, etc. |
| **Memory / personalization** | Use Claude memory features to learn user preferences over time |
| **Citations** | Use citations API to ground verdicts in WHO/FDA references |

---

*End of Claude API spec.*
