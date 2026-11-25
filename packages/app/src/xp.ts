import { SOLO_ABANDON, XP, ownMoves, type OwnTurn, type XpGrant } from "@chessroyale/core";
import { endSoloLive, keepSoloLive, keepSoloResult, markSoloGameReal, onlineGameXp, refreshProfile, startSoloGame, type SoloRealFacts } from "./account.ts";
import { testParams } from "./test-switches.ts";
import { accountReady } from "./boss-tokens.ts";

/**
 * A game's XP on its result screen (Nov 9; the server decides it: server/xp.ts). A solo game is noted on the server as it begins
 * (`noteSoloGame`: the server keeps the time) and its result's answer carries the XP (App.tsx, recordSoloResult →
 * `settleSoloXp`). An online game's room writes it with the results: the screen asks for it by the lobby's code a few times
 * (XP.asksMs) while the room writes them (as boss tokens are asked for). A ranked 1 v 1's comes on its outcome message.
 */

/** Each solo game's id on the server, asked for as it began (null: none, no account yet). */
const soloGames = new WeakMap<object, Promise<string | null>>();
/**
 * The last solo result on its way to the server (App.tsx, as its result screen shows): a new game's start waits for it, as a start
 * records the open game as left if it's real (SOLO_ABANDON) and "Again" can come quicker than the post.
 */
let posting: Promise<unknown> = Promise.resolve();
export const postingSoloResult = (p: Promise<unknown>): void => void (posting = p.catch(() => undefined));
/**
 * A solo game begins: the server times it. `?xpgame=MINUTES` (a test switch): it counts as a game that long. `watch`: the game to tell
 * the server about at your SOLO_ABANDON.minMoves-th own move (watchSoloGame); none for a Battle Tower floor or a test game.
 */
export function noteSoloGame(match: object, watch?: SoloGameWatch): void {
  const minutes = Number(testParams().get("xpgame"));
  // (A START tapped the moment the app opens waits for your account, as boss tokens' does.)
  const body = Number.isFinite(minutes) && testParams().has("xpgame") ? { xpgame: minutes } : {};
  const before = posting;
  soloGames.set(
    match,
    accountReady()
      .then(async (ok) => {
        if (!ok) return null;
        await before;
        return startSoloGame(body);
      })
      .catch(() => null),
  );
  if (watch) watchSoloGame(match, watch);
}

/**
 * A solo game as watchSoloGame reads it: your turns so far (its record), its updates, whether it's over, its loss row's facts, its
 * result as posted (but its game's id) once it's decided (null before), and what to do as the page goes (SoloMatch.endOnHide).
 */
export interface SoloGameWatch {
  readonly moves: readonly OwnTurn[];
  subscribe(f: () => void): () => void;
  over(): boolean;
  facts(): SoloRealFacts;
  result(): Record<string, unknown> | null;
  hide(): void;
}

/** The real solo game this tab is playing, told as the page goes (SoloGameWatch.hide). */
let onHide: (() => void) | null = null;
let hideHeard = false;
function hideTo(f: (() => void) | null): void {
  onHide = f;
  if (f && !hideHeard && typeof addEventListener === "function") {
    hideHeard = true;
    addEventListener("pagehide", () => onHide?.());
  }
}

/**
 * Leaving a solo game after SOLO_ABANDON.minMoves of your own moves counts as a loss (Eric, Nov 22; server/xp.ts): at that move (core's
 * ownMoves, as XP counts them) the server is told that the game is real, and from then this device notes at each turn that a tab is
 * playing it (account.ts keepSoloLive), so the app's load in another tab leaves it be. The mark is done once the server answered;
 * while it fails (no answer, a server error) it's sent again at your next turn, one at a time. Decided, its result is kept on the device
 * at once, and the page going on the reveal of its last move ends it first (SoloGameWatch.hide). Its end (the result screen) takes the
 * note off; the result itself takes the game off the server.
 */
