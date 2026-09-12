import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { publicRocketState } from "@/lib/rocket";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  return NextResponse.json({ state: publicRocketState(user.id) });
}