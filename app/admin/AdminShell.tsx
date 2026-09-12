"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TILES = [
  { href: "/admin", icon: "◆", label: "Dashboard", exact: true },
  { href: "/admin/cases", icon: "▣", label: "Case Builder" },
  { href: "/admin/announcements", icon: "📣", label: "Announcements" },
  { href: "/admin/users", icon: "◉", label: "Users" },
];

export default function AdminShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-[235px] flex-col border-r border-[#1b1f2b] bg-gradient-to-b from-[#0b0d13] to-[#08090e] p-[26px_16px]">
        <div className="flex h-[45px] items-center gap-[11px] pl-[10px] text-[14px] font-extrabold tracking-[1.6px]">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#eb4b4b] to-[#7f1d1d] text-[12px] text-white shadow-[0_0_22px_rgba(235,75,75,0.4)]">
            ⚡
          </span>
          <span>
            ADMIN
            <span className="text-[#eb4b4b]">PANEL</span>
          </span>
        </div>

        <nav className="mt-[38px] flex flex-col gap-[5px]">
          {TILES.map((t) => {
            const active = t.exact
              ? pathname === t.href
              : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex h-12 w-full items-center gap-[13px] rounded-[9px] border px-[15px] text-[13px] font-semibold transition ${
                  active
                    ? "border-[#eb4b4b]/30 bg-gradient-to-r from-[#eb4b4b]/16 to-[#eb4b4b]/[0.045] text-white shadow-[inset_3px_0_0_#eb4b4b]"
                    : "border-transparent bg-transparent text-[#737887] hover:bg-white/[0.025] hover:text-white"
                }`}
              >
                <span
                  className={`w-[19px] text-center text-[16px] ${
                    active ? "text-[#eb4b4b]" : "text-[#646978]"
                  }`}
                >
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div className="rounded-[10px] border border-[#1b1f2b] bg-white/[0.015] p-4">
            <div className="text-[9px] font-extrabold tracking-[1.5px] text-[#eb4b4b]">
              LOGGED IN AS
            </div>
            <div className="mt-[6px] text-[11px] font-bold text-white">
              {username}
            </div>
          </div>

          <Link
            href="/"
            className="h-[38px] w-full rounded-[10px] border border-[#1b1f2b] bg-[#0e1017] text-center text-[10px] font-extrabold uppercase leading-[38px] tracking-[1px] text-[#737887] transition hover:border-[#8b5cf6]/30 hover:text-white"
          >
            ← Back to site
          </Link>
        </div>
      </aside>

      <main className="ml-[235px] min-h-screen px-[42px] pb-[60px] pt-[42px]">
        {children}
      </main>
    </div>
  );
}