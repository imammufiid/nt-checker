// Types mirror API_CONTRACT.md. Keep wire shapes (snake_case) for HealthProfile,
// AuthUser, AuthTokens since the BE returns them that way. Scan stays camelCase
// because the existing legacy scans endpoint emits the TypeORM entity directly
// (see backend/src/scans/scan.entity.ts) and the frontend has shipped against
// that shape since the MVP. Migrating Scan to snake_case is a later wave.

// ─── Verdict / Scan (existing, unchanged) ────────────────────────────────────

export type VerdictTier = 'healthy' | 'moderate' | 'unhealthy';

export interface Verdict {
  tier: VerdictTier;
  score: number;
  summary: string;
  explanation: string;
}

export interface RedFlag {
  ingredient: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Scan {
  id: string;
  productName: string | null;
  imageUrl: string;
  nutrition: Record<string, number | null>;
  ingredients: string[];
  redFlagIngredients: RedFlag[] | null;
  verdict: Verdict;
  extractionConfidence: 'high' | 'medium' | 'low';
  createdAt: string;
}

// ─── Auth (new) ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  subscription_tier: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  // refresh_token is set as an httpOnly cookie by the BE; we do not read it.
  expires_in: number;
}

export interface AuthBundle {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

// ─── Health Profile (new) ────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type Condition =
  | 'diabetes_type_1'
  | 'diabetes_type_2'
  | 'hypertension'
  | 'high_cholesterol'
  | 'heart_disease'
  | 'pcos'
  | 'gout'
  | 'none';

export type Allergy =
  | 'gluten'
  | 'lactose'
  | 'nuts'
  | 'peanuts'
  | 'soy'
  | 'eggs'
  | 'shellfish'
  | 'fish';

export type DietaryGoal =
  | 'weight_loss'
  | 'weight_gain'
  | 'muscle_gain'
  | 'keto'
  | 'low_sodium'
  | 'low_sugar'
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'kosher';

export interface HealthProfile {
  age: number | null;
  gender: Gender | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: ActivityLevel | null;
  conditions: Condition[] | null;
  allergies: Allergy[] | null;
  goals: DietaryGoal[] | null;
}

// ─── API envelope (new) ──────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiErrorBody;
