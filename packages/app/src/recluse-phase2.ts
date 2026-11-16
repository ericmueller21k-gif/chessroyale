import { BOSS_BANNER, RECLUSE_PHASE2, bannerPlusMs } from "@chessroyale/core";
import { RECLUSE } from "./characters/recluse.ts";
import { animLength, cueAt } from "./characters/power-art.ts";
import { lazyTable } from "./characters/sprite.ts";
import { RECLUSE_LINES } from "./characters/recluse-lines.ts";
import { pacedLine } from "./paced-line.ts";
import { play } from "./sound.ts";
import { INTERRUPT, bossVoice } from "./speech.tsx";
import {
  applyMove,
  baseAt,
  legalMoves,
  phase2BossMove,
  phase2Clock,
  phase2Move,
  phase2Next,
  phase2Outcome,
  phase2Resign,
  phase2Slash,
  phase2ToMove,
  phase2WinAll,
  startPhase2,
  toSan,
  type Base,
  type MoveScore,
  type Phase2Board,
  type Phase2Engine,
  type Phase2Judged,
  type Phase2State,
} from "@chessroyale/chess";

/**
 * The phase change (Eric, Oct 14; since Nov 14 his transformation by the book's light, no God King: docs/decisions/
 * 2026-11-14-recluse-transformation.md), ms from its start, which follows his cutscene with no break: the man still kneeling in its
 * light beside the child (components/RecluseTransform.tsx draws it over the board; screens/Recluse2.tsx the board, the split and
 * the dock). The beats are settings (RECLUSE_PHASE2.change.transform):
 * - the book flat on the board before him falls open, its pages lighting up (the transformation theme's intro starts);
 * - on the music's slam the light bursts out and takes him: his head goes back, his eyes go totally white (`burstAt`);
 * - on its build a shaft of it lifts him off his knees, his arms hanging at his sides (`riseAt`), and it grows faster and faster:
 *   it engulfs him, shoots up off the screen (`shootAt`), radiates in every direction (`radiateAt`) and whites out the whole
 *   screen (`whiteAt` to `whiteFull`); unseen in the white he's set down in his final form, and the child and the lens go;
 * - the light dies back into the center (`downAt`) and shows him (`revealAt`), his eyes glowing; his first line
 *   (`chantLines[0]`, over his head);
 * - he crouches and leaps on the music's breath (`upAt`), and lands as it drops: the board cracks under him (`crackAt`, the
 *   music's drop: `introMs`), the big board gone from that frame on; blue arcs strike from his hands at his sides (`arcAt` to
 *   `arcEnd`); the quarters part and grow into four boards as the light dies; his second line (`chantLines[1]`);
 * - the book snaps shut and flies up into his hands while every board's pieces fly to their Chess960 squares; he leaps back to his
 *   place, in phase 2's idle (in his final form) from then on;
 * - "PHASE 2"; then phase 2's boards, still, with a big 5, 4, 3, 2, 1 on every one (`countdownMs`), and the clocks start.
 * The God King stays in his place, greyed, throughout (Eric, Nov 14).
 */
