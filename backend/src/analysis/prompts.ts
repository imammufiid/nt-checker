export const SYSTEM_PROMPT = `You are a nutrition analyst for the nt-checker app. Read the food/drink nutrition label image, extract structured data, and provide a health verdict.

# Extraction rules
- All nutrition values are PER SERVING. Use null if a value is not visible on the label.
- Preserve the order of ingredients exactly as printed.
- Set extraction_confidence:
  - "high"   — all key fields are clearly readable
  - "medium" — some fields had to be estimated
  - "low"    — image is too blurry, dark, or partial to read reliably

# Health scoring (per serving)
Negative thresholds (lower is better):
- Sugar:         < 5g healthy   |  5-15g moderate  |  > 15g unhealthy
- Added sugar:   = 0g healthy   |  1-10g moderate  |  > 10g unhealthy
- Sodium:        < 140mg healthy | 140-400mg moderate | > 400mg unhealthy
- Saturated fat: < 1.5g healthy  | 1.5-5g moderate   | > 5g unhealthy
- Trans fat:     > 0g auto-UNHEALTHY (overrides score)

Positive thresholds (higher is better):
- Fiber:    > 3g = +10 score points
- Protein:  > 5g = +5 score points

# Red flag ingredients (auto-deduct from score)
- Trans fats / hydrogenated oils: -20
- High-fructose corn syrup (HFCS): -15
- Artificial sweeteners (aspartame, sucralose): -5
- Artificial colors (Red 40, Yellow 5, Tartrazine, etc.): -5 each
- BHA, BHT, sodium nitrite, sodium benzoate: -10

# Bonuses
- Whole grain / whole food as first ingredient: +10
- Fewer than 5 total ingredients: +10
- High fiber (> 5g): +5

# Verdict tiers
- score >= 70  → "healthy"
- score 40-69  → "moderate"
- score < 40   → "unhealthy"
Start at score = 60 (neutral baseline) and apply adjustments.

# Output requirements
- You MUST call the extract_and_analyze_nutrition tool. Do not respond in plain text.
- In "summary", give a single sentence (max 20 words).
- In "explanation", give 2-3 sentences citing specific numbers (e.g., "35g sugar per serving — over the 15g unhealthy threshold").
- If the image is unreadable, still call the tool with extraction_confidence="low" and a verdict that says retake the photo.`;

export const NUTRITION_TOOL = {
  name: 'extract_and_analyze_nutrition',
  description:
    'Extract nutrition facts and ingredients from a food/drink label image, then provide a health verdict and score.',
  input_schema: {
    type: 'object' as const,
    required: [
      'extraction_confidence',
      'product',
      'nutrition',
      'ingredients',
      'red_flag_ingredients',
      'verdict',
    ],
    properties: {
      extraction_confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Confidence level in the extracted data.',
      },
      extraction_notes: {
        type: 'string',
        description:
          'Optional notes about what was hard to read (e.g. "sodium value partially obscured").',
      },
      product: {
        type: 'object',
        required: ['name', 'serving_size'],
        properties: {
          name: { type: ['string', 'null'] },
          brand: { type: 'string' },
          category: {
            type: 'string',
            enum: [
              'beverage',
              'snack',
              'dairy',
              'bakery',
              'frozen',
              'canned',
              'condiment',
              'cereal',
              'other',
            ],
          },
          serving_size: { type: 'string' },
          servings_per_container: { type: 'number' },
        },
      },
      nutrition: {
        type: 'object',
        description:
          'Per-serving values. Use null for any value not visible on the label.',
        properties: {
          calories: { type: ['number', 'null'] },
          total_fat_g: { type: ['number', 'null'] },
          saturated_fat_g: { type: ['number', 'null'] },
          trans_fat_g: { type: ['number', 'null'] },
          cholesterol_mg: { type: ['number', 'null'] },
          sodium_mg: { type: ['number', 'null'] },
          total_carbs_g: { type: ['number', 'null'] },
          fiber_g: { type: ['number', 'null'] },
          sugar_g: { type: ['number', 'null'] },
          added_sugar_g: { type: ['number', 'null'] },
          protein_g: { type: ['number', 'null'] },
        },
      },
      ingredients: {
        type: 'array',
        description: 'Ordered list of ingredients as printed on the label.',
        items: { type: 'string' },
      },
      red_flag_ingredients: {
        type: 'array',
        description:
          'Ingredients flagged as unhealthy or controversial (empty array if none).',
        items: {
          type: 'object',
          required: ['ingredient', 'reason', 'severity'],
          properties: {
            ingredient: { type: 'string' },
            reason: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      verdict: {
        type: 'object',
        required: ['tier', 'score', 'summary', 'explanation'],
        properties: {
          tier: {
            type: 'string',
            enum: ['healthy', 'moderate', 'unhealthy'],
          },
          score: { type: 'number', minimum: 0, maximum: 100 },
          summary: {
            type: 'string',
            description: 'Single-sentence verdict (max 20 words).',
          },
          explanation: {
            type: 'string',
            description: '2-3 sentences citing specific nutrients and numbers.',
          },
        },
      },
    },
  },
};
