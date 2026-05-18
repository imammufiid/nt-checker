import { useEffect, useState, type FormEvent } from 'react';
import type {
  ActivityLevel,
  Allergy,
  Condition,
  DietaryGoal,
  Gender,
  HealthProfile,
} from '../../lib/types';
import { id } from '../../lib/id';
import ConditionsChips from './ConditionsChips';

interface Props {
  initial?: HealthProfile | null;
  onSubmit: (profile: HealthProfile) => Promise<void>;
  submitting?: boolean;
}

const ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

const GENDERS: Gender[] = ['male', 'female', 'other', 'prefer_not_to_say'];

const CONDITIONS: Condition[] = [
  'diabetes_type_1',
  'diabetes_type_2',
  'hypertension',
  'high_cholesterol',
  'heart_disease',
  'pcos',
  'gout',
  'none',
];

const ALLERGIES: Allergy[] = [
  'gluten',
  'lactose',
  'nuts',
  'peanuts',
  'soy',
  'eggs',
  'shellfish',
  'fish',
];

const GOALS: DietaryGoal[] = [
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
];

interface FormState {
  age: string;
  gender: Gender | '';
  weightKg: string;
  heightCm: string;
  activityLevel: ActivityLevel | '';
  conditions: Condition[];
  allergies: Allergy[];
  goals: DietaryGoal[];
}

function fromProfile(profile: HealthProfile | null | undefined): FormState {
  return {
    age: profile?.age != null ? String(profile.age) : '',
    gender: profile?.gender ?? '',
    weightKg: profile?.weight_kg != null ? String(profile.weight_kg) : '',
    heightCm: profile?.height_cm != null ? String(profile.height_cm) : '',
    activityLevel: profile?.activity_level ?? '',
    conditions: profile?.conditions ?? [],
    allergies: profile?.allergies ?? [],
    goals: profile?.goals ?? [],
  };
}

function toProfile(s: FormState): HealthProfile {
  const ageN = s.age.trim() === '' ? null : Number(s.age);
  const weightN = s.weightKg.trim() === '' ? null : Number(s.weightKg);
  const heightN = s.heightCm.trim() === '' ? null : Number(s.heightCm);
  return {
    age: Number.isFinite(ageN) ? ageN : null,
    gender: (s.gender || null) as Gender | null,
    weight_kg: Number.isFinite(weightN) ? weightN : null,
    height_cm: Number.isFinite(heightN) ? heightN : null,
    activity_level: (s.activityLevel || null) as ActivityLevel | null,
    conditions: s.conditions.length > 0 ? s.conditions : null,
    allergies: s.allergies.length > 0 ? s.allergies : null,
    goals: s.goals.length > 0 ? s.goals : null,
  };
}

export default function ProfileForm({ initial, onSubmit, submitting }: Props) {
  const [form, setForm] = useState<FormState>(() => fromProfile(initial));

  useEffect(() => {
    if (initial) setForm(fromProfile(initial));
  }, [initial]);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    await onSubmit(toProfile(form));
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60';

  return (
    <form onSubmit={handle} className="space-y-6" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="profile-age"
            className="block text-sm font-medium text-slate-700"
          >
            {id.profile.fields.age}
          </label>
          <input
            id="profile-age"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="profile-gender"
            className="block text-sm font-medium text-slate-700"
          >
            {id.profile.fields.gender}
          </label>
          <select
            id="profile-gender"
            value={form.gender}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value as Gender | '' })
            }
            disabled={submitting}
            className={inputClass}
          >
            <option value="">{id.profile.placeholders.selectGender}</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {id.profile.genders[g]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="profile-weight"
            className="block text-sm font-medium text-slate-700"
          >
            {id.profile.fields.weight}
          </label>
          <input
            id="profile-weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={1}
            value={form.weightKg}
            onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="profile-height"
            className="block text-sm font-medium text-slate-700"
          >
            {id.profile.fields.height}
          </label>
          <input
            id="profile-height"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={1}
            value={form.heightCm}
            onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
            disabled={submitting}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div
          id="profile-activity-label"
          className="text-sm font-medium text-slate-700"
        >
          {id.profile.fields.activity}
        </div>
        <div
          role="radiogroup"
          aria-labelledby="profile-activity-label"
          className="grid grid-cols-2 sm:grid-cols-5 gap-2"
        >
          {ACTIVITY_LEVELS.map((lvl) => {
            const selected = form.activityLevel === lvl;
            return (
              <button
                key={lvl}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  setForm({ ...form, activityLevel: selected ? '' : lvl })
                }
                disabled={submitting}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors min-h-11 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 ${
                  selected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-medium'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {id.profile.activityLevels[lvl]}
              </button>
            );
          })}
        </div>
      </div>

      <ConditionsChips
        groupId="profile-conditions"
        label={id.profile.fields.conditions}
        value={form.conditions}
        onChange={(v) =>
          setForm({ ...form, conditions: v as Condition[] })
        }
        options={CONDITIONS.map((c) => ({
          value: c,
          label: id.profile.conditions[c],
        }))}
        disabled={submitting}
      />

      <ConditionsChips
        groupId="profile-allergies"
        label={id.profile.fields.allergies}
        value={form.allergies}
        onChange={(v) =>
          setForm({ ...form, allergies: v as Allergy[] })
        }
        options={ALLERGIES.map((a) => ({
          value: a,
          label: id.profile.allergies[a],
        }))}
        disabled={submitting}
      />

      <ConditionsChips
        groupId="profile-goals"
        label={id.profile.fields.goals}
        value={form.goals}
        onChange={(v) =>
          setForm({ ...form, goals: v as DietaryGoal[] })
        }
        options={GOALS.map((g) => ({
          value: g,
          label: id.profile.goals[g],
        }))}
        disabled={submitting}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center px-4 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors min-h-11"
      >
        {submitting ? id.profile.submitting : id.profile.submit}
      </button>
    </form>
  );
}
