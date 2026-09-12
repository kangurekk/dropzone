"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AvatarImage from "@/components/AvatarImage";
import { avatarGradient } from "@/lib/user-colors";

type PublicUser = {
  id: number;
  username: string;
  avatar: string;
  avatarFocalX: number;
  avatarFocalY: number;
  avatarZoom: number;
  bannerColor: string;
  accentColor: string;
  bio: string;
  memberSince: number;
  casesOpened: number;
  highestBalance: number;
  netProfit: number;
};

type Drop = {
  itemName: string;
  itemImage: string | null;
  itemColor: string | null;
  itemPrice: number;
  caseName: string | null;
  droppedAt: number;
};

type ApiResponse = {
  user: PublicUser;
  friendship: {
    status: string | null;
    initiator: number | null;
    isSelf: boolean;
  };
  recentDrops: Drop[];
  bestPull: { name: string; price: number; pulledAt: number } | null;
};

function getSourceLabel(d: Drop): string | null {
  if (d.caseName === "Plinko Session") return "Plinko";
  if (d.caseName === "Roulette") return "Roulette";
  if (d.caseName === "Rocket Crash") return "Rocket Crash";
  if (typeof d.caseName === "string" && d.caseName.startsWith("Blackjack"))
    return "Blackjack";
  return null;
}

