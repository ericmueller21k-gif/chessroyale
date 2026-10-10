import { useLayoutEffect } from "preact/hooks";
import { BLOCK, BOUNCE, SNACK, pieceAt, withPiece, withoutPiece } from "@chessroyale/chess";
import type { BounceResult } from "@chessroyale/core";
import { bounceShape } from "../characters/bigboy.ts";
import { bossKit } from "../characters/kits.ts";
import { pickLine } from "../characters/boss-beats.ts";
import { animLength, blockItem, blockLetter, EFFECTS } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, BossEffect, BossMoment, prewarm, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { Flight, onSquare, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";
import { NORMAL, bossVoice } from "../speech.tsx";

/**
 * Big Boy on the board: his snack before move 1 (he waddles over to one of the crowd's centre pawns, grabs it, eats it)
 * and his Big Bounce (three bounces on 2x2 spots, the pieces there knocked up and tumbling; a giant fall onto the four
 * middle squares, a shockwave, dust and a jolt; every piece settling into the new position; and off he bounces). All
 * from the shared state (`powers.snack`, `powers.bounce`) and the moment's start, so everyone online sees the same
 * thing. Everything sits in eighths of chessground's board (`.bb-layer`), so a piece that lands is exactly on its square
 * when the board takes over from it.
 */

type Orientation = "white" | "black";
type Pt = { x: number; y: number };

/** A square's middle in % of the board. */
const centreOf = (square: string, o: Orientation): Pt => {
  const { x, y } = squareXY(square, o);
  return { x: x / 8, y: y / 8 };
};
/** The four squares of a bounce's spot (a 2x2 block by its lower-left square). */
export const spotSquares = (spot: string): string[] => {
  const f = spot.charCodeAt(0);
  const r = Number(spot[1]);
  return [spot, `${String.fromCharCode(f + 1)}${r}`, `${String.fromCharCode(f)}${r + 1}`, `${String.fromCharCode(f + 1)}${r + 1}`];
};
const CENTRE_SPOT = "d4";
/** A spot's middle (where the four squares meet) in % of the board. */
const spotCentre = (spot: string, o: Orientation): Pt => {
  const pts = spotSquares(spot).map((sq) => centreOf(sq, o));
  return { x: pts.reduce((s, p) => s + p.x, 0) / 4, y: pts.reduce((s, p) => s + p.y, 0) / 4 };
};
/** His corner of the board (top left), where he leaps from and bounces back to. */
const CORNER: Pt = { x: 4, y: 2 };

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** A hop from a to b, `h` high (% of the board), `u` 0 to 1 along it. */
const arc = (a: Pt, b: Pt, h: number, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - h * 4 * u * (1 - u) });

/** His box on the board: this wide (% of the board), his feet on the point he's at. */
const BOUNCE_W = 40;

