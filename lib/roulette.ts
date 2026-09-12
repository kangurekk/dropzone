export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type BetType =
  | "red"
  | "black"
  | "green"
  | "even"
  | "odd"
  | "low"
  | "high"
  | "dozen1"
  | "dozen2"
  | "dozen3"
  | "number";

export type Bet = {
  userId: number;
  username: string;
  type: BetType;
  number?: number;
  amount: number;
};

export type Phase = "betting" | "spinning" | "result";

export type RoundState = {
  roundId: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  winningNumber: number | null;
  bets: Bet[];
};

const BETTING_MS = 30_000;
const SPINNING_MS = 7_000;
const RESULT_MS = 6_000;

type GlobalState = {
  state: RoundState;
  timer: ReturnType<typeof setTimeout> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __rouletteState: GlobalState | undefined;
}

function getWinningNumberForRound(roundId: number): number {
  let hash = roundId * 2654435761;
  hash = (hash ^ (hash >>> 13)) * 1274126177;
  hash = hash ^ (hash >>> 16);
  return Math.abs(hash) % 37;
}

function createRound(roundId: number): RoundState {
  const now = Date.now();
  return {
    roundId,
    phase: "betting",
    phaseStartedAt: now,
    phaseEndsAt: now + BETTING_MS,
    winningNumber: null,
    bets: [],
  };
}

function advance(state: RoundState): RoundState {
  const now = Date.now();

  if (state.phase === "betting") {
    return {
      ...state,
      phase: "spinning",
      phaseStartedAt: now,
      phaseEndsAt: now + SPINNING_MS,
      winningNumber: getWinningNumberForRound(state.roundId),
    };
  }

  if (state.phase === "spinning") {
    return {
      ...state,
      phase: "result",
      phaseStartedAt: now,
      phaseEndsAt: now + RESULT_MS,
    };
  }

  return createRound(state.roundId + 1);
}

function ensureState(): GlobalState {
  if (!global.__rouletteState) {
    global.__rouletteState = {
      state: createRound(1),
      timer: null,
    };
  }
  return global.__rouletteState;
}

function tick() {
  const g = ensureState();
  g.state = advance(g.state);
  scheduleTick();
}

function scheduleTick() {
  const g = ensureState();
  const now = Date.now();
  const wait = Math.max(200, g.state.phaseEndsAt - now);

  if (g.timer) clearTimeout(g.timer);
  g.timer = setTimeout(tick, wait + 100);
}

export function getState(): RoundState {
  const g = ensureState();
  if (!g.timer) scheduleTick();

  const now = Date.now();
  let safety = 0;
  while (now >= g.state.phaseEndsAt && safety < 100) {
    g.state = advance(g.state);
    safety++;
  }
  if (!g.timer) scheduleTick();

  return g.state;
}

export function placeBet(bet: Bet): { ok: boolean; error?: string } {
  const g = ensureState();
  const now = Date.now();

  let safety = 0;
  while (now >= g.state.phaseEndsAt && safety < 100) {
    g.state = advance(g.state);
    safety++;
  }

  if (g.state.phase !== "betting") {
    return { ok: false, error: "Betting is closed" };
  }

  if (bet.amount < 1) {
    return { ok: false, error: "Minimum bet is $1" };
  }

  g.state.bets.push(bet);
  return { ok: true };
}

export function payoutFor(bet: Bet, winning: number): number {
  const isRed = RED_NUMBERS.has(winning);
  const isBlack = winning !== 0 && !isRed;
  const isGreen = winning === 0;

  switch (bet.type) {
    case "red":
      return isRed ? bet.amount * 2 : 0;
    case "black":
      return isBlack ? bet.amount * 2 : 0;
    case "green":
      return isGreen ? bet.amount * 36 : 0;
    case "even":
      return winning !== 0 && winning % 2 === 0 ? bet.amount * 2 : 0;
    case "odd":
      return winning % 2 === 1 ? bet.amount * 2 : 0;
    case "low":
      return winning >= 1 && winning <= 18 ? bet.amount * 2 : 0;
    case "high":
      return winning >= 19 && winning <= 36 ? bet.amount * 2 : 0;
    case "dozen1":
      return winning >= 1 && winning <= 12 ? bet.amount * 3 : 0;
    case "dozen2":
      return winning >= 13 && winning <= 24 ? bet.amount * 3 : 0;
    case "dozen3":
      return winning >= 25 && winning <= 36 ? bet.amount * 3 : 0;
    case "number":
      return bet.number === winning ? bet.amount * 36 : 0;
  }
}