function getSourceIcon(d: Drop): string | null {
  if (d.caseName === "Plinko Session") return "◆";
  if (d.caseName === "Roulette") return "🎰";
  if (d.caseName === "Rocket Crash") return "🚀";
  if (typeof d.caseName === "string" && d.caseName.startsWith("Blackjack"))
    return "♠";
  return null;
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = params?.username;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [myData, setMyData] = useState<{
    username: string | null;
    avatar: string | null;
    balance: number;
    myId: number | null;
  }>({ username: null, avatar: null, balance: 0, myId: null });

  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      setMyData({
        username: d.user?.username ?? null,
        avatar: d.user?.avatar ?? null,
        balance: d.user?.balance ?? 0,
        myId: d.user?.id ?? null,
      });
    } catch {}
  }

  async function loadProfile() {
    if (!username) return;
    try {
      const res = await fetch(`/api/users/${username}`);
      if (!res.ok) {
        setError(res.status === 404 ? "User not found" : "Failed to load");
        return;
      }
      const d = await res.json();
      setData(d);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  async function sendRequest() {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      });
      const d = await res.json();
      if (!res.ok) {
        showFlash(d.error ?? "Failed");
      } else if (d.accepted) {
        showFlash("Friend added!");
        loadProfile();
      } else {
        showFlash("Request sent");
        loadProfile();
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeFriend() {
    if (!data) return;
    if (!confirm(`Remove ${data.user.username} from friends?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/friends/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      });
      if (res.ok) {
        showFlash("Removed");
        loadProfile();
      }
    } finally {
      setBusy(false);
    }
  }

  function openDM() {
    if (!data) return;
    router.push(`/messages/${data.user.id}`);
  }

  const initial = data?.user.username[0].toUpperCase() ?? "?";
  const isUpload = data?.user.avatar?.startsWith("/uploads/") ?? false;

  const friendState = data?.friendship;
  const canAddFriend =
    friendState &&
    !friendState.isSelf &&
    friendState.status !== "accepted" &&
    !(friendState.status === "pending" && friendState.initiator !== data?.user.id);

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="friends" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title={data ? data.user.username : "Profile"}
          description="Public profile"
          balance={myData.balance}
          username={myData.username}
          avatar={myData.avatar}
        />

        {loading ? (
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-10 text-center text-[11px] text-[#737887]">
            Loading...
          </div>
        ) : error || !data ? (
          <div className="rounded-2xl border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.06] p-6 text-center">
            <div className="text-[14px] font-bold text-[#eb4b4b]">
              {error ?? "Failed to load"}
            </div>
            <Link
              href="/"
              className="mt-4 inline-flex h-[40px] items-center rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-4 text-[11px] font-extrabold text-[#a78bfa]"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <>
            {/* HERO */}
            <div
              className="relative overflow-hidden rounded-2xl border border-[#1b1f2b] p-6"
              style={{
                background: `radial-gradient(circle at 20% 0%, ${data.user.bannerColor}33 0%, transparent 60%), linear-gradient(160deg, #11141d, #090b10)`,
              }}
            >
              <div
                className="pointer-events-none absolute left-1/4 top-[-100px] h-[200px] w-[200px] -translate-x-1/2 rounded-full blur-[80px]"
                style={{ background: data.user.bannerColor, opacity: 0.25 }}
              />

              <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <div
                  className="h-[100px] w-[100px] shrink-0 overflow-hidden rounded-2xl text-[40px] font-bold text-white"
                  style={{
                    background: isUpload
                      ? "#0e1017"
                      : avatarGradient(
                          data.user.bannerColor,
                          data.user.accentColor
                        ),
                    boxShadow: `0 0 40px ${data.user.bannerColor}55`,
                  }}
                >
                  {isUpload ? (
                    <AvatarImage
                      src={data.user.avatar}
                      alt={data.user.username}
                      focalX={data.user.avatarFocalX}
                      focalY={data.user.avatarFocalY}
                      zoom={data.user.avatarZoom}
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      {initial}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2
                    className="truncate text-[26px] font-bold tracking-[-0.5px]"
                    style={{ color: data.user.accentColor }}
                  >
                    {data.user.username}
                  </h2>
                  <p className="mt-1 text-[11px] text-[#737887]">
                    Member since{" "}
                    {new Date(data.user.memberSince).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>

                  {data.user.bio && (
                    <p className="mt-2 max-w-[500px] text-[11px] text-[#737887]">
                      {data.user.bio}
                    </p>
                  )}

                  {/* ACTIONS */}
                  {!friendState?.isSelf && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {friendState?.status === "accepted" ? (
                        <>
                          <button
                            type="button"
                            onClick={openDM}
                            className="h-[38px] rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.1] px-5 text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#a78bfa] transition hover:bg-[#8b5cf6]/[0.2]"
                          >
                            Message
                          </button>
                          <button
                            type="button"
                            onClick={removeFriend}
                            disabled={busy}
                            className="h-[38px] rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.06] px-4 text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#eb4b4b] transition hover:bg-[#eb4b4b]/[0.15] disabled:opacity-40"
                          >
                            Remove friend
                          </button>
                        </>
                      ) : canAddFriend ? (
                        <button
                          type="button"
                          onClick={sendRequest}
                          disabled={busy}
                          className="h-[38px] rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.1] px-5 text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#a78bfa] transition hover:bg-[#8b5cf6]/[0.2] disabled:opacity-40"
                        >
                          {friendState?.status === "pending" &&
                          friendState.initiator === data.user.id
                            ? "Accept request"
                            : "Add friend"}
                        </button>
                      ) : friendState?.status === "pending" ? (
                        <span className="inline-flex h-[38px] items-center rounded-lg border border-[#eab308]/30 bg-[#eab308]/[0.08] px-4 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#eab308]">
                          Request pending
                        </span>
                      ) : null}
                    </div>
                  )}

                  {friendState?.isSelf && (
                    <Link
                      href="/settings"
                      className="mt-4 inline-flex h-[38px] items-center rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-4 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#737887] transition hover:text-white"
                    >
                      Edit my profile
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* STATS */}
            <h2 className="mb-3 mt-8 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
              Stats
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Cases opened"
                value={data.user.casesOpened.toString()}
              />
              <StatCard
                label="Peak balance"
                value={`$${data.user.highestBalance.toFixed(2)}`}
                color="#4ade80"
              />
              <StatCard
                label="Net profit"
                value={`${data.user.netProfit >= 0 ? "+" : "-"}$${Math.abs(
                  data.user.netProfit
                ).toFixed(2)}`}
                color={data.user.netProfit >= 0 ? "#4ade80" : "#eb4b4b"}
              />
              <StatCard
                label="Best pull"
                value={
                  data.bestPull ? `$${data.bestPull.price.toFixed(2)}` : "—"
                }
                color="#ffd700"
                hint={data.bestPull?.name}
              />
            </div>

            {/* RECENT DROPS */}
            <h2 className="mb-3 mt-8 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
              Recent drops
            </h2>
            {data.recentDrops.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-6 text-center text-[11px] text-[#4f5563]">
                No drops yet.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
                {data.recentDrops.map((d, i) => {
                  const color = d.itemColor ?? "#8b5cf6";
                  const sourceLabel = getSourceLabel(d);
                  const sourceIcon = getSourceIcon(d);
                  const isSpecial = sourceLabel !== null;

                  return (
                    <div
                      key={i}
                      className="group relative overflow-hidden rounded-lg border bg-gradient-to-b from-[#11141c] to-[#0b0d13] transition hover:-translate-y-[2px]"
                      style={{ borderColor: `${color}30` }}
                    >
                      {/* IMAGE AREA */}
                      <div
                        className="relative h-[58px] w-full overflow-hidden"
                        style={{
                            background: `radial-gradient(circle at center, ${color}22 0%, transparent 65%), linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))`,
                        }}
                    >
                        {d.itemImage && !isSpecial ? (
                          <img
                            src={d.itemImage}
                            alt={d.itemName}
                            className="skin-img absolute inset-0 h-full w-full object-contain p-1.5"
                            draggable={false}
                          />
                        ) : (
                          <div
                            className="absolute inset-0 grid place-items-center text-2xl"
                            style={{
                              color,
                              textShadow: `0 0 16px ${color}`,
                            }}
                          >
                            {sourceIcon ?? "◆"}
                          </div>
                        )}
                      </div>

                      {/* INFO */}
                      <div className="border-t border-[#1b1f2b] px-1.5 py-1">
                        {isSpecial ? (
                          <>
                            <div
                              className="truncate text-[9px] font-extrabold"
                              style={{ color }}
                              title={`${sourceLabel} — ${d.itemName}`}
                            >
                              {d.itemName}
                            </div>
                            <div className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.4px] text-[#737887]">
                              {sourceLabel}
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className="truncate text-[9px] font-bold"
                              style={{ color }}
                              title={d.itemName}
                            >
                              {d.itemName}
                            </div>
                            <div
                              className="mt-0.5 truncate text-[8px] font-bold"
                              style={{ color }}
                            >
                              ${d.itemPrice.toFixed(2)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {flash && (
              <div className="mt-4 rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-3 py-2 text-center text-[11px] text-[#c4b5fd]">
                {flash}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
      <div className="text-[8px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
        {label}
      </div>
      <div
        className="mt-2 truncate text-[16px] font-bold text-white"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-[9px] text-[#737887]">{hint}</div>}
    </div>
  );
}