/** Where he is at `t` ms into the moment, how big, and his shadow (where it falls, how big; none in his corner). */
function bouncePath(t: number, spots: readonly string[], o: Orientation): { at: Pt; scale: number; shadow: { at: Pt; size: number } | null; shown: boolean } {
  const s = spots.map((sp) => spotCentre(sp, o));
  const mid = spotCentre(CENTRE_SPOT, o);
  const L = BOUNCE.leapAt;
  const [l1, l2, l3] = BOUNCE.lands as [number, number, number];
  const lands = [l1, l2, l3];
  if (t < L) return { at: CORNER, scale: 1, shadow: null, shown: false };
  // The leap and the three hops: each from the last place he touched down (just after its squash) to the next spot.
  const hops: { from: Pt; to: Pt; t0: number; t1: number; h: number }[] = [
    { from: CORNER, to: s[0]!, t0: L + 90, t1: l1, h: 26 },
    { from: s[0]!, to: s[1]!, t0: l1 + 100, t1: l2, h: 22 },
    { from: s[1]!, to: s[2]!, t0: l2 + 100, t1: l3, h: 22 },
  ];
  if (t < L + 90) return { at: CORNER, scale: 1, shadow: null, shown: true };
  for (const [i, hp] of hops.entries()) {
    if (t < hp.t0) return { at: hops[i - 1]?.to ?? CORNER, scale: 1, shadow: { at: hops[i - 1]?.to ?? CORNER, size: 1 }, shown: true };
    if (t < hp.t1) {
      const u = (t - hp.t0) / (hp.t1 - hp.t0);
      return { at: arc(hp.from, hp.to, hp.h, u), scale: 1, shadow: { at: hp.to, size: 0.35 + 0.65 * u }, shown: true };
    }
  }
  // The big one: a deep crouch on the third spot, up and away off the top, then the giant fall onto the middle.
  const up0 = l3 + 230;
  const top: Pt = { x: (s[2]!.x + mid.x) / 2, y: -75 };
  const fall0 = BOUNCE.crashAt - 300;
  if (t < up0) return { at: s[2]!, scale: 1, shadow: { at: s[2]!, size: 1 }, shown: true };
  if (t < fall0) {
    const u = ease((t - up0) / (fall0 - up0));
    return { at: { x: s[2]!.x + (top.x - s[2]!.x) * u, y: s[2]!.y + (top.y - s[2]!.y) * Math.sqrt(u) }, scale: 1, shadow: { at: mid, size: 0.25 * u }, shown: true };
  }
  if (t < BOUNCE.crashAt) {
    const u = (t - fall0) / 300;
    return { at: { x: top.x + (mid.x - top.x) * u, y: top.y + (mid.y - top.y) * u * u }, scale: 1 + 0.4 * u, shadow: { at: mid, size: 0.25 + 1.15 * u }, shown: true };
  }
  // On the middle: giant as he lands, back to his size as the pieces settle.
  const back0 = BOUNCE.backAt + 150;
  if (t < back0) {
    const u = clamp01((t - BOUNCE.crashAt) / (BOUNCE.settledAt - BOUNCE.crashAt));
    return { at: mid, scale: 1.4 - 0.4 * ease(u), shadow: { at: mid, size: 1.4 - 0.4 * ease(u) }, shown: true };
  }
  // And off, back to his corner.
  const u = clamp01((t - back0) / (BOUNCE.total - 120 - back0));
  return { at: arc(mid, CORNER, 30, u), scale: 1 - 0.25 * u, shadow: u < 0.6 ? { at: mid, size: 1 - u * 1.4 } : null, shown: t < BOUNCE.total - 60 };
}

/** One piece knocked up by a bounce: where it starts, where it lands, when it goes up and comes down. */
interface Flyer {
  from: string;
  to: string;
  piece: { color: "w" | "b"; type: string };
  up: number;
  down: number;
  land: number;
  /** A hop (knocked up and back onto its square) rather than a flight to a new one. */
  hop: boolean;
}
const HOP_MS = 520;
const LAND_MS = 400;

/**
 * Every piece the bounce knocks up (never a king): the pieces on each spot as he lands there (those the bounce moves stay up,
 * tumbling, the rest hop back down onto their squares), the pieces on the middle squares at the crash, and any piece
 * it moves that wasn't under a spot (the shockwave throws it up). The moved ones come down one after another as the
 * pieces settle, each onto its new square.
 */
