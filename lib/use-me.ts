"use client";

import { useEffect, useState } from "react";

export type Me = {
  id: number;
  username: string;
  balance: number;
  avatar: string | null;
  avatarFocalX: number;
  avatarFocalY: number;
  avatarZoom: number;
  bannerColor: string | null;
  accentColor: string | null;
  bio: string | null;
  isAdmin: boolean;
} | null;

let cachedMe: Me = null;
let cachedAt = 0;
const CACHE_MS = 5000;

/**
 * Global hook — fetches the current user once and shares across components.
 * Cached for 5 seconds to avoid a fetch storm when multiple components mount.
 */
export function useMe(): { me: Me; loading: boolean; refresh: () => void } {
  const [me, setMe] = useState<Me>(cachedMe);
  const [loading, setLoading] = useState(cachedMe === null);

  async function fetchMe() {
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      cachedMe = d.user ?? null;
      cachedAt = Date.now();
      setMe(cachedMe);
    } catch {
      cachedMe = null;
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Use cache if fresh
    if (cachedMe && Date.now() - cachedAt < CACHE_MS) {
      setMe(cachedMe);
      setLoading(false);
      return;
    }

    fetchMe();
  }, []);

  return { me, loading, refresh: fetchMe };
}