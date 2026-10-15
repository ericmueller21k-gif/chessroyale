import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { RECLUSE, RECLUSE_JUMP } from "./characters/recluse.ts";
import { animLength, cueAt } from "./characters/power-art.ts";
import {
  LAST_STAND,
  legalMoves,
  phase2BossMove,
  phase2Flags,
  phase2Move,
  phase2Next,
  phase2Outcome,
  phase2Resign,
  phase2Timeouts,
  phase2ToMove,
  phase2Ult,
  startPhase2,
  type MoveScore,
  type Phase2Board,
  type Phase2Engine,
  type Phase2State,
} from "@chessroyale/chess";

/**
 * The phase change (Eric, Oct 14), ms from its start (screens/Recluse2.tsx draws it), about 15 s after a short fall
 * (`fallMs`: phase 1 beaten, the board holds while he collapses and starts to mumble), all on one square stage:
 * - **the God King's absorption** (Eric, Oct 14: he plays with an engine now, so he takes the God King's): the God King
 *   stands over him in his place, his sword raised and his aura swelling, and gloats (`kingAt`); still on his knees, the
 *   boss's head snaps up and he raises his hand to the God King (`seizeAt`); the God King's golden power streams out of
 *   him into that hand while he flickers and cracks (`drainAt`: his Last Stand's blows, its flashes and cracks, are his
 *   frames); as it lands the boss's fist closes, his half-engine look ignites and he says so (`igniteAt`), and the God
 *   King fades away (`goneAt`: absorbed; he is gone for the rest of the fight);
 * - he gets up in a rage where he stands (`rage`: the book flies back into his hand);
 * - he leaps from there onto the middle of the board (the board draws his whole figure, on a phone too), landing with a
 *   thud and a burst of dust (the board jolts);
 * - he brandishes the book over his head and throws it down at his feet, where it lands open;
 * - light pours up out of it while he chants over it, arms raised, his hair lifting (phase 2's face from here), his
 *   chant in his bubble;
 * - the boards crack (Sawyer's board-saw gap, down and across the middle) and the quarters part, each growing into a
 *   whole board at its corner, as the light dies; blue arcs strike the board from his hands meanwhile (`arcAt` to
 *   `arcEnd`: the engine's power splits it);
 * - the book snaps shut and flies up into his hands (his revive's own frames) while every board's pieces fly to their
 *   Chess960 squares; he leaps back to his place, in phase 2's idle from then on;
 * - "PHASE 2", and the clocks start.
 * One book on screen throughout: his own, in his frames.
 */
export const PHASE_CHANGE = (() => {
  const a = RECLUSE.anims;
  const len = (n: string) => animLength(a[n]!);
  const fallMs = 1800;
  // The absorption. (His drain lasts the God King's Last Stand blows to his stagger: its flashes and cracks, his frames.)
  const kingAt = 0;
  const seizeAt = 1700;
  const drainAt = seizeAt + (cueAt(a.seize!, "reach") ?? 0);
  const drainMs = LAST_STAND.staggerAt - LAST_STAND.slashAt;
  const igniteAt = drainAt + drainMs;
  // (His word on it, a moment after: his chant cuts in on it.)
  const absorbLineAt = igniteAt + 120;
  const fadeMs = 700;
  const goneAt = igniteAt + fadeMs;
  const riseAt = igniteAt + len("seized");
  const rageMs = len("rage");
  // (The board's figure takes over where he stood as the leap's crouch begins: his place is empty until he's back.)
  const leapAt = riseAt + rageMs;
  const upAt = leapAt + RECLUSE_JUMP.upAt;
  const landAt = leapAt + RECLUSE_JUMP.landAt;
  const dropAt = leapAt + len("leap");
  const thudAt = dropAt + (cueAt(a.drop!, "thud") ?? 0);
  const chantAt = dropAt + len("drop");
  const lightMs = 500;
  const crackAt = chantAt + 1700;
  const partAt = crackAt + 750;
  const growAt = partAt + 400;
  const growMs = 900;
  // (The arcs start just before the crack and stop as the boards settle.)
  const arcAt = crackAt - 200;
  const arcEnd = growAt + growMs - 100;
  const pickupAt = growAt + growMs + 100;
  const catchAt = pickupAt + (cueAt(a.pickup!, "catch") ?? 0);
  const shuffleAt = pickupAt + 150;
  const shuffleMs = 900;
  const backAt = pickupAt + len("pickup");
  const homeAt = backAt + len("leap2");
  const bannerAt = Math.max(homeAt, shuffleAt + shuffleMs) + 100;
  // ("PHASE 2": 2.4 s, every banner a second longer since Eric, Oct 15; the clocks start after it.)
  const bannerMs = 2400;
  return {
    fallMs,
    kingAt,
    seizeAt,
    drainAt,
    drainMs,
    igniteAt,
    absorbLineAt,
    fadeMs,
    goneAt,
    riseAt,
    rageMs,
    leapAt,
    upAt,
    landAt,
    dropAt,
    thudAt,
    chantAt,
    lightMs,
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
    bannerMs,
    total: bannerAt + bannerMs,
  };
})();

