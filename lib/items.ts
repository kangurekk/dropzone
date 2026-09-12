import type { Item } from "./types";
import rawItems from "./items.json";

export const ITEMS = rawItems as Item[];

export function getItemById(id: string) {
  return (
    ITEMS.find((item) => item.id === id) ??
    ITEMS.find((item) => item.name === id) ??
    null
  );
}