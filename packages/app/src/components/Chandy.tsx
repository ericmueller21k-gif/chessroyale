/**
 * Chandy's powers on screen (his rules: packages/chess/src/bosses/chandy.ts; his art: characters/chandy.ts and effects/chandy.ts;
 * docs/ideas/chandy-wiring.md; docs/decisions/2026-11-16-chandy-rules.md), all from the shared state and each moment's start, so
 * everyone online sees the same thing:
 * - **His locks:** a crosshair on each locked piece of yours, its pips counting the turns it has left (3, 2, 1); a new one snaps on
 *   as he points (`lockOn`; on each of his first captures, chandy.teachCaptures, on the piece it takes, before that move shows:
 *   chandyTurnMoments).
 * - **The upgrade window** (`upgrade`, 2 s, the clock held): the rifle at its new stage, the part snapping on, "UPGRADE!", the move
 *   it unlocked (ChandyUpgrade), front and center over the board.
 * - **His meter's moves** (each with its banner, your pawn on it, and his shot from the board's corner): scatter shot's burst and
 *   its four blocked squares; the beam's cover over a rank and a file (the squares hidden); the shields' bubbles; rapid fire's hits
 *   and dizzy stars; the Lock-on Shot's aim (the crosshair on your queen, or your best rook if your queen is gone, and the line down
 *   its file from his side; a second crosshair on the piece its round will most likely hit, Nov 24), and its shot at the start of his
 *   next turn (one round flying down the file, the piece in its way on the board until the round reaches it, then shattered).
 * - **His bar:** the rifle's pips (n of 5) and the move meter, greyed until his first upgrade (nothing hidden, nothing shifts); his
 *   rage meter dimmed until the fifth ("Rage: unlocks at 5 upgrades").
 * - **Dodge** (as your turn begins): ChandyDodge over the board, built from the shared state and the battle's clock (dodgeView): the
 *   scope-in, the warning volley, three rounds of vote and beams; the first hit cracks your king, the second is the kill.
 * - **Dodge from your mate** (Eric, Nov 26; the state's `dodge.mate`, the run's `at` its start; dodgeTimeline's `opening` and `win`):
 *   first his opening over the board as it is, step by step: the pause on your move; his jump onto the board and collapse, his reach
 *   for your king, the zap (his figure's poses for now: the characters' job draws them, fitting the timeline); his line in his speech
 *   box (CHANDY_MATE_LINES). Then the Dodge; survived, the win beat: your mate back on the board, "CHECKMATE!" (the hero banner).
 */
