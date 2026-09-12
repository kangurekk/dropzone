import { getSessionUser } from "./auth";
import db from "./db";

export async function getAdminUser(): Promise<{
  id: number;
  username: string;
} | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const row = db
    .prepare("SELECT id, username, is_admin FROM users WHERE id = ?")
    .get(session.id) as
    | { id: number; username: string; is_admin: number }
    | undefined;

  if (!row || row.is_admin !== 1) return null;

  return { id: row.id, username: row.username };
}