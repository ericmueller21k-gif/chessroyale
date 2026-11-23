import { newestCapture, type Capture } from "@chessroyale/chess";

/**
 * The queen banners as events (Eric, Nov 5: "the banner for his ult is tethered to when he ults, and the queen capture is
 * tethered to when your queens are captured. How could they ever intercross like they did?").
 *
 * They read only the board's capture records (BoardState.captures: written as each move is played, the boss's, yours or
 * one a power plays for either; a Revision removes the ones it crosses out), never the board itself. So a power that
 * changes the board around a queen (a burn, a bounce, a freeze, a Slam, a killer plant) can't make one, and one can't
 * hide a real one.
 *
 * - QUEEN DOWN!: once for each of the boss's moves that took your queen, keyed to that move's ply, on the screen where
 *   his move lands (bossShowMs gives it the time).
 * - QUEEN SLAIN!: once for each of your moves that took his queen, keyed to that ply, in his thinking straight after it
 *   (bossThinkMs gives it the time).
 *
 * Each is due only while its move is the board's newest, and shows once (bannerOn): a later screen of the same turn (the
 * Slam's, a bounce's, the funhouse's, his second thinking) draws the screen again without it. The power banners are
 * tied to their own events already: each power moment's (PowerMoment's `banner`) is keyed to its use (the event's kind
 * and turn) and drawn only within that moment's beats.
 */
export type QueenBannerKind = "down" | "slain";

export interface QueenBanner {
  kind: QueenBannerKind;
  /** The capture's ply (the moves on the board once it was played). */
  ply: number;
  /** Shown once by this key (bannerOn): the battle, the ply and the move. */
  key: string;
}

/** Which banner a capture plays for the crowd on `crowdSide`: his of your queen, yours of his; any other, none. */
export function queenBannerOf(c: Capture, crowdSide: "w" | "b", battle = ""): QueenBanner | null {
  if (c.piece !== "q") return null;
  const kind: QueenBannerKind | null = c.side !== crowdSide && c.color === crowdSide ? "down" : c.side === crowdSide && c.color !== crowdSide ? "slain" : null;
  return kind ? { kind, ply: c.ply, key: `${battle}:${kind}:${c.ply}:${c.from}${c.to}` } : null;
}

/** Every queen banner of the battle so far, in order, from its capture records. */
export function queenBanners(board: { captures?: readonly Capture[] | null }, crowdSide: "w" | "b", battle = ""): QueenBanner[] {
  return (board.captures ?? []).map((c) => queenBannerOf(c, crowdSide, battle)).filter((b) => b !== null);
}

/** What a boss screen is, for the queen banners: his move landing (`move`), his thinking (`thinking`), or neither (null). */
export type BannerScreen = "move" | "thinking" | null;

/**
 * The queen banner this screen may play: the newest move's capture record, if it took a queen, and the screen is that
 * banner's (QUEEN DOWN! as his move lands, QUEEN SLAIN! while he thinks). Whether it still shows is bannerOn's.
 */
export function dueQueenBanner(boss: { crowdSide: "w" | "b"; board: { history: readonly string[]; captures?: readonly Capture[] | null } }, screen: BannerScreen, battle = ""): QueenBanner | null {
  const c = screen ? newestCapture(boss.board) : null;
  const b = c ? queenBannerOf(c, boss.crowdSide, battle) : null;
  return b && (b.kind === "down" ? screen === "move" : screen === "thinking") ? b : null;
}

/**
 * The banners shown this battle: each one's key and when it first showed (ms). Per battle, on this device: it survives
 * the screen being drawn again or mounted anew (each of the boss's screens is), and starts afresh with a new battle
 * (resetBattleBanners, at its intro) or a reload.
 */
const shown = new Map<string, number>();
const KEPT = 64;

/**
 * Whether a banner shows at `now` (ms), `ms` long: from the first time it's asked for, until `ms` later; never again
 * after that, whatever draws the screen again.
 */
export function bannerOn(key: string, now: number, ms: number): boolean {
  let since = shown.get(key);
  if (since === undefined) {
    since = now;
    shown.set(key, since);
    if (shown.size > KEPT) shown.delete(shown.keys().next().value!);
  }
  return now >= since && now < since + ms;
}

/** A new battle: no banner of it has shown yet. */
export function resetBattleBanners(): void {
  shown.clear();
}