import { CHANDY_FIRE_AT, CHANDY_FX, MATE_STEPS, dodgeTimeline, linesAfter, pieceAt, withPiece, type ChandyView, type MateStep } from "@chessroyale/chess";
import { BOSS_POWERS, SPEECH, bossInText, type ChandyMove, type DodgeLine } from "@chessroyale/core";
import type { BossView, DodgeRun } from "../game.ts";
import { BoardEffects, onEachFrame, prewarm, prewarmAnims, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { CHANDY, CHANDY_BAR, CHANDY_CLONE, CHANDY_RIFLE, chandyAnim, type RifleStage } from "../characters/chandy.ts";
import { CHANDY_MATE_LINES } from "../characters/chandy-lines.ts";
import { useEffect, useLayoutEffect } from "preact/hooks";
import { CRITICAL, Say, bossVoice } from "../speech.tsx";
import { kingVoice } from "../godKing.ts";
import { pacedLine } from "../paced-line.ts";
import { FightBanner } from "./FightBanner.tsx";
import { GodKingPortrait } from "./GodKing.tsx";
import { playInPlace } from "./BossCharacter.tsx";

import { spriteCanvas } from "../characters/sprite-kit.ts";
import { EFFECTS, type EffectName } from "../characters/power-art.ts";
import { ChandyDodge, type DodgeView } from "./ChandyDodge.tsx";
import { ChandyUpgrade } from "./ChandyUpgrade.tsx";
import type { BoardLayerProps, BossUi, Moment, MomentProps, MomentUi } from "./PowerParts.tsx";

/** His moves' names, as the upgrade window and his banners say them (the queen lock is the Lock-on Shot since Nov 24: it may aim at a rook). */
export const CHANDY_MOVE_NAMES: Record<ChandyMove, string> = { scatter: "Scatter shot", beam: "Beam", shields: "Shields", rapidfire: "Rapid fire", queenlock: "Lock-on Shot" };

/** The words under his banners and in the dock (placeholders, short, for Eric to change: docs/decisions/2026-11-16-chandy-rules.md). */
export const CHANDY_WORDS = {
  scatter: "Four squares blocked this turn.",
  beam: (square?: string) => (square ? `Rank ${square[1]} and the ${square[0]}-file held.` : "A rank and a file held."),
  shields: "Two of his pieces shielded.",
  rapid: "Three of your pieces dizzy.",
  aim: (shape?: string) => (shape === "r" ? "He fires at your rook next. Block its file!" : "He fires at your queen next. Block her file!"),
  // (Never "queen" unless the piece is one: the shot may aim at a rook, Nov 24.)
  shot: (piece: string | null | undefined, stopped: boolean) => (stopped ? "Lock-on Shot: the shot was stopped." : piece === "q" ? "Lock-on Shot: your queen fell." : `Lock-on Shot: your ${PIECES[piece ?? "p"] ?? "piece"} took it.`),
} as const;
const PIECES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** When his shot fires in a move's moment (ms): his `fire` animation's cue (characters/chandy.ts: 520 ms in; the banners' window). */
export const FIRE_AT = CHANDY_FIRE_AT;
/** His line at the opening's `line` step: Eric's pick, its two sentences typed in turn at SPEECH's pace. */
export const MATE_LINE = pacedLine(CHANDY_MATE_LINES[0], { ...SPEECH, sentencePauseMs: BOSS_POWERS.chandy.mateLinePauseMs });
/** His point's lock cue (the crosshair snaps on). */
const POINT_AT = 120;
/** The rounds of rapid fire, this far apart (ms). */
const RAPID_STAGGER = 150;
/** The queen lock's round, a square this long (ms; settings: chandy.shotStepMs). */
const ROUND_STEP = BOSS_POWERS.chandy.shotStepMs;
/**
 * When the queen lock's round reaches the piece it hits (ms into its moment; `squares`: its path from his edge, that square last): its
 * head at the middle of that square, half a square after it enters it. The piece stays on the board until then (chandyFen).
 */
export const shotHitAt = (squares: number): number => FIRE_AT + (squares - 0.5) * ROUND_STEP;

const find = (moments: readonly Moment[], kind: Moment["kind"]) => moments.find((m) => m.kind === kind) ?? null;

/** His state as the screens see it. */
export const chandyOf = (boss: Pick<BossView, "powers"> | null | undefined): ChandyView | null => boss?.powers?.chandy ?? null;

/** The beam's square's look: its crossing, a square of its rank, or of its file. */
const beamKind = (sq: string, beam: { rank: number; file: string }) => (sq === `${beam.file}${beam.rank}` ? "cross" : Number(sq[1]) === beam.rank ? "row" : "col");

/** The squares from his edge (rank 8 when you're White) down `square`'s file to just before it. */
function lineToQueen(square: string, crowd: "w" | "b"): string[] {
  const out: string[] = [];
  const end = Number(square[1]);
  if (crowd === "w") for (let r = 8; r > end; r--) out.push(`${square[0]}${r}`);
  else for (let r = 1; r < end; r++) out.push(`${square[0]}${r}`);
  return out;
}

/** What his powers put on the squares now (`moments`: the screen's; each new thing plays its start from its moment). */
export function chandyItems(boss: BossView, moments: readonly Moment[], now: number): BoardItem[] {
  const c = chandyOf(boss);
  if (!c) return [];
  const out: BoardItem[] = [];
  const at = (m: Moment | null, ms: number) => (m ? m.at + ms : 0);
  // His locks (a new one snapping on as he points).
  for (const l of c.locks) {
    const m = moments.find((x) => x.kind === "lockOn" && x.square === l.square) ?? null;
    const held = `held${Math.max(1, Math.min(3, l.left))}`;
    if (m && now < at(m, POINT_AT)) continue;
    out.push(m ? { square: l.square, name: "chandyCrosshair", anim: "lock", then: held, since: at(m, POINT_AT) } : { square: l.square, name: "chandyCrosshair", anim: held, since: 0, quiet: true });
  }
  // Scatter shot: the burst on its spot, its four squares.
  if (c.scatter) {
    const m = find(moments, "scatterShot");
    if (!m || now >= at(m, FIRE_AT)) {
      if (m) out.push({ square: c.scatter.spot, name: "chandyScatterBurst", anim: "burst", since: at(m, FIRE_AT) });
      for (const sq of c.scatter.squares) out.push(m ? { square: sq, name: "chandyScatter", anim: "land", then: "held", since: at(m, FIRE_AT + 120) } : { square: sq, name: "chandyScatter", anim: "held", since: 0, quiet: true });
    }
  }
  // The beam's cover: opaque, over your pieces.
  if (c.beam) {
    const m = find(moments, "beam");
    if (!m || now >= at(m, FIRE_AT))
      c.beam.squares.forEach((sq, i) => {
        const k = beamKind(sq, c.beam!);
        out.push(m ? { square: sq, name: "chandyBeam", anim: `${k}In`, then: k, since: at(m, FIRE_AT), quiet: i > 0 } : { square: sq, name: "chandyBeam", anim: k, since: 0, quiet: true });
      });
  }
  // The shields' bubbles.
  if (c.shields) {
    const m = find(moments, "shields");
    if (!m || now >= at(m, FIRE_AT)) for (const sq of c.shields.squares) out.push(m ? { square: sq, name: "chandyShield", anim: "up", then: "held", since: at(m, FIRE_AT) } : { square: sq, name: "chandyShield", anim: "held", since: 0, quiet: true });
  }
  // Rapid fire: three hits, then the dizzy stars.
  if (c.dizzy.length) {
    const m = find(moments, "rapidFire");
    c.dizzy.forEach((sq, i) => {
      const when = at(m, FIRE_AT + i * RAPID_STAGGER);
      if (m && now < when) return;
      out.push(m ? { square: sq, name: "chandyDizzy", anim: "hit", then: "dizzy", since: when } : { square: sq, name: "chandyDizzy", anim: "dizzy", since: 0, quiet: true });
    });
  }
  // The queen lock's aim: the crosshair on its target (your queen, or a rook: Nov 19) and the line down its file from his side, through your turn.
  if (c.aim) {
    const m = find(moments, "queenAim");
    if (!m || now >= at(m, FIRE_AT)) {
      out.push({ square: c.aim, name: "chandyCrosshair", anim: m ? "lock" : "held", then: "held", since: at(m, FIRE_AT), quiet: !m });
      lineToQueen(c.aim, boss.crowdSide).forEach((sq, i) => out.push(m ? { square: sq, name: "chandyQueenAim", anim: "on", then: "aim", since: at(m, FIRE_AT), quiet: i > 0 } : { square: sq, name: "chandyQueenAim", anim: "aim", since: 0, quiet: true }));
    }
  }
  // Its shot (at the start of his turn): one round down the file from his edge, a square every ROUND_STEP (each square plays its slice
  // of it), stopping on the piece in its way as it reaches the piece's middle, which shatters then (the board shows it until: chandyFen).
  const shot = find(moments, "queenShot");
  if (shot?.squares?.length) {
    const trail = shot.squares;
    const hits = !shot.fizzled?.length && !!shot.square;
    trail.forEach((sq, i) => {
      const when = at(shot, FIRE_AT + i * ROUND_STEP);
      if (now >= when) out.push({ square: sq, name: "chandyRound", anim: hits && i === trail.length - 1 ? "hit" : "pass", since: when, quiet: i > 0 });
    });
    const hitAt = at(shot, shotHitAt(trail.length));
    if (hits && now >= hitAt) out.push({ square: shot.square!, name: "chandyShatter", anim: "shatter", since: hitAt });
  }
  return out;
}

/**
 * The position the board shows while the queen lock's shot plays (Eric, Nov 20: "it makes your piece disappear before the beam actually
 * hits it"): the game's board loses the piece as his turn begins (chandyBattle.afterCrowdMove), so the piece the round hits is put back
 * on its square until the round reaches it (shotHitAt), then goes as it shatters. Otherwise `fen` as it is.
 */
export function chandyFen(boss: Pick<BossView, "id" | "crowdSide">, moments: readonly Moment[], now: number, fen: string): string {
  if (boss.id !== "chandy") return fen;
  const shot = find(moments, "queenShot");
  if (!shot?.square || !shot.shape || shot.fizzled?.length || !shot.squares?.length) return fen;
  if (now >= shot.at + shotHitAt(shot.squares.length) || pieceAt(fen, shot.square)) return fen;
  return withPiece(fen, shot.square, { color: boss.crowdSide, type: shot.shape as "p" | "n" | "b" | "r" | "q" });
}

/** His layer over the board: everything over the pieces (the beam hides them, the crosshairs and bubbles sit on them). */
function ChandyLayer({ boss, orientation, moments, now }: BoardLayerProps) {
  const items = chandyItems(boss, moments, now);
  return { over: items.length > 0 ? <BoardEffects items={items} orientation={orientation} class="pw-fire-board ch-over" /> : null };
}

// ---------------- His moments ----------------

/** A move of his meter's: his banner (your pawn on it), his shot from the board's corner. */
const moveMoment =
  (title: string, sub: (m: Moment) => string) =>
  ({ moment, banner, cast }: MomentProps) => (
    <div class={`power-moment pm-chandy pm-ch-${moment.kind}`} data-square={moment.square ?? ""} data-squares={(moment.squares ?? []).join(",")}>
      {banner(title, sub(moment), "chandy", FIRE_AT)}
      {cast("fire", FIRE_AT)}
    </div>
  );

/** A lock snapping on: he points (the crosshair is the board layer's). */
function lockMoment({ moment, cast }: MomentProps) {
  return (
    <div class="power-moment pm-chandy pm-ch-lock" data-square={moment.square ?? ""}>
      {cast("lock", POINT_AT)}
    </div>
  );
}

/** The upgrade window, front and center over the board (2 s, the clock held). */
function upgradeMoment({ moment }: MomentProps) {
  const stage = Math.max(1, Math.min(5, moment.stage ?? 1)) as 1 | 2 | 3 | 4 | 5;
  return (
    <div class="power-moment pm-stay pm-ch-upgrade">
      <ChandyUpgrade stage={stage} move={moment.unlock ? CHANDY_MOVE_NAMES[moment.unlock] : undefined} since={moment.at} />
    </div>
  );
}

/** The queen lock's shot, at the start of his turn: he fires (the round and the shatter are the board layer's). */
function shotMoment({ moment, cast }: MomentProps) {
  return (
    <div class="power-moment pm-chandy pm-ch-shot" data-square={moment.square ?? ""} data-fizzled={moment.fizzled?.length ? "1" : "0"}>
      {cast("fire", FIRE_AT)}
    </div>
  );
}

const MOMENTS: Record<"lockOn" | "upgrade" | "scatterShot" | "beam" | "shields" | "rapidFire" | "queenAim" | "queenShot" | "dodge" | "dodgeWin", MomentUi> = {
  // (His moves as your turn begins, after his move: the upgrade it earned first, then his meter's move, then a new lock.)
  upgrade: { order: 0, kit: "power", view: upgradeMoment },
  scatterShot: { order: 1, kit: "power", lineAt: FIRE_AT, view: moveMoment("SCATTER SHOT!", () => CHANDY_WORDS.scatter) },
  beam: { order: 1, kit: "power", lineAt: FIRE_AT, view: moveMoment("BEAM!", (m) => CHANDY_WORDS.beam(m.square)) },
  shields: { order: 1, kit: "power", lineAt: FIRE_AT, view: moveMoment("SHIELDS!", () => CHANDY_WORDS.shields) },
  rapidFire: { order: 1, kit: "power", lineAt: FIRE_AT, view: moveMoment("RAPID FIRE!", () => CHANDY_WORDS.rapid) },
  queenAim: { order: 1, kit: "power", lineAt: FIRE_AT, view: moveMoment("LOCK-ON SHOT!", (m) => CHANDY_WORDS.aim(m.shape)) },
  lockOn: { order: 2, kit: "powerHit", view: lockMoment },
  // (At the start of his turn: the dock says what the shot did.)
  queenShot: { order: 0, kit: "power", dock: (m) => CHANDY_WORDS.shot(m.shape, !!m.fizzled?.length), view: shotMoment },
  // (Dodge plays on a screen of its own; its hit ends the battle.)
  dodge: { order: 3, kit: "ultimate", view: () => null },
  dodgeWin: { order: 3, kit: "ultimateHit", view: () => null },
};

/** When this device first saw each of his moments in his turns (they play from then), by battle, turn and moment. */
const turnSeen = new Map<string, number>();

/**
 * His moments in his turn, while he thinks (the queen lock's shot as it begins; a taught capture's lock as one of his first captures,
 * chandy.teachCaptures, is about to show, with his move known: chandyBattle.firstLock; both in one turn: the shot, then the lock), from
 * this turn's events, each from when this device first saw it and never before the one ahead of it ends; his move waits for them
 * (chandyTurnMs, and the server's hold of a taught capture).
 */
export function chandyTurnMoments(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "chandy" || !p) return [];
  const list = p.events.filter((e) => e.turn === p.turn && (e.kind === "queenShot" || (e.kind === "lockOn" && e.first)));
  if (!list.length) return [];
  const seen = (kind: string) => {
    const seenKey = `${boss.id}:${boss.startMove}:${p.turn}:${kind}`;
    let at = turnSeen.get(seenKey);
    if (at === undefined) {
      turnSeen.set(seenKey, (at = now));
      if (turnSeen.size > 20) turnSeen.delete(turnSeen.keys().next().value!);
    }
    return at;
  };
  let t = 0;
  return [...list]
    .sort((a, b) => MOMENTS[a.kind as keyof typeof MOMENTS].order - MOMENTS[b.kind as keyof typeof MOMENTS].order)
    .map((e) => {
      t = Math.max(t, seen(e.kind));
      const m: Moment = { kind: e.kind, key: `${boss.id}:${e.kind}:${e.turn}:${e.square ?? ""}`, at: t, ms: CHANDY_FX[e.kind as keyof typeof CHANDY_FX], ...(e.square ? { square: e.square } : {}), ...(e.squares ? { squares: e.squares } : {}), ...(e.fizzled ? { fizzled: e.fizzled } : {}), ...(e.first ? { first: true as const } : {}), ...(e.shape ? { shape: e.shape } : {}) };
      t += m.ms;
      return m;
    });
}

// ---------------- His bar ----------------

/** The rifle's pips (n of 5) and the move meter, greyed until his first upgrade. */
function ChandyBar({ boss }: { boss: BossView }) {
  const c = chandyOf(boss);
  if (!c) return null;
  const on = c.meter !== null;
  const pct = Math.round((c.meter ?? 0) * 100);
  return (
    <span class={`ch-bar${on ? "" : " ch-off"}`} title={on ? `Move meter: ${pct}%` : "Move meter: starts at his first upgrade"}>
      <span class="ch-pips" role="img" aria-label={`Rifle ${c.upgrades} of 5`} data-upgrades={c.upgrades}>
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} class={i <= c.upgrades ? "on" : ""} />
        ))}
      </span>
      <span class="ch-meter" role="meter" aria-label={on ? `Move meter ${pct}%` : "Move meter: locked"} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

