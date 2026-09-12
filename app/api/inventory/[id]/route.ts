import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await params;
  const inventoryId = parseInt(id, 10);
  if (!isFinite(inventoryId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = db
    .prepare("DELETE FROM inventory WHERE id = ? AND user_id = ?")
    .run(inventoryId, user.id);

  return NextResponse.json({ ok: true, deleted: result.changes });
}