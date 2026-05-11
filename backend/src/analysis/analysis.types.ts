export interface AnalysisResult {
  extraction_confidence: 'high' | 'medium' | 'low';
  extraction_notes?: string;
  product: {
    name: string | null;
    brand?: string;
    category?: string;
    serving_size: string;
    servings_per_container?: number;
  };
  nutrition: Record<string, number | null>;
  ingredients: string[];
  red_flag_ingredients: Array<{
    ingredient: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  verdict: {
    tier: 'healthy' | 'moderate' | 'unhealthy';
    score: number;
    summary: string;
    explanation: string;
  };
}
