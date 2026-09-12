"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { avatarGradient } from "@/lib/user-colors";

type Message = {
  id: number;
  senderId: number;
  receiverId: number | null;
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

export default function DMPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const otherId = parseInt(params?.userId ?? "0", 10);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [myId, setMyId] = useState<number | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [other, setOther] = useState<Friend | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadMessages() {
    try {
      const res = await fetch(`/api/chat/dm/${otherId}`);
      if (!res.ok) {
        if (res.status === 403) setError("You are not friends with this user.");
        else if (res.status === 404) setError("User not found.");
        return;
      }
      const d = await res.json();
      if (Array.isArray(d.messages)) setMessages(d.messages);
    } catch {}
  }

  useEffect(() => {
    if (!isFinite(otherId) || otherId <= 0) {
      router.push("/messages");
      return;
    }

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUsername(d.user?.username ?? null);
        setAvatar(d.user?.avatar ?? null);
        setBalance(d.user?.balance ?? 0);
        setMyId(d.user?.id ?? null);
        if (d.user?.id === otherId) router.push("/messages");
      })
      .catch(() => {});

    fetch("/api/friends")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.friends)) {
          setFriends(d.friends);
          const found = d.friends.find((f: Friend) => f.userId === otherId);
          if (found) setOther(found);
          else setError("You are not friends with this user.");
        }
      })
      .catch(() => {});

    loadMessages();
    const t = setInterval(loadMessages, 2500);
    return () => clearInterval(t);
  }, [otherId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const content = input.trim();
    if (!content) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/dm/${otherId}`, {
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
          title={other ? `Chat with ${other.username}` : "Direct message"}
          description="Private conversation"
          balance={balance}
          username={username}
          avatar={avatar}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* FRIENDS */}
          <aside className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <Link
              href="/messages"
              className="mb-3 flex items-center gap-2 rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-2 py-1.5 text-[11px] font-bold text-[#a78bfa] transition hover:bg-[#8b5cf6]/[0.15]"
            >
              🌐 Global chat
            </Link>
            <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Friends
            </div>
            {friends.length === 0 ? (
              <div className="text-[10px] text-[#4f5563]">No friends yet.</div>
            ) : (
              <div className="space-y-1">
                {friends.map((f) => {
                  const active = f.userId === otherId;
                  const isUpload = f.avatar?.startsWith("/uploads/");
                  const initial =
                    f.avatar && !isUpload
                      ? f.avatar
                      : f.username[0].toUpperCase();
                  return (
                    <Link
                      key={f.userId}
                      href={`/messages/${f.userId}`}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                        active
                          ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/10"
                          : "border-transparent hover:border-[#8b5cf6]/30 hover:bg-[#8b5cf6]/[0.05]"
                      }`}
                    >
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md text-[12px] font-bold text-white"
                        style={{
                          background: isUpload
                            ? "#0e1017"
                            : avatarGradient(f.bannerColor, f.accentColor),
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

          {/* CHAT */}
          <section className="flex h-[calc(100vh-240px)] flex-col rounded-2xl border border-[#1b1f2b] bg-[#0b0d13]">
            {error ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="rounded-xl border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.06] px-5 py-4 text-center">
                  <div className="text-[12px] font-bold text-[#eb4b4b]">
                    {error}
                  </div>
                  <Link
                    href="/messages"
                    className="mt-3 inline-flex h-[34px] items-center rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-4 text-[10px] font-extrabold text-[#a78bfa]"
                  >
                    Back to global chat
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* HEADER */}
                <div className="flex items-center gap-3 border-b border-[#1b1f2b] px-4 py-3">
                  {other && (
                    <>
                      <div
                        className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg text-[14px] font-bold text-white"
                        style={{
                          background: other.avatar?.startsWith("/uploads/")
                            ? "#0e1017"
                            : avatarGradient(
                                other.bannerColor,
                                other.accentColor
                              ),
                        }}
                      >
                        {other.avatar?.startsWith("/uploads/") ? (
                          <img
                            src={other.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          other.username[0].toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold">
                          {other.username}
                        </div>
                        <div className="text-[9px] text-[#737887]">
                          Private conversation
                        </div>
                      </div>
                    </>
                  )}
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
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}