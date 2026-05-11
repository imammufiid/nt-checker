import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

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

@Entity('scans')
export class Scan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  productName: string | null;

  @Column({ type: 'text' })
  imagePath: string;

  @Column({ type: 'text' })
  imageUrl: string;

  @Column({ type: 'simple-json' })
  nutrition: Record<string, number | null>;

  @Column({ type: 'simple-json' })
  ingredients: string[];

  @Column({ type: 'simple-json', nullable: true })
  redFlagIngredients: RedFlag[] | null;

  @Column({ type: 'simple-json' })
  verdict: Verdict;

  @Column({ type: 'text', default: 'high' })
  extractionConfidence: 'high' | 'medium' | 'low';

  @CreateDateColumn()
  createdAt: Date;
}
