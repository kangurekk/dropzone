export type Risk = "low" | "medium" | "high";
export type Rows = 8 | 12 | 16;

export const MULTIPLIERS: Record<Risk, Record<Rows, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    16: [
      16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9,
      16,
    ],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [
      110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41,
      110,
    ],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    16: [
      1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130,
      1000,
    ],
  },
};

// Simulate a plinko drop — returns slot index and multiplier
export function rollPlinko(
  risk: Risk,
  rows: Rows
): { slot: number; multiplier: number } {
  const table = MULTIPLIERS[risk][rows];
  let pos = 0;
  for (let i = 0; i < rows; i++) {
    if (Math.random() < 0.5) pos++;
  }
  return { slot: pos, multiplier: table[pos] };
}

export function isValidRisk(v: any): v is Risk {
  return v === "low" || v === "medium" || v === "high";
}

export function isValidRows(v: any): v is Rows {
  return v === 8 || v === 12 || v === 16;
}