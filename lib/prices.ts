import csfloatPrices from "@/lib/csfloat-prices.json";

const CSFLOAT_PRICES = csfloatPrices as Record<string, number>;

// ─────────────────────────────────────────────────────────────
// NAME NORMALIZATION — strip wear + ★
// ─────────────────────────────────────────────────────────────

const WEAR_SUFFIX =
  /\s*\(\s*(factory new|minimal wear|field-tested|well-worn|battle-scarred|fn|mw|ft|ww|bs)\s*\)\s*$/i;

function baseNameOf(name: string): string {
  return name
    .toLowerCase()
    .replace(WEAR_SUFFIX, "")
    .replace(/\u2605/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// PRICE INDEX — pre-built for fast lookups
// ─────────────────────────────────────────────────────────────

const exactIndex: Record<string, number> = CSFLOAT_PRICES;

const baseIndex: Record<string, number> = (() => {
  const idx: Record<string, number> = {};
  for (const [name, price] of Object.entries(CSFLOAT_PRICES)) {
    const key = baseNameOf(name);
    // Keep the cheapest wear (safer default for EV math)
    if (idx[key] == null || price < idx[key]) {
      idx[key] = price;
    }
  }
  return idx;
})();

console.log(
  `[prices] loaded ${Object.keys(exactIndex).length} exact, ${Object.keys(baseIndex).length} base names`
);

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

export function getPrice(name: string): number | null {
  // 1. Exact match
  if (exactIndex[name] != null) return exactIndex[name];

  // 2. Base-name match (ignores wear + star)
  const base = baseNameOf(name);
  if (baseIndex[base] != null) return baseIndex[base];

  return null;
}

// ─────────────────────────────────────────────────────────────
// SEARCH — used by admin case builder
// ─────────────────────────────────────────────────────────────

export type SkinSearchResult = {
  name: string;
  marketHashName: string;
  price: number;
  rarity: string;
  image?: string;
};

export async function searchSkins(query: string): Promise<SkinSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const q = query.toLowerCase().trim();
  const results: SkinSearchResult[] = [];

  for (const [name, price] of Object.entries(CSFLOAT_PRICES)) {
    if (name.toLowerCase().includes(q)) {
      results.push({
        name,
        marketHashName: name,
        price,
        rarity: "",
      });
      if (results.length >= 50) break;
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// DEBUG (safe to leave in)
// ─────────────────────────────────────────────────────────────

export function getPriceIndexSize() {
  return Object.keys(exactIndex).length;
}