export const PHASE_CHANGE = lazyTable(() => {
  const a = RECLUSE.anims;
  const len = (n: string) => animLength(a[n]!);
  const pace = RECLUSE_PHASE2.change;
  // (The beats are settings from the transformation theme's start, `musicAtMs` in: here, from the phase change's.)
  const { musicAtMs, introMs, riseMs, leapMs, line2AfterMs, ...beats } = pace.transform;
  const T = { musicAtMs, introMs, riseMs, leapMs, line2AfterMs, ...Object.fromEntries(Object.entries(beats).map(([k, v]) => [k, v + musicAtMs])) } as typeof pace.transform;
  // (His fall before it: a setting since Nov 13, as the lobby server times it too.)
  const fallMs = pace.fallMs;
  const crackAt = musicAtMs + introMs;
  const upAt = crackAt - T.leapMs;
  const crouchAt = upAt - 200;
  // (His two lines, each typed sentence by sentence at the cutscene's pace: the first, a little faster, as he stands revealed, its
  // box held through the crouch, gone as he leaps; the second as the board splits.)
  const cl = pace.chantLines;
  const first = pacedLine(RECLUSE_LINES.chantSay[0]!, { ...cl, typeMs: cl.firstTypeMs });
  const chantLines = [
    { at: T.line1At, line: { ...first, holdMs: Math.min(first.holdMs, upAt - T.line1At) } },
    { at: crackAt + T.line2AfterMs, line: pacedLine(RECLUSE_LINES.chantSay[1]!, cl) },
  ];
  const partAt = crackAt + 750;
  const growAt = partAt + 400;
  const growMs = 900;
  // (The arcs from the landing until the boards settle; their crackle starts a moment before, so its two snaps fall on the big
  // ones: recluse-sounds.ts, `arc`.)
  const arcAt = crackAt - 200;
  const arcEnd = growAt + growMs - 100;
  const pickupAt = growAt + growMs + 100;
  const catchAt = pickupAt + (cueAt(a.pickup!, "catch") ?? 0);
  const shuffleAt = pickupAt + 150;
  const shuffleMs = 900;
  const backAt = pickupAt + len("pickup");
  const homeAt = backAt + len("leap2");
  const bannerAt = Math.max(homeAt, shuffleAt + shuffleMs) + 100;
  // ("PHASE 2": a boss's banner, 1.4 s; Eric, Oct 16, a second shorter again; Oct 24, the banners' extra on top
  // (bannerPlusMs). The clocks start after it.)
  const bannerMs = BOSS_BANNER.phase2Ms;
  // (Then phase 2's boards, still: a big 5, 4, 3, 2, 1 on every one before the clocks run. SimulScreen draws it.)
  const countdownMs = pace.countdownSeconds * 1000;
  return {
    fallMs,
    ...T,
    crouchAt,
    upAt,
    chantLines,
    crackAt,
    partAt,
    growAt,
    growMs,
    arcAt,
    arcEnd,
    pickupAt,
    catchAt,
    shuffleAt,
    shuffleMs,
    backAt,
    homeAt,
    bannerAt,
    get bannerMs(): number {
      return bannerMs + bannerPlusMs();
    },
    get total(): number {
      return bannerAt + bannerMs + bannerPlusMs();
    },
    countdownMs,
  };
});

/**
 * His figure where he stands through the phase change (BossCharacter's figure run, from `at`, the change's start): his place
 * stands empty while the board draws him (`rc-away`), and once he's back he rests in phase 2's idle, in his final form.
 */
export function phaseChangeRun(at: number) {
  return { since: at, anims: [], loop: "idle2" } as const;
}

/**
 * The arcs that strike the board as it splits (Eric, Oct 14: smooth, thin bright cores with a soft glow): when each
 * strikes (ms into the phase change), from which of his hands (0: our left), where on the cracks it lands (% of
 * the board), its shape's seed, and whether it's one of the two big ones (both hands at once, as the board cracks and
 * as it parts). The same every time.
 */
export interface ArcStrike {
  at: number;
  hand: 0 | 1;
  to: readonly [number, number];
  seed: number;
  big: boolean;
}
/** How long an arc shows (ms), and how often its shape is drawn again while it does. */
export const ARC_LIFE = 260;
export const ARC_REDRAW = 70;
export const ARC_STRIKES: readonly ArcStrike[] = lazyTable(() => {
  const C = PHASE_CHANGE;
  let s = 0x2f6b9e1;
  const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 2 ** 32);
  const out: ArcStrike[] = [];
  // A point on the cracks, on his hand's side: down the middle (above him or below), or out along the cross.
  const target = (hand: 0 | 1): [number, number] => {
    const r = rnd();
    const side = hand === 0 ? -1 : 1;
    if (r < 0.3) return [50, 4 + rnd() * 26];
    if (r < 0.55) return [50, 72 + rnd() * 24];
    return [50 + side * (12 + rnd() * 38), 50];
  };
  // (The small ones from his landing on: his hands are at his sides from then.)
  for (let t = C.crackAt + 60, i = 0; t < C.arcEnd - ARC_LIFE / 2; t += 85 + rnd() * 60, i++) {
    const hand = (i % 2) as 0 | 1;
    out.push({ at: Math.round(t), hand, to: target(hand), seed: 1 + Math.floor(rnd() * 1e6), big: false });
  }
  for (const at of [C.crackAt, C.partAt])
    for (const hand of [0, 1] as const) out.push({ at, hand, to: hand === 0 ? [4, 50] : [96, 50], seed: 1 + Math.floor(rnd() * 1e6), big: true });
  return out.sort((x, y) => x.at - y.at);
});

