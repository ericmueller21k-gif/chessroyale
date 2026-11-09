import { account, finishSoloBossBattle, onAccountChange, onlineBattleToken, refreshProfile, startSoloBossBattle } from "./account.ts";

/**
 * Boss tokens on the result screen (Eric, Nov 2; docs/decisions/2026-11-02-boss-tokens.md). The server decides every drop; this
 * only asks it. A solo boss battle (Boss alone, a Solo raid) is noted on the server as it begins (`noteSoloBattle`: the server
 * keeps the time) and finished from its result screen, whose answer says the token it dropped. An online one is counted by its
 * match room as the results come up: the result screen asks for its battle's token (its lobby code) a few times while the room
 * writes the results.
 */

/** Your account has loaded (a START tapped the moment the app opens waits for it), or it didn't within `ms`. */
export function accountReady(ms = 15_000): Promise<boolean> {
  if (account().profile) return Promise.resolve(true);
  return new Promise((done) => {
    const off = onAccountChange(() => {
      if (!account().profile) return;
      off();
      clearTimeout(late);
      done(true);
    });
    const late = setTimeout(() => {
      off();
      done(false);
    }, ms);
  });
}

/** Each solo boss battle's id on the server, asked for as it began (null: no token to earn here). */
const solo = new WeakMap<object, Promise<string | null>>();
/** `town`: the boss challenged from the town (its start and its finish go into the town's chat, the server's lines). */
export function noteSoloBattle(match: object, town?: string): void {
  solo.set(
    match,
    accountReady()
      .then((ok) => (ok ? startSoloBossBattle(town) : null))
      .catch(() => null),
  );
}

/**
 * How a finished boss battle went, for the town's chat (the server posts it only for a challenge from the town): won, lost,
 * drawn or surrendered (a resign: the server posts it only after enough moves), and your moves; null for a leave (no line).
 */
export function battleOutcome(match: TokenMatch): { outcome: "won" | "lost" | "drew" | "surrendered"; moves: number } | null {
  const p = match.phase;
  if (p?.kind !== "results" || !p.bossResult) return null;
  const moves = (match.moves ?? []).filter((m) => m.move !== null).length;
  if (p.left) return (p.left as { how?: string }).how === "resigned" ? { outcome: "surrendered", moves } : null;
  return { outcome: p.bossResult === "crowd" ? "won" : p.bossResult === "boss" ? "lost" : "drew", moves };
}

/** What a result screen knows of its match. */
export interface TokenMatch {
  settings: { raid?: boolean };
  phase?: { kind: string; bossResult?: "crowd" | "boss" | "draw"; left?: unknown };
  /** Your moves (a pass is `null`): how many, for the town's chat line. */
  moves?: readonly { move: unknown }[];
  serverPaced?: boolean;
  code?: string;
}

/** How long after the results an online battle's screen asks again (ms, in turn): the room may still be writing them. */
const ONLINE_ASKS = [700, 1500, 3000, 6000, 10_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const answers = new WeakMap<object, Promise<string | null>>();

/** The token this boss battle dropped you (a boss's id), or null: asked once per battle, whoever asks. */
export function battleToken(match: TokenMatch): Promise<string | null> {
  let p = answers.get(match);
  if (p) return p;
  p = (async () => {
    if (!match.settings.raid) return null;
    let token: string | null = null;
    const started = solo.get(match);
    if (started) {
      const id = await started;
      if (id) token = (await finishSoloBossBattle(id, battleOutcome(match)).catch(() => null))?.token ?? null;
    } else if (match.serverPaced && match.code) {
      for (const ms of ONLINE_ASKS) {
        await sleep(ms);
        token = await onlineBattleToken(match.code).catch(() => null);
        if (token) break;
      }
    }
    // (Your locker's count, for the inventory and the shops.)
    if (token) void refreshProfile().catch(() => undefined);
    return token;
  })();
  answers.set(match, p);
  return p;
}

/** Battles whose token box was closed with OK: it doesn't come back on that result screen. */
export const tokenSeen = new WeakSet<object>();
