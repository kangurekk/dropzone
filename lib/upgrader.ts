export type Multiplier = 1.5 | 2 | 5 | 10;

export const MULTIPLIERS: { value: Multiplier; label: string; odds: number }[] =
  [
    { value: 1.5, label: "1.5x", odds: 60 },
    { value: 2, label: "2x", odds: 40 },
    { value: 5, label: "5x", odds: 18 },
    { value: 10, label: "10x", odds: 9 },
  ];

export function isValidMultiplier(v: any): v is Multiplier {
  return v === 1.5 || v === 2 || v === 5 || v === 10;
}

export function oddsFor(m: Multiplier): number {
  return MULTIPLIERS.find((x) => x.value === m)?.odds ?? 0;
}