export const CHANDY_UI = {
  id: "chandy",
  ultimate: { name: "Dodge" },
  moments: MOMENTS,
  bar: ({ boss }) => <ChandyBar boss={boss} />,
  board: (p) => ChandyLayer(p),
} satisfies BossUi;

// ---------------- Dodge ----------------

/** The clones as the screen draws them (a rank's on the a- or h-file from the crowd's side: the left or right edge, either way up). */
const shownLine = (l: DodgeLine, side: "white" | "black", since?: number): DodgeView["lines"][number] =>
  "rank" in l ? { rank: l.rank, side: side === "white" ? l.side : l.side === "left" ? "right" : "left", ...(since !== undefined ? { since } : {}) } : { file: l.file, ...(since !== undefined ? { since } : {}) };

/** How long a teleport's afterimage and "TELEPORT!" show (ms). */
const GHOST_MS = 500;

/** How long the beams take to fade at their end (ms; the art's `fade`). */
const BEAM_FADE_MS = 180;

/**
 * Dodge's view at `now` (this device's time), from the shared state (the boss's `chandy.dodge`: online, what's been seen of it) and
 * the run (when it began, the round voted on, its counts, your vote). The phases follow dodgeTimeline from the run's start: the
 * scope-in, the slide, the warning volley, then each round (its beams traveling and held; a hit that loses: the kill).
 */
