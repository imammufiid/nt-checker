import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from './user-profile.entity';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

export interface ProfileResponse {
  age: number | null;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null;
  conditions: string[] | null;
  allergies: string[] | null;
  goals: string[] | null;
}

const NULL_PROFILE: ProfileResponse = {
  age: null,
  gender: null,
  weight_kg: null,
  height_cm: null,
  activity_level: null,
  conditions: null,
  allergies: null,
  goals: null,
};

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly profiles: Repository<UserProfile>,
  ) {}

  async get(userId: string): Promise<ProfileResponse> {
    const row = await this.profiles.findOne({ where: { userId } });
    if (!row) return { ...NULL_PROFILE };
    return this.toResponse(row);
  }

  async upsert(
    userId: string,
    dto: UpsertProfileDto,
  ): Promise<ProfileResponse> {
    const existing = await this.profiles.findOne({ where: { userId } });

    if (existing) {
      this.applyDtoToEntity(existing, dto);
      const saved = await this.profiles.save(existing);
      return this.toResponse(saved);
    }

    const row = this.profiles.create({ userId });
    this.applyDtoToEntity(row, dto);
    const saved = await this.profiles.save(row);
    return this.toResponse(saved);
  }

  private applyDtoToEntity(row: UserProfile, dto: UpsertProfileDto): void {
    if (dto.age !== undefined) row.age = dto.age ?? null;
    if (dto.gender !== undefined) row.gender = (dto.gender as any) ?? null;
    if (dto.weight_kg !== undefined) row.weightKg = dto.weight_kg ?? null;
    if (dto.height_cm !== undefined) row.heightCm = dto.height_cm ?? null;
    if (dto.activity_level !== undefined)
      row.activityLevel = (dto.activity_level as any) ?? null;
    if (dto.conditions !== undefined) row.conditions = dto.conditions ?? null;
    if (dto.allergies !== undefined) row.allergies = dto.allergies ?? null;
    if (dto.goals !== undefined) row.goals = dto.goals ?? null;
  }

  private toResponse(row: UserProfile): ProfileResponse {
    return {
      age: row.age,
      gender: row.gender,
      weight_kg: row.weightKg,
      height_cm: row.heightCm,
      activity_level: row.activityLevel,
      conditions: row.conditions,
      allergies: row.allergies,
      goals: row.goals,
    };
  }
}
