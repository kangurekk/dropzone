"use client";

import Link from "next/link";

const CARDS = [
  {
    href: "/admin/cases",
    icon: "▣",
    label: "Case Builder",
    desc: "Create and edit cases with real-time pricing and drop rates.",
    color: "#8b5cf6",
  },
  {
    href: "/admin/announcements",
    icon: "📣",
    label: "Announcements",
    desc: "Broadcast live messages to every user on the site.",
    color: "#22c55e",
  },
  {
    href: "/admin/users",
    icon: "◉",
    label: "Users",
    desc: "View, gift balance, or adjust accounts.",
    color: "#f59e0b",
  },
];

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-10 border-b border-[#181c26] pb-6">
        <h1 className="text-[24px] font-bold tracking-[-0.5px]">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-[11px] text-[#737887]">
          Manage cases, users, and site-wide announcements.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group relative overflow-hidden rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-6 transition hover:-translate-y-1 hover:border-[#8b5cf6]/30"
          >
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full blur-[70px] opacity-[0.15] transition duration-300 group-hover:opacity-25"
              style={{ background: c.color }}
            />

            <div
              className="grid h-12 w-12 place-items-center rounded-xl text-[22px]"
              style={{
                background: `${c.color}22`,
                color: c.color,
                boxShadow: `0 0 30px ${c.color}33`,
              }}
            >
              {c.icon}
            </div>

            <div className="mt-4 text-[16px] font-bold tracking-[-0.3px] text-white">
              {c.label}
            </div>
            <div className="mt-2 text-[11px] leading-[1.5] text-[#737887]">
              {c.desc}
            </div>

            <div
              className="mt-4 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[1px] transition group-hover:gap-2"
              style={{ color: c.color }}
            >
              Open <span>→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}