export function bounceFlyers(b: Pick<BounceResult, "before" | "moves" | "spots">): Flyer[] {
  const out: Flyer[] = [];
  const moved = new Map(b.moves.map((m) => [m.from, m.to]));
  const taken = new Set<string>();
  const hit = (sq: string, at: number) => {
    if (taken.has(sq)) return;
    const pc = pieceAt(b.before, sq);
    // (Kings stay put: the board always has both, and the bounce never moves one.)
    if (!pc || pc.type === "k") return;
    taken.add(sq);
    const to = moved.get(sq);
    out.push({ from: sq, to: to ?? sq, piece: pc, up: at, down: to ? 0 : at + HOP_MS, land: to ? 0 : at + HOP_MS, hop: !to });
  };
  b.spots.forEach((sp, k) => spotSquares(sp).forEach((sq) => hit(sq, BOUNCE.lands[k] ?? BOUNCE.crashAt)));
  spotSquares(CENTRE_SPOT).forEach((sq) => hit(sq, BOUNCE.crashAt));
  for (const m of b.moves) hit(m.from, BOUNCE.crashAt);
  // The moved ones settle in turn.
  const fly = out.filter((f) => !f.hop);
  const stagger = fly.length > 1 ? Math.min(80, (BOUNCE.settledAt - BOUNCE.settleAt - LAND_MS - 20) / (fly.length - 1)) : 0;
  fly.forEach((f, i) => {
    f.down = BOUNCE.settleAt + i * stagger;
    f.land = f.down + LAND_MS;
  });
  return out;
}

/** Where a knocked-up piece is at `t` (ms into the moment), in % of the board, and how it's turned. Null: on the board. */
function flyerAt(f: Flyer, t: number, o: Orientation): { at: Pt; rot: number; squash: number } | null {
  if (t < f.up || t >= f.land) return null;
  const a = centreOf(f.from, o);
  if (f.hop) {
    const u = (t - f.up) / HOP_MS;
    return { at: { x: a.x, y: a.y - 11 * 4 * u * (1 - u) }, rot: 360 * ease(u), squash: 1 };
  }
  // Up, then tumbling in the air above its square (drifting a little), then down onto its new one.
  const spin = 300 + ((f.from.charCodeAt(0) * 37 + Number(f.from[1]) * 11) % 200);
  const rise = clamp01((t - f.up) / 300);
  const wobble = Math.sin((t - f.up) / 140) * 1.4;
  const hover: Pt = { x: a.x + wobble, y: a.y - 18 * Math.sqrt(rise) + Math.sin((t - f.up) / 230) * 1.5 };
  const rot = (spin * (t - f.up)) / 1000;
  if (t < f.down) return { at: hover, rot, squash: 1 };
  const u = (t - f.down) / LAND_MS;
  const b = centreOf(f.to, o);
  const end = Math.ceil(rot / 360) * 360;
  return { at: { x: hover.x + (b.x - hover.x) * u, y: hover.y + (b.y - hover.y) * u * u }, rot: rot + (end - rot) * ease(u), squash: 1 };
}

/**
 * The board under the bounce at `t` (ms into its moment): the position before it, less the pieces up in the air;
 * once they've all come down, the new position. Null when no bounce is playing.
 */
export function bounceFen(b: BounceResult | null | undefined, m: Pick<Moment, "kind" | "at"> | null, now: number, after: string): string | null {
  if (!b || !m || m.kind !== "bounce") return null;
  const t = now - m.at;
  if (t >= BOUNCE.settledAt) return after;
  const flyers = bounceFlyers(b);
  let fen = b.before;
  // Off the board: every piece up in the air, and every moved piece once it has gone up; then each moved piece that has
  // come down stands on its new square.
  for (const f of flyers) if (t >= f.up && (!f.hop || t < f.land)) fen = withoutPiece(fen, f.from);
  for (const f of flyers) if (!f.hop && t >= f.land) fen = withPiece(fen, f.to, f.piece);
  return fen;
}

/** The board jolts as he lands (a bump) and at the crash (a jolt). */
export function bounceJolt(m: Pick<Moment, "kind" | "at"> | null, now: number): "bump" | "crash" | null {
  if (!m || m.kind !== "bounce") return null;
  const t = now - m.at;
  if (t >= BOUNCE.crashAt && t < BOUNCE.crashAt + BOUNCE.jolt) return "crash";
  for (const l of BOUNCE.lands) if (t >= l && t < l + 180) return "bump";
  return null;
}

const PIECE_CLASS: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const CRASH_MS = animLength(EFFECTS.bounceCrash.ch.anims.crash!);
const PUFF_MS = animLength(EFFECTS.bouncePuff.ch.anims.puff!);

