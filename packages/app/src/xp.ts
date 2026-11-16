import { XP, type XpGrant } from "@chessroyale/core";
import { onlineGameXp, refreshProfile, startSoloGame } from "./account.ts";
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
/** A solo game begins: the server times it. `?xpgame=MINUTES` (a test switch): it counts as a game that long. */
export function noteSoloGame(match: object): void {
  const minutes = Number(testParams().get("xpgame"));
  // (A START tapped the moment the app opens waits for your account, as boss tokens' does.)
  const body = Number.isFinite(minutes) && testParams().has("xpgame") ? { xpgame: minutes } : {};
  soloGames.set(
    match,
    accountReady()
      .then((ok) => (ok ? startSoloGame(body) : null))
      .catch(() => null),
  );
}
/** The id the server gave this solo game as it began (null: none). */
export const soloGameId = (match: object): Promise<string | null> => soloGames.get(match) ?? Promise.resolve(null);

/** The address's switches that make a solo game a test game (no XP: "No XP: test game."): docs/areas/ops.md, "Test switches". */
const SOLO_TEST_SWITCHES = ["rounds", "clock", "finalTurns", "bossMoves", "draw", "power", "format", "speed", "weakbots", "pace", "augments", "start", "win", "mate", "phase", "laststand", "side", "form"];
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
