export const NIVELES = [
  { min: 0, max: 99, label: 'Bronce', color: '#CD7F32' },
  { min: 100, max: 199, label: 'Plata', color: '#C0C0C0' },
  { min: 200, max: 499, label: 'Oro', color: '#FFD700' },
  { min: 500, max: Infinity, label: 'Platino', color: '#E5E4E2' },
] as const;

export function getNivelLoyalty(total: number): { label: string; color: string } {
  for (const nivel of NIVELES) {
    if (total >= nivel.min && total <= nivel.max) {
      return { label: nivel.label, color: nivel.color };
    }
  }
  return { label: 'Platino', color: '#E5E4E2' };
}

export function getProgressPercent(total: number): number {
  if (total >= 500) return 100;
  return total % 100;
}
