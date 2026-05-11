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
