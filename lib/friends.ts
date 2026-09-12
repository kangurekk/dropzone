import db from "./db";

export type FriendStatus = "pending" | "accepted" | "rejected";

export type FriendEntry = {
  id: number;
  userId: number;
  username: string;
  avatar: string;
  accentColor: string;
  status: FriendStatus;
  initiatorId: number;
  createdAt: number;
  updatedAt: number;
};

export function getFriendship(userA: number, userB: number) {
  return db
    .prepare(
      `SELECT * FROM friendships
       WHERE (user_id = ? AND friend_id = ?)
          OR (user_id = ? AND friend_id = ?)
       LIMIT 1`
    )
    .get(userA, userB, userB, userA) as any;
}

export function areFriends(userA: number, userB: number): boolean {
  const row = getFriendship(userA, userB);
  return row?.status === "accepted";
}