type Pt = readonly [number, number];
/**
 * An arc's points from `a` to `b`: midpoint displacement (each segment's middle pushed off the line, less at each level),
 * so it's jagged in the small and smooth in the large; `seed` picks its shape.
 */
export function arcPoints(a: Pt, b: Pt, seed: number, depth = 4, rough = 0.16): Pt[] {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 2 ** 32) * 2 - 1;
  let pts: Pt[] = [a, b];
  let amp = Math.hypot(b[0] - a[0], b[1] - a[1]) * rough;
  for (let d = 0; d < depth; d++) {
    const next: Pt[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!;
      const q = pts[i]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const o = rnd() * amp;
      next.push([(p[0] + q[0]) / 2 + (-(q[1] - p[1]) / len) * o, (p[1] + q[1]) / 2 + ((q[0] - p[0]) / len) * o], q);
    }
    pts = next;
    amp *= 0.55;
  }
  return pts;
}
/** A smooth path through points (curves through the midpoints, the points their control points): no sharp zigzags. */
export function smoothPath(pts: readonly Pt[]): string {
  const f = (v: number) => Math.round(v * 100) / 100;
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join(" ");
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const n = pts[i + 1]!;
    d += ` Q${f(p[0])} ${f(p[1])} ${f((p[0] + n[0]) / 2)} ${f((p[1] + n[1]) / 2)}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d} L${f(last[0])} ${f(last[1])}`;
}

/** How a cut heart looks `t` ms after its cut (slashLook): its blade's glint, the blade's stroke, the two halves, the board's grey. */
export interface SlashLook {
  /** The glint of his blade drawn back past the heart's top-right corner, in fractions of the heart; null once it has gone through. */
  glint: { x: number; y: number; o: number; s: number } | null;
  /** The stroke across the heart (its length 0 to 1, from the top-right corner down to the bottom-left; its opacity), or null. */
  blade: { len: number; o: number } | null;
  /** The two halves (the upper left's, the lower right's): their shift (fractions of the heart), turn (degrees) and opacity. */
  a: { x: number; y: number; r: number; o: number };
  b: { x: number; y: number; r: number; o: number };
  /** Done: the slot shows the empty heart alone. */
  done: boolean;
}

const easeIn = (x: number) => x * x * x;
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const unit = (x: number) => Math.max(0, Math.min(1, x));

/**
 * A heart cut, `t` ms after its cut began (Eric, Nov 16: "a slash with a wind-up (slow) then a fast follow-through across the heart,
 * the heart cut in half, both halves sliding apart and fading"; no flash): for `windMs` his blade's glint draws back past the heart's
 * top-right corner, slowly and then faster; it goes through in `bladeMs`, the stroke fading after; the halves slide apart along the
 * cut and fade until `ms`. Pure: the screen draws it from the time since the cut, so a board drawn again mid-cut carries on from where
 * it was. (A board whose last heart it was greys out by CSS: Recluse2.tsx's Cell.)
 */
export function slashLook(t: number, s: { windMs: number; ms: number } = RECLUSE_PHASE2.slash): SlashLook {
  const bladeMs = 90;
  const wind = unit(t / s.windMs);
  const after = t - s.windMs;
  const glint = t < s.windMs ? { x: 0.7 + 0.35 * easeIn(wind), y: -0.15 - 0.35 * easeIn(wind), o: unit(wind * 2.5), s: 0.5 + 0.5 * wind } : null;
  const blade = after >= 0 && after < bladeMs + 260 ? { len: easeOut(unit(after / bladeMs)), o: 1 - unit((after - bladeMs) / 260) } : null;
  const apart = easeOut(unit(after / (s.ms - s.windMs)));
  const fade = unit((after - 120) / (s.ms - s.windMs - 120));
  return {
    glint,
    blade,
    a: { x: -0.32 * apart, y: -0.26 * apart, r: -16 * apart, o: 1 - fade },
    b: { x: 0.3 * apart, y: 0.3 * apart, r: 14 * apart, o: 1 - fade },
    done: t >= s.ms,
  };
}

