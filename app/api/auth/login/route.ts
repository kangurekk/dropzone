import { NextResponse } from "next/server";
import db from "@/lib/db";
import {
  verifyPassword,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const u = username.trim().toLowerCase();

    const row = db
      .prepare("SELECT id, password_hash FROM users WHERE username = ?")
      .get(u) as { id: number; password_hash: string } | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Wrong username or password" },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "Wrong username or password" },
        { status: 401 }
      );
    }

    const token = createSession(row.id);
    await setSessionCookie(token);

    return NextResponse.json({ ok: true, username: u });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}