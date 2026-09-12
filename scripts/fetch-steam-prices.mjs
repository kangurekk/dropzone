import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const OUT = path.join(process.cwd(), "lib", "price-index.json");
const FAILED_OUT = path.join(process.cwd(), "lib", "price-failed.json");
const NAMES_FILE = path.join(process.cwd(), "weapon-names.txt");

const DELAY_MS = 8_000;               // 8s between requests
const SAVE_EVERY = 10;
const MAX_NAMES = 0;                  // 0 = all
const NULL_STREAK_LIMIT = 5;          // soft rate limit threshold
const NULL_WAIT_MS = 5 * 60_000;      // wait 5 min on soft limit
const HARD_LIMIT_HITS = 3;            // hard rate limit retries before quit
const HARD_WAIT_MS = 90_000;          // wait on hard rate limit

// ─────────────────────────────────────────────────────────────
// ENCODING — ★ must be percent-encoded for Steam
// ─────────────────────────────────────────────────────────────

function steamEncode(name) {
  return encodeURIComponent(name)
    .replace(/%20/g, "+")
    .replace(/%7C/g, "%7c")
    .replace(/%E2%98%85/g, "%e2%98%85");
}

// ─────────────────────────────────────────────────────────────
// FETCH VIA CURL.EXE
// ─────────────────────────────────────────────────────────────

