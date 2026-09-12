import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    console.log("[users/username] START");

    const viewer = await getSessionUser();
    console.log("[users/username] viewer:", viewer?.id ?? null);

    if (!viewer) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { username } = await params;
    console.log("[users/username] username param:", username);

    const uname = username.toLowerCase();

    const u = db
      .prepare(
        `SELECT id, username, avatar, avatar_focal_x, avatar_focal_y, avatar_zoom,
                banner_color, accent_color, bio, created_at,
                cases_opened, highest_balance, total_wagered, total_won
         FROM users WHERE LOWER(username) = ?`
      )
      .get(uname) as any;

    console.log("[users/username] user found:", u?.id, u?.username);

    if (!u) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let friendStatus: string | null = null;
    let friendInitiator: number | null = null;

    if (u.id !== viewer.id) {
      console.log("[users/username] checking friendship");
      const f = db
        .prepare(
          `SELECT status, initiator_id FROM friendships
           WHERE (user_id = ? AND friend_id = ?)
              OR (user_id = ? AND friend_id = ?)
           LIMIT 1`
        )
        .get(viewer.id, u.id, u.id, viewer.id) as
        | { status: string; initiator_id: number }
        | undefined;
      if (f) {
        friendStatus = f.status;
        friendInitiator = f.initiator_id;
      }
      console.log("[users/username] friendship:", friendStatus);
    }

    console.log("[users/username] loading drops");
    const recentDrops = db
      .prepare(
        `SELECT item_name, item_image, item_color, item_price, case_name, dropped_at
         FROM drop_history WHERE user_id = ?
         ORDER BY dropped_at DESC LIMIT 10`
      )
      .all(u.id) as any[];
    console.log("[users/username] drops:", recentDrops.length);

    console.log("[users/username] loading best pull");
    const bestPull = db
      .prepare(
        `SELECT item_name, item_price, opened_at
         FROM case_openings WHERE user_id = ?
         ORDER BY item_price DESC LIMIT 1`
      )
      .get(u.id) as
      | { item_name: string; item_price: number; opened_at: number }
      | undefined;
    console.log("[users/username] best pull:", bestPull?.item_name);

    const netProfit = (u.total_won ?? 0) - (u.total_wagered ?? 0);

    console.log("[users/username] SUCCESS");

    return NextResponse.json({
      user: {
        id: u.id,
        username: u.username,
        avatar: u.avatar ?? "◆",
        avatarFocalX: u.avatar_focal_x ?? 50,
        avatarFocalY: u.avatar_focal_y ?? 50,
        avatarZoom: u.avatar_zoom ?? 1,
        bannerColor: u.banner_color ?? "#8b5cf6",
        accentColor: u.accent_color ?? "#a78bfa",
        bio: u.bio ?? "",
        memberSince: u.created_at,
        casesOpened: u.cases_opened ?? 0,
        highestBalance: u.highest_balance ?? 0,
        netProfit,
      },
      friendship: {
        status: friendStatus,
        initiator: friendInitiator,
        isSelf: u.id === viewer.id,
      },
      recentDrops: recentDrops.map((d) => ({
        itemName: d.item_name,
        itemImage: d.item_image,
        itemColor: d.item_color,
        itemPrice: d.item_price,
        caseName: d.case_name,
        droppedAt: d.dropped_at,
      })),
      bestPull: bestPull
        ? {
            name: bestPull.item_name,
            price: bestPull.item_price,
            pulledAt: bestPull.opened_at,
          }
        : null,
    });
  } catch (err: any) {
    console.error(
      "[users/username] FATAL ERROR:",
      err?.message ?? err,
      "\nSTACK:",
      err?.stack
    );
    return NextResponse.json(
      {
        error: "Server error",
        detail: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}