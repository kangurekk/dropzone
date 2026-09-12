export type ItemCategory =
  | "agent"
  | "charm"
  | "sticker"
  | "patch"
  | "graffiti"
  | "music-kit"
  | "collectible";

export type ItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "restricted"
  | "classified"
  | "epic"
  | "legendary"
  | "mythic"
  | "special";

export type Item = {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  price: number;
  color?: string;
  image?: string;
  description?: string;
};