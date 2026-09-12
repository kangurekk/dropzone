import type { Item } from "./types";

export type Rarity =
  | "milspec"
  | "restricted"
  | "classified"
  | "covert"
  | "exceedingly-rare";

export type CaseReward = {
  itemId: string;
  weight: number;
  rarity: Rarity;
  price?: number;
};

export type CaseData = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  glow: string;
  rewards: CaseReward[];
};

export const CASES: CaseData[] = [
{
  "id": "sniper",
  "name": "Sniper Case",
  "description": "nasz chlopaczek",
  "price": 2.88,
  "icon": "🎯",
  "glow": "#087500",
  "rewards": [
    { "itemId": "skin-db4de1c248fa", "weight": 0.0037624966495577424, "rarity": "covert", "price": 46.23 },
    { "itemId": "skin-7b1ef066823d", "weight": 0.0038891018301810825, "rarity": "covert", "price": 35 },
    { "itemId": "skin-f787cc672771", "weight": 0.004240201300961318, "rarity": "covert", "price": 35.81 },
    { "itemId": "skin-3a4cc2c7a86f", "weight": 0.004294216604158276, "rarity": "covert", "price": 28.02 },

    { "itemId": "skin-5c4c6649f0ba", "weight": 0.0037360584711230275, "rarity": "classified", "price": 41.82 },
    { "itemId": "skin-b712400e97a9", "weight": 0.005379023943363879, "rarity": "classified", "price": 34.91 },
    { "itemId": "skin-d0203eae8335", "weight": 0.00605421523332587, "rarity": "classified", "price": 27.39 },
    { "itemId": "skin-d85f6159fe4a", "weight": 0.5448793709993283, "rarity": "classified", "price": 14.22 },
    { "itemId": "skin-f2cdadd8b557", "weight": 0.5470399831272069, "rarity": "classified", "price": 17.35 },
    { "itemId": "skin-a5be0877a3d7", "weight": 0.7779779106705408, "rarity": "classified", "price": 7.84 },
    { "itemId": "skin-c41637779316", "weight": 1.2648583498621344, "rarity": "classified", "price": 4.27 },

    { "itemId": "skin-665b5d16532c", "weight": 0.004339229356822411, "rarity": "restricted", "price": 25 },
    { "itemId": "skin-860a0652d07a", "weight": 0.599839942002235, "rarity": "restricted", "price": 2.26 },
    { "itemId": "skin-a89bff508437", "weight": 0.819952302529845, "rarity": "restricted", "price": 4.44 },
    { "itemId": "skin-78882aeeb9a7", "weight": 1.4729433028778882, "rarity": "restricted", "price": 2.54 },
    { "itemId": "skin-c97e27944006", "weight": 2.140608460594439, "rarity": "restricted", "price": 2.89 },

    { "itemId": "skin-05f333baf59c", "weight": 0.004034943148812874, "rarity": "milspec", "price": 2.36 },
    { "itemId": "skin-29f83d73bb6a", "weight": 0.5016455223204825, "rarity": "milspec", "price": 0.40 },
    { "itemId": "skin-be9ae71d9e43", "weight": 0.004904931214184316, "rarity": "milspec", "price": 0.45 },
    { "itemId": "skin-8d7feec0f6e3", "weight": 8.88243310208729, "rarity": "milspec", "price": 0.35 }
  ]
}]

export const RARITY_COLORS: Record<Rarity, string> = {
  milspec: "#4b69ff",
  restricted: "#8847ff",
  classified: "#d32ce6",
  covert: "#eb4b4b",
  "exceedingly-rare": "#ffd700",
};

export function getOdds(rewards: CaseReward[]) {
  const total = rewards.reduce((sum, r) => sum + r.weight, 0);
  return rewards.map((r) => ({
    ...r,
    chance: (r.weight / total) * 100,
  }));
}

export function getCaseById(id: string) {
  return CASES.find((c) => c.id === id) ?? null;
}