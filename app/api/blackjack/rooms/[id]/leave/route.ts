import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { leaveRoom } from "@/lib/blackjack-rooms";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await params;
  leaveRoom(id, user.id);

  return NextResponse.json({ ok: true });
}