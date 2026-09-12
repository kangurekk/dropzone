import fs from "fs";

const res = await fetch(
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json"
);
const skins = await res.json();

// Map CS2 rarity names to your own rarity keys
const rarityMap = {
  "Consumer Grade": "consumer",
  "Industrial Grade": "industrial",
  "Mil-Spec Grade": "milspec",
  "Restricted": "restricted",
  "Classified": "classified",
  "Covert": "covert",
  "Contraband": "contraband",
  "Extraordinary": "special",
};

const items = skins.map((skin) => ({
  id: skin.id,
  name: skin.name, // e.g. "AK-47 | Redline (Field-Tested)"
  category: skin.category?.name?.toLowerCase() ?? "other",
  rarity: rarityMap[skin.rarity?.name] ?? "consumer",
  color: skin.rarity?.color ?? "#b0c3d9",
  image: skin.image,
  description: `${skin.weapon?.name ?? ""} skin`.trim(),
  price: 0, // we’ll fill this at runtime
}));

fs.writeFileSync("lib/items.json", JSON.stringify(items, null, 2));
console.log(`Wrote ${items.length} items to lib/items.json`);