export function dodgeView(boss: BossView, run: DodgeRun, now: number, onPick?: (square: string) => void): DodgeView | null {
  const d = chandyOf(boss)?.dodge;
  if (!d) return null;
  const S = BOSS_POWERS.chandy;
  const side = boss.crowdSide === "w" ? "white" : "black";
  const tl = dodgeTimeline();
  const t = now - run.at;
  const base = { side, king: d.king, center: d.center, hits: 0 } as const;
  // A mate's opening, before the Dodge's start (the board as it is): its step now. And after a survived one, the win beat.
  if (d.mate && t < 0) {
    const step: MateStep = MATE_STEPS.find((k) => t < tl.opening[k].end) ?? "line";
    return { ...base, phase: "mate", step, since: run.at + tl.opening[step].at, lines: [], round: 1 };
  }
  if (d.mate && t >= tl.win.at && d.results.length >= d.rounds.length && d.results.filter((r) => r.hit).length < S.dodgeHits) return { ...base, phase: "win", since: run.at + tl.win.at, lines: [], round: 3 };
  if (t < tl.slideAt) return { ...base, phase: "scope", since: run.at, lines: [], round: 1 };
  if (t < tl.volley.at) return { ...base, phase: "slide", since: run.at + tl.slideAt, lines: [], round: 1 };
  // The warning volley: the clones on lines that miss your king fire once; no vote.
  if (t < tl.volley.end) {
    const lines = (d.volley ?? []).map((l) => shownLine(l, side, run.at + tl.volley.at));
    return { ...base, phase: "volley", since: run.at + tl.volley.at, lines, round: 1, beams: { at: run.at + tl.volley.fireAt, fadeAt: run.at + tl.volley.end - BEAM_FADE_MS }, ...(t >= tl.volley.landAt ? { warned: true } : {}) };
  }
  // The hit that loses (its round shows the kill until dodgeEndAt), and the round on: the last one with a result whose end hasn't
  // passed, else the one being voted on.
  let hits = 0;
  const losing = d.results.findIndex((r) => r.hit && ++hits >= S.dodgeHits);
  const endOf = (i: number) => (i === losing ? tl.rounds[i]!.hitAt + tl.killMs : tl.rounds[i]!.end);
  let k = Math.min(d.rounds.length - 1, d.results.length);
  let running = false;
  for (let i = 0; i < d.results.length; i++)
    if (t < endOf(i)) {
      k = i;
      running = true;
      break;
    }
  // (Dodge decided, its last round's end past: keep that round (the kill, or the last result) on screen until the results come,
  // never the next round's clones and "Locked" after a kill in round 2: the review of #745.)
  if (!running && (losing >= 0 || d.results.length >= d.rounds.length)) k = losing >= 0 ? losing : d.results.length - 1;
  const r = tl.rounds[k]!;
  const round = d.rounds[k]!;
  const result = d.results[k];
  const landed = !!result && t >= r.hitAt;
  // (Your king's crack: the first hit, once it has landed; the hits shown so far.)
  const first = d.results.findIndex((x) => x.hit);
  const crackAt = first >= 0 && first !== losing && (k > first || (k === first && landed)) ? run.at + tl.rounds[first]!.hitAt : undefined;
  const shownHits = d.results.slice(0, k).filter((x) => x.hit).length + (landed && result.hit ? 1 : 0);
  const kept = { ...base, hits: shownHits, ...(crackAt !== undefined ? { cracked: crackAt } : {}) };
  const roundNo = (k + 1) as 1 | 2 | 3;
  const seen = round.teleports.filter((_, j) => t >= (r.teleports[j] ?? Infinity));
  const linesNow = linesAfter(round, seen.length);
  const lines = linesNow.map((l, i) => {
    const j = seen.map((x) => x.clone).lastIndexOf(i);
    return shownLine(l, side, j >= 0 ? run.at + r.teleports[j]! : undefined);
  });
  const ghosts = seen.flatMap((x, j) => {
    const left = run.at + r.teleports[j]!;
    if (now >= left + GHOST_MS) return [];
    const was = linesAfter(round, j)[x.clone]!;
    return [{ ...shownLine(was, side), since: left }];
  });
  const teleport = seen.some((_, j) => t >= r.teleports[j]! && t < r.teleports[j]! + GHOST_MS);
  if (t < r.voteAt) return { ...kept, phase: "open", since: run.at + r.openAt, lines: [], round: roundNo };
  if (!result) {
    if (t < r.voteEnd) return { ...kept, phase: "vote", since: run.at + r.voteAt, lines, ghosts, votes: run.round === k ? run.votes : {}, ...(run.round === k && run.mine ? { mine: run.mine } : {}), endsAt: run.at + r.voteEnd, round: roundNo, teleport, ...(onPick ? { onPick } : {}) };
    // (Closed: the result is on its way.)
    return { ...kept, phase: "locked", since: run.at + r.voteEnd, lines, round: roundNo };
  }
  const placed = result.placed;
  if (t < r.blastAt) return { ...kept, phase: "locked", since: run.at + r.closeAt, lines, placed, round: roundNo };
  const killAt = run.at + r.hitAt;
  const beams = { at: run.at + r.blastAt, fadeAt: k === losing ? killAt + S.dodgeKillMs - BEAM_FADE_MS : run.at + r.end - BEAM_FADE_MS };
  if (!landed) return { ...kept, phase: "blast", since: run.at + r.blastAt, lines, placed, round: roundNo, beams };
  if (k === losing) return { ...kept, phase: "kill", since: killAt, lines, placed, round: roundNo, beams, result: "hit", killAt };
  return { ...kept, phase: "result", since: killAt, lines, placed, round: roundNo, beams, result: result.hit ? "hit" : "dodged" };
}

