"use client";

import { useEffect, useState } from "react";
import { ITEMS } from "@/lib/items";
import { searchSkins } from "@/lib/prices";
import { CASES } from "@/lib/cases";
import type { Rarity } from "@/lib/cases";

type PickedItem = {
  id: string;
  name: string;
  image?: string;
  price?: number;
  weight: number;
  rarity: Rarity;
  frozen?: boolean;
};

const API_RARITY_MAP: Record<string, Rarity> = {
  "Consumer Grade": "milspec",
  "Industrial Grade": "milspec",
  "Mil-Spec Grade": "milspec",
  Restricted: "restricted",
  Classified: "classified",
  Covert: "covert",
  Contraband: "covert",
  Extraordinary: "exceedingly-rare",
  "Exceedingly Rare": "exceedingly-rare",
  Superior: "classified",
  Remarkable: "restricted",
  "High Grade": "milspec",
  "Base Grade": "milspec",
  Exotic: "classified",
};

const COLOR_TO_RARITY: Record<string, Rarity> = {
  "#b0c3d9": "milspec",
  "#5e98d9": "milspec",
  "#4b69ff": "milspec",
  "#8847ff": "restricted",
  "#d32ce6": "classified",
  "#eb4b4b": "covert",
  "#ffd700": "exceedingly-rare",
  "#e4ae39": "exceedingly-rare",
};

function inferRarity(item: any): Rarity {
  if (typeof item.rarity === "string") {
    const direct = API_RARITY_MAP[item.rarity];
    if (direct) return direct;
  }
  if (item.rarity && typeof item.rarity === "object") {
    const named = API_RARITY_MAP[item.rarity.name];
    if (named) return named;
    const byColor = COLOR_TO_RARITY[(item.rarity.color ?? "").toLowerCase()];
    if (byColor) return byColor;
  }
  const color = (item.color ?? "").toLowerCase();
  if (COLOR_TO_RARITY[color]) return COLOR_TO_RARITY[color];
  return "milspec";
}

function baseNameOf(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\u2605/g, "")
    .trim()
    .toLowerCase();
}

function SkinImage({
  src,
  alt,
  width = 48,
}: {
  src?: string;
  alt: string;
  width?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="grid place-items-center rounded-md border border-[#1b1f2b] bg-[#0e1017] text-[#4f5563]"
        style={{ width, height: width * 0.75, fontSize: width * 0.4 }}
        title={alt}
      >
        ◆
      </div>
    );
  }

  return (
    <div
      className="grid place-items-center rounded-md"
      style={{
        width,
        height: width * 0.75,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
      }}
    >
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        className="skin-img"
      />
    </div>
  );
}

const RARITY_OPTIONS: { value: Rarity; label: string; color: string }[] = [
  { value: "milspec", label: "Mil-Spec", color: "#4b69ff" },
  { value: "restricted", label: "Restricted", color: "#8847ff" },
  { value: "classified", label: "Classified", color: "#d32ce6" },
  { value: "covert", label: "Covert", color: "#eb4b4b" },
  { value: "exceedingly-rare", label: "Exceedingly Rare", color: "#ffd700" },
];

const RARITY_RATES: Record<Rarity, number> = {
  milspec: 79.92,
  restricted: 15.98,
  classified: 3.2,
  covert: 0.64,
  "exceedingly-rare": 0.26,
};

