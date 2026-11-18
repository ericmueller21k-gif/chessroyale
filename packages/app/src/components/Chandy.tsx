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
 *   and dizzy stars; the queen lock's aim (her crosshair and the line down her file from his side), and its shot at the start of his
 *   next turn (the round down the file, the piece in its way shattered).
 * - **His bar:** the rifle's pips (n of 5) and the move meter, greyed until his first upgrade (nothing hidden, nothing shifts); his
 *   rage meter dimmed until the fifth ("Rage: unlocks at 5 upgrades").
 * - **Dodge** (as your turn begins): ChandyDodge over the board, built from the shared state and the battle's clock (dodgeView): the
 *   scope-in, the warning volley, three rounds of vote and beams; the first hit cracks your king, the second is the kill.
 */
import { CHANDY_FIRE_AT, CHANDY_FX, dodgeTimeline, linesAfter, type ChandyView } from "@chessroyale/chess";
import { BOSS_POWERS, type ChandyMove, type DodgeLine } from "@chessroyale/core";
import type { BossView, DodgeRun } from "../game.ts";
import { BoardEffects, onEachFrame, prewarm, prewarmAnims, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { CHANDY, CHANDY_BAR, CHANDY_CLONE, CHANDY_RIFLE } from "../characters/chandy.ts";
import { spriteCanvas } from "../characters/sprite-kit.ts";
import { EFFECTS, type EffectName } from "../characters/power-art.ts";
import { ChandyDodge, type DodgeView } from "./ChandyDodge.tsx";
import { ChandyUpgrade } from "./ChandyUpgrade.tsx";
import type { BoardLayerProps, BossUi, Moment, MomentProps, MomentUi } from "./PowerParts.tsx";

/** His moves' names, as the upgrade window and his banners say them. */
export const CHANDY_MOVE_NAMES: Record<ChandyMove, string> = { scatter: "Scatter shot", beam: "Beam", shields: "Shields", rapidfire: "Rapid fire", queenlock: "Queen lock" };

/** The words under his banners and in the dock (placeholders, short, for Eric to change: docs/decisions/2026-11-16-chandy-rules.md). */
export const CHANDY_WORDS = {
  scatter: "Four squares blocked this turn.",
  beam: (square?: string) => (square ? `Rank ${square[1]} and the ${square[0]}-file held.` : "A rank and a file held."),
  shields: "Two of his pieces shielded.",
  rapid: "Three of your pieces dizzy.",
  aim: "He fires at her next. Block her file!",
  shot: (piece: string | null | undefined, stopped: boolean) => (stopped ? "Queen lock: the shot was stopped." : piece === "q" ? "Queen lock: your queen fell." : `Queen lock: your ${PIECES[piece ?? "p"] ?? "piece"} took it.`),
} as const;
const PIECES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** When his shot fires in a move's moment (ms): his `fire` animation's cue (characters/chandy.ts: 520 ms in; the banners' window). */
export const FIRE_AT = CHANDY_FIRE_AT;
/** His point's lock cue (the crosshair snaps on). */
const POINT_AT = 120;
/** The rounds of rapid fire, this far apart (ms). */
const RAPID_STAGGER = 150;
/** The queen lock's round, a square this long (ms). */
const ROUND_STEP = 60;

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
  // The queen lock's aim: her crosshair and the line down her file from his side, through your turn.
  if (c.aim) {
    const m = find(moments, "queenAim");
    if (!m || now >= at(m, FIRE_AT)) {
      out.push({ square: c.aim, name: "chandyCrosshair", anim: m ? "lock" : "held", then: "held", since: at(m, FIRE_AT), quiet: !m });
      lineToQueen(c.aim, boss.crowdSide).forEach((sq, i) => out.push(m ? { square: sq, name: "chandyQueenAim", anim: "on", then: "aim", since: at(m, FIRE_AT), quiet: i > 0 } : { square: sq, name: "chandyQueenAim", anim: "aim", since: 0, quiet: true }));
    }
  }
  // Its shot (at the start of his turn): the round down the file, the piece in its way shattered.
  const shot = find(moments, "queenShot");
  if (shot?.squares?.length) {
    const trail = shot.squares;
    trail.forEach((sq, i) => {
      const when = at(shot, FIRE_AT + i * ROUND_STEP);
      if (now >= when) out.push({ square: sq, name: "chandyRound", anim: "fly", then: "trail", since: when, quiet: i > 0 });
    });
    const hitAt = at(shot, FIRE_AT + trail.length * ROUND_STEP);
    if (!shot.fizzled?.length && shot.square && now >= hitAt) out.push({ square: shot.square, name: "chandyShatter", anim: "shatter", since: hitAt });
  }
  return out;
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
  queenAim: { order: 1, kit: "power", lineAt: FIRE_AT, view: moveMoment("QUEEN LOCK!", () => CHANDY_WORDS.aim) },
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

/** Dodge over the board while it runs (the board under it shows the position, its king taken off: dodgeFen). */
export function DodgeLayer({ boss, run, now, onPick }: { boss: BossView; run: DodgeRun; now: number; onPick: (square: string) => void }) {
  const view = dodgeView(boss, run, now, onPick);
  return view ? <ChandyDodge view={view} /> : null;
}

/** The board under Dodge: your king off it from the scope-in (Dodge draws its own); the blank board covers the rest from `open`. */
export function dodgeFen(boss: BossView, fen: string): string {
  const d = chandyOf(boss)?.dodge;
  if (!d) return fen;
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
