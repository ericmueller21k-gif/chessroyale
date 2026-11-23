import { BIRDIE_BEATS, bannerLeadMs, birdieLeadMs, pieceAt, powerFxMs, trainReaches, withPiece, withoutPiece } from "@chessroyale/chess";
import { BIRDIE_CINEMATIC } from "@chessroyale/core";
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { BIRDIE_CROSSING, BIRDIE_SMASH, BIRDIE_TRAIN } from "../characters/effects/birdie.ts";
import { noteArmor } from "../characters/birdie-state.ts";
import { rejoinedAt } from "../characters/moo-state.ts";
import type { BossView } from "../game.ts";
import type { PieceDecor } from "../board/types.ts";
import { CRITICAL } from "../speech.tsx";
import { onResetBeats } from "./boss-figure.ts";
import { BirdieFall, prewarmBirdieFall } from "./BirdieFall.tsx";
import { BoardEffects, SpriteAnim, prewarm, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { InPlace, PIECE_WORD, type BoardLayerProps, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Birdie's powers on screen (his rules: packages/chess/src/bosses/birdie.ts; docs/decisions/2026-11-23-birdie-rules.md), all from the
 * battle's shared view and each moment's start, so everyone online sees the same thing. Nothing he draws moves the board, the dock or
 * the bar (Eric's rule: nothing shifts).
 * - **The warning** (`trainSignal`, as your turn after his move begins): he steps up and waves his wing like a conductor; at its
 *   `signal` cue the crossing lights on every square of the line (its bell), its lamps flashing through your turn, and a warning sign
 *   glows over the marked piece (WarnSign) until it moves or his train reaches it. The dock says what to do through your turn ("Move your
 *   knight!": refused.ts, trainLine).
 * - **His train** (`trainSmash`, at the start of his turn as your move lands, while he thinks): he ducks into his cab and it pulls away
 *   (his `depart`, in his spot), then the train rides the line across the board from his side, every piece on the line stepping aside as
 *   it comes and back after its tail, and the piece you left there is smashed as the train's nose reaches it (the smash); spared (the
 *   smash wasn't legal), it steps aside too. He rolls back into his spot (his `entrance`).
 * - **Your king** (`trainWin`): END OF THE LINE!, then the same ride, your king smashed: the battle is his.
 * - **His fall** (`birdieFall`, at the start of his turn, after the train if it rode), timed to his ult's piece (BIRDIE_ULT: the music
 *   switches as it starts, birdie-music.ts): he waits in his spot and says his line, then his `fall` in his spot, the cutscene
 *   (BirdieFall.tsx) with the train's impact on the piece's drop, and he's Armored Birdie from its hit (the kit's powered twin).
 */

const B = BIRDIE_BEATS;
type Orientation = "white" | "black";

/** His words for you (the dock, during a moment with none of its own banner's words). Short enough for a phone's dock at 320 px. */
export const BIRDIE_WORDS = {
  /** The warning's, through your turn: the piece on his line. */
  move: (piece: string | undefined) => `Move your ${PIECE_WORD[piece ?? "k"] ?? "piece"}!`,
  smashed: (piece: string | undefined) => `His train hit your ${PIECE_WORD[piece ?? "p"] ?? "piece"}.`,
  spared: (piece: string | undefined) => `The train spared your ${PIECE_WORD[piece ?? "p"] ?? "piece"}.`,
  win: "END OF THE LINE!",
  winSub: "His train hit your king",
} as const;

/** A square's column and row as the board is seen. */
const drawnAt = (sq: string, o: Orientation) => {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  return { col: o === "white" ? f : 7 - f, row: o === "white" ? 7 - r : r };
};

// ---------------- His moments while he thinks ----------------

/** When this device first saw each of his moments in his turns (they play from then), by battle and turn; -Infinity: skipped. */
const turnSeen = new Map<string, number>();
onResetBeats(() => turnSeen.clear());

/**
 * His moments in his turn, while he thinks (as your move lands: his train's ride, a smash, a sparing or your king, then his fall), from
 * this turn's events, in that order, from when this device first saw them, after QUEEN SLAIN! if your move took his queen (birdieLeadMs,
 * as his thinking waits: birdieTurnMs), from when this turn's moments began (`turnAt`: the lobby's thinking start as this device
 * received it, or solo's, kept with the game), so a reload or a late join in his fall's wait or its cutscene carries on where it was, his
 * music's drop with it (Nov 23). His fall's hit is noted for his armored look (birdie-state.ts). With no `turnAt` (an older server), from
 * when this device first saw them, and first seen just as it rejoined: skipped, the board as it is and his look armored at once (Moo's
 * Full Moon's rule, BIRDIE_CINEMATIC.rejoinMs).
 */
export function birdieTurnMoments(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "birdie" || !p) return [];
  const list = p.events.filter((e) => e.turn === p.turn && (e.kind === "trainSmash" || e.kind === "trainWin" || e.kind === "birdieFall"));
  if (!list.length) return [];
  const seenKey = `${boss.id}:${boss.startMove}:${p.turn}`;
  let first = turnSeen.get(seenKey);
  if (first === undefined) {
    const began = p.birdie?.turnAt?.turn === p.turn ? p.birdie.turnAt.at : undefined;
    first = began !== undefined ? began + birdieLeadMs(boss) : now - rejoinedAt() < BIRDIE_CINEMATIC.rejoinMs ? -Infinity : now + birdieLeadMs(boss);
    turnSeen.set(seenKey, first);
    if (turnSeen.size > 20) turnSeen.delete(turnSeen.keys().next().value!);
  }
  if (first === -Infinity) {
    if (list.some((e) => e.kind === "birdieFall")) noteArmor(boss, -Infinity);
    return [];
  }
  let t = first;
  return [...list]
    .sort((a, b) => MOMENTS[a.kind as keyof typeof MOMENTS].order - MOMENTS[b.kind as keyof typeof MOMENTS].order)
    .map((e) => {
      const lead = bannerLeadMs(e.kind);
      const m: Moment = { kind: e.kind, key: `${boss.id}:${e.kind}:${e.turn}`, at: t + lead, ms: powerFxMs(e) - lead, ...(lead ? { lead } : {}), ...(e.square ? { square: e.square } : {}), ...(e.squares ? { squares: [...e.squares] } : {}), ...(e.fizzled ? { fizzled: [...e.fizzled] } : {}), ...(e.shape ? { shape: e.shape } : {}) };
      if (e.kind === "birdieFall") noteArmor(boss, m.at + B.fall.armorAt);
      t = m.at + m.ms;
      return m;
    });
}

/** His train's ride among the moments now (a smash, a sparing, or your king), or null. */
const rideOf = (moments: readonly Moment[]) => moments.find((m) => m.kind === "trainSmash" || m.kind === "trainWin") ?? null;

/** The kings on `squares` (never taken off a drawn board: code reading it as chess would refuse a position without one). */
const kingsOn = (fen: string, squares: readonly string[]) => squares.filter((sq) => pieceAt(fen, sq)?.type === "k");

/**
 * The position the board shows during his train's ride (`fen`: the game's, the smash already made): the piece it smashes back on its
 * square until the ride begins; every piece on the line but a king off the board while it rides (the layer draws them stepping aside,
 * the smashed one until the train reaches it; a king stays, the train passing over it). `still`: the board doesn't animate those
 * changes. Null: no ride now (the position as it is). Your king smashed is hidden by its decor (birdieDecor), never taken off.
 */
export function birdieFen(boss: Pick<BossView, "id" | "crowdSide" | "crowdMoves" | "powers">, moments: readonly Moment[], now: number, fen: string): { fen: string; still: boolean } | null {
  if (boss.id !== "birdie") return null;
  const ride = boss.powers?.birdie?.ride ?? null;
  const m = rideOf(moments);
  if (!m || !m.squares?.length || !ride) return null;
  const t = now - m.at;
  const smashed = !ride.spared && !ride.king;
  if (t < B.ride.rideAt) return smashed ? { fen: withPiece(fen, ride.square, { color: boss.crowdSide, type: ride.piece }), still: true } : null;
  if (t < B.ride.backAt) {
    const kings = kingsOn(fen, m.squares);
    return { fen: m.squares.filter((sq) => !kings.includes(sq)).reduce((f, sq) => withoutPiece(f, sq), fen), still: true };
  }
  return null;
}

/**
 * Your king smashed by his train (`trainWin`): its board piece hidden from the train's hit on, through the result (the battle his), by
 * a class on its element (`bd-smashed`), the position as it is. Undefined: nothing to hide.
 */
export function birdieDecor(boss: Pick<BossView, "id" | "crowdSide" | "crowdMoves" | "powers"> | null | undefined, moments: readonly Moment[], now: number): PieceDecor | undefined {
  const ride = boss?.id === "birdie" ? boss.powers?.birdie?.ride : null;
  if (!ride?.king || ride.at !== boss!.crowdMoves) return undefined;
  const m = rideOf(moments);
  const i = ride.squares.indexOf(ride.square);
  if (m && now < m.at + B.ride.rideAt + trainReaches(Math.max(0, i))) return undefined;
  const code = `${boss!.crowdSide}k`;
  return { key: `bd-smashed:${ride.square}`, of: (square, c) => (square === ride.square && c === code ? { cls: "bd-smashed", kids: null } : null) };
}

// ---------------- The board layer ----------------

/**
 * The pieces his layer draws on the line while his train rides (`at`: the ride's start on this screen), each with its square's place
 * along the line: every piece on it but a king (the board leaves them off: birdieFen; a king stays on the board, the train passing
 * over it), read from the rules' position (`fen`: the boss's board, never the drawn one, which has them off), the smashed one until
 * the train reaches it.
 */
export function ridePieces(fen: string, crowd: "w" | "b", ride: { square: string; piece: string; spared?: true }, squares: readonly string[], at: number, now: number): { square: string; i: number; color: "w" | "b"; type: string; smashed: boolean }[] {
  return squares.flatMap((square, i) => {
    const smashed = square === ride.square && !ride.spared;
    const pc = smashed ? { color: crowd, type: ride.piece } : pieceAt(fen, square);
    if (!pc || pc.type === "k") return [];
    if (smashed && now >= at + trainReaches(i)) return [];
    return [{ square, i, color: pc.color as "w" | "b", type: pc.type, smashed }];
  });
}

const COLOUR = { w: "white", b: "black" } as const;

/**
 * An element whose CSS animation starts at `at` (Date.now's clock): its delay is `at` less the moment the element was first drawn, kept
 * from then on. His layer is drawn again every frame, and a delay set anew from each frame's `now` retimes the running animation (Nov 23,
 * measured: the train crossed in half its time, in jumps twice as big, then stood off the board; the pieces stepped aside as fast). A copy
 * drawn anew (a screen rebuilt) takes its own first moment.
 */
function Timed({ tag: Tag, at, style, children, ...rest }: { tag: "span" | "piece"; at: number; style: Record<string, string>; class: string; children?: ComponentChildren; "data-turn"?: number; "data-square"?: string }) {
  const [drawn] = useState(Date.now);
  return (
    <Tag {...rest} style={{ ...style, animationDelay: `${at - drawn}ms` }}>
      {children}
    </Tag>
  );
}

/**
 * The warning sign on the marked piece (Eric, Nov 23: "mark the piece required to move with a yellow train warning ⚠️ like this that's
 * glowing over the tile but also a see through, make it look clean. This way the player knows which piece is in danger";
 * docs/decisions/2026-11-23-birdie-cadence-warning.md): a yellow warning triangle with its "!" over the piece's square, as the board is
 * seen (a flipped board too), see-through so the piece reads through it, glowing in a slow pulse (styles.css `.bd-sign`: opacity alone,
 * composited; no frame loop of its own). `at`: when it lit (the crossing's `signal` cue), its pulse's beat kept from then by a copy drawn
 * anew; 0: not known here (lit before this screen), its pulse from its first drawing.
 */
function WarnSign({ square, orientation, at }: { square: string; orientation: Orientation; at: number }) {
  const [drawn] = useState(Date.now);
  const c = drawnAt(square, orientation);
  return (
    <span class="bd-sign" data-square={square} style={{ "--sq-x": String(c.col), "--sq-y": String(c.row), animationDelay: `${at ? at - drawn : 0}ms` }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path class="bd-sign-edge" d={SIGN} />
        <path class="bd-sign-face" d={SIGN} />
        <rect class="bd-sign-mark" x="45" y="33" width="10" height="30" rx="5" />
        <circle class="bd-sign-mark" cx="50" cy="74" r="5.5" />
      </svg>
    </span>
  );
}
/** The sign's triangle (its corners rounded by its strokes' round joins). */
const SIGN = "M50 9 L93 85 L7 85 Z";

/** The crossing on each square of the warned line: lit at the warning's `signal` cue on this screen, else already flashing. */
function crossingItems(squares: readonly string[], since: number, until: (i: number) => number, now: number): BoardItem[] {
  return squares.flatMap((square, i) => (now < until(i) ? [{ square, name: "birdieCrossing", ...(since ? { since } : { anim: "crossing", since: 0 }), quiet: i > 0 }] : []));
}

/**
 * His layer over the board: the crossing on the warned line through your turn (and his, until his train passes each square), and the
 * warning sign on the marked piece while it's there (the drawn board: gone the moment it moves) and until the train reaches it; while
 * his train rides, the train (its art from above, two squares long, nose first along the line from his side, clipped at the board's
 * edge), every piece on the line stepping aside as it comes, and the smash on the piece it reaches.
 */
function birdieLayer({ boss, p, board, moments, now, orientation }: BoardLayerProps): { under?: preact.ComponentChildren; over: preact.ComponentChildren } {
  const bd = p.birdie;
  const signal = moments.find((m) => m.kind === "trainSignal");
  const ride = rideOf(moments);
  // (The crossing under the pieces, as its art means: a piece on its square covers the bars' middle, its lamps either side; the smash over.)
  const items: BoardItem[] = [];
  const smash: BoardItem[] = [];
  const over: preact.JSX.Element[] = [];
  // (The sign over the marked piece: its square and when it lit; drawn over the line's pieces, under the train.)
  let sign: { square: string; at: number } | null = null;
  if (bd?.warn && bd.warn.turn === p.turn && !ride) {
    const lit = signal ? signal.at + B.signal.lightAt : 0;
    if (!signal || now >= lit) {
      items.push(...crossingItems(bd.warn.squares, lit, () => Infinity, now));
      const on = pieceAt(board, bd.warn.square);
      if (on?.color === boss.crowdSide && on.type === bd.warn.piece) sign = { square: bd.warn.square, at: lit };
    }
  }
  if (ride?.squares?.length && bd?.ride) {
    const t = now - ride.at;
    const rideAt = ride.at + B.ride.rideAt;
    const reach = (i: number) => rideAt + trainReaches(i);
    // (The crossing until the train's nose reaches each square; the sign on the piece left there until it reaches it.)
    if (t < B.ride.backAt) items.push(...crossingItems(ride.squares, 0, reach, now));
    const marked = ride.squares.indexOf(bd.ride.square);
    if (t < B.ride.backAt && marked >= 0 && now < reach(marked)) sign = { square: bd.ride.square, at: 0 };
    if (t >= B.ride.rideAt && t < B.ride.backAt) {
      const first = drawnAt(ride.squares[0]!, orientation);
      const second = drawnAt(ride.squares[1]!, orientation);
      const u = { x: second.col - first.col, y: second.row - first.row };
      // (Its art's nose points to our right: turned to the line's way on screen.)
      const turn = u.x === 1 ? 0 : u.x === -1 ? 180 : u.y === 1 ? 90 : -90;
      // Where its middle is `d` squares along the line from the first square's near edge (eighths of the board, from its top left).
      const at = (d: number) => ({ x: (first.col + 0.5 + u.x * (d - 0.5)) / 8, y: (first.row + 0.5 + u.y * (d - 0.5)) / 8 });
      const from = at(-1 - 1);
      const to = at(-1 + B.ride.trackSquares - 1);
      over.push(
        <div key="track" class="bd-track" data-line={bd.ride.line}>
          <Timed
            key={ride.key}
            tag="span"
            class="bd-train"
            data-turn={turn}
            at={rideAt}
            style={{ "--x0": String(from.x), "--y0": String(from.y), "--x1": String(to.x), "--y1": String(to.y), "--turn": `${turn}deg`, animationDuration: `${B.ride.rideMs}ms` }}
          >
            <SpriteAnim ch={BIRDIE_TRAIN} anim="ride" since={rideAt} id={`${ride.key}:train`} />
          </Timed>
        </div>,
      );
      // Every piece on the line, stepping aside as the train comes and back after it (the smashed one until it's reached).
      const pieces = ridePieces(boss.board.fen, boss.crowdSide, bd.ride, ride.squares, rideAt, now).map(({ square: sq, i, color, type, smashed }) => {
        const pc = { color, type };
        const c = drawnAt(sq, orientation);
        const asideAt = reach(i) - B.ride.asideMs;
        // (Aside across the line: off a rank upward, off a file to the left, as seen.)
        const off = u.x !== 0 ? { x: 0, y: -0.42 } : { x: -0.42, y: 0 };
        const stays = Math.round((3 / B.ride.trackSquares) * B.ride.rideMs);
        return (
          <Timed
            key={`${ride.key}:${sq}`}
            tag="piece"
            class={`${COLOUR[pc.color]} ${PIECE_WORD[pc.type]}${smashed ? "" : " bd-aside"}`}
            data-square={sq}
            at={asideAt}
            style={{ left: `${(c.col * 100) / 8}%`, top: `${(c.row * 100) / 8}%`, ...(smashed ? {} : { "--ax": String(off.x), "--ay": String(off.y), animationDuration: `${stays + 2 * B.ride.asideMs}ms` }) }}
          />
        );
      });
      over.push(
        <div key="pieces" class="hb-pieces bd-pieces">
          {pieces}
        </div>,
      );
    }
    // The smash on the piece the train reaches (your king too), from that moment.
    if (!bd.ride.spared) {
      const i = ride.squares.indexOf(bd.ride.square);
      if (i >= 0 && t >= B.ride.rideAt) smash.push({ square: bd.ride.square, name: "birdieSmash", since: reach(i) });
    }
  }
  if (sign) over.push(<WarnSign key="sign" square={sign.square} orientation={orientation} at={sign.at} />);
  return {
    under: items.length > 0 && <BoardEffects items={items} orientation={orientation} class="bd-crossing" />,
    over: (
      <>
        {smash.length > 0 && <BoardEffects items={smash} orientation={orientation} class="bd-fx" />}
        {over}
      </>
    ),
  };
}

// ---------------- His moments ----------------

/** The warning: he steps up and waves like a conductor; at the `signal` cue the crossing lights on the line (the board layer). */
function signalView({ cast }: MomentProps) {
  return <div class="power-moment pm-birdie-signal">{cast("signal", B.signal.lightAt)}</div>;
}

/**
 * His train's ride: in his spot he ducks in and it pulls away, his spot empty while it crosses the board (the board layer), then he
 * rolls back in (his `entrance`). Your king: END OF THE LINE! first.
 */
function rideView({ moment, banner }: MomentProps) {
  return (
    <div class="power-moment pm-stay pm-birdie-ride" data-ride={moment.kind}>
      {moment.kind === "trainWin" && banner(BIRDIE_WORDS.win, BIRDIE_WORDS.winSub, "birdie")}
      <InPlace runKey={moment.key} anims={["depart", "gone", "entrance"]} since={moment.at} />
    </div>
  );
}

/**
 * His fall: he waits in his spot (his line at `lineAt`), then from `fallAt` his `fall` in his spot, his spot empty through the cutscene
 * (BirdieFall.tsx), Armored Birdie back in it from the hit.
 */
function fallView({ moment }: MomentProps) {
  return (
    <div class="power-moment pm-stay pm-birdie-fall">
      <InPlace runKey={moment.key} anims={["fall", "away"]} since={moment.at + B.fall.fallAt} />
      <BirdieFall at={moment.at} />
    </div>
  );
}

/**
 * The warning plays as your turn begins (after his move); his train, your king and his fall while he thinks (birdieTurnMoments), in
 * that order. Only END OF THE LINE! has a banner: the crossing, the ride and the cutscene say the rest.
 */
const MOMENTS: Record<"trainSignal" | "trainSmash" | "trainWin" | "birdieFall", MomentUi> = {
  trainSignal: { order: 0, kit: "power", lineAt: B.signal.lightAt, dock: (m) => BIRDIE_WORDS.move(m.shape), view: signalView },
  trainSmash: { order: 0, kit: "powerHit", dock: (m) => (m.fizzled?.length ? BIRDIE_WORDS.spared(m.shape) : BIRDIE_WORDS.smashed(m.shape)), view: rideView },
  trainWin: { order: 0, kit: "powerHit", priority: () => CRITICAL, view: rideView },
  birdieFall: { order: 1, kit: "ultimate", lineAt: B.fall.lineAt, priority: () => CRITICAL, view: fallView },
};

// ---------------- Drawn ahead ----------------

let warmed = false;
/** His train, the crossing and the smash drawn ahead, and his fall's cutscene fetched and decoded, as his battle starts. */
export function prewarmBirdie(): void {
  if (warmed) return;
  warmed = true;
  prewarmSprite(BIRDIE_TRAIN, BIRDIE_TRAIN.anims.ride!.frames);
  for (const [name, ch] of [["birdieCrossing", BIRDIE_CROSSING], ["birdieSmash", BIRDIE_SMASH]] as const) prewarm(name, Object.entries(ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
  prewarmBirdieFall();
}

export const BIRDIE_UI = {
  id: "birdie",
  // (His fall comes at the start of his turn once he has lost enough: no warning; his meter is the material he has lost.)
  ultimate: { name: "The Fall", when: "When he's lost enough" },
  moments: MOMENTS,
  board: (p) => birdieLayer(p),
} satisfies BossUi;
