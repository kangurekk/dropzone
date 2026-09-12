"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { avatarGradient } from "@/lib/user-colors";

type Message = {
  id: number;
  senderId: number;
  username: string;
  avatar: string;
  bannerColor: string;
  accentColor: string;
  content: string;
  createdAt: number;
};

type Friend = {
  userId: number;
  username: string;
  avatar: string;
  bannerColor: string;
  accentColor: string;
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [myId, setMyId] = useState<number | null>(null);

  const [friends, setFriends] = useState<
    {
        userId: number;
        username: string;
        avatar: string;
        bannerColor: string;
        accentColor: string;
    }[]
    >([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<number>(0);

  async function loadMessages() {
    try {
      const res = await fetch("/api/chat/global?limit=60");
      const d = await res.json();
      if (Array.isArray(d.messages)) {
        setMessages(d.messages);
        if (d.messages.length > 0) {
          lastIdRef.current = d.messages[d.messages.length - 1].id;
        }
      }
    } catch {}
  }

  async function loadFriends() {
    try {
      const res = await fetch("/api/friends");
      const d = await res.json();
      if (Array.isArray(d.friends)) setFriends(d.friends);
    } catch {}
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUsername(d.user?.username ?? null);
        setAvatar(d.user?.avatar ?? null);
        setBalance(d.user?.balance ?? 0);
        setMyId(d.user?.id ?? null);
      })
      .catch(() => {});

    loadMessages();
    loadFriends();

    const t = setInterval(loadMessages, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const content = input.trim();
    if (!content) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setInput("");
        await loadMessages();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="messages" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title="Messages"
          description="Global chat and DMs."
          balance={balance}
          username={username}
          avatar={avatar}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* LEFT: FRIENDS LIST */}
          <aside className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Friends ({friends.length})
            </div>
            {friends.length === 0 ? (
              <div className="text-[10px] text-[#4f5563]">
                No friends yet.
              </div>
            ) : (
              <div className="space-y-1">
                {friends.map((f) => {
                  const isUpload = f.avatar?.startsWith("/uploads/");
                  const initial =
                    f.avatar && !isUpload ? f.avatar : f.username[0].toUpperCase();
                  return (
                    <Link
                      key={f.userId}
                      href={`/messages/${f.userId}`}
                      className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-[#8b5cf6]/30 hover:bg-[#8b5cf6]/[0.05]"
                    >
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md text-[12px] font-bold text-white"
                        style={{
                          background: isUpload
                            ? "#0e1017"
                            : avatarGradient(f.bannerColor, f.accentColor)
                        }}
                      >
                        {isUpload ? (
                          <img
                            src={f.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initial
                        )}
                      </div>
                      <div className="truncate text-[11px] font-semibold">
                        {f.username}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </aside>

          {/* RIGHT: CHAT */}
          <section className="flex h-[calc(100vh-240px)] flex-col rounded-2xl border border-[#1b1f2b] bg-[#0b0d13]">
            {/* HEADER */}
            <div className="flex items-center gap-3 border-b border-[#1b1f2b] px-4 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#5b21b6] text-[16px]">
                🌐
              </div>
              <div>
                <div className="text-[13px] font-bold">Global chat</div>
                <div className="text-[9px] text-[#737887]">
                  Everyone can see this
                </div>
              </div>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="text-center text-[11px] text-[#4f5563]">
                  No messages yet. Say hi!
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const mine = m.senderId === myId;
                    const isUpload = m.avatar?.startsWith("/uploads/");
                    const initial =
                      m.avatar && !isUpload
                        ? m.avatar
                        : m.username[0].toUpperCase();
                    return (
                      <div
                        key={m.id}
                        className={`flex items-end gap-2 ${
                          mine ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        <div
                            className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md text-[12px] font-bold text-white"
                            style={{
                                background: isUpload
                                ? "#0e1017"
                                : avatarGradient(m.bannerColor, m.accentColor),
                            }}
                            >
                          {isUpload ? (
                            <img
                              src={m.avatar}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initial
                          )}
                        </div>
                        <div
                          className={`max-w-[70%] rounded-xl px-3 py-2 ${
                            mine
                              ? "border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.12]"
                              : "border border-[#1b1f2b] bg-[#0e1017]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Link
                                href={`/u/${m.username}`}
                                className="text-[10px] font-bold hover:underline"
                                style={{ color: m.accentColor }}
                                >
                                {m.username}
                            </Link>
                            <span className="text-[8px] text-[#4f5563]">
                              {new Date(m.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="mt-1 break-words text-[12px] text-white">
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* INPUT */}
            <div className="border-t border-[#1b1f2b] p-3">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Type a message..."
                  disabled={sending}
                  className="h-[42px] flex-1 rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[12px] text-white outline-none focus:border-[#8b5cf6] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || input.trim().length === 0}
                  className="h-[42px] rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-5 text-[11px] font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}