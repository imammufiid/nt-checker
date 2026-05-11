const LABELS: Record<string, string> = {
  calories: 'Kalori',
  total_fat_g: 'Lemak Total (g)',
  saturated_fat_g: 'Lemak Jenuh (g)',
  trans_fat_g: 'Lemak Trans (g)',
  cholesterol_mg: 'Kolesterol (mg)',
  sodium_mg: 'Garam / Natrium (mg)',
  total_carbs_g: 'Karbohidrat Total (g)',
  fiber_g: 'Serat (g)',
  sugar_g: 'Gula (g)',
  added_sugar_g: 'Gula Tambahan (g)',
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
      <p className="text-sm text-slate-500">
        Data gizi tidak berhasil dibaca dari foto.
      </p>
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
