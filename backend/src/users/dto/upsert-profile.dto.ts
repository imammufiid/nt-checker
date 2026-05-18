import { Expose } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const GENDER_VALUES = [
  'male',
  'female',
  'other',
  'prefer_not_to_say',
] as const;

export const ACTIVITY_LEVELS = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
] as const;

export const CONDITION_VALUES = [
  'diabetes_type_1',
  'diabetes_type_2',
  'hypertension',
  'high_cholesterol',
  'heart_disease',
  'pcos',
  'gout',
  'none',
] as const;

export const ALLERGY_VALUES = [
  'gluten',
  'lactose',
  'nuts',
  'peanuts',
  'soy',
  'eggs',
  'shellfish',
  'fish',
] as const;

export const GOAL_TAG_VALUES = [
  'weight_loss',
  'weight_gain',
  'muscle_gain',
  'keto',
  'low_sodium',
  'low_sugar',
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
] as const;

/**
 * Wire shape is snake_case per API_CONTRACT.md §3.3/3.4. Entity stays camelCase;
 * `@Expose({ name: '...' })` lets `plainToInstance(..., { excludeExtraneousValues: false })`
 * still pick up the snake_case keys while DTO field names stay readable in code.
 *
 * Every field is `@IsOptional()` so a partial profile is valid (PRD F-P0-2
 * AC: "with nulls allowed for fields the user hasn't filled").
 *
 * `@ValidateIf(o => v !== null)` lets clients explicitly send `null` to clear
 * a previously-set value without tripping the IsX validators.
 */
export class UpsertProfileDto {
  @Expose({ name: 'age' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  age?: number | null;

  @Expose({ name: 'gender' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @IsIn(GENDER_VALUES as unknown as string[])
  gender?: string | null;

  @Expose({ name: 'weight_kg' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  weight_kg?: number | null;

  @Expose({ name: 'height_cm' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  height_cm?: number | null;

  @Expose({ name: 'activity_level' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @IsIn(ACTIVITY_LEVELS as unknown as string[])
  activity_level?: string | null;

  @Expose({ name: 'conditions' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CONDITION_VALUES as unknown as string[], { each: true })
  conditions?: string[] | null;

  @Expose({ name: 'allergies' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALLERGY_VALUES as unknown as string[], { each: true })
  allergies?: string[] | null;

  @Expose({ name: 'goals' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(GOAL_TAG_VALUES as unknown as string[], { each: true })
  goals?: string[] | null;
}