export default function AdminCasesPage() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PickedItem[]>([]);
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});

  const [caseId, setCaseId] = useState("new-case");
  const [caseName, setCaseName] = useState("New Case");
  const [caseDesc, setCaseDesc] = useState("A brand new case");
  const [casePrice, setCasePrice] = useState(10);
  const [caseIcon, setCaseIcon] = useState("📦");
  const [caseGlow, setCaseGlow] = useState("#8b5cf6");

  const [loadedCaseId, setLoadedCaseId] = useState<string>("");
  const [rtp, setRtp] = useState(95);

  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const parts = query.split("|");
      const searchTerm = (parts[1] ?? parts[0]).trim();

      let res = await searchSkins(searchTerm);

      if (parts.length > 1 && parts[0].trim()) {
        const weapon = parts[0].trim().toLowerCase();
        res = res.filter((r) =>
          r.marketHashName.toLowerCase().startsWith(weapon)
        );
      }

      setResults(res);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const totalWeight = picked.reduce((sum, p) => sum + p.weight, 0) || 1;

  const missingPrices = picked.filter((p) => p.price == null).length;

  const ev = picked.reduce((sum, p) => {
    const price = p.price ?? 0;
    const chance = p.weight / totalWeight;
    return sum + price * chance;
  }, 0);

  const optimalPrice = rtp > 0 ? ev / (rtp / 100) : 0;
  const margin = casePrice - ev;
  const marginPct = casePrice > 0 ? (margin / casePrice) * 100 : 0;

  function applyPrice(ids: string[], price: number) {
    setPicked((current) =>
      current.map((x) => (ids.includes(x.id) ? { ...x, price } : x))
    );
  }

  function addItemFromSearch(result: any) {
    const id = result.marketHashName ?? result.name;
    if (!id) return;
    if (picked.some((p) => p.id === id)) return;

    const base = baseNameOf(id);
    const catalogItem = ITEMS.find((it) => baseNameOf(it.name) === base);
    const displayName = catalogItem?.name ?? id;

    setPicked([
      ...picked,
      {
        id: displayName,
        name: displayName,
        image: catalogItem?.image ?? result.image,
        price: typeof result.price === "number" ? result.price : undefined,
        weight: 1,
        rarity: inferRarity({ rarity: result.rarity }),
      },
    ]);
  }

  function removeItem(id: string) {
    setPicked(picked.filter((p) => p.id !== id));
  }

  function updateRarity(id: string, rarity: Rarity) {
    setPicked(picked.map((p) => (p.id === id ? { ...p, rarity } : p)));
  }

  function toggleFreeze(id: string) {
    setPicked(picked.map((p) => (p.id === id ? { ...p, frozen: !p.frozen } : p)));
  }

  function setPercent(id: string, pct: number) {
    if (!isFinite(pct) || pct < 0 || pct >= 100) return;

    const item = picked.find((x) => x.id === id);
    if (!item || item.frozen) return;

    const T = picked.reduce((sum, x) => sum + x.weight, 0);
    const newWX = (pct / 100) * T;

    const frozenWeight = picked
      .filter((x) => x.id !== id && x.frozen)
      .reduce((sum, x) => sum + x.weight, 0);

    const remaining = T - newWX - frozenWeight;
    if (remaining < 0) return;

    const freeItems = picked.filter((x) => x.id !== id && !x.frozen);
    const freeTotal = freeItems.reduce((sum, x) => sum + x.weight, 0);

    setPicked(
      picked.map((x) => {
        if (x.id === id) return { ...x, weight: newWX };
        if (x.frozen) return x;
        if (freeItems.length === 0) return x;
        if (freeTotal === 0) {
          return { ...x, weight: remaining / freeItems.length };
        }
        return { ...x, weight: (x.weight / freeTotal) * remaining };
      })
    );
  }

  function applyRealOdds() {
    const tiers: Record<Rarity, PickedItem[]> = {
      milspec: [],
      restricted: [],
      classified: [],
      covert: [],
      "exceedingly-rare": [],
    };
    picked.forEach((p) => tiers[p.rarity].push(p));

    const next = picked.map((p) => {
      const count = tiers[p.rarity].length;
      if (count === 0) return p;
      const perItem = RARITY_RATES[p.rarity] / count;
      return { ...p, weight: Number(perItem.toFixed(6)) };
    });
    setPicked(next);
  }

  async function loadCase(id: string) {
    setLoadedCaseId(id);
    if (!id) return;

    const source = CASES.find((c) => c.id === id);
    if (!source) return;

    setCaseId(source.id);
    setCaseName(source.name);
    setCaseDesc(source.description);
    setCasePrice(source.price);
    setCaseIcon(source.icon);
    setCaseGlow(source.glow);

    const rebuilt: PickedItem[] = source.rewards.flatMap((r) => {
      const item = ITEMS.find((i) => i.id === r.itemId);
      if (!item) return [];
      return [
        {
          id: item.id,
          name: item.name,
          image: item.image,
          weight: r.weight,
          rarity: r.rarity ?? inferRarity(item),
        },
      ];
    });

    setPicked(rebuilt);
    setPercentInputs({});

    const missing = source.rewards.length - rebuilt.length;
    if (missing > 0) {
      alert(
        `Loaded "${source.name}" but ${missing} item(s) couldn't be found in the catalog.`
      );
    }

    const groups = new Map<string, PickedItem[]>();
    for (const p of rebuilt) {
      const base = baseNameOf(p.name);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base)!.push(p);
    }

    console.log("[loadCase] searching", groups.size, "unique skins");

    for (const [base, items] of groups) {
      try {
        const [weaponPart, ...nameParts] = base.split("|");
        const weapon = weaponPart.trim();
        const skinName = nameParts.join(" ").trim() || weapon;

        const res = await searchSkins(skinName);
        console.log(
          `[loadCase] "${skinName}" (weapon "${weapon}") →`,
          res.length,
          "results"
        );

        const match = res.find((r) => baseNameOf(r.marketHashName) === base);

        if (!match) {
          const fallback = res.find(
            (r) =>
              baseNameOf(r.marketHashName).split("|")[1]?.trim() === skinName
          );
          if (!fallback) {
            console.warn(`[loadCase] no match for "${base}"`);
            continue;
          }
          applyPrice(
            items.map((i) => i.id),
            fallback.price
          );
          continue;
        }

        applyPrice(
          items.map((i) => i.id),
          match.price
        );
      } catch (err) {
        console.warn("[loadCase] search failed for", base, err);
      }
    }
  }

  function resetBuilder() {
    setLoadedCaseId("");
    setCaseId("new-case");
    setCaseName("New Case");
    setCaseDesc("A brand new case");
    setCasePrice(10);
    setCaseIcon("📦");
    setCaseGlow("#8b5cf6");
    setPicked([]);
    setPercentInputs({});
    setQuery("");
  }

  const exportedJson = JSON.stringify(
    {
      id: caseId,
      name: caseName,
      description: caseDesc,
      price: casePrice,
      icon: caseIcon,
      glow: caseGlow,
      rewards: picked.map((p) => ({
        itemId: p.id,
        weight: p.weight,
        rarity: p.rarity,
        price: p.price,
      })),
    },
    null,
    2
  );

  function copyJson() {
    navigator.clipboard.writeText(exportedJson);
    alert("Copied! Paste into CASES in lib/cases.ts");
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-10 flex items-end justify-between border-b border-[#181c26] pb-6">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">
            Case Builder
          </h1>
          <p className="mt-2 text-[11px] text-[#737887]">
            {loadedCaseId
              ? `Editing "${caseName}" — copy the JSON to save.`
              : "Create a new case, or load an existing one to edit."}
          </p>
        </div>

        <div className="rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-4 py-2">
          <div className="text-[8px] font-extrabold tracking-[1.2px] text-[#4f5563]">
            PICKED
          </div>
          <div className="mt-1 text-[14px] font-bold">
            {picked.length} items
          </div>
        </div>
      </header>

      <section className="mb-10">
        <SectionTitle>Load case</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={loadedCaseId}
            onChange={(e) => loadCase(e.target.value)}
            className="admin-input"
            style={{ maxWidth: 320 }}
          >
            <option value="">— New case —</option>
            {CASES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name} — ${c.price}
              </option>
            ))}
          </select>

          {loadedCaseId && (
            <button
              onClick={resetBuilder}
              className="rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 py-2 text-[10px] font-bold text-[#737887] transition hover:bg-[#141824] hover:text-white"
            >
              Clear
            </button>
          )}

          {loadedCaseId && (
            <span className="text-[10px] text-[#eab308]">
              ⚠ Paste the copied JSON over the existing case in{" "}
              <code className="text-[#a78bfa]">lib/cases.ts</code>
            </span>
          )}
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle>Case info</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="ID">
            <input
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Name">
            <input
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Price">
            <input
              type="number"
              value={casePrice}
              onChange={(e) => setCasePrice(Number(e.target.value))}
              className="admin-input"
            />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <input
              value={caseDesc}
              onChange={(e) => setCaseDesc(e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Icon">
            <input
              value={caseIcon}
              onChange={(e) => setCaseIcon(e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Glow color">
            <div className="flex gap-2">
              <input
                type="color"
                value={caseGlow}
                onChange={(e) => setCaseGlow(e.target.value)}
                className="h-[38px] w-[50px] cursor-pointer rounded-md border border-[#1b1f2b] bg-[#0e1017]"
              />
              <input
                value={caseGlow}
                onChange={(e) => setCaseGlow(e.target.value)}
                className="admin-input flex-1"
              />
            </div>
          </Field>
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle>Search items</SectionTitle>
        <input
          placeholder="Type at least 2 characters…  e.g. 'redline' or 'asiimov'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="admin-input"
        />

        {query.length >= 2 && (
          <div className="mt-3 max-h-[340px] overflow-y-auto rounded-xl border border-[#1b1f2b] bg-[#0b0d13]">
            {searching && (
              <div className="p-4 text-[11px] text-[#737887]">
                Searching…
              </div>
            )}

            {!searching && results.length === 0 && (
              <div className="p-4 text-[11px] text-[#737887]">
                No matches.
              </div>
            )}

            {results.map((r, i) => {
              const id = r.marketHashName ?? r.name;
              const isPicked = picked.some(
                (p) => baseNameOf(p.name) === baseNameOf(id)
              );
              const rarity = inferRarity({ rarity: r.rarity });
              const rarityColor =
                RARITY_OPTIONS.find((x) => x.value === rarity)?.color ??
                "#8b5cf6";

              const catalogItem = ITEMS.find(
                (it) => baseNameOf(it.name) === baseNameOf(id)
              );

              return (
                <button
                  key={`${id}-${i}`}
                  onClick={() => addItemFromSearch(r)}
                  disabled={isPicked}
                  className={`flex w-full items-center gap-3 border-b border-[#14171f] px-4 py-3 text-left transition last:border-b-0 ${
                    isPicked
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-white/[0.025]"
                  }`}
                >
                  <SkinImage src={catalogItem?.image} alt={id} width={56} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold">
                      {id}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#a78bfa]">
                      ${(r.price ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <span
                    className="rounded-md border px-2 py-1 text-[9px] font-bold uppercase"
                    style={{
                      color: rarityColor,
                      borderColor: `${rarityColor}44`,
                      background: `${rarityColor}11`,
                    }}
                  >
                    {rarity.replace("-", " ")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionTitle>Case economics</SectionTitle>

        {missingPrices > 0 && (
          <div className="mb-3 rounded-lg border border-[#3a2a1a] bg-[#1a1408] px-3 py-2 text-[11px] text-[#eab308]">
            ⚠ {missingPrices} item{missingPrices === 1 ? "" : "s"} have no
            price. EV is underestimated.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Expected value"
            value={`$${ev.toFixed(2)}`}
            hint="Avg. return per open"
          />
          <Stat
            label="Suggested price"
            value={`$${optimalPrice.toFixed(2)}`}
            hint={`At ${rtp}% RTP`}
            highlight
          />
          <Stat
            label="Your price"
            value={`$${casePrice.toFixed(2)}`}
            hint="What you charge"
          />
          <Stat
            label="Margin"
            value={`$${margin.toFixed(2)}`}
            hint={`${marginPct.toFixed(1)}% per open`}
            color={margin >= 0 ? "#4ade80" : "#eb4b4b"}
          />
        </div>

        <div className="mt-4 flex items-center gap-4">
          <label className="text-[10px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
            Target RTP
          </label>
          <input
            type="range"
            min={80}
            max={100}
            step={1}
            value={rtp}
            onChange={(e) => setRtp(Number(e.target.value))}
            className="flex-1 accent-[#8b5cf6]"
          />
          <span className="w-[60px] text-right text-[12px] font-bold text-[#a78bfa]">
            {rtp}%
          </span>

          <button
            onClick={() => setCasePrice(Number(optimalPrice.toFixed(2)))}
            disabled={picked.length === 0}
            className="rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-3 py-2 text-[10px] font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply suggested price
          </button>
        </div>

        <p className="mt-3 text-[10px] leading-[1.6] text-[#4f5563]">
          RTP = what fraction of the case price the player gets back on
          average. Real sites run 85–95%. Lower RTP = bigger house edge.
        </p>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Items in this case ({picked.length})</SectionTitle>

          {picked.length > 0 && (
            <button
              onClick={applyRealOdds}
              className="rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-3 py-2 text-[10px] font-extrabold text-white shadow-[0_8px_24px_rgba(109,63,224,0.22)] transition hover:brightness-110"
            >
              Apply real Valve odds
            </button>
          )}
        </div>

        {picked.length === 0 ? (
          <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] text-[11px] text-[#4f5563]">
            Nothing added yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#1b1f2b] bg-[#0b0d13]">
            <div className="grid grid-cols-[1fr_140px_90px_130px_40px_40px] items-center gap-3 border-b border-[#1b1f2b] bg-[#0e1017] px-4 py-2 text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
              <div>Item</div>
              <div>Rarity</div>
              <div className="text-right">Price</div>
              <div className="text-right">Chance %</div>
              <div></div>
              <div></div>
            </div>

            {picked.map((p) => {
              const chance = (p.weight / totalWeight) * 100;
              const rarityColor =
                RARITY_OPTIONS.find((r) => r.value === p.rarity)?.color ??
                "#8b5cf6";

              const inputValue = percentInputs[p.id] ?? chance.toFixed(4);

              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_140px_90px_130px_40px_40px] items-center gap-3 border-b border-[#14171f] px-4 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <SkinImage src={p.image} alt={p.name} width={44} />
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold">
                        {p.name}
                      </div>
                      <div className="truncate text-[9px] text-[#4f5563]">
                        {p.id}
                      </div>
                    </div>
                  </div>

                  <select
                    value={p.rarity}
                    onChange={(e) =>
                      updateRarity(p.id, e.target.value as Rarity)
                    }
                    className="admin-input"
                    style={{ color: rarityColor }}
                  >
                    {RARITY_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>

                  <div className="text-right font-mono text-[11px]">
                    {p.price != null ? (
                      <span style={{ color: "#a78bfa" }}>
                        ${p.price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[#4f5563]">—</span>
                    )}
                  </div>

                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="99.9999"
                    value={inputValue}
                    disabled={p.frozen}
                    onChange={(e) =>
                      setPercentInputs((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      const raw = percentInputs[p.id];
                      if (raw != null && raw !== "") {
                        const pct = parseFloat(raw);
                        if (!isNaN(pct)) setPercent(p.id, pct);
                      }
                      setPercentInputs((prev) => {
                        const next = { ...prev };
                        delete next[p.id];
                        return next;
                      });
                    }}
                    className={`admin-input text-right ${
                      p.frozen ? "opacity-50" : ""
                    }`}
                    style={{ color: rarityColor }}
                  />

                  <button
                    onClick={() => toggleFreeze(p.id)}
                    className={`rounded-md border py-1 text-[12px] transition ${
                      p.frozen
                        ? "border-[#8b5cf6]/40 bg-[#8b5cf6]/10 text-[#a78bfa]"
                        : "border-[#1b1f2b] bg-[#0e1017] text-[#4f5563] hover:text-white"
                    }`}
                    title={p.frozen ? "Unfreeze chance" : "Freeze chance"}
                  >
                    {p.frozen ? "🔒" : "🔓"}
                  </button>

                  <button
                    onClick={() => removeItem(p.id)}
                    className="rounded-md border border-[#2a1e2e] bg-[#1a0f1a] py-1 text-[13px] text-[#eb4b4b] transition hover:bg-[#2a0f1a]"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Export</SectionTitle>
          <button
            onClick={copyJson}
            disabled={picked.length === 0}
            className="rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-4 py-2 text-[11px] font-extrabold text-white shadow-[0_10px_30px_rgba(109,63,224,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copy JSON
          </button>
        </div>

        <pre className="max-h-[400px] overflow-auto rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-4 text-[11px] leading-[1.6] text-[#a78bfa]">
          {exportedJson}
        </pre>
      </section>

      <style jsx global>{`
        .admin-input {
          width: 100%;
          height: 38px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #1b1f2b;
          background: #0e1017;
          color: #f4f5f7;
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .admin-input:focus {
          border-color: #8b5cf6;
        }
        .admin-input option {
          background: #0e1017;
          color: #f4f5f7;
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
      {children}
    </h2>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({
  label,
  value,
  hint,
  color,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-[#8b5cf6]/40 bg-gradient-to-br from-[#8b5cf6]/10 to-transparent"
          : "border-[#1b1f2b] bg-[#0e1017]"
      }`}
    >
      <div className="text-[8px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
        {label}
      </div>
      <div
        className="mt-2 text-[18px] font-bold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[9px] text-[#737887]">{hint}</div>}
    </div>
  );
}