/**
 * His line as one of your hearts is cut (`left`: how many you have left after it; Eric, Nov 16: harder as they run out): a taunt
 * while 3 or more are left, in turn from your first; at 2 and 1 the harder ones; the last (`pick`: which of its lines), as your
 * board goes with it.
 */
export function slashLine(left: number, pick = 0): string {
  const L = RECLUSE_LINES.slash;
  if (left <= 0) return L.last[Math.abs(pick) % L.last.length]!;
  if (left <= 2) return L.hard[(2 - left) % L.hard.length]!;
  return L.taunt[Math.max(0, RECLUSE_PHASE2.hearts - 1 - left) % L.taunt.length]!;
}

/**
 * A heart of yours cut (solo's and online's): the slash's sound and his line, on your screen only (a bot's heart has the slash on its
 * board alone), cutting in on whatever he's saying (INTERRUPT; Eric, Nov 16). `key`: the fight's.
 */
export function cueSlash(left: number, key: string, pick = 0) {
  play("recluseSlash");
  bossVoice.say(slashLine(left, pick), `recluse:p2:slash:${key}:${left}`, INTERRUPT);
}

/**
 * Whether his phase 2 follows phase 1 won, on this device (solo): alone (Boss alone), or in a solo Crowd's boss final
 * (Oct 14: it's always him there), whose other finalists take the other boards. Never a Solo raid (its 49 bots have no
 * boards). Online (Nov 13) the server runs it (his room's fight, a Crowd final: recluse-online.ts, NetMatch), not this.
 */
export function phase2Follows(o: { bossId: string | null | undefined; result: string | null | undefined; raid: boolean; raidBots: boolean; crowdFinal: boolean }): boolean {
  if (o.bossId !== "recluse" || o.result !== "crowd" || RECLUSE_PHASE2.boards < 1) return false;
  return o.raid ? !o.raidBots : o.crowdFinal;
}

/**
 * Phase 2's other players (boards 1 on): those who fought phase 1 beside you, in the order given (a solo Crowd's
 * finalists), then fresh bots (`fresh`: Boss alone's, every one) for any board still empty, each under an id of its own;
 * one player a board, never more than the boards.
 */
export function phase2Mates(mates: readonly { id: string; name: string }[], boards: number, fresh: (n: number) => readonly { id: string; name: string }[]): { id: string; name: string }[] {
  const kept = mates.slice(0, Math.max(0, boards - 1)).map((m) => ({ id: m.id, name: m.name }));
  const need = Math.max(0, boards - 1 - kept.length);
  const added = need ? fresh(need).map((b) => ({ id: kept.some((k) => k.id === b.id) ? `${b.id}-p2` : b.id, name: b.name })) : [];
  return [...kept, ...added];
}

/**
 * The result's headline after his phase 2 (QA #12, Nov 14). Where everyone in the match played one of his boards (his room's
 * fight: the four of them), the boards decided it, so the headline is the fight's, as a boss alone's: "Victory!" (every board
 * won) or "Defeated"; the place goes in the line under it ("4th of 4" over "You beat the Hidden Boss on all 4 boards!" read as a
 * loss). A Crowd final's headline stays your place in its crowd, as before (crowd-hidden.spec.ts). Null: the usual headline (no
 * phase 2, no result, or a crowd beyond the boards). Only what's shown: the placement itself is untouched.
 */
export function phase2Headline(r: { simul?: { won: number; of: number }; noResult?: string }, totalPlayers: number): "Victory!" | "Defeated" | null {
  if (!r.simul || r.noResult || totalPlayers > r.simul.of) return null;
  return r.simul.won === r.simul.of ? "Victory!" : "Defeated";
}

/** One step of a phase 2 board's review: the position after `ply` moves (0: its start) and the move that made it (SAN), or null. */
export interface BoardStep {
  ply: number;
  fen: string;
  move: string | null;
  san: string | null;
}

/**
 * A phase 2 board, move by move, for the result's review (QA #12, Nov 14: it replayed phase 1's first form instead): its start
 * (the base at ply 0, its Chess960 position) and the position after each move, in one pass. A move that can't be read ends it
 * there rather than break the result screen.
 */