/** His figure's poses for a mate's opening steps until their art lands (the characters' job): the collapse, the reach, the zap. */
const MATE_POSES: Partial<Record<MateStep, string>> = { jump: "stow", reach: "point", zap: "fire" };

/**
 * Dodge over the board while it runs (the board under it shows the position, its king taken off: dodgeFen). A mate's opening: his
 * figure's pose for each step, from the step's start (a redraw carries it on), and his line, said once as its step comes; the win beat:
 * "CHECKMATE!", the God King's hero banner, for the beat's length.
 */
export function DodgeLayer({ boss, run, now, onPick }: { boss: BossView; run: DodgeRun; now: number; onPick: (square: string) => void }) {
  const view = dodgeView(boss, run, now, onPick);
  const step = view?.phase === "mate" ? view.step : undefined;
  const pose = step ? MATE_POSES[step] : undefined;
  const stage = Math.max(0, Math.min(5, chandyOf(boss)?.upgrades ?? 0)) as RifleStage;
  useLayoutEffect(() => {
    if (pose && view) playInPlace(`${run.key}:mate:${step}`, [chandyAnim(pose, stage)], view.since);
  }, [run.key, step]);
  // (Your mate's opening: the God King quiet until the Dodge's own start. The line up as your mate lands is from your turn's start,
  // stale now: "Guard the queen!" over Qxf7#, the director's still, Nov 26. Taken off the screen early: he speaks again.)
  const opening = view?.phase === "mate";
  useLayoutEffect(() => {
    if (opening) kingVoice.hush(run.at);
  }, [opening, run.at]);
  useEffect(() => () => kingVoice.unhush(), []);
  if (!view) return null;
  const tl = dodgeTimeline();
  return (
    <>
      <ChandyDodge view={view} />
      {step === "line" && <Say voice={bossVoice} text={null} paced={MATE_LINE} sayKey={`${run.key}:mate-line`} priority={CRITICAL} />}
      {view.phase === "win" && now < view.since + (tl.win.end - tl.win.at) && <FightBanner key={`${run.key}:win`} tone="hero" face={<GodKingPortrait side={boss.crowdSide} />} text="CHECKMATE!" sub={`You beat ${bossInText(boss.name)}`} ms={tl.win.end - tl.win.at} />}
    </>
  );
}

