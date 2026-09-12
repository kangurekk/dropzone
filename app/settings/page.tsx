"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AvatarCropModal from "@/components/AvatarCropModal";
import AvatarImage from "@/components/AvatarImage";

type MeResponse = {
  user: {
    id: number;
    username: string;
    balance: number;
    avatar: string;
    avatarFocalX: number;
    avatarFocalY: number;
    avatarZoom: number;
    bannerColor: string;
    accentColor: string;
    bio: string;
  } | null;
};

type CropArea = { x: number; y: number; width: number; height: number };

const AVATARS = [
  "◆", "★", "♠", "♥", "♦", "♣",
  "🚀", "💎", "🔥", "👑", "⚡", "🎯",
  "🦅", "🐉", "🦊", "🐺", "🦁", "🐯",
  "🐸", "🐼", "🐨", "🐵", "🦄", "🐙",
];

const COLORS = [
  "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b",
  "#10b981", "#06b6d4", "#3b82f6", "#6366f1",
  "#a78bfa", "#f472b6", "#fb7185", "#fbbf24",
  "#34d399", "#22d3ee", "#60a5fa", "#818cf8",
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState<"blob" | "focal">("blob");

  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("◆");
  const [avatarFocalX, setAvatarFocalX] = useState(50);
  const [avatarFocalY, setAvatarFocalY] = useState(50);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [bannerColor, setBannerColor] = useState("#8b5cf6");
  const [accentColor, setAccentColor] = useState("#a78bfa");
  const [bio, setBio] = useState("");
  const [balance, setBalance] = useState(0);

  const isUpload = avatar.startsWith("/uploads/");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: MeResponse) => {
        if (!d.user) {
          router.push("/login");
          return;
        }
        setUsername(d.user.username);
        setAvatar(d.user.avatar);
        setAvatarFocalX(d.user.avatarFocalX ?? 50);
        setAvatarFocalY(d.user.avatarFocalY ?? 50);
        setAvatarZoom(d.user.avatarZoom ?? 1);
        setBannerColor(d.user.bannerColor);
        setAccentColor(d.user.accentColor);
        setBio(d.user.bio);
        setBalance(d.user.balance);
      })
      .catch(() => setError("Could not load profile"))
      .finally(() => setLoading(false));
  }, [router]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2500);
  }

  async function uploadGifOriginal(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setAvatar(data.avatar);
        router.refresh();
      } else {
        setError(data.error ?? "Upload failed");
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function uploadOriginal(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }

      setAvatar(data.avatar);
      showSuccess("Avatar uploaded!");
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)");
      e.target.value = "";
      return;
    }

    const url = URL.createObjectURL(file);

    if (file.type === "image/gif") {
      // GIF: upload original first, then open crop modal in "focal" mode
      // so the user picks where the center is. The GIF stays animated.
      uploadGifOriginal(file).then(() => {
        setCropSrc(url);
        setCropMode("focal");
      });
    } else {
      setCropSrc(url);
      setCropMode("blob");
    }

    e.target.value = "";
  }

  async function uploadCropped(blob: Blob) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", blob, "avatar.png");

      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }

      setAvatar(data.avatar);
      setAvatarFocalX(50);
      setAvatarFocalY(50);
      setAvatarZoom(1);
      showSuccess("Avatar uploaded!");
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (cropSrc) {
        URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
      }
    }
  }

  async function handleCropConfirm(blob: Blob, area: CropArea) {
    if (cropMode === "focal") {
      // GIF path: don't crop the file. Compute the focal point percentage
      // from where the user positioned the crop box.
      const img = new Image();
      img.src = cropSrc!;
      await new Promise<void>((resolve) => {
        if (img.complete) resolve();
        else img.onload = () => resolve();
      });

      const cx = ((area.x + area.width / 2) / img.naturalWidth) * 100;
      const cy = ((area.y + area.height / 2) / img.naturalHeight) * 100;

      try {
        const res = await fetch("/api/profile/avatar-focal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: cx, y: cy, zoom: avatarZoom }),
        });
        if (res.ok) {
          setAvatarFocalX(cx);
          setAvatarFocalY(cy);
          showSuccess("Avatar position saved!");
          router.refresh();
        } else {
          setError("Could not save position");
        }
      } catch {
        setError("Could not save position");
      } finally {
        cancelCrop();
      }
    } else {
      await uploadCropped(blob);
    }
  }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          avatar: isUpload ? undefined : avatar,
          bannerColor,
          accentColor,
          bio,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }

      showSuccess("Profile updated!");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
        <Sidebar active="settings" />
        <main className="ml-[235px] min-h-screen px-[42px] pb-[60px]">
          <Topbar
            title="Settings"
            description="Edit your profile."
            balance={0}
            username={null}
            avatar={avatar}
          />
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-10 text-center text-[11px] text-[#737887]">
            Loading...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="settings" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[60px]">
        <Topbar
          title="Settings"
          description="Edit how your profile looks to others."
          balance={balance}
          username={username}
          avatar={avatar}
          avatarFocalX={avatarFocalX}
          avatarFocalY={avatarFocalY}
          avatarZoom={avatarZoom}
        />

        {/* LIVE PREVIEW */}
        <section
          className="relative mb-6 overflow-hidden rounded-2xl border border-[#1b1f2b] p-6"
          style={{
            background: `radial-gradient(circle at 20% 0%, ${bannerColor}33 0%, transparent 60%), linear-gradient(160deg, #11141d, #090b10)`,
          }}
        >
          <div
            className="pointer-events-none absolute left-1/4 top-[-100px] h-[200px] w-[200px] -translate-x-1/2 rounded-full blur-[80px]"
            style={{ background: bannerColor, opacity: 0.25 }}
          />

          <div className="relative flex items-center gap-4">
            <div
              className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl text-[34px] font-bold text-white"
              style={{
                background: isUpload
                  ? "#0e1017"
                  : `linear-gradient(135deg, ${bannerColor}, ${accentColor})`,
                boxShadow: `0 0 40px ${bannerColor}55`,
              }}
            >
              {isUpload ? (
                <AvatarImage
                  src={avatar}
                  alt="avatar"
                  focalX={avatarFocalX}
                  focalY={avatarFocalY}
                  zoom={avatarZoom}
                  className="grid h-full w-full place-items-center"
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  {avatar}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div
                className="truncate text-[22px] font-bold"
                style={{ color: accentColor }}
              >
                {username || "username"}
              </div>
              {bio && (
                <div className="mt-1 line-clamp-2 max-w-[500px] text-[11px] text-[#737887]">
                  {bio}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FORM */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* LEFT COLUMN */}
          <div className="space-y-5">
            {/* USERNAME */}
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-5">
              <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                Username
              </div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="h-[44px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[13px] text-white outline-none focus:border-[#8b5cf6]"
              />
              <div className="mt-2 text-[9px] text-[#4f5563]">
                3–20 characters. Letters, numbers and underscore only.
              </div>
            </div>

            {/* BIO */}
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-5">
              <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                Bio
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="A short description about you..."
                className="w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] p-3 text-[12px] text-white outline-none focus:border-[#8b5cf6]"
              />
              <div className="mt-2 text-right text-[9px] text-[#4f5563]">
                {bio.length}/200
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">
            {/* AVATAR */}
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-5">
              <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                Avatar
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-xl text-[28px] font-bold text-white"
                  style={{
                    background: isUpload
                      ? "#0e1017"
                      : `linear-gradient(135deg, ${bannerColor}, ${accentColor})`,
                  }}
                >
                  {isUpload ? (
                    <AvatarImage
                      src={avatar}
                      alt="avatar"
                      focalX={avatarFocalX}
                      focalY={avatarFocalY}
                      zoom={avatarZoom}
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      {avatar}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <label
                    className={`inline-flex h-[38px] cursor-pointer items-center rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-4 text-[10px] font-extrabold uppercase tracking-[0.8px] transition ${
                      uploading
                        ? "cursor-wait text-[#4f5563]"
                        : "text-[#737887] hover:border-[#8b5cf6]/40 hover:text-white"
                    }`}
                  >
                    {uploading ? "Uploading..." : "Upload image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploading}
                      onChange={onFileSelected}
                      className="hidden"
                    />
                  </label>

                  {isUpload && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatar("◆");
                          setAvatarFocalX(50);
                          setAvatarFocalY(50);
                          setAvatarZoom(1);
                        }}
                        className="ml-2 text-[9px] font-bold text-[#eb4b4b] hover:underline"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Re-open crop for an existing upload
                          setCropSrc(avatar);
                          setCropMode(avatar.endsWith(".gif") ? "focal" : "blob");
                        }}
                        className="ml-2 text-[9px] font-bold text-[#a78bfa] hover:underline"
                      >
                        Adjust
                      </button>
                    </>
                  )}

                  <div className="mt-1 text-[9px] text-[#4f5563]">
                    JPG, PNG, WEBP or GIF. Max 5MB.
                  </div>
                </div>
              </div>

              {/* Emoji presets */}
              <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
                Or pick an icon
              </div>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAvatar(a);
                      setAvatarFocalX(50);
                      setAvatarFocalY(50);
                      setAvatarZoom(1);
                    }}
                    className={`grid aspect-square place-items-center rounded-lg border text-[20px] transition ${
                      avatar === a
                        ? "border-[#8b5cf6]/60 bg-[#8b5cf6]/15"
                        : "border-[#1b1f2b] bg-[#0e1017] hover:border-[#8b5cf6]/30"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* BANNER COLOR */}
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-5">
              <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                Banner color
              </div>
              <div className="grid grid-cols-8 gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBannerColor(c)}
                    className={`aspect-square rounded-lg border-2 transition ${
                      bannerColor === c
                        ? "scale-110 border-white"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {/* ACCENT COLOR */}
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-5">
              <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                Accent color
              </div>
              <div className="grid grid-cols-8 gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAccentColor(c)}
                    className={`aspect-square rounded-lg border-2 transition ${
                      accentColor === c
                        ? "scale-110 border-white"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="mt-5 rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-4 py-3 text-[11px] text-[#eb4b4b]">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-5 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/[0.08] px-4 py-3 text-[11px] text-[#4ade80]">
            {success}
          </div>
        )}

        {/* SAVE */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="h-[44px] rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-5 text-[11px] font-extrabold text-[#737887] transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-[44px] rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-6 text-[11px] font-extrabold text-white shadow-[0_10px_30px_rgba(109,63,224,0.22)] transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>

        {/* CROP MODAL */}
        {cropSrc && (
          <AvatarCropModal
            imageSrc={cropSrc}
            onCancel={cancelCrop}
            onConfirm={handleCropConfirm}
            uploading={uploading}
          />
        )}
      </main>
    </div>
  );
}