import { SOLO_ABANDON, ownMoves, type Settings } from "@chessroyale/core";
import type { SoloRealFacts } from "./account.ts";
import type { KeptGame } from "./tower.ts";

/**
 * A solo boss battle kept on this device so it can be resumed after a reload (Eric, Nov 22, step 2: "You have a game in progress,
 * Resume or Forfeit?"; docs/decisions/2026-11-22-solo-resume.md). Boss alone and a Solo raid, never the Hidden Boss (his forms and
 * phase 2 aren't in the runner's snapshot), a test game or a Battle Tower floor (kept by tower.ts). Kept as a floor is (solo.ts's
 * keeper: the runner's snapshot, your moves, the time used on your turn) from your first move, one a device, with the account and the
 * server's ids. Cleared once the game is decided (its result is then kept by account.ts until sent) or forfeited.
 */
export interface KeptSolo {
  v: 1;
  /** The account it's for: another account's is never offered. */
  user: string;
  /** The server's solo game (xp.ts noteSoloGame): resumed with it, so its row and its 10-move mark stay as they were. */
  game: string;
  /** Its boss battle on the server (boss tokens; null: none to earn). */
  battle: string | null;
  /** When it began on this device: SOLO_ABANDON.staleHours after, the server records it as left, and it's dropped here. */
  at: number;
  /** The match's settings as its runner had them. */
  settings: Settings;
  /** A Solo raid (bots in the crowd); false: Boss alone. */
  bots: boolean;
  /** The boss (the card's portrait and name). */
  boss: string;
  /** Its loss row's facts (the 10-move mark's), sent with a Forfeit past the mark. */
  facts: SoloRealFacts;
  /** The game as it stood at its last step. */
  kept: KeptGame;
  /**
   * The tab playing it (`TAB`; unset: none since it was kept): a Resume claims it, and every keep checks it, so a tab whose game another
   * tab took over stops there and never writes it back (the review of #885, I1: two tabs each played on from the card they were offered).
   */
  tab?: string;
}

export const KEPT_KEY = "brc.soloKept";
/** This tab (this page's load): who holds the kept game (KeptSolo.tab). */
const TAB = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** A kept game read back, or null when there's none or it isn't one (another version, a damaged entry). */
export function readKeptSolo(text: string | null): KeptSolo | null {
  if (!text) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  const k = v as Partial<KeptSolo> | null;
  if (!k || typeof k !== "object" || k.v !== 1 || typeof k.user !== "string" || typeof k.game !== "string" || typeof k.boss !== "string") return null;
  if (typeof k.at !== "number" || !Number.isFinite(k.at) || !k.settings || typeof k.settings !== "object" || !k.facts || typeof k.facts !== "object") return null;
  const g = k.kept as Partial<KeptGame> | undefined;
  if (!g || typeof g !== "object" || !g.snapshot || typeof g.snapshot !== "object" || !g.snapshot.state || !Array.isArray(g.snapshot.boards) || !Array.isArray(g.moves)) return null;
  return {
    v: 1,
    user: k.user,
    game: k.game,
    battle: typeof k.battle === "string" ? k.battle : null,
    at: k.at,
    settings: k.settings,
    bots: k.bots === true,
    boss: k.boss,
    facts: k.facts,
    kept: { snapshot: g.snapshot, moves: g.moves, intro: !!g.intro, ...(typeof g.turnMs === "number" && Number.isFinite(g.turnMs) && g.turnMs > 0 ? { turnMs: g.turnMs } : {}) },
    ...(typeof k.tab === "string" ? { tab: k.tab } : {}),
  };
}

export function loadKeptSolo(): KeptSolo | null {
  try {
    return readKeptSolo(localStorage.getItem(KEPT_KEY));
  } catch {
    return null;
  }
}

/** Written; false: no storage, or full (a reload then can't resume it, and the game counts as left, as before step 2). */
function saveKeptSolo(k: KeptSolo): boolean {
  try {
    localStorage.setItem(KEPT_KEY, JSON.stringify(k));
    return true;
  } catch {
    return false;
  }
}

/** Resume's claim (account.ts takeKeptSolo): the kept game is this tab's from now; another tab playing it stops at its next keep. */
export const claimKeptSolo = (k: KeptSolo): void => void saveKeptSolo({ ...k, tab: TAB });

/** `k` is held by this tab (it kept it, or its Resume claimed it). */
const heldHere = (k: KeptSolo | null, game: string): boolean => k?.game === game && k.tab === TAB;

/** The kept game dropped (`game`: only if it's that one: another may have been kept since, by another tab). */
export function clearKeptSolo(game?: string): void {
  try {
    if (game === undefined || loadKeptSolo()?.game === game) localStorage.removeItem(KEPT_KEY);
  } catch {
    // No storage.
  }
}

/** It began SOLO_ABANDON.staleHours ago: the server records it as left at any profile read, so it's never resumed. */
export const keptStale = (k: Pick<KeptSolo, "at">, now = Date.now()): boolean => now - k.at >= SOLO_ABANDON.staleHours * 3_600_000;

/** The kept game for this account (`user`), not stale; null for none or another account's. */
export function keptSoloFor(user: string | null | undefined, now = Date.now()): KeptSolo | null {
  const k = loadKeptSolo();
  return k && user && k.user === user && !keptStale(k, now) ? k : null;
}

