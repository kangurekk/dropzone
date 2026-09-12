"use client";

import { useEffect, useState } from "react";

type User = {
  id: number;
  username: string;
  balance: number;
  casesOpened: number;
  isAdmin: boolean;
  createdAt: number;
  avatar: string;
  bannerColor: string;
  accentColor: string;
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState<Record<number, string>>({});
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (Array.isArray(data.users)) setUsers(data.users);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  async function action(id: number, act: string, amt?: number) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, amount: amt }),
      });
      const d = await res.json();
      if (!res.ok) {
        setFlash(d.error ?? "Failed");
        setTimeout(() => setFlash(null), 3000);
      } else {
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-8 flex items-end justify-between border-b border-[#181c26] pb-6">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">Users</h1>
          <p className="mt-2 text-[11px] text-[#737887]">
            {users.length} account{users.length === 1 ? "" : "s"} · live
            updates every 10s
          </p>
        </div>
        {flash && (
          <span className="text-[11px] font-bold text-[#eb4b4b]">{flash}</span>
        )}
      </header>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by username..."
        className="mb-4 h-[42px] w-full max-w-[400px] rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-4 text-[12px] text-white outline-none focus:border-[#8b5cf6]"
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-10 text-center text-[11px] text-[#4f5563]">
          {search ? "No users match your search." : "No users."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4"
            >
              {/* HEADER ROW */}
              <div className="flex items-center gap-4">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl text-[18px] font-bold text-white"
                  style={{
                    background: u.avatar?.startsWith("/uploads/")
                      ? `url(${u.avatar}) center/cover`
                      : `linear-gradient(135deg, ${u.bannerColor ?? "#8b5cf6"}, ${u.accentColor ?? "#a78bfa"})`,
                  }}
                >
                  {!u.avatar?.startsWith("/uploads/") &&
                    (u.avatar || u.username[0].toUpperCase())}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-white">
                      {u.username}
                    </span>
                    {u.isAdmin && (
                      <span className="rounded-md border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.1] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.6px] text-[#eb4b4b]">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#737887]">
                    ${u.balance.toFixed(2)} · {u.casesOpened} cases · joined{" "}
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* ACTION ROW */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#181c26] pt-3">
                <input
                  type="number"
                  placeholder="Amount"
                  value={amount[u.id] ?? ""}
                  onChange={(e) =>
                    setAmount((prev) => ({ ...prev, [u.id]: e.target.value }))
                  }
                  className="h-[34px] w-[110px] rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[12px] text-white outline-none focus:border-[#8b5cf6]"
                />
                <button
                  type="button"
                  disabled={busy === u.id || !amount[u.id]}
                  onClick={() =>
                    action(u.id, "give", parseFloat(amount[u.id] ?? "0"))
                  }
                  className="h-[34px] rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/[0.08] px-3 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#4ade80] transition hover:bg-[#22c55e]/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Give
                </button>
                <button
                  type="button"
                  disabled={busy === u.id || !amount[u.id]}
                  onClick={() =>
                    action(u.id, "take", parseFloat(amount[u.id] ?? "0"))
                  }
                  className="h-[34px] rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/[0.08] px-3 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#fbbf24] transition hover:bg-[#f59e0b]/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  − Take
                </button>
                <button
                  type="button"
                  disabled={busy === u.id || !amount[u.id]}
                  onClick={() =>
                    action(u.id, "set", parseFloat(amount[u.id] ?? "0"))
                  }
                  className="h-[34px] rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#737887] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Set
                </button>

                <div className="flex-1" />

                <button
                  type="button"
                  disabled={busy === u.id}
                  onClick={() => {
                    if (confirm(`Reset stats for ${u.username}?`))
                      action(u.id, "reset");
                  }}
                  className="h-[34px] rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#737887] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset stats
                </button>

                <button
                  type="button"
                  disabled={busy === u.id}
                  onClick={() => {
                    if (
                      confirm(
                        `${u.isAdmin ? "Demote" : "Promote"} ${u.username}?`
                      )
                    )
                      action(u.id, "toggle_admin");
                  }}
                  className="h-[34px] rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-3 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#eb4b4b] transition hover:bg-[#eb4b4b]/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {u.isAdmin ? "Demote" : "Promote"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}