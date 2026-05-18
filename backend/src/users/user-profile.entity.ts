import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_user_profile_user_id_uniq', { unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (u) => u.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'integer', nullable: true })
  age: number | null;

  @Column({ type: 'text', nullable: true })
  gender: Gender | null;

  @Column({ type: 'real', nullable: true })
  weightKg: number | null;

  @Column({ type: 'real', nullable: true })
  heightCm: number | null;

  @Column({ type: 'text', nullable: true })
  activityLevel: ActivityLevel | null;

  @Column({ type: 'simple-json', nullable: true })
  conditions: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  allergies: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  goals: string[] | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