/** Your moves in a kept game (core's ownMoves, as XP and the 10-move mark count them): the card's move number. */
export const keptMoves = (k: Pick<KeptSolo, "kept">): number => ownMoves(k.kept.moves);

/** Past the mark: a Forfeit counts as a loss (SOLO_ABANDON.minMoves). */
export const keptReal = (k: Pick<KeptSolo, "kept">): boolean => keptMoves(k) >= SOLO_ABANDON.minMoves;

/**
 * What keeps a solo boss battle on the device as it's played (SoloMatch.kept; the same steps as a tower floor's FloorPlay): the game as
 * it stands after every step, written once the server's ids are in (`ready`) and from your first move (SOLO_ABANDON.keepFromMoves).
 * `end`: the game is decided, resigned or forfeited: cleared, and nothing more is written. Every write after the first checks this tab
 * still holds it (KeptSolo.tab): another tab's Resume took it over, or another tab ended it or started another game, and this one stops
 * (`lost`: App.tsx stops the match, "Played in another tab."), never writing it back.
 */
export class SoloKeep {
  private ids: { user: string; game: string; battle: string | null } | null = null;
  private last: KeptGame | null = null;
  private over = false;
  /** This tab holds the kept game: it wrote it, or its Resume claimed it (`ready`). */
  private held = false;
  constructor(
    private readonly base: {
      at: number;
      bots: boolean;
      settings: () => Settings;
      facts: () => SoloRealFacts;
      boss: () => string | null;
      /** Another tab took this game over (or ended it): this tab's match stops. */
      lost?: () => void;
    },
  ) {}
  /**
   * The account and the server's ids, known once its start answered (a resumed game's at once, held by this tab if its Resume's claim was
   * written): what's kept so far is written.
   */
  ready(user: string, game: string, battle: string | null): void {
    if (this.over || this.ids) return;
    this.ids = { user, game, battle };
    this.held = heldHere(loadKeptSolo(), game);
    this.write();
  }
  keep(game: KeptGame): void {
    if (this.over) return;
    this.last = game;
    this.write();
  }
  /** The time you've used on this turn (KeptGame.turnMs), kept with the game as it stands: the page hidden or closed. */
  keepTurn(ms: number): void {
    if (this.over || !this.last) return;
    this.keep({ ...this.last, turnMs: Math.max(0, Math.round(ms)) });
  }
  /** Decided, resigned or given up: the kept game goes (only if it's still this one), and nothing is written again. */
  end(): void {
    if (this.over) return;
    this.over = true;
    if (this.ids) clearKeptSolo(this.ids.game);
  }
  get ended(): boolean {
    return this.over;
  }
  private write() {
    const ids = this.ids;
    const game = this.last;
    const boss = this.base.boss();
    if (!ids || !game || !boss || ownMoves(game.moves) < SOLO_ABANDON.keepFromMoves) return;
    // (Held, and no longer this tab's: taken over, ended or replaced by another tab. Nothing more is written; the match stops.)
    if (this.held && !heldHere(loadKeptSolo(), ids.game)) {
      this.over = true;
      return this.base.lost?.();
    }
    if (saveKeptSolo({ v: 1, ...ids, at: this.base.at, settings: this.base.settings(), bots: this.base.bots, boss, facts: this.base.facts(), kept: game, tab: TAB })) this.held = true;
  }
}

// ---------------- The card's answers (components/GameInProgress.tsx; App.tsx registers Resume) ----------------

/** The app's answers (App.tsx registers them): back into a kept game, and a line on home (a Resume or Forfeit refused). */
type KeptAnswers = { resume: (k: KeptSolo) => void; note: (line: string) => void };
let answers: KeptAnswers | null = null;
export function onKeptAnswers(a: KeptAnswers): () => void {
  answers = a;
  return () => {
    if (answers === a) answers = null;
  };
}
/** Resume, from the card: back into the same battle exactly where it is kept now (App.tsx, account.ts takeKeptSolo). */
export const resumeKeptSolo = (k: KeptSolo): void => answers?.resume(k);
/** Why a Resume or Forfeit was refused ("That game has already ended.", "Played in another tab."), on home's error line. */
export const keptNote = (line: string): void => answers?.note(line);

/** Another solo game about to start with one kept: the question on screen and its answer (true: forfeit it and go on). */
let asked: { kept: KeptSolo; answer: (go: boolean) => void } | null = null;
const askWatch = new Set<() => void>();
export const forfeitAsk = (): { kept: KeptSolo; answer: (go: boolean) => void } | null => asked;
export function onForfeitAsk(fn: () => void): () => void {
  askWatch.add(fn);
  return () => void askWatch.delete(fn);
}
/**
 * Before another solo game starts on this device (any solo mode, a Battle Tower floor): the game kept for this account (account.ts
 * askForfeitFirst: `kept`, null for none) asks first, "Forfeit your game in progress?", instead of the start recording it as left unasked
 * (step 2). True: none kept, or Forfeit (the card's forfeit done first); false: Cancel, nothing starts. A second ask replaces the first
 * (answered false).
 */
export function askForfeit(kept: KeptSolo | null): Promise<boolean> {
  if (!kept) return Promise.resolve(true);
  return new Promise((done) => {
    asked?.answer(false);
    const mine = {
      kept,
      answer: (go: boolean) => {
        if (asked === mine) asked = null;
        askWatch.forEach((f) => f());
        done(go);
      },
    };
    asked = mine;
    askWatch.forEach((f) => f());
  });
}
