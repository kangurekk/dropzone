export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K";

export type Card = { rank: Rank; suit: Suit };

export type PublicCard =
| { rank: Rank; suit: Suit; hidden?: false }
| { hidden: true };

export type Outcome = "blackjack" | "win" | "push" | "lose" | "bust";

export type Session = {
  userId: number;
  username: string;
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  outcome?: Outcome;
  payout?: number;
  startedAt: number;
};

const RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

export function hideCard(): PublicCard {
  return { hidden: true };
}

export function isHiddenCard(c: PublicCard): c is { hidden: true } {
  return "hidden" in c && c.hidden === true;
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ rank: r, suit: s });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function handValue(hand: Card[]): {
  total: number;
  soft: boolean;
} {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J", "10"].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank, 10);
    }
  }

  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  soft = aces > 0 && total <= 21;

  return { total, soft };
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand).total === 21;
}

export function isBust(hand: Card[]): boolean {
  return handValue(hand).total > 21;
}

export function shouldDealerHit(hand: Card[]): boolean {
  const { total } = handValue(hand);
  // Stand on soft 17+
  return total < 17;
}

export function resolveOutcome(
  playerHand: Card[],
  dealerHand: Card[],
  bet: number
): { outcome: Outcome; payout: number } {
  const p = handValue(playerHand).total;
  const d = handValue(dealerHand).total;
  const playerBJ = isBlackjack(playerHand);
  const dealerBJ = isBlackjack(dealerHand);

  // Player blackjack wins immediately, pays 3:2 (unless dealer also has BJ)
  if (playerBJ && !dealerBJ) {
    return { outcome: "blackjack", payout: bet * 2.5 };
  }

  if (playerBJ && dealerBJ) {
    return { outcome: "push", payout: bet };
  }

  if (p > 21) return { outcome: "bust", payout: 0 };
  if (d > 21) return { outcome: "win", payout: bet * 2 };

  if (p > d) return { outcome: "win", payout: bet * 2 };
  if (p < d) return { outcome: "lose", payout: 0 };
  return { outcome: "push", payout: bet };
}

/* ─────────────────────────────────────────────────
   Sessions storage — in-memory, per user
   ───────────────────────────────────────────────── */

declare global {
  // eslint-disable-next-line no-var
  var __blackjackSessions: Map<number, Session> | undefined;
}

if (!global.__blackjackSessions) global.__blackjackSessions = new Map();

const SESSION_MAX_MS = 30 * 60 * 1000; // 30 min max

export function getSession(userId: number): Session | null {
  const map = global.__blackjackSessions!;
  const s = map.get(userId);
  if (!s) return null;

  // Expire stale sessions
  if (Date.now() - s.startedAt > SESSION_MAX_MS) {
    map.delete(userId);
    return null;
  }

  return s;
}

export function setSession(s: Session) {
  global.__blackjackSessions!.set(s.userId, s);
}

export function clearSession(userId: number) {
  global.__blackjackSessions!.delete(userId);
}

export function draw(session: Session): Card {
  if (session.deck.length < 10) {
    // Reshuffle mid-hand if running low
    session.deck = buildDeck();
  }
  return session.deck.pop()!;
}

export function startHand(
  userId: number,
  username: string,
  bet: number
): Session {
  const deck = buildDeck();
  const session: Session = {
    userId,
    username,
    deck,
    playerHand: [],
    dealerHand: [],
    bet,
    doubled: false,
    done: false,
    startedAt: Date.now(),
  };

  // Deal: player, dealer, player, dealer
  session.playerHand.push(draw(session));
  session.dealerHand.push(draw(session));
  session.playerHand.push(draw(session));
  session.dealerHand.push(draw(session));

  // Natural blackjack for player? Auto-resolve.
  if (isBlackjack(session.playerHand)) {
    session.done = true;
    const { outcome, payout } = resolveOutcome(
      session.playerHand,
      session.dealerHand,
      session.bet
    );
    session.outcome = outcome;
    session.payout = payout;
  }

  return session;
}