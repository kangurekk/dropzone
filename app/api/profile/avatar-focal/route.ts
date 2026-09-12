import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const { x, y, zoom } = body;

  const fx = typeof x === "number" ? Math.max(0, Math.min(100, x)) : 50;
  const fy = typeof y === "number" ? Math.max(0, Math.min(100, y)) : 50;
  const fz =
    typeof zoom === "number" && zoom >= 1 && zoom <= 3 ? zoom : 1;

  db.prepare(
    "UPDATE users SET avatar_focal_x = ?, avatar_focal_y = ?, avatar_zoom = ? WHERE id = ?"
  ).run(fx, fy, fz, user.id);

  return NextResponse.json({ ok: true, x: fx, y: fy, zoom: fz });
}