/**
 * His figure where he stands through the phase change (BossCharacter's figure run, from `at`, the change's start): slumped
 * and mumbling, then he seizes the God King's power, his hand held up while it streams in, his fist as it lands, up in a
 * rage; from his leap the board draws him, and once he's back he rests in phase 2's idle.
 */
export function phaseChangeRun(at: number) {
  const C = PHASE_CHANGE;
  const seize = animLength(RECLUSE.anims.seize!);
  return { since: at + C.seizeAt, anims: ["seize", { anim: "seizeLoop", ms: C.igniteAt - C.seizeAt - seize }, "seized", "rage"], loop: "idle2", before: "collapseLoop" } as const;
}

/** What the God King shows in his place at `t` ms into the phase change, or "gone" (absorbed: from then on, phase 2 too). */
export type AbsorbKing = { anim: "raise" | "lastStand"; since: number; then?: "raised"; class: "gk-triumph" | "gk-drained" | "gk-fading" } | "gone";
export function absorbKing(t: number, at: number): AbsorbKing {
  const C = PHASE_CHANGE;
  // Triumphant: his sword raised (his aura swelling). Drained: his Last Stand's blows, its flashes and cracks, timed so
  // its stagger comes as the power lands; then he fades as he staggers.
  if (t < C.drainAt) return { anim: "raise", since: at + C.kingAt, then: "raised", class: "gk-triumph" };
  if (t >= C.goneAt) return "gone";
  return { anim: "lastStand", since: at + C.igniteAt - (LAST_STAND.staggerAt - LAST_STAND.fallAt), class: t < C.igniteAt ? "gk-drained" : "gk-fading" };
}

/**
 * The arcs that strike the board as it splits (Eric, Oct 14: smooth, thin bright cores with a soft glow): when each
 * strikes (ms into the phase change), from which of his raised hands (0: our left), where on the cracks it lands (% of
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
export const ARC_STRIKES: readonly ArcStrike[] = (() => {
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
  for (let t = C.arcAt, i = 0; t < C.arcEnd - ARC_LIFE / 2; t += 85 + rnd() * 60, i++) {
    const hand = (i % 2) as 0 | 1;
    out.push({ at: Math.round(t), hand, to: target(hand), seed: 1 + Math.floor(rnd() * 1e6), big: false });
  }
  for (const at of [C.crackAt, C.partAt])
    for (const hand of [0, 1] as const) out.push({ at, hand, to: hand === 0 ? [4, 50] : [96, 50], seed: 1 + Math.floor(rnd() * 1e6), big: true });
  return out.sort((x, y) => x.at - y.at);
})();

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

/** His ultimate where he stands (playInPlace): the spellbook opened, held, slammed shut. */
export const PHASE2_ULT_ANIMS = ["spellbook2", "spellLoop2", "spellClose2"] as const;
/**
 * "5 SECONDS!" shows this long as his ultimate comes (ms): the banner's whole 2.5 s. It had its extra second first (Eric,
 * Oct 14); since Oct 15 every banner has it, so it's as long as the rest now.
 */
export const PHASE2_ULT_BANNER_MS = 2800;

