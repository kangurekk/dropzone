import { NextResponse } from "next/server";
import db from "@/lib/db";
import {
  hashPassword,
  createSession,
  setSessionCookie,
} from "@/lib/auth";
import { enforceLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // ── Rate limit po IP ──────────────────────────────────────
    // 5 rejestracji na godzinę z jednego IP. Normalny user
    // zaklada jedno konto, bot masowo — to go zatrzyma.
    const ip = getClientIp(request);
    const blocked = enforceLimit(`signup-ip:${ip}`, 5, 60 * 60_000);
    if (blocked) return blocked;

    const { username, password } = await request.json();

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const u = username.trim().toLowerCase();
    if (u.length < 3 || u.length > 20) {
      return NextResponse.json(
        { error: "Username must be 3–20 characters" },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(u);

    if (existing) {
      return NextResponse.json(
        { error: "Username taken" },
        { status: 409 }
      );
    }

    const hash = await hashPassword(password);
    const result = db
      .prepare(
        "INSERT INTO users (username, password_hash, balance, created_at) VALUES (?, ?, 20, ?)"
      )
      .run(u, hash, Date.now());

    const token = createSession(result.lastInsertRowid as number);
    await setSessionCookie(token);

    return NextResponse.json({ ok: true, username: u });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}