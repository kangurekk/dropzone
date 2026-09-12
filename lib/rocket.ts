export type Phase = "waiting" | "flying" | "crashed";

export type RocketPlayer = {
  userId: number;
  username: string;
  avatar: string;
  bannerColor: string;
  accentColor: string;
  bet: number;
  cashedAt: number | null;
  cashoutMultiplier: number | null;
  payout: number;
};

export type RocketHistory = {
  roundId: number;
  crashAt: number;
};

export type RocketState = {
  roundId: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  flyingStartedAt: number;
  crashAt: number;
  currentMultiplier: number;
  players: RocketPlayer[];
  history: RocketHistory[];
};

const WAITING_MS = 10_000;
const CRASHED_MS = 5_000;
const GROWTH_COEFF = 0.035; // multiplier = e^(GROWTH_COEFF * t²)  gdzie t w sekundach
const GROWTH_EXP = 1.25;

declare global {
  // eslint-disable-next-line no-var
  var __rocketState: RocketState | undefined;
}

function newRound(roundId: number, history: RocketHistory[]): RocketState {
  const now = Date.now();
  return {
    roundId,
    phase: "waiting",
    phaseStartedAt: now,
    phaseEndsAt: now + WAITING_MS,
    flyingStartedAt: 0,
    crashAt: 0,
    currentMultiplier: 1,
    players: [],
    history,
  };
}

export function getRocketState(): RocketState {
  if (!global.__rocketState) {
    global.__rocketState = newRound(1, []);
  }
  return global.__rocketState;
}

function saveRocketState(s: RocketState) {
  global.__rocketState = s;
}

function generateCrashPoint(): number {
  const u = Math.random();
  // 1% chance of instant crash at 1.00x
  if (u < 0.01) return 1.0;
  // Standard formula with ~1% house edge
  const c = 0.99 / (1 - u);
  return Math.max(1.0, Math.floor(c * 100) / 100);
}

export function computeMultiplier(flyingStartedAt: number): number {
  const elapsedSec = (Date.now() - flyingStartedAt) / 1000;
  return Math.max(
    1,
    Math.exp(GROWTH_COEFF * Math.pow(elapsedSec, GROWTH_EXP))
  );
}

export function tickRocket() {
  const s = getRocketState();
  const now = Date.now();

  if (s.phase === "waiting" && now >= s.phaseEndsAt) {
    s.phase = "flying";
    s.flyingStartedAt = now;
    s.crashAt = generateCrashPoint();
    s.currentMultiplier = 1;
    s.phaseStartedAt = now;
    s.phaseEndsAt = 0;
    saveRocketState(s);
    return;
  }

  if (s.phase === "flying") {
    const m = computeMultiplier(s.flyingStartedAt);
    s.currentMultiplier = Math.floor(m * 100) / 100;

    if (m >= s.crashAt) {
      s.currentMultiplier = s.crashAt;
      s.phase = "crashed";
      s.phaseStartedAt = now;
      s.phaseEndsAt = now + CRASHED_MS;
      s.history = [
        { roundId: s.roundId, crashAt: s.crashAt },
        ...s.history,
      ].slice(0, 30);
      saveRocketState(s);
      return;
    }
    // Save multiplier so cashout uses fresh value
    saveRocketState(s);
  }

  if (s.phase === "crashed" && now >= s.phaseEndsAt) {
    global.__rocketState = newRound(s.roundId + 1, s.history);
  }
}

export function publicRocketState(viewerId: number) {
  const s = getRocketState();
  return {
    roundId: s.roundId,
    phase: s.phase,
    phaseStartedAt: s.phaseStartedAt,
    phaseEndsAt: s.phaseEndsAt,
    currentMultiplier: s.currentMultiplier,
    crashAt: s.phase === "crashed" ? s.crashAt : null,
    players: s.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      bannerColor: p.bannerColor,
      accentColor: p.accentColor,
      bet: p.bet,
      cashedAt: p.cashedAt,
      cashoutMultiplier: p.cashoutMultiplier,
      payout: p.payout,
      isMe: p.userId === viewerId,
    })),
    history: s.history,
  };
}

export function placeRocketBet(player: {
  userId: number;
  username: string;
  avatar: string;
  bannerColor: string;
  accentColor: string;
  bet: number;
}): { ok: boolean; error?: string } {
  const s = getRocketState();
  if (s.phase !== "waiting") return { ok: false, error: "Betting closed" };
  if (s.players.some((p) => p.userId === player.userId)) {
    return { ok: false, error: "Already bet this round" };
  }
  s.players.push({
    ...player,
    cashedAt: null,
    cashoutMultiplier: null,
    payout: 0,
  });
  saveRocketState(s);
  return { ok: true };
}

export function cashOutRocket(userId: number): {
  ok: boolean;
  error?: string;
  payout?: number;
  multiplier?: number;
} {
  const s = getRocketState();
  if (s.phase !== "flying") return { ok: false, error: "Not flying" };

  const p = s.players.find((x) => x.userId === userId);
  if (!p) return { ok: false, error: "Not in this round" };
  if (p.cashedAt != null) return { ok: false, error: "Already cashed out" };

  const m = Math.floor(computeMultiplier(s.flyingStartedAt) * 100) / 100;
  if (m >= s.crashAt) return { ok: false, error: "Too late" };

  p.cashedAt = Date.now();
  p.cashoutMultiplier = m;
  p.payout = Math.round(p.bet * m * 100) / 100;
  saveRocketState(s);

  return { ok: true, payout: p.payout, multiplier: m };
}