export function boardSteps(b: { history: readonly string[]; bases?: readonly Base[] | null }): BoardStep[] {
  const steps: BoardStep[] = [{ ply: 0, fen: baseAt(0, b.bases).fen, move: null, san: null }];
  for (let ply = 1; ply <= b.history.length; ply++) {
    const prev = steps[ply - 1]!.fen;
    const move = b.history[ply - 1]!;
    try {
      const base = baseAt(ply, b.bases);
      steps.push({ ply, fen: base.ply === ply ? base.fen : applyMove(prev, move), move, san: toSan(prev, move) });
    } catch {
      break;
    }
  }
  return steps;
}

/** What the bots' engine must do: play at a strength (UciEngine), or its best (the test switch, ?win=1). */
export interface Phase2BotEngine extends Phase2Engine {
  topMoves(fen: string, n: number): Promise<MoveScore[]>;
}

/**
 * The Hidden Boss's phase 2 on this device (Boss alone; its rules: packages/chess/src/bosses/recluse-phase2.ts): four
 * boards at once, you on board 0, bots on the rest. One engine plays him on every board in turn (`boss`: your board
 * first when it's waiting, then the board that has waited longest); the bots think on their own clocks (`bots`; the same
 * engine when the device has one only). Every clock is checked five times a second; a board ends by mate, a draw, time,
 * resigning or its hearts all cut; the battle ends when every board is decided (`onDone`). Only your moves are judged by the clock
 * (`judged`): a bot's heart is cut by the slow think it rolled, as that think ends, never because its engine answered late (the
 * engine it shares with him queues behind his searches: the review of #744, M1).
 */
export class Phase2Game {
  state: Phase2State;
  /** Boards where it's his move, in the order they came. */
  private waiting: number[] = [];
  private thinking = false;
  private stopped = false;
  private tick: ReturnType<typeof setInterval> | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  /** What his engine is on now (the admins' line): the board and how long his last move took. */
  lastMs: number | null = null;
  /** His moves so far, on all the boards. */
  bossMoves = 0;
  /** Whose moves the clock judges: yours (Phase2Judged). */
  private readonly judged: Phase2Judged = (player) => player === this.opts.human;

  constructor(
    private readonly opts: {
      players: readonly string[];
      numbers: readonly number[];
      human: string;
      boss: Phase2Engine;
      bots: Phase2BotEngine;
      /** The test switch (?win=1): every board from a mate in one, and the bots play their best. */
      win?: boolean;
      rng?: () => number;
      onChange: () => void;
      /** A board has just been decided (its result is set). */
      onResult: (b: Phase2Board) => void;
      /** A heart cut on a board (its player's move turned slow, or the admins' test): the board as it is now (hearts left, lost). */
      onSlash?: (b: Phase2Board) => void;
      /** His move played on a board: how many he has made so far on all of them. */
      onBossMove?: (moves: number) => void;
      onDone: () => void;
    },
  ) {
    this.state = startPhase2({ players: opts.players, numbers: opts.numbers, now: Date.now(), win: opts.win });
  }

  /** Play begins: every player's clock is running (they're White); the bots start thinking. */
  start() {
    this.state = startPhase2({ players: this.opts.players, numbers: this.opts.numbers, now: Date.now(), win: this.opts.win });
    for (const b of this.state.boards) if (b.player !== this.opts.human) this.botTurn(b.id);
    // (A move turning slow has its heart cut, as the server's timer does online; a bank that runs out loses the board.)
    this.tick = setInterval(() => this.update(phase2Clock(this.state, Date.now(), this.judged)), 200);
    this.opts.onChange();
  }

