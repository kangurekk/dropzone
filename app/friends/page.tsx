"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { avatarGradient } from "@/lib/user-colors";

type Friend = {
  friendshipId: number;
  userId: number;
  username: string;
  avatar: string;
  accentColor: string;
  bannerColor: string;
  since: number;
};

type SearchUser = {
  id: number;
  username: string;
  avatar: string;
  accentColor: string;
  bannerColor: string;
  friendStatus: string | null;
  friendInitiator: number | null;
};

type Tab = "friends" | "requests" | "find";

export default function FriendsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("friends");

  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [myId, setMyId] = useState<number | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Friend[]>([]);
  const [outgoing, setOutgoing] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function loadFriends() {
    try {
      const res = await fetch("/api/friends");
      const d = await res.json();
      if (d.friends) setFriends(d.friends);
      if (d.incoming) setIncoming(d.incoming);
      if (d.outgoing) setOutgoing(d.outgoing);
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

    loadFriends().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "find" || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/friends/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.users)) setResults(d.users);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, tab]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  async function sendRequest(userId: number) {
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const d = await res.json();
    if (!res.ok) {
      showFlash(d.error ?? "Failed");
      return;
    }
    if (d.accepted) {
      showFlash("Friend added!");
    } else {
      showFlash("Request sent");
    }
    loadFriends();
    setResults((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, friendStatus: "pending", friendInitiator: myId ?? 0 }
          : u
      )
    );
  }

  async function respond(friendshipId: number, action: "accept" | "reject") {
    const res = await fetch("/api/friends/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, action }),
    });
    if (res.ok) {
      showFlash(action === "accept" ? "Accepted!" : "Rejected");
      loadFriends();
    }
  }

  async function removeFriend(userId: number, uname: string) {
    if (!confirm(`Remove ${uname} from friends?`)) return;
    const res = await fetch("/api/friends/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      showFlash("Removed");
      loadFriends();
    }
  }

  function openDM(userId: number) {
    router.push(`/messages/${userId}`);
  }

  const pendingCount = incoming.length;

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="friends" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title="Friends"
          description="Manage your friends and start conversations."
          balance={balance}
          username={username}
          avatar={avatar}
        />

        {/* TABS */}
        <div className="mb-6 flex gap-2">
          <TabBtn active={tab === "friends"} onClick={() => setTab("friends")}>
            Friends ({friends.length})
          </TabBtn>
          <TabBtn active={tab === "requests"} onClick={() => setTab("requests")}>
            Requests
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-[#eb4b4b] px-1.5 py-0.5 text-[9px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === "find"} onClick={() => setTab("find")}>
            Find users
          </TabBtn>
        </div>

        {flash && (
          <div className="mb-4 rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-3 py-2 text-[11px] text-[#c4b5fd]">
            {flash}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-10 text-center text-[11px] text-[#737887]">
            Loading...
          </div>
        ) : tab === "friends" ? (
          <FriendsList
            friends={friends}
            onDM={openDM}
            onRemove={removeFriend}
          />
        ) : tab === "requests" ? (
          <RequestsList
            incoming={incoming}
            outgoing={outgoing}
            onRespond={respond}
          />
        ) : (
          <FindList
            query={query}
            setQuery={setQuery}
            searching={searching}
            results={results}
            myId={myId}
            onSendRequest={sendRequest}
          />
        )}
      </main>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[38px] items-center rounded-lg border px-4 text-[11px] font-extrabold uppercase tracking-[0.8px] transition ${
        active
          ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-[#a78bfa]"
          : "border-[#1b1f2b] bg-[#0b0d13] text-[#737887] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Avatar({
  avatar,
  bannerColor,
  accentColor,
  size = 40,
}: {
  avatar: string;
  bannerColor: string;
  accentColor: string;
  size?: number;
}) {
  const isUpload = avatar?.startsWith("/uploads/");
  const initial = avatar && !isUpload ? avatar : "◆";
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-lg text-[14px] font-bold text-white"
      style={{
        width: size,
        height: size,
        background: isUpload
          ? "#0e1017"
          : avatarGradient(bannerColor, accentColor),
      }}
    >
      {isUpload ? (
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

function FriendsList({
  friends,
  onDM,
  onRemove,
}: {
  friends: Friend[];
  onDM: (id: number) => void;
  onRemove: (id: number, name: string) => void;
}) {
  if (friends.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-10 text-center text-[11px] text-[#4f5563]">
        No friends yet. Use "Find users" to add someone.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {friends.map((f) => (
        <div
          key={f.friendshipId}
          className="flex items-center gap-3 rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-3"
        >
          <Avatar
            avatar={f.avatar}
            bannerColor={f.bannerColor}
            accentColor={f.accentColor}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-white">
              {f.username}
            </div>
            <div className="text-[9px] text-[#737887]">
              Friends since {new Date(f.since).toLocaleDateString()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDM(f.userId)}
            className="h-[34px] rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-4 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#a78bfa] transition hover:bg-[#8b5cf6]/[0.15]"
          >
            Message
          </button>
          <button
            type="button"
            onClick={() => onRemove(f.userId, f.username)}
            className="h-[34px] rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-3 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#eb4b4b] transition hover:bg-[#eb4b4b]/[0.15]"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function RequestsList({
  incoming,
  outgoing,
  onRespond,
}: {
  incoming: Friend[];
  outgoing: Friend[];
  onRespond: (id: number, action: "accept" | "reject") => void;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
          Incoming ({incoming.length})
        </h2>
        {incoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-6 text-center text-[11px] text-[#4f5563]">
            No incoming requests.
          </div>
        ) : (
          <div className="space-y-2">
            {incoming.map((f) => (
              <div
                key={f.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-3"
              >
                <Avatar
                  avatar={f.avatar}
                  bannerColor={f.bannerColor}
                  accentColor={f.accentColor}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-white">
                    {f.username}
                  </div>
                  <div className="text-[9px] text-[#737887]">
                    Requested {new Date(f.since).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRespond(f.friendshipId, "accept")}
                  className="h-[34px] rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/[0.08] px-4 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#4ade80] transition hover:bg-[#22c55e]/[0.15]"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onRespond(f.friendshipId, "reject")}
                  className="h-[34px] rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#737887] transition hover:text-white"
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
          Sent ({outgoing.length})
        </h2>
        {outgoing.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-6 text-center text-[11px] text-[#4f5563]">
            No sent requests.
          </div>
        ) : (
          <div className="space-y-2">
            {outgoing.map((f) => (
              <div
                key={f.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-3"
              >
                <Avatar
                  avatar={f.avatar}
                  bannerColor={f.bannerColor}
                  accentColor={f.accentColor}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-white">
                    {f.username}
                  </div>
                  <div className="text-[9px] text-[#737887]">
                    Waiting for response
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#737887]">
                  Pending
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FindList({
  query,
  setQuery,
  searching,
  results,
  myId,
  onSendRequest,
}: {
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  results: SearchUser[];
  myId: number | null;
  onSendRequest: (id: number) => void;
}) {
  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users by username..."
        className="mb-4 h-[46px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-4 text-[13px] text-white outline-none focus:border-[#8b5cf6]"
      />

      {query.trim().length < 2 ? (
        <div className="rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-10 text-center text-[11px] text-[#4f5563]">
          Type at least 2 characters to search.
        </div>
      ) : searching ? (
        <div className="rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-10 text-center text-[11px] text-[#737887]">
          Searching...
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-10 text-center text-[11px] text-[#4f5563]">
          No users found.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((u) => {
            const isSelf = u.id === myId;
            const isFriend = u.friendStatus === "accepted";
            const isPendingOutgoing =
              u.friendStatus === "pending" && u.friendInitiator === myId;
            const isPendingIncoming =
              u.friendStatus === "pending" &&
              u.friendInitiator !== null &&
              u.friendInitiator !== myId;

            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-3"
              >
                <Avatar
                  avatar={u.avatar}
                  bannerColor={u.bannerColor}
                  accentColor={u.accentColor}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-white">
                    {u.username}
                  </div>
                  {isFriend && (
                    <div className="text-[9px] text-[#4ade80]">
                      Already friends
                    </div>
                  )}
                  {isPendingOutgoing && (
                    <div className="text-[9px] text-[#eab308]">
                      Request sent
                    </div>
                  )}
                  {isPendingIncoming && (
                    <div className="text-[9px] text-[#a78bfa]">
                      Sent you a request
                    </div>
                  )}
                </div>

                {isSelf ? (
                  <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#4f5563]">
                    You
                  </span>
                ) : isFriend ? (
                  <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#4ade80]">
                    Friends
                  </span>
                ) : isPendingOutgoing ? (
                  <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#eab308]">
                    Pending
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSendRequest(u.id)}
                    className="h-[34px] rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-4 text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#a78bfa] transition hover:bg-[#8b5cf6]/[0.15]"
                  >
                    {isPendingIncoming ? "Accept" : "Add friend"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}