/**
 * The board under Dodge: your king off it from the scope-in (Dodge draws its own); the blank board covers the rest from `open`. A mate's
 * opening and its win beat (`run` at `now`): the board as it is, your king on it.
 */
export function dodgeFen(boss: BossView, fen: string, run?: DodgeRun, now = Date.now()): string {
  const d = chandyOf(boss)?.dodge;
  if (!d) return fen;
  if (d.mate && run && (now < run.at || now >= run.at + dodgeTimeline().win.at)) return fen;
  const parts = fen.split(" ");
  const rows = parts[0]!.split("/").map((row) => row.replace(/\d/g, (n) => ".".repeat(Number(n))).split(""));
  const f = d.king.charCodeAt(0) - 97;
  const r = 8 - Number(d.king[1]);
  if (rows[r]?.[f]) rows[r]![f] = ".";
  parts[0] = rows.map((row) => row.join("").replace(/\.+/g, (x) => String(x.length))).join("/");
  return parts.join(" ");
}

/** The dock's words while Dodge runs (in the slot the Scramble Rush uses): what to do now, and what's at stake. */
export function dodgeDock(boss: BossView, run: DodgeRun, now: number): { line: string; sub: string } {
  const v = dodgeView(boss, run, now);
  if (!v) return { line: "", sub: "" };
  const S = BOSS_POWERS.chandy;
  // (A mate's opening: the mate held; the win beat: it stands.)
  if (v.phase === "mate") return { line: "Checkmate?", sub: `${bossInText(boss.name, true)} isn't done yet.` };
  if (v.phase === "win") return { line: "Checkmate!", sub: `You beat ${bossInText(boss.name)}.` };
  const left = S.dodgeHits - v.hits;
  const stake = left <= 1 ? "One more hit and the battle is his." : `${left === 2 ? "Two" : left} hits and the battle is his.`;
  if (v.phase === "vote") return { line: "Vote where your king stands", sub: `One square is safe. ${stake}` };
  if (v.phase === "kill") return { line: "Hit!", sub: "The battle is his." };
  // (A first hit in the last round: Dodge is over, the board comes back; no "one more hit".)
  if (v.phase === "result") return v.result === "hit" ? { line: "King cracked!", sub: v.round < 3 ? stake : "The board comes back." } : { line: `Dodged ${v.round} of 3`, sub: v.round < 3 ? "Next round." : "The board comes back." };
  if (v.phase === "locked" || v.phase === "blast") return { line: "Locked", sub: v.placed ? `Your king on ${v.placed}.` : "Counting the votes." };
  if (v.phase === "volley") return v.warned ? { line: "Dodge the next one!", sub: `Vote where your king stands. ${stake}` } : { line: "Dodge!", sub: "A warning shot. Watch his clones." };
  if (v.phase === "open" && v.round === 1) return { line: "Dodge the next one!", sub: `One square is safe. ${stake}` };
  return { line: "Dodge!", sub: "One square is safe. Watch his clones." };
}

