import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { getItemById } from "@/lib/items";
import { getPrice } from "@/lib/prices";
import { isValidMultiplier, oddsFor } from "@/lib/upgrader";
import { enforceLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  // ── Rate limit: 20 upgrade'ów na minutę per user ─────────────
  const blocked = enforceLimit(`upgrade:${user.id}`, 20, 60_000);
  if (blocked) return blocked;

  const body = await request.json();
  const { inventoryId, targetItemId, multiplier } = body;

  if (
    typeof inventoryId !== "string" ||
    typeof targetItemId !== "string" ||
    !isValidMultiplier(multiplier)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const target = getItemById(targetItemId);
  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  // ── Serwer sam ustala cenę targetu — NIE ufamy klientowi ─────
  // Wcześniej `body.targetPrice` przychodziło od klienta i było
  // tylko sanity-checkowane, co pozwalało wysłać targetPrice: 5000
  // przy tanim itemie i wygrać fałszywą wartość.
  const serverTargetPrice = getPrice(target.name);
  if (serverTargetPrice == null || serverTargetPrice <= 0) {
    return NextResponse.json(
      { error: "Target has no known price" },
      { status: 400 }
    );
  }

  const odds = oddsFor(multiplier);

  try {
    const result = db.transaction(() => {
      const staked = db
        .prepare(
          `SELECT id, item_id, name, image, color, rarity, price
           FROM inventory WHERE id = ? AND user_id = ?`
        )
        .get(parseInt(inventoryId, 10), user.id) as
        | {
            id: number;
            item_id: string;
            name: string;
            image: string | null;
            color: string | null;
            rarity: string | null;
            price: number;
          }
        | undefined;

      if (!staked) throw new Error("ITEM_NOT_FOUND");

      // ── Sprawdź czy target jest odpowiednio droższy ──────────
      // target >= staked * multiplier (z tolerancją 5% na wahania cen)
      const minTarget = staked.price * multiplier * 0.95;
      if (serverTargetPrice < minTarget) {
        throw new Error("TARGET_TOO_LOW");
      }

      const win = Math.random() * 100 < odds;
      const now = Date.now();

      // Remove staked item always
      db.prepare("DELETE FROM inventory WHERE id = ?").run(staked.id);

      let wonItem: any = null;

      if (win) {
        const inv = db
          .prepare(
            `INSERT INTO inventory
             (user_id, item_id, name, image, color, rarity, price, dropped_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            user.id,
            target.id,
            target.name,
            target.image ?? null,
            target.color ?? null,
            target.rarity ?? null,
            serverTargetPrice,
            now
          );

        wonItem = {
          uid: String(inv.lastInsertRowid),
          id: target.id,
          name: target.name,
          image: target.image,
          color: target.color,
          rarity: target.rarity,
          price: serverTargetPrice,
          droppedAt: now,
        };
      }

      db.prepare(
        `UPDATE users
         SET total_wagered = total_wagered + ?,
             total_won = total_won + ?
         WHERE id = ?`
      ).run(staked.price, win ? serverTargetPrice : 0, user.id);

      return { win, wonItem, stakedUid: String(staked.id) };
    })();

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[upgrade] ERROR:", err);
    if (err.message === "ITEM_NOT_FOUND") {
      return NextResponse.json(
        { error: "Item not in inventory" },
        { status: 400 }
      );
    }
    if (err.message === "TARGET_TOO_LOW") {
      return NextResponse.json(
        { error: "Target too cheap" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}