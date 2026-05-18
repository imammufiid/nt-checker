import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

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
@Index('idx_scans_user_created', ['userId', 'createdAt'])
export class Scan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // BE-001: nullable on the column to allow the boot-time backfill to seed a
  // "legacy" user without data loss; service layer treats this as NOT NULL
  // for newly-created scans (BE-007, later wave).
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (u) => u.scans, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

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
