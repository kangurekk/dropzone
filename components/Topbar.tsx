"use client";

import Link from "next/link";
import AvatarImage from "@/components/AvatarImage";
import { avatarGradient, userAccent } from "@/lib/user-colors";
import { useMe } from "@/lib/use-me";

type TopbarProps = {
  title: string;
  description: string;
  balance?: number;
  username?: string | null;
  avatar?: string | null;
  avatarFocalX?: number;
  avatarFocalY?: number;
  avatarZoom?: number;
  onDeposit?: () => void;
  profileHref?: string;
  profileActive?: boolean;
};

export default function Topbar({
  title,
  description,
  balance,
  username,
  avatar,
  avatarFocalX,
  avatarFocalY,
  avatarZoom,
  onDeposit,
  profileHref = "/profile",
  profileActive = false,
}: TopbarProps) {
  const { me } = useMe();

  // Prefer explicit props, fall back to fetched `me`
  const finalUsername = username ?? me?.username ?? null;
  const finalAvatar = avatar ?? me?.avatar ?? null;
  const finalBalance = balance ?? me?.balance ?? 0;
  const finalFocalX = avatarFocalX ?? me?.avatarFocalX ?? 50;
  const finalFocalY = avatarFocalY ?? me?.avatarFocalY ?? 50;
  const finalZoom = avatarZoom ?? me?.avatarZoom ?? 1;

  const initial = finalUsername ? finalUsername[0].toUpperCase() : "?";
  const isUpload = finalAvatar?.startsWith("/uploads/") ?? false;
  const gradient = avatarGradient(me?.bannerColor, me?.accentColor);
  const accent = userAccent(me?.accentColor);

  return (
    <header className="mb-[38px] flex min-h-[92px] items-center justify-between border-b border-[#181c26]">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.5px]">{title}</h1>
        <p className="mt-[7px] text-[11px] text-[#737887]">{description}</p>
      </div>

      <div className="flex items-center gap-[11px]">
        <div className="flex h-[48px] min-w-[132px] flex-col justify-center rounded-xl border border-[#1c202b] bg-gradient-to-br from-[#10131b] to-[#0c0e14] px-[15px] shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <span className="text-[7px] font-extrabold tracking-[1.3px] text-[#4f5462]">
            BALANCE
          </span>
          <strong className="mt-[3px] text-[14px] font-bold text-white">
            ${finalBalance.toFixed(2)}
          </strong>
        </div>

        {onDeposit && (
          <button
            type="button"
            onClick={onDeposit}
            className="h-[48px] rounded-xl border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-[18px] text-[10px] font-extrabold tracking-[0.2px] text-white shadow-[0_10px_30px_rgba(109,63,224,0.22)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_12px_35px_rgba(109,63,224,0.32)]"
          >
            + Deposit
          </button>
        )}

        <Link
          href={profileHref}
          title="Profile"
          className="grid h-[48px] w-[48px] place-items-center overflow-hidden rounded-xl border text-[14px] font-bold text-white transition"
          style={{
            borderColor: profileActive ? accent : "#1c202b",
            background: isUpload ? "#0e1017" : gradient,
            boxShadow: profileActive ? `0 0 20px ${accent}55` : undefined,
          }}
        >
          {isUpload ? (
            <AvatarImage
              src={finalAvatar!}
              alt="avatar"
              focalX={finalFocalX}
              focalY={finalFocalY}
              zoom={finalZoom}
              className="h-full w-full"
            />
          ) : (
            initial
          )}
        </Link>
      </div>
    </header>
  );
}