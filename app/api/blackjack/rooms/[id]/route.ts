import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRoom, publicRoom } from "@/lib/blackjack-rooms";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await params;
  const room = getRoom(id);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room: publicRoom(room, user.id) });
}