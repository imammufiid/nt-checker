interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  label: string;
  /** DOM id of the wrapping group (used to associate labels via aria-labelledby). */
  groupId: string;
  disabled?: boolean;
}

/**
 * Multi-select chips. Reused 3x in ProfileForm — conditions, allergies, goals.
 * Chips toggle on click. Selected = emerald-filled; unselected = neutral outline.
 */
export default function ConditionsChips({
  value,
  onChange,
  options,
  label,
  groupId,
  disabled,
}: Props) {
  const toggle = (v: string) => {
    if (disabled) return;
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  return (
    <div className="space-y-2">
      <div id={`${groupId}-label`} className="text-sm font-medium text-slate-700">
        {label}
      </div>
      <div
        role="group"
        aria-labelledby={`${groupId}-label`}
        className="flex flex-wrap gap-2"
      >
        {options.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              disabled={disabled}
              aria-pressed={selected}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-9 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                selected
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
