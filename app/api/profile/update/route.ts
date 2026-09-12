import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const { username, avatar, bannerColor, accentColor, bio } = body;

  // ── Username validation ────────────────────────────────
  let newUsername: string | null = null;
  if (typeof username === "string") {
    const u = username.trim().toLowerCase();
    if (u.length < 3 || u.length > 20) {
      return NextResponse.json(
        { error: "Username must be 3–20 characters" },
        { status: 400 }
      );
    }
    if (!/^[a-z0-9_]+$/.test(u)) {
      return NextResponse.json(
        { error: "Only letters, numbers and _" },
        { status: 400 }
      );
    }
    if (u !== user.username) {
      const taken = db
        .prepare("SELECT id FROM users WHERE username = ? AND id != ?")
        .get(u, user.id);
      if (taken) {
        return NextResponse.json(
          { error: "Username taken" },
          { status: 409 }
        );
      }
      newUsername = u;
    }
  }

    // ── Avatar: allow emoji or a path like /uploads/avatars/... ───
  let newAvatar: string | null = null;
  if (typeof avatar === "string") {
    const a = avatar.trim();
    const isEmoji = a.length > 0 && a.length <= 8;
    const isUpload = a.startsWith("/uploads/avatars/");
    if (!isEmoji && !isUpload) {
      return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
    }
    newAvatar = a;
  }

  // ── Colors ─────────────────────────────────────────────
  if (bannerColor !== undefined && !isHex(bannerColor)) {
    return NextResponse.json({ error: "Invalid banner color" }, { status: 400 });
  }
  if (accentColor !== undefined && !isHex(accentColor)) {
    return NextResponse.json({ error: "Invalid accent color" }, { status: 400 });
  }

  // ── Bio ────────────────────────────────────────────────
  let newBio: string | null = null;
  if (typeof bio === "string") {
    newBio = bio.slice(0, 200);
  }

  // ── Apply ──────────────────────────────────────────────
  const updates: string[] = [];
  const params: any[] = [];

  if (newUsername !== null) {
    updates.push("username = ?");
    params.push(newUsername);
  }
  if (newAvatar !== null) {
    updates.push("avatar = ?");
    params.push(newAvatar);
  }
  if (isHex(bannerColor)) {
    updates.push("banner_color = ?");
    params.push(bannerColor);
  }
  if (isHex(accentColor)) {
    updates.push("accent_color = ?");
    params.push(accentColor);
  }
  if (newBio !== null) {
    updates.push("bio = ?");
    params.push(newBio);
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  params.push(user.id);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(
    ...params
  );

  return NextResponse.json({ ok: true });
}