async function fetchViaCurl(url) {
  try {
    const { stdout } = await execFileAsync(
      "curl.exe",
      [
        "-s",
        "-S",
        "--compressed",
        "--max-time",
        "15",
        "-H",
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "-H",
        "Accept: application/json, text/plain, */*",
        "-H",
        "Accept-Language: en-US,en;q=0.9",
        url,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return { body: stdout, error: null };
  } catch (err) {
    return { body: "", error: err };
  }
}

// ─────────────────────────────────────────────────────────────
// LOAD
// ─────────────────────────────────────────────────────────────

const rawNames = await fs.readFile(NAMES_FILE, "utf-8");
let NAMES = rawNames
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

if (MAX_NAMES > 0) NAMES = NAMES.slice(0, MAX_NAMES);

console.log(`Loaded ${NAMES.length} names`);

let prices = {};
try {
  prices = JSON.parse(await fs.readFile(OUT, "utf-8"));
} catch {}

let failedNames = new Set();
try {
  const arr = JSON.parse(await fs.readFile(FAILED_OUT, "utf-8"));
  if (Array.isArray(arr)) failedNames = new Set(arr);
} catch {}

console.log(`Already cached: ${Object.keys(prices).length} prices`);
console.log(`Already failed: ${failedNames.size} names`);
console.log("");

await fs.writeFile(OUT, JSON.stringify(prices, null, 2));
await fs.writeFile(FAILED_OUT, JSON.stringify([...failedNames], null, 2));

// ─────────────────────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────────────────────

let fetched = 0;
let skipped = 0;
let failed = 0;
let processed = 0;
let rateLimitHits = 0;
let consecutiveNulls = 0;

for (let i = 0; i < NAMES.length; i++) {
  const name = NAMES[i];
  const tag = `[${i + 1}/${NAMES.length}]`;

  if (prices[name] != null) {
    skipped++;
    continue;
  }
  if (failedNames.has(name)) {
    skipped++;
    continue;
  }

  const url =
    "https://steamcommunity.com/market/priceoverview/" +
    `?appid=730&currency=1&market_hash_name=${steamEncode(name)}`;

  const { body, error } = await fetchViaCurl(url);

  if (error) {
    console.error(`${tag} ${name} → curl error: ${error.message}`);
    failedNames.add(name);
    failed++;
    processed++;
    await new Promise((r) => setTimeout(r, DELAY_MS));
    continue;
  }

  let success = false;
  let wasNull = false;

  try {
    const json = JSON.parse(body);

    // ── null response ─────────────────────────────────────
    if (json === null) {
      wasNull = true;
      consecutiveNulls++;
      console.log(
        `${tag} ${name} → null (streak: ${consecutiveNulls}/${NULL_STREAK_LIMIT})`
      );

      if (consecutiveNulls >= NULL_STREAK_LIMIT) {
        console.error(
          `\nSoft rate limit — ${NULL_STREAK_LIMIT} nulls in a row.`
        );
        console.error(
          `Waiting ${NULL_WAIT_MS / 60_000} minutes, then retrying...\n`
        );
        await fs.writeFile(OUT, JSON.stringify(prices, null, 2));
        await fs.writeFile(
          FAILED_OUT,
          JSON.stringify([...failedNames], null, 2)
        );
        await new Promise((r) => setTimeout(r, NULL_WAIT_MS));
        consecutiveNulls = 0;
        i--;
        continue;
      }
    } else if (json.success) {
      consecutiveNulls = 0; // reset on real response
      const raw = json.median_price ?? json.lowest_price ?? null;
      if (raw) {
        const p = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
        if (isFinite(p) && p > 0) {
          prices[name] = p;
          fetched++;
          success = true;
          console.log(`${tag} ${name} → $${p.toFixed(2)}`);
        }
      }
    } else {
      // json.success === false but not null — item not on market
      consecutiveNulls = 0;
    }

    // Detect rate-limit text in body
    if (!success && body.includes("rate limit")) {
      rateLimitHits++;
      console.error(`${tag} HARD RATE LIMIT (hit ${rateLimitHits}/${HARD_LIMIT_HITS})`);

      if (rateLimitHits >= HARD_LIMIT_HITS) {
        console.error("Hit hard rate limit 3 times. Saving and stopping.");
        await fs.writeFile(OUT, JSON.stringify(prices, null, 2));
        await fs.writeFile(
          FAILED_OUT,
          JSON.stringify([...failedNames], null, 2)
        );
        console.log(`\nProgress saved: ${Object.keys(prices).length} prices`);
        process.exit(0);
      }

      console.log(`  waiting ${HARD_WAIT_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, HARD_WAIT_MS));
      i--;
      continue;
    }

    if (!success && !wasNull) {
      console.log(`${tag} ${name} → no price data`);
    }
  } catch {
    const preview = body.slice(0, 200).replace(/\s+/g, " ");
    console.error(`${tag} ${name} → bad JSON`);
    console.error(`  body preview: ${preview}`);

    const looksLikeRateLimit =
      body.includes("<html") ||
      body.includes("<!DOCTYPE") ||
      body.includes("Too Many Requests") ||
      body.includes("Access Denied") ||
      body.toLowerCase().includes("cloudflare") ||
      body.length === 0;

    if (looksLikeRateLimit) {
      rateLimitHits++;
      console.error(`  → rate limit (hit ${rateLimitHits}/${HARD_LIMIT_HITS})`);

      if (rateLimitHits >= HARD_LIMIT_HITS) {
        console.error("Hit 3 rate limits. Saving and stopping.");
        await fs.writeFile(OUT, JSON.stringify(prices, null, 2));
        await fs.writeFile(
          FAILED_OUT,
          JSON.stringify([...failedNames], null, 2)
        );
        console.log(`\nProgress saved: ${Object.keys(prices).length} prices`);
        process.exit(0);
      }

      console.log(`  waiting ${HARD_WAIT_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, HARD_WAIT_MS));
      i--;
      continue;
    }
  }

  // Only add to failed if it wasn't a null (nulls handled above)
  if (!success && !wasNull) {
    failedNames.add(name);
    failed++;
  }

  processed++;

  if (processed % SAVE_EVERY === 0) {
    await fs.writeFile(OUT, JSON.stringify(prices, null, 2));
    await fs.writeFile(FAILED_OUT, JSON.stringify([...failedNames], null, 2));
    console.log(
      `  …saved (${Object.keys(prices).length} prices, ${failedNames.size} failed)\n`
    );
  }

  await new Promise((r) => setTimeout(r, DELAY_MS));
}

// ─────────────────────────────────────────────────────────────
// DONE
// ─────────────────────────────────────────────────────────────

await fs.writeFile(OUT, JSON.stringify(prices, null, 2));
await fs.writeFile(FAILED_OUT, JSON.stringify([...failedNames], null, 2));

console.log("\n──────────────");
console.log(`New prices:      ${fetched}`);
console.log(`Skipped:         ${skipped}`);
console.log(`Failed:          ${failed}`);
console.log(`Total in index:  ${Object.keys(prices).length}`);
console.log(`Total failed:    ${failedNames.size}`);
console.log(`Saved to:`);
console.log(`  ${OUT}`);
console.log(`  ${FAILED_OUT}`);