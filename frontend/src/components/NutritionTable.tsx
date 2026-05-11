const LABELS: Record<string, string> = {
  calories: 'Calories',
  total_fat_g: 'Total Fat (g)',
  saturated_fat_g: 'Saturated Fat (g)',
  trans_fat_g: 'Trans Fat (g)',
  cholesterol_mg: 'Cholesterol (mg)',
  sodium_mg: 'Sodium (mg)',
  total_carbs_g: 'Total Carbs (g)',
  fiber_g: 'Fiber (g)',
  sugar_g: 'Sugar (g)',
  added_sugar_g: 'Added Sugar (g)',
  protein_g: 'Protein (g)',
};

interface Props {
  nutrition: Record<string, number | null>;
}

export default function NutritionTable({ nutrition }: Props) {
  const rows = Object.entries(LABELS).filter(([key]) => {
    const v = nutrition[key];
    return v !== undefined && v !== null;
  });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">No nutrition data extracted.</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([key, label]) => (
          <tr key={key} className="border-b last:border-0">
            <td className="py-2 text-slate-600">{label}</td>
            <td className="py-2 text-right font-medium">{nutrition[key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
