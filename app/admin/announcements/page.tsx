"use client";

import { useEffect, useState } from "react";

type AnnType = "info" | "success" | "warning" | "error";

type Ann = {
  id: number;
  message: string;
  type: AnnType;
  createdAt: number;
  expiresAt: number | null;
};

const TYPES: AnnType[] = ["info", "success", "warning", "error"];

const PRESETS = [
  { label: "5 min", hours: 5 / 60 },
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "Forever", hours: 0 },
];

export default function AnnouncementsAdminPage() {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<AnnType>("info");
  const [duration, setDuration] = useState(1);
  const [sending, setSending] = useState(false);
  const [list, setList] = useState<Ann[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      if (Array.isArray(data.announcements)) setList(data.announcements);
    } catch {}
  }

  useEffect(() => {
    load();
  }, []);

  async function send() {
    if (message.trim().length < 3) return;
    setSending(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          type,
          durationHours: duration > 0 ? duration : undefined,
        }),
      });
      if (res.ok) {
        setMessage("");
        setFlash("Sent!");
        setTimeout(() => setFlash(null), 2000);
        await load();
      } else {
        const d = await res.json();
        setFlash(d.error ?? "Failed");
        setTimeout(() => setFlash(null), 3000);
      }
    } finally {
      setSending(false);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    await load();
  }

  async function clearAll() {
    if (!confirm("Delete all announcements?")) return;
    for (const a of list) {
      await fetch(`/api/announcements/${a.id}`, { method: "DELETE" });
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-10 flex items-end justify-between border-b border-[#181c26] pb-6">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">
            Announcements
          </h1>
          <p className="mt-2 text-[11px] text-[#737887]">
            Live messages that pop up instantly on every user's screen.
          </p>
        </div>
        {list.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.8px] text-[#eb4b4b] transition hover:bg-[#eb4b4b]/[0.15]"
          >
            Clear all
          </button>
        )}
      </header>

      <section className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-6">
        <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
          New announcement
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 300))}
          rows={3}
          placeholder="Type your message..."
          className="w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] p-3 text-[13px] text-white outline-none focus:border-[#8b5cf6]"
        />
        <div className="mt-1 text-right text-[9px] text-[#4f5563]">
          {message.length}/300
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
            Type
          </span>
          {TYPES.map((t) => {
            const accent =
              t === "info"
                ? "#8b5cf6"
                : t === "success"
                  ? "#22c55e"
                  : t === "warning"
                    ? "#eab308"
                    : "#eb4b4b";
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg border px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.6px] transition ${
                  active ? "text-white" : "text-[#737887] hover:text-white"
                }`}
                style={{
                  background: active ? `${accent}22` : "#0e1017",
                  borderColor: active ? accent : "#1b1f2b",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
            Duration
          </span>
          {PRESETS.map((p) => {
            const active = duration === p.hours;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setDuration(p.hours)}
                className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${
                  active
                    ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-[#a78bfa]"
                    : "border-[#1b1f2b] bg-[#0e1017] text-[#737887] hover:text-white"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={sending || message.trim().length < 3}
            className="h-[42px] rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-6 text-[11px] font-extrabold tracking-[0.4px] text-white shadow-[0_10px_30px_rgba(109,63,224,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "Sending..." : "Send to all"}
          </button>
          {flash && (
            <span className="text-[11px] font-bold text-[#4ade80]">
              {flash}
            </span>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
          Active ({list.length})
        </h2>
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-8 text-center text-[11px] text-[#4f5563]">
            No active announcements.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((a) => {
              const accent =
                a.type === "success"
                  ? "#22c55e"
                  : a.type === "warning"
                    ? "#eab308"
                    : a.type === "error"
                      ? "#eb4b4b"
                      : "#8b5cf6";
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-[#1b1f2b] bg-[#0b0d13] px-4 py-3"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-bold"
                    style={{ background: `${accent}22`, color: accent }}
                  >
                    {a.type[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-white">
                      {a.message}
                    </div>
                    <div className="mt-0.5 text-[9px] text-[#4f5563]">
                      {new Date(a.createdAt).toLocaleString()} ·{" "}
                      {a.expiresAt
                        ? `expires ${new Date(a.expiresAt).toLocaleString()}`
                        : "never expires"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="rounded-md border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#eb4b4b] transition hover:bg-[#eb4b4b]/[0.15]"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}