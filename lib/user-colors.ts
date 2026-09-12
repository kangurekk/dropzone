export type UserColors = {
  bannerColor?: string | null;
  accentColor?: string | null;
};

export const DEFAULT_BANNER = "#8b5cf6";
export const DEFAULT_ACCENT = "#a78bfa";

/**
 * Returns a gradient string that gives each user their own color identity.
 * Falls back to defaults when colors are missing.
 */
export function avatarGradient(
  bannerColor?: string | null,
  accentColor?: string | null
): string {
  const b = bannerColor || DEFAULT_BANNER;
  const a = accentColor || DEFAULT_ACCENT;
  return `linear-gradient(135deg, ${b}, ${a})`;
}

/**
 * Solid color for badges, borders, glow.
 */
export function userAccent(accentColor?: string | null): string {
  return accentColor || DEFAULT_ACCENT;
}