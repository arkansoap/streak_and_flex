/** Une tuile « chiffre + libellé ». Le chiffre porte la couleur de texte, jamais celle du streak. */

interface Props {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatTile({ label, value, hint }: Props) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