function watchSoloGame(match: object, w: SoloGameWatch): void {
  let real = false;
  /** The mark: to send (at the next turn), on its way, or answered. */
  let mark: "due" | "sending" | "done" = "due";
  let seen = -1;
  /** Its result, kept on the device (once) as the game is decided. */
  let kept = false;
  const id = () => soloGameId(match);
  const hide = () => w.hide();
  const off = w.subscribe(() => {
    const moved = w.moves.length !== seen;
    seen = w.moves.length;
    if (moved && !real && ownMoves(w.moves) >= SOLO_ABANDON.minMoves) {
      real = true;
      hideTo(hide);
    }
    // (Real and decided: its result is kept on the device at once (account.ts keepSoloResult), before any end moment plays (a beaten
    // boss's fall, the final's last move held), so a page closed or reloaded meanwhile still sends it and it's never recorded as left.
    // The result screen's post then sends it as usual.)
    const result = real && !kept ? w.result() : null;
    if (result) {
      kept = true;
      void id().then((g) => g && keepSoloResult(g, result));
    }
    if (w.over()) {
      off();
      if (real) {
        if (onHide === hide) hideTo(null);
        void id().then((g) => g && endSoloLive(g));
      }
      return;
    }
    if (!moved || !real) return;
    const facts = mark === "due" ? w.facts() : null;
    if (facts) mark = "sending";
    void id().then(async (g) => {
      if (!g) return void (mark = "done");
      keepSoloLive(g);
      if (facts) mark = (await markSoloGameReal(g, facts).catch(() => false)) ? "done" : "due";
    });
  });
}
/**
 * A Battle Tower floor's XP game (every floor is a counted solo game): a new floor's noted as it begins, its id handed to `keep` (kept
 * with the floor on the device); a rejoin goes on with the id kept (null: none, so no XP), never a new game, which would time the floor
 * from the reload (audit 2, finding 6).
 */
export function noteFloorGame(match: object, rejoin: { xp?: string } | null, keep: (id: string) => void): void {
  if (rejoin) return void soloGames.set(match, Promise.resolve(rejoin.xp ?? null));
  noteSoloGame(match);
  void soloGameId(match).then((id) => id && keep(id));
}
/**
 * A solo boss battle resumed from this device (step 2, Resume): it goes on with its own game on the server (its row open, its 10-move
 * mark as it was: a mark sent again changes nothing), never a new start, which would record it as left. Watched as at its start.
 */
export function resumeSoloGame(match: object, game: string, watch: SoloGameWatch): void {
  soloGames.set(match, Promise.resolve(game));
  watchSoloGame(match, watch);
}
/** The id the server gave this solo game as it began (null: none). */
export const soloGameId = (match: object): Promise<string | null> => soloGames.get(match) ?? Promise.resolve(null);

/** The address's switches that make a solo game a test game (no XP: "No XP: test game."): docs/areas/ops.md, "Test switches". */
const SOLO_TEST_SWITCHES = ["rounds", "clock", "finalTurns", "limit", "bossMoves", "draw", "power", "format", "speed", "weakbots", "pace", "augments", "start", "win", "mate", "phase", "laststand", "side", "form"];
/** This solo game is a test's: a test switch is on (only where they apply: testParams), or practice mode. */
export const soloTestGame = (practice: boolean): boolean => practice || SOLO_TEST_SWITCHES.some((k) => testParams().has(k));

/** The grants whose box has finished its fill (review m7): a later box for the same game (a remount) shows the end at once. */
const filledGrants = new WeakSet<XpGrant>();
export const markXpFilled = (xp: XpGrant): void => void filledGrants.add(xp);
export const xpFilled = (xp: XpGrant): boolean => filledGrants.has(xp);

/** Each game's XP, asked once, whoever asks: a promise of the grant (null: none came). */
const answers = new WeakMap<object, { p: Promise<XpGrant | null>; settle?: (x: XpGrant | null) => void }>();

/** A solo game's result came back from the server, with its XP (or none came). */
export function settleSoloXp(match: object, xp: XpGrant | null): void {
  const a = answers.get(match);
  if (a?.settle) a.settle(xp);
  else if (!a) answers.set(match, { p: Promise.resolve(xp) });
  if (xp && !xp.none) void refreshProfile().catch(() => undefined);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The XP this game earned you: an online game's by its code (asked at XP.asksMs while its room writes it), a solo one's when its
 * result comes back (`solo`). Null: none came (no account, the server never decided one).
 */
export function gameXp(match: object, opts: { code?: string | null; solo?: boolean }): Promise<XpGrant | null> {
  const a = answers.get(match);
  if (a) return a.p;
  if (opts.solo) {
    let settle!: (x: XpGrant | null) => void;
    const p = new Promise<XpGrant | null>((r) => (settle = r));
    answers.set(match, { p, settle });
    return p;
  }
  const code = opts.code;
  const p = (async () => {
    if (!code) return null;
    for (const ms of XP.asksMs) {
      await sleep(ms);
      const xp = await onlineGameXp(code).catch(() => null);
      if (xp) {
        if (!xp.none) void refreshProfile().catch(() => undefined);
        return xp;
      }
    }
    return null;
  })();
  answers.set(match, { p });
  return p;
}
