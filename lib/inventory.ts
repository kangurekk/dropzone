export type InventoryItem = {
  uid: string;
  id: string;
  name: string;
  image?: string;
  color?: string;
  rarity?: string;
  price: number;
  droppedAt: number;
};

export type NewInventoryItem = Omit<InventoryItem, "uid" | "droppedAt">;