/**
 * Whether his phase 2 follows phase 1 won, on this device (solo): alone (Boss alone), or in a solo Crowd's boss final
 * (Oct 14: it's always him there), whose other finalists take the other boards. Never a Solo raid (its 49 bots have no
 * boards), and never online, where phase 2 isn't built yet: there phase 1 won is the crowd's victory.
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

/** What the bots' engine must do: play at a strength (UciEngine), or its best (the test switch, ?win=1). */
export interface Phase2BotEngine extends Phase2Engine {
  topMoves(fen: string, n: number): Promise<MoveScore[]>;
}

/**
 * The Hidden Boss's phase 2 on this device (Boss alone; its rules: packages/chess/src/bosses/recluse-phase2.ts): four
 * boards at once, you on board 0, bots on the rest. One engine plays him on every board in turn (`boss`: your board
 * first when it's waiting, then the board that has waited longest); the bots think on their own clocks (`bots`; the same
 * engine when the device has one only). Every clock is checked five times a second; a board ends by mate, a draw, time
 * or resigning; the battle ends when every board is decided (`onDone`).
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
      /**
       * A slow move (anyone's) before his ultimate: on which board, and whether it was the one that brought his ultimate;
       * then his ultimate as it comes.
       */
      onSlow?: (boardId: number, ult: boolean) => void;
      onUlt?: () => void;
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
    // (Before his ultimate a bank that runs out loses the board; after it, a move out of time is played at random.)
    this.tick = setInterval(() => {
      const now = Date.now();
      this.update(phase2Timeouts(phase2Flags(this.state, now), now, this.opts.rng ?? Math.random));
    }, 200);
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
    this.update(phase2Move(this.state, boardId, move, Date.now()));
  }

  /** Testing (admins): his ultimate now. */
  ult() {
    this.update(phase2Ult(this.state, Date.now()));
  }

  /** You resign your board: it's lost; the others play on. */
  resign(boardId: number) {
    this.update(phase2Resign(this.state, boardId, Date.now()));
  }

  private update(next: Phase2State) {
    if (this.stopped || next === this.state) return;
    const before = this.state;
    this.state = next;
    const ult = next.ultAt !== null && before.ultAt === null;
    if (next.slow > before.slow) {
      // (One move at a time changes the state: the board whose history grew.)
      const slowOn = next.boards.find((b, i) => b.board.history.length > before.boards[i]!.board.history.length);
      if (slowOn) this.opts.onSlow?.(slowOn.id, ult);
    }
    if (ult) this.opts.onUlt?.();
    for (const b of next.boards) {
      const was = before.boards.find((x) => x.id === b.id)!;
      if (was === b) continue;
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
          this.update(phase2Move(this.state, id, move, Date.now()));
          if (this.state !== before && !this.stopped) this.opts.onBossMove?.(++this.bossMoves);
        }
        this.pump();
      });
  }

  /** A bot's move: it thinks a bullet player's while (its clock running), then plays. Late, its board is lost on time. */
  private botTurn(id: number) {
    const fen = this.board(id)!.board.fen;
    const rng = this.opts.rng ?? Math.random;
    // (Now and then a slow one before his ultimate, so his count comes from the bots too.)
    const slow = this.state.ultAt === null && !this.opts.win && rng() < RECLUSE_PHASE2.botSlowChance;
    const [lo, hi] = slow ? RECLUSE_PHASE2.botSlowMs : RECLUSE_PHASE2.botMoveMs;
    const think = lo + rng() * (hi - lo);
    const engine = this.opts.bots;
    const search = this.opts.win
      ? engine.topMoves(fen, 1).then((t) => t[0]?.move ?? legalMoves(fen)[0]!)
      : // (A slow one only waits longer: its search keeps the usual budget, so a shared engine isn't held up.)
        engine.playAtElo(fen, RECLUSE_PHASE2.botElo, RECLUSE_PHASE2.botNodes, Math.min(think, RECLUSE_PHASE2.botMoveMs[1]));
    const wait = new Promise<void>((r) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        r();
      }, this.opts.win ? 300 : think);
      this.timers.add(t);
    });
    void Promise.all([search.catch(() => legalMoves(fen)[0]!), wait]).then(([move]) => {
      if (this.stopped || this.board(id)?.board.fen !== fen) return;
      this.update(phase2Move(this.state, id, move, Date.now()));
    });
  }
}