// ---------------- Made ahead ----------------

let warmed = false;
/** Draws `frames` of a sprite-kit character to its canvases (as the clones' layer and the upgrade window draw them), a slice a frame. */
function warmCanvases(ch: typeof CHANDY_CLONE, done?: () => void): void {
  const frames = Object.entries(ch.anims).flatMap(([name, a]) => a.frames.map((_, i) => [name, i] as const));
  let i = 0;
  let stop = () => {};
  stop = onEachFrame(() => {
    const t0 = performance.now();
    do {
      const f = frames[i++];
      if (f) spriteCanvas(ch, f[0], f[1]);
    } while (i < frames.length && performance.now() - t0 < 4);
    if (i >= frames.length) {
      stop();
      done?.();
    }
  });
}

/**
 * His art made ahead, in quiet slices from the battle's start (BossCharacter's warm-up; .claude/LESSONS.md, "A stall the first time an
 * effect shows"): Dodge's clones were made as its vote opened, a 3.9 s stall on a slowed phone that swallowed the whole vote (Nov 16).
 * Then the rifle's stages (the upgrade window), his figure at each stage (and his phone bar's own firing frames: CHANDY_BAR), and his
 * board art.
 */
export function prewarmChandy(): void {
  if (warmed) return;
  warmed = true;
  prewarmAnims([...Object.values(CHANDY_CLONE.anims), ...Object.values(CHANDY_RIFLE.anims)], () =>
    warmCanvases(CHANDY_CLONE, () =>
      warmCanvases(CHANDY_RIFLE, () => {
        const staged = Object.entries(CHANDY.anims).filter(([name]) => /_s\d$/.test(name));
        const barOwn = Object.entries(CHANDY_BAR.anims).filter(([name, a]) => /_s\d$/.test(name) && a !== CHANDY.anims[name]);
        prewarmSprite(CHANDY, [...staged, ...barOwn].flatMap(([, a]) => a.frames));
        for (const fx of Object.keys(EFFECTS).filter((k) => k.startsWith("chandy")) as EffectName[]) prewarm(fx, Object.entries(EFFECTS[fx].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
      }),
    ),
  );
}
