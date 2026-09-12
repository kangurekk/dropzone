import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function extFor(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    console.log(
      "[upload-avatar] file:",
      file.name,
      file.type,
      file.size,
      "bytes"
    );

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 5MB)" },
        { status: 400 }
      );
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WEBP or GIF" },
        { status: 400 }
      );
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let ext = extFor(file.type);

    // ─────────────────────────────────────────────────────────
    // GIF → animated WebP
    // Chrome's fast scaler mis-maps GIF palettes at small sizes,
    // making colors look inverted. WebP has a consistent color
    // pipeline at every size, so we normalize GIFs on upload.
    // ─────────────────────────────────────────────────────────
    if (file.type === "image/gif") {
      try {
        buffer = await sharp(buffer, { animated: true })
          .webp({ quality: 90, effort: 3 })
          .toBuffer();
        ext = "webp";
        console.log(
          "[upload-avatar] gif → webp:",
          buffer.length,
          "bytes"
        );
      } catch (err) {
        console.warn("[upload-avatar] gif→webp failed, keeping original:", err);
        // Fall back to the original GIF buffer
      }
    }

    const filename = `user-${user.id}-${Date.now()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "avatars");
    const filepath = path.join(dir, filename);

    await fs.mkdir(dir, { recursive: true });

    // Delete previous avatars for this user
    try {
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (f.startsWith(`user-${user.id}-`)) {
          await fs.unlink(path.join(dir, f)).catch(() => {});
        }
      }
    } catch {
      // ignore
    }

    await fs.writeFile(filepath, buffer);

    const url = `/uploads/avatars/${filename}`;

    db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(url, user.id);

    console.log("[upload-avatar] saved:", url);

    return NextResponse.json({ ok: true, avatar: url });
  } catch (err) {
    console.error("[upload-avatar] ERROR:", err);
    return NextResponse.json(
      { error: "Upload failed", detail: String(err) },
      { status: 500 }
    );
  }
}