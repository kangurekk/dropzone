"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";

export type SidebarPage =
  | "cases"
  | "upgrade"
  | "casino"
  | "plinko"
  | "roulette"
  | "blackjack"
  | "inventory"
  | "profile"
  | "friends"
  | "messages"
  | "leaderboard"
  | "settings";

type SidebarProps = {
  active: SidebarPage;
  onNavigate?: (page: SidebarPage) => void;
};

const LINKS: {
  id: SidebarPage;
  icon: string;
  label: string;
  href: string;
}[] = [
  { id: "cases", icon: "▣", label: "Cases", href: "/" },
  { id: "upgrade", icon: "↗", label: "Upgrader", href: "/?tab=upgrade" },
  { id: "casino", icon: "🎰", label: "Casino", href: "/casino" },
  { id: "inventory", icon: "▤", label: "Inventory", href: "/?tab=inventory" },
  { id: "profile", icon: "◉", label: "Profile", href: "/profile" },
  { id: "friends", icon: "👥", label: "Friends", href: "/friends" },
  { id: "messages", icon: "💬", label: "Messages", href: "/messages" },
  { id: "leaderboard", icon: "🏆", label: "Leaderboard", href: "/leaderboard" },
  { id: "settings", icon: "⚙", label: "Settings", href: "/settings" },
];

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  const { me } = useMe();
  const router = useRouter();

  const [unread, setUnread] = useState(0);
  const [pendingReqs, setPendingReqs] = useState(0);

  useEffect(() => {
    function load() {
      fetch("/api/chat/unread")
        .then((r) => r.json())
        .then((d) => {
          setUnread(d.unreadDMs ?? 0);
          setPendingReqs(d.pendingFriendRequests ?? 0);
        })
        .catch(() => {});
    }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function handleClick(page: SidebarPage, href: string) {
    // Any link that's a real route (not a "?tab=" one) navigates directly
    if (!href.startsWith("/?")) {
      router.push(href);
      return;
    }

    // Tab links — if the parent gives us onNavigate, switch in-place
    if (onNavigate) {
      onNavigate(page);
      return;
    }

    // Otherwise navigate with a tab query
    const target = page === "cases" ? "/" : `/?tab=${page}`;
    router.push(target);
  }

  return (
    <aside className="fixed left-0 top-0 z-[200] flex h-screen w-[235px] flex-col border-r border-[#1b1f2b] bg-gradient-to-b from-[#0b0d13] to-[#08090e] p-[26px_16px]">
      <div className="flex h-[45px] items-center gap-[11px] pl-[10px] text-[16px] font-extrabold tracking-[1.8px]">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#5b21b6] text-[12px] text-white shadow-[0_0_22px_rgba(139,92,246,0.3)]">
          ◆
        </span>
        <span>
          большой
          <span className="text-[#a78bfa]">дроп</span>
        </span>
      </div>

      <nav className="mt-[38px] flex flex-col gap-[5px]">
        {LINKS.map((link) => {
          const isActive = active === link.id;
          const showMsgBadge = link.id === "messages" && unread > 0;
          const showFriendBadge = link.id === "friends" && pendingReqs > 0;

          return (
            <button
              key={link.id}
              type="button"
              onClick={() => handleClick(link.id, link.href)}
              className={`flex h-12 w-full items-center gap-[13px] rounded-[9px] border px-[15px] text-[13px] font-semibold transition ${
                isActive
                  ? "border-[#8b5cf6]/20 bg-gradient-to-r from-[#8b5cf6]/16 to-[#8b5cf6]/[0.045] text-white shadow-[inset_3px_0_0_#8b5cf6]"
                  : "border-transparent bg-transparent text-[#737887] hover:bg-white/[0.025] hover:text-white"
              }`}
            >
              <span
                className={`w-[19px] text-center text-[16px] ${
                  isActive ? "text-[#a78bfa]" : "text-[#646978]"
                }`}
              >
                {link.icon}
              </span>
              <span className="flex-1 text-left">{link.label}</span>
              {showMsgBadge && (
                <span className="ml-auto rounded-full bg-[#eb4b4b] px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
              {showFriendBadge && (
                <span className="ml-auto rounded-full bg-[#eb4b4b] px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {pendingReqs > 99 ? "99+" : pendingReqs}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <div className="rounded-[10px] border border-[#1b1f2b] bg-white/[0.015] p-4">
          <div className="text-[9px] font-extrabold tracking-[1.5px] text-[#a78bfa]">
            DEMO MODE
          </div>
          <div className="mt-[6px] text-[9px] leading-[1.5] text-[#4f5462]">
            All currency is fictional.
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="h-[38px] w-full rounded-[10px] border border-[#1b1f2b] bg-[#0e1017] text-[10px] font-extrabold uppercase tracking-[1px] text-[#737887] transition hover:border-[#eb4b4b]/30 hover:bg-[#eb4b4b]/[0.06] hover:text-[#eb4b4b]"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}