  stop() {
    this.stopped = true;
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  get outcome() {
    return phase2Outcome(this.state);
  }

  board(id: number): Phase2Board | null {
    return this.state.boards.find((b) => b.id === id) ?? null;
  }

  /** Your move on your board (ignored unless it's yours to make and legal). */
  move(boardId: number, move: string) {
    const b = this.board(boardId);
    if (!b || b.player !== this.opts.human || phase2ToMove(b) !== "crowd") return;
    const before = this.state;
    this.update(phase2Move(this.state, boardId, move, Date.now(), this.judged));
    if (this.winNext && this.state !== before) {
      this.winNext = false;
      this.update(phase2WinAll(this.state, Date.now()));
    }
  }

  /** Testing (admins, "Win this form"): your next move here wins every board still on. */
  winNext = false;

  /** Testing (admins, the ultimate trigger in phase 2): a heart of yours cut now, on your move. */
  slash() {
    const mine = this.state.boards.find((b) => b.player === this.opts.human);
    if (mine) this.update(phase2Slash(this.state, mine.id, Date.now()));
  }

  /** You resign your board: it's lost; the others play on. */
  resign(boardId: number) {
    this.update(phase2Resign(this.state, boardId, Date.now()));
  }

  private update(next: Phase2State) {
    if (this.stopped || next === this.state) return;
    const before = this.state;
    this.state = next;
    for (const b of next.boards) {
      const was = before.boards.find((x) => x.id === b.id)!;
      if (was === b) continue;
      if (b.hearts < was.hearts) this.opts.onSlash?.(b);
      if (b.result && !was.result) this.opts.onResult(b);
      const who = phase2ToMove(b);
      if (who === "boss" && !this.waiting.includes(b.id)) this.waiting.push(b.id);
      if (who === "crowd" && b.player !== this.opts.human && b.board.history.length !== was.board.history.length) this.botTurn(b.id);
    }
    this.pump();
    this.opts.onChange();
    if (phase2Outcome(next).decided) {
      this.stop();
      this.opts.onDone();
    }
  }

  /** His next move, one board at a time on his one engine. No answer from it: the first legal move (never a stall). */
  private pump() {
    if (this.thinking || this.stopped) return;
    const id = phase2Next(this.state, this.waiting, this.opts.human);
    this.waiting = this.waiting.filter((x) => {
      const b = this.board(x);
      return x !== id && !!b && phase2ToMove(b) === "boss";
    });
    if (id === null) return;
    const fen = this.board(id)!.board.fen;
    this.thinking = true;
    const t0 = performance.now();
    void phase2BossMove(this.opts.boss, fen)
      .catch(() => legalMoves(fen)[0]!)
      .then((move) => {
        this.thinking = false;
        this.lastMs = performance.now() - t0;
        if (this.stopped) return;
        if (this.board(id)?.board.fen === fen) {
          const before = this.state;
          this.update(phase2Move(this.state, id, move, Date.now(), this.judged));
          if (this.state !== before && !this.stopped) this.opts.onBossMove?.(++this.bossMoves);
        }
        this.pump();
      });
  }

  /**
   * A bot's move: it thinks a bullet player's while (its clock running), then plays. Late, its board is lost on time. A slow think
   * costs it a heart as that think ends (`thinkEnds`), whenever its engine answers; a usual one never does, however late the answer.
   */
  private botTurn(id: number) {
    const fen = this.board(id)!.board.fen;
    const rng = this.opts.rng ?? Math.random;
    // (Now and then a slow one: it loses a heart as yours would.)
    const slow = !this.opts.win && rng() < RECLUSE_PHASE2.botSlowChance;
    const [lo, hi] = slow ? RECLUSE_PHASE2.botSlowMs : RECLUSE_PHASE2.botMoveMs;
    const think = lo + rng() * (hi - lo);
    const thinkEnds = Date.now() + think;
    const engine = this.opts.bots;
    const search = this.opts.win
      ? engine.topMoves(fen, 1).then((t) => t[0]?.move ?? legalMoves(fen)[0]!)
      : // (A slow one only waits longer: its search keeps the usual budget, so a shared engine isn't held up.)
        engine.playAtElo(fen, RECLUSE_PHASE2.botElo, RECLUSE_PHASE2.botNodes, Math.min(think, RECLUSE_PHASE2.botMoveMs[1]));
    const wait = new Promise<void>((r) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        // (Its slow think over: the heart cut at the moment it ended, even if the timer ran late.)
        if (slow && this.board(id)?.board.fen === fen) this.update(phase2Slash(this.state, id, thinkEnds));
        r();
      }, this.opts.win ? 300 : think);
      this.timers.add(t);
    });
    void Promise.all([search.catch(() => legalMoves(fen)[0]!), wait]).then(([move]) => {
      if (this.stopped || this.board(id)?.board.fen !== fen) return;
      this.update(phase2Move(this.state, id, move, Date.now(), this.judged));
    });
  }
}
