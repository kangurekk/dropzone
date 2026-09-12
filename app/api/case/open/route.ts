import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { CASES, type CaseReward } from "@/lib/cases";
import { getItemById } from "@/lib/items";

type CaseRewardWithPrice = CaseReward & { price?: number };

function pickWeighted(
  rewards: CaseRewardWithPrice[]
): CaseRewardWithPrice | null {
  const total = rewards.reduce((s, r) => s + r.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const r of rewards) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return rewards[rewards.length - 1] ?? null;
}

export async function POST(request: Request) {
  console.log("[case/open] ===== REQUEST START =====");

  const user = await getSessionUser();
  if (!user) {
    console.log("[case/open] not logged in");
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const caseId = typeof body.caseId === "string" ? body.caseId : null;
  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  }

  const caseData = CASES.find((c) => c.id === caseId);
  if (!caseData) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  try {
    const before = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(user.id) as { balance: number };
    console.log("[case/open] balance BEFORE:", before.balance);

    const result = db.transaction(() => {
      const u = db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(user.id) as { balance: number };

      if (u.balance < caseData.price) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const winnerReward = pickWeighted(caseData.rewards);
      if (!winnerReward) throw new Error("EMPTY_CASE");

      const winner = getItemById(winnerReward.itemId);
      if (!winner) throw new Error("ITEM_NOT_FOUND");

      const itemPrice = winnerReward.price ?? winner.price ?? 0;
      const now = Date.now();

      const updateResult = db.prepare(
        `UPDATE users
         SET balance = balance - ?,
             cases_opened = cases_opened + 1,
             total_wagered = total_wagered + ?,
             total_won = total_won + ?
         WHERE id = ?`
      ).run(caseData.price, caseData.price, itemPrice, user.id);

      console.log(
        "[case/open] UPDATE users → changes:",
        updateResult.changes,
        "new balance should be:",
        u.balance - caseData.price
      );

      const inv = db
        .prepare(
          `INSERT INTO inventory
           (user_id, item_id, name, image, color, rarity, price, dropped_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          user.id,
          winner.id,
          winner.name,
          winner.image ?? null,
          winner.color ?? null,
          winner.rarity ?? null,
          itemPrice,
          now
        );

      console.log("[case/open] INSERT inventory id:", inv.lastInsertRowid);

      db.prepare(
        `INSERT INTO case_openings
         (user_id, case_id, case_name, item_name, item_price, opened_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(user.id, caseData.id, caseData.name, winner.name, itemPrice, now);
      

      return {
        winner: {
          uid: String(inv.lastInsertRowid),
          id: winner.id,
          name: winner.name,
          image: winner.image,
          color: winner.color,
          rarity: winner.rarity,
          price: itemPrice,
          droppedAt: now,
        },
        newBalance: u.balance - caseData.price,
        spent: caseData.price,
        itemPrice,
      };
    })();

    const after = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(user.id) as { balance: number };
    console.log("[case/open] balance AFTER:", after.balance);
    console.log("[case/open] ===== REQUEST END =====");

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[case/open] ERROR:", err);
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Not enough balance" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}