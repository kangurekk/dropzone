import fs from "fs/promises";
import path from "path";

const OUT = path.join(process.cwd(), "lib", "csfloat-prices.json");

async function main() {
  console.log("Pobieram pełny cennik z CSFloat...");

  const res = await fetch(
    "https://csfloat.com/api/v1/listings/price-list",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`HTTP ${res.status}:`, text.slice(0, 200));
    process.exit(1);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    console.error("Nieoczekiwany format — nie jest tablicą.");
    console.error(JSON.stringify(data).slice(0, 300));
    process.exit(1);
  }

  console.log(`Otrzymano ${data.length} przedmiotów`);

  // Zbuduj indeks: nazwa → cena w USD
  const prices = {};
  let skipped = 0;

  for (const item of data) {
    const name = item.market_hash_name;
    const priceCents = item.min_price;

    if (!name || typeof priceCents !== "number" || priceCents <= 0) {
      skipped++;
      continue;
    }

    prices[name] = Math.round((priceCents / 100) * 100) / 100;
  }

  await fs.writeFile(OUT, JSON.stringify(prices, null, 2));

  console.log(`Zapisano ${Object.keys(prices).length} cen (pominięto ${skipped})`);
  console.log(`Plik: ${OUT}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});