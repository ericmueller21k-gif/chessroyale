import { account, finishSoloBossBattle, onAccountChange, onlineBattleToken, refreshProfile, startSoloBossBattle } from "./account.ts";

/**
 * Boss tokens on the result screen (Eric, Nov 2; docs/decisions/2026-11-02-boss-tokens.md). The server decides every drop; this
 * only asks it. A solo boss battle (Boss alone, a Solo raid) is noted on the server as it begins (`noteSoloBattle`: the server
 * keeps the time) and finished from its result screen, whose answer says the token it dropped. An online one is counted by its
 * match room as the results come up: the result screen asks for its battle's token (its lobby code) a few times while the room
 * writes the results.
 */

/** Your account has loaded (a START tapped the moment the app opens waits for it), or it didn't within `ms`. */
function accountReady(ms = 15_000): Promise<boolean> {
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
export function noteSoloBattle(match: object): void {
  solo.set(
    match,
    accountReady()
      .then((ok) => (ok ? startSoloBossBattle() : null))
      .catch(() => null),
  );
}

/** What a result screen knows of its match. */
export interface TokenMatch {
  settings: { raid?: boolean };
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
      if (id) token = (await finishSoloBossBattle(id).catch(() => null))?.token ?? null;
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
