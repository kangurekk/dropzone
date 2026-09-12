"use client";

import { useEffect, useRef, useState } from "react";
import { useMe } from "@/lib/use-me";

type Announcement = {
  id: number;
  message: string;
  type: "info" | "success" | "warning" | "error";
  created_at: number;
  expires_at: number | null;
};

const STYLES: Record<
  Announcement["type"],
  { bg: string; border: string; text: string; icon: string; accent: string }
> = {
  info: {
    bg: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.06))",
    border: "rgba(139,92,246,0.5)",
    text: "#e9d5ff",
    icon: "ℹ",
    accent: "#8b5cf6",
  },
  success: {
    bg: "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))",
    border: "rgba(34,197,94,0.5)",
    text: "#bbf7d0",
    icon: "✓",
    accent: "#22c55e",
  },
  warning: {
    bg: "linear-gradient(135deg, rgba(234,179,8,0.18), rgba(234,179,8,0.06))",
    border: "rgba(234,179,8,0.5)",
    text: "#fde68a",
    icon: "⚠",
    accent: "#eab308",
  },
  error: {
    bg: "linear-gradient(135deg, rgba(235,75,75,0.18), rgba(235,75,75,0.06))",
    border: "rgba(235,75,75,0.5)",
    text: "#fecaca",
    icon: "✕",
    accent: "#eb4b4b",
  },
};

const SHOW_MS = 6000;

export default function AnnouncementToast() {
  const { me } = useMe();
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [entering, setEntering] = useState(false);

  const seenIds = useRef<Set<number>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    let es: EventSource | null = null;

    function connect() {
      es = new EventSource("/api/announcements/stream");

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const list: Announcement[] = data.announcements ?? [];

          if (!initialized.current) {
            // First snapshot: mark all as seen so we don't toast old ones
            list.forEach((a) => seenIds.current.add(a.id));
            initialized.current = true;
            return;
          }

          // Find brand new ones
          const fresh = list.filter((a) => !seenIds.current.has(a.id));
          if (fresh.length > 0) {
            fresh.forEach((a) => seenIds.current.add(a.id));
            setQueue((q) => [...q, ...fresh]);
          }
        } catch {}
      };

      es.onerror = () => {
        es?.close();
        es = null;
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      es?.close();
    };
  }, []);

  // Show one at a time
  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0];
    setQueue((q) => q.slice(1));
    setCurrent(next);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntering(true))
    );
  }, [queue, current]);

  // Auto dismiss
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => {
      setEntering(false);
      setTimeout(() => setCurrent(null), 300);
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [current]);

  function dismiss() {
    setEntering(false);
    setTimeout(() => setCurrent(null), 300);
  }

  if (!current) return null;

  const style = STYLES[current.type] ?? STYLES.info;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9998] flex justify-center p-4"
      style={{
        transition: "transform 300ms cubic-bezier(.2,.9,.3,1.2), opacity 300ms ease",
        transform: entering ? "translateY(0)" : "translateY(-120%)",
        opacity: entering ? 1 : 0,
      }}
    >
      <div
        className="pointer-events-auto relative flex w-full max-w-[560px] items-center gap-3 overflow-hidden rounded-2xl border px-5 py-4 backdrop-blur-xl"
        style={{
          background: style.bg,
          borderColor: style.border,
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 60px ${style.accent}33`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(to right, transparent, ${style.accent}, transparent)`,
          }}
        />

        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px] font-bold"
          style={{
            background: style.accent,
            color: "#0b0d13",
            boxShadow: `0 0 20px ${style.accent}88`,
          }}
        >
          {style.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div
            className="text-[8px] font-extrabold uppercase tracking-[1.6px]"
            style={{ color: style.accent }}
          >
            {current.type === "info"
              ? "Announcement"
              : current.type === "success"
                ? "Good news"
                : current.type === "warning"
                  ? "Heads up"
                  : "Alert"}
          </div>
          <div
            className="mt-1 text-[13px] font-semibold leading-snug"
            style={{ color: style.text }}
          >
            {current.message}
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[16px] transition hover:bg-white/[0.08]"
          style={{ color: style.text }}
          aria-label="Dismiss"
        >
          ×
        </button>

        <div
          className="absolute bottom-0 left-0 h-[2px]"
          style={{
            background: style.accent,
            animation: `announcement-progress ${SHOW_MS}ms linear forwards`,
          }}
        />
      </div>

      <style jsx global>{`
        @keyframes announcement-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}