/** The Big Bounce on the board (its moment's beats: BOUNCE in boss-timing.ts). */
export function BigBounce({ boss, moment, now, orientation }: { boss: BossView; moment: Moment; now: number; orientation: Orientation }) {
  const b = boss.powers?.bounce;
  const kit = bossKit(boss.name);
  if (!b || !kit) return null;
  const t = now - moment.at;
  const path = bouncePath(t, b.spots, orientation);
  const shape = bounceShape(t - BOUNCE.leapAt);
  const [sx, sy] = shape === "squash" ? [1.16, 0.84] : shape === "stretch" ? [0.9, 1.12] : shape === "crash" ? [1.28, 0.72] : [1, 1];
  const ch = kit.ch;
  const w = BOUNCE_W * path.scale;
  const h = (w * ch.h) / ch.w;
  // Dust off each square of a spot as he lands on it, and off the middle at the crash.
  const puffs: BoardItem[] = [];
  b.spots.forEach((sp, k) => {
    const at = moment.at + (BOUNCE.lands[k] ?? 0);
    if (now >= at && now < at + PUFF_MS) for (const sq of spotSquares(sp)) puffs.push({ square: sq, name: "bouncePuff", since: at, quiet: true });
  });
  const crashAt = moment.at + BOUNCE.crashAt;
  if (now >= crashAt && now < crashAt + PUFF_MS) for (const sq of spotSquares(CENTRE_SPOT)) puffs.push({ square: sq, name: "bouncePuff", since: crashAt, quiet: true });
  const flyers = bounceFlyers(b);
  return (
    <div class="cg-wrap bb-layer" aria-hidden="true" data-bounce={t < BOUNCE.settledAt ? "on" : "settled"}>
      {path.shadow && path.shown && (
        <span
          class="bb-shadow"
          style={{ left: `${path.shadow.at.x}%`, top: `${path.shadow.at.y}%`, width: `${22 * path.shadow.size}%`, height: `${7 * path.shadow.size}%`, opacity: String(Math.min(0.55, 0.25 + 0.3 * path.shadow.size)) }}
        />
      )}
      {puffs.length > 0 && <BoardEffects items={puffs} orientation={orientation} class="bb-puffs" />}
      {flyers.map((f) => {
        const p = flyerAt(f, t, orientation);
        if (!p) return null;
        return (
          <piece
            key={`fly-${f.from}`}
            class={`bb-piece ${f.piece.color === "w" ? "white" : "black"} ${PIECE_CLASS[f.piece.type]}`}
            style={{ left: `${p.at.x - 6.25}%`, top: `${p.at.y - 6.25}%`, rotate: `${Math.round(p.rot)}deg` }}
            data-square={f.from}
            data-to={f.to}
          />
        );
      })}
      {now >= crashAt && now < crashAt + CRASH_MS && (
        <span class="bb-crash">
          <BossEffect name="bounceCrash" since={crashAt} id={`crash-${moment.key}`} />
        </span>
      )}
      {path.shown && (
        <span
          class="bb-boy"
          style={{
            left: `${path.at.x - (w * ch.foot[0]) / ch.w}%`,
            top: `${path.at.y - (h * ch.foot[1]) / ch.h}%`,
            width: `${w}%`,
            aspectRatio: `${ch.w} / ${ch.h}`,
            transformOrigin: `${(100 * ch.foot[0]) / ch.w}% ${(100 * ch.foot[1]) / ch.h}%`,
            scale: `${sx} ${sy}`,
          }}
        >
          <BossMoment boss={boss.name} anim="bigBounce" since={moment.at + BOUNCE.leapAt} />
        </span>
      )}
    </div>
  );
}

// ---------------- His snack ----------------

/** His box for the snack (% of the board) and where his free hand reaches from his feet (frame pixels: his `reach`). */
const SNACK_W = 36;
const REACH: Pt = { x: 26, y: -19 };

/** The snack's line (his kit's, the same for everyone). */
export const snackLine = (boss: Pick<BossView, "name" | "id" | "startMove">): string => {
  const kit = bossKit(boss.name);
  return (kit && pickLine(kit, "snack", `${boss.id}:snack:${boss.startMove}`)) ?? "Nom nom.";
};

/** The pawn is still on the board (before he grabs it), `since` the snack's start. */
export const snackPawnShown = (since: number, now: number) => now < since + SNACK.grabAt;

/**
 * His snack in the intro, from `since` (SNACK's beats): he waddles in from the board's edge to the crowd's pawn, grabs
 * it (it's gone from the board from then: the screen shows it until `grabAt`), eats it and waddles back off.
 */
export function SnackTime({ boss, since, now, orientation }: { boss: BossView; since: number; now: number; orientation: Orientation }) {
  const kit = bossKit(boss.name);
  const sq = boss.powers?.snack;
  // His line, into his voice (his text box, for its time: speech.tsx).
  const lineAt = since + SNACK.nomAt;
  const due = now >= lineAt;
  useLayoutEffect(() => {
    if (due) bossVoice.say(snackLine(boss), `${boss.id}:${boss.startMove}:snack`, NORMAL);
  }, [due]);
  if (!kit?.ch.anims.snack || !sq) return null;
  const ch = kit.ch;
  const t = now - since;
  const p = centreOf(sq, orientation);
  const px = SNACK_W / ch.w;
  // His feet so that his reaching hand lands on the pawn: from the left edge for a pawn left of the middle, else
  // from the right.
  const foot: Pt = { x: p.x - REACH.x * px, y: p.y - REACH.y * px };
  const fromX = p.x < 50 ? -24 : 112;
  const back = SNACK.ms - 650;
  const x = t < SNACK.walkMs ? fromX + (foot.x - fromX) * (t / SNACK.walkMs) : t < back ? foot.x : foot.x + (fromX - foot.x) * clamp01((t - back) / 650);
  const h = (SNACK_W * ch.h) / ch.w;
  return (
    <div class="power-moment pm-snack">
      {t < SNACK.ms && (
        <span class="bb-snack" style={{ left: `${x - (SNACK_W * ch.foot[0]) / ch.w}%`, top: `${foot.y - (h * ch.foot[1]) / ch.h}%`, width: `${SNACK_W}%`, aspectRatio: `${ch.w} / ${ch.h}`, opacity: t > SNACK.ms - 200 ? String((SNACK.ms - t) / 200) : "1" }}>
          <BossMoment boss={boss.name} anim="snack" since={since} look={boss.crowdSide === "b" ? "blackPawn" : undefined} />
        </span>
      )}
    </div>
  );
}

// ---------------- Drawn ahead ----------------

const warmed = new Set<string>();
/**
 * His powers' frames drawn ahead, a slice each animation frame (prewarm), from when his battle shows: the snack first
 * (it plays a few seconds in), then the toss and the toy block, then the bounce and its crash, so none of them stalls
 * a slow phone the first time it shows (.claude/LESSONS.md: "A stall the first time an effect shows").
 */
export function prewarmBigBoy(name: string, look?: string): void {
  const kit = bossKit(name);
  if (!kit || warmed.has(`${name}:${look ?? ""}`)) return;
  warmed.add(`${name}:${look ?? ""}`);
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  prewarmSprite(kit.ch, [...frames("snack"), ...frames("toss"), ...frames("bigBounce")], look);
  const fx = (n: keyof typeof EFFECTS) => Object.entries(EFFECTS[n].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const));
  prewarm("blockFly", fx("blockFly"));
  prewarm("toyBlock", fx("toyBlock"));
  prewarm("bouncePuff", fx("bouncePuff"));
  prewarm("bounceCrash", fx("bounceCrash"));
}

// ---------------- His powers on screen: the toy block, the Big Bounce's moment ----------------

/** When this device saw a toy block go (it puffs away from then, as the next turn begins). */
const blockGone = new Map<string, number>();
/** The last toy block each battle showed (so one that has just gone puffs away). */
const blockLast = new Map<string, { square: string; until: number }>();
/**
 * Big Boy's toy block on the board: landing as his toss arrives (its moment), sitting while it lasts, and puffing away
 * once it's gone (as the turn after its last begins). One canvas over the board, under any banner, never taking a tap.
 */
function blockItems(boss: BossView, now: number, appearAt: (square: string) => number): BoardItem[] {
  const p = boss.powers;
  if (!p || p.passive !== "blocks") return [];
  const key = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const block = p.block ?? null;
  const out: BoardItem[] = [];
  if (block) {
    blockLast.set(key, { square: block.square, until: block.until });
    const since = appearAt(block.square);
    if (now >= since) out.push(blockItem(block.square, since ? "land" : "sit", since));
  } else {
    const last = blockLast.get(key);
    if (last && last.until < p.turn) {
      const tag = `${key}:${last.square}:${last.until}`;
      let at = blockGone.get(tag);
      if (at === undefined) blockGone.set(tag, (at = now));
      if (now < at + POOF_MS) out.push(blockItem(last.square, "poof", at));
    }
  }
  return out;
}
const POOF_MS = animLength(EFFECTS.toyBlock.ch.anims.poofA!);

function blockMoment({ moment, t, orientation, banner, cast }: MomentProps) {
  const letter = moment.square ? blockLetter(moment.square) : "A";
  return (
    <div class="power-moment pm-block">
      {t < 1500 && banner("TOY BLOCK!", moment.square ? `Blocked: ${moment.square}` : undefined, "toy")}
      {cast("toss", BLOCK.flyAt)}
      {moment.square && t >= BLOCK.flyAt && t < BLOCK.landAt && (
        <Flight name="blockFly" anim={`fly${letter}`} square={moment.square} orientation={orientation} since={moment.at + BLOCK.flyAt} ms={BLOCK.landAt - BLOCK.flyAt} />
      )}
    </div>
  );
}

function bounceMoment({ boss, moment, now, t, orientation, banner }: MomentProps) {
  return (
    <div class="power-moment pm-bounce">
      {t < 1300 && banner("BIG BOUNCE!", undefined, "toy")}
      <BigBounce boss={boss} moment={moment} now={now} orientation={orientation} />
    </div>
  );
}

/** Big Boy's powers on screen. His rules: packages/chess/src/bosses/bigboy.ts. */
export const BIGBOY_UI = {
  id: "bigboy",
  // (His Big Bounce comes at the start of his turn, after your move.)
  ultimate: { name: "the Big Bounce", when: "After your move" },
  moments: {
    block: { order: 0, kit: "power", dock: "Toy block!", appearAt: (m, square) => (m.square === square ? m.at + BLOCK.landAt : undefined), view: blockMoment },
    // The Big Bounce, at the start of his turn before his move: its own screen.
    bounce: { order: 3, kit: "ultimate", dock: "Big Bounce!", own: (boss) => !!boss.powers?.bounce && boss.powers.bounce.at === boss.crowdMoves && boss.powers.events.some((e) => e.kind === "bounce"), view: bounceMoment },
  },
  // His toy block: landing as his toss arrives, sitting while it lasts, puffing away as it goes.
  board: ({ boss, orientation, now, appearAt }) => {
    const blocks = blockItems(boss, now, appearAt);
    return {
      over: (
        <>
          {blocks.length > 0 && <BoardEffects items={blocks} orientation={orientation} class="pw-fire-board pw-block-board" />}
          {blocks.map((b) => (
            <span key={`block-${b.square}`} class="pw-block" style={onSquare(b.square, orientation)} data-square={b.square} data-state={b.anim!.replace(/[A-Z]$/, "")} />
          ))}
        </>
      ),
    };
  },
} satisfies BossUi;
