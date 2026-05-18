import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { Scan } from '../scans/scan.entity';

export type SubscriptionTier = 'free' | 'premium';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_users_email', { unique: true })
  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  passwordHash: string;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column({ type: 'text', default: 'free' })
  subscriptionTier: SubscriptionTier;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => UserProfile, (p) => p.user, {
    cascade: ['insert', 'update', 'remove'],
  })
  profile?: UserProfile | null;

  @OneToMany(() => RefreshToken, (rt) => rt.user, { cascade: ['remove'] })
  refreshTokens?: RefreshToken[];

  @OneToMany(() => Scan, (s) => s.user, { cascade: ['remove'] })
  scans?: Scan[];
}
