import { NextResponse } from "next/server";
import { deleteSession, clearSessionCookie, getSessionToken } from "@/lib/auth";

export async function POST() {
  const token = await getSessionToken();
  if (token) deleteSession(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}