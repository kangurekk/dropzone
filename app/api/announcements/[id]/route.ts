import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import db from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!isFinite(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  db.prepare("DELETE FROM announcements WHERE id = ?").run(numId);

  return NextResponse.json({ ok: true });
}