import fs from "fs/promises";
import path from "path";

const ITEMS_PATH = path.join(process.cwd(), "lib", "items.json");
const OUT = path.join(process.cwd(), "weapon-names.txt");

const items = JSON.parse(await fs.readFile(ITEMS_PATH, "utf-8"));

// Keep only weapons, knives, gloves
const ALLOWED = new Set([
  "weapon", "weapons",
  "rifle", "rifles",
  "pistol", "pistols",
  "smg", "smgs",
  "heavy", "shotgun", "shotguns", "mg", "machinegun",
  "knife", "knives",
  "glove", "gloves",
]);

const filtered = items.filter((item) => {
  const cat = String(item.category ?? "").toLowerCase();
  return ALLOWED.has(cat);
});

console.log(`Total items: ${items.length}`);
console.log(`Weapons/knives/gloves: ${filtered.length}`);

// Group by category for sanity
const counts = {};
for (const i of filtered) {
  const c = i.category ?? "unknown";
  counts[c] = (counts[c] ?? 0) + 1;
}
console.log("Categories:", counts);

// Write one name per line
await fs.writeFile(OUT, filtered.map((i) => i.name).join("\n"), "utf-8");
console.log(`Written to ${OUT}`);