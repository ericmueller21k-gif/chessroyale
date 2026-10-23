import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { GARDEN_ART, WATER_BEATS, growthAt, withPiece, withoutPiece, type GardenView } from "@chessroyale/chess";
import { BOSS_POWERS, type WaterGrowth } from "@chessroyale/core";
import { SWEEP_MS } from "../characters/effects/gardener.ts";
import { pickLine } from "../characters/boss-beats.ts";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, cueAt } from "../characters/power-art.ts";
import type { PieceDecor } from "../board/types.ts";
import type { BossView } from "../game.ts";
import { gardenNow, realMs } from "../garden-clock.ts";
import { addToss, currentTosses, freshLanding, hasTossed, onTosses, resetTosses, seedReading, tossSquares, type Toss } from "../garden-seeds.ts";
import { NORMAL, Say, bossVoice } from "../speech.tsx";
import { BoardEffects, BossEffect, prewarm, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { figureBusy, playInPlace } from "./BossCharacter.tsx";
import { SoundAt, onSquare, type BoardLayerProps, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Puddles', the hippo gardener's, powers on screen (his rules: packages/chess/src/bosses/gardener.ts; docs/decisions/2026-10-21-gardener-rules.md
 * and 2026-10-23-gardener-wired.md), all from the shared state and the garden's clock, so everyone online sees the same thing:
 * - **The seed meter** (`SeedMeter`, in the boss bar by the rage meter): a seed icon, "Seeds 7" and a bar filling toward the next seed, from
 *   the view's `garden` and the rules' `seedsAt` / `seedFill` on the garden's clock (garden-clock.ts: the server's online, the page's
 *   visible time solo). Held while a watering is being placed (`garden.taken`); full at the cap.
 * - **The toss**: the opening's five seeds (the `plantMany` event of the first crowd turn) and one seed each time the count rises on this
 *   screen's own clock (`plant`: no turn's events carry it). His `plant` animation plays where he stands, never over another animation of
 *   his; at its `toss` cue the seeds leave his hand, wherever it is on the screen, and arc to squares of the board's middle (decorative:
 *   a seeded pick, the same on every device) and plop in (`seedPlop`). Nothing stays. Nothing holds a move (their POWER_FX is 0), and the
 *   timer that watches for the next seed waits for its time: no redraw of the board for it.
 * - **The watering** (`water`, as the crowd's turn after it begins; his whole turn): his cast at the board's corner; at its `spray` cue the
 *   `waterSweep` crosses the board and each outcome's square sprouts as the front reaches it; then each outcome in the moment's `growth`
 *   order, WATER_BEATS apart: a killer plant `kill` (the piece off at `snap`, as a captured piece goes), a grown piece `bud` / `budQueen`
 *   (the piece on at `pop`, with a pop-in), a plain plant `grow` then `green`, nothing `wilt`. The board under the moment is the position
 *   before it until each outcome's cue (`gardenerFen`). Then his reaction: `cheer`, `bigCheer` or `shrug`.
 * - **The plain plants** stay drawn on their squares from `garden.plants` while they block: `green` at `left` 3, `toFall` then `fall` at 2,
 *   `toDrop` then `drop` at 1, `gone` as one leaves the list. A reload shows each in its state without a watering played again (a
 *   moment plays from the turn's events only; `garden.water` stays in the view).
 */

type Orientation = "white" | "black";

/** A square's column and row on screen (0 at the top left). */
const cellOf = (square: string, o: Orientation) => {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { col: o === "white" ? f : 7 - f, row: o === "white" ? 7 - r : r };
};

// ---------------- Where the sweep is, and when ----------------

/**
 * The spray's front across the board in the art (effects/gardener.ts, `WATER_SWEEP`): the front is at x `front0 + step * i` (of the
 * board's 256 px) in frame i (`frameMs` each), and the lower rows lead by `lean` px a row. A test measures the sprite against these.
 * He casts at the board's left (its top-left corner), the sweep as drawn comes in from the left edge: it needs no flip for his side.
 */
export const SWEEP = { frameMs: 60, front0: -24, step: 50, lean: 0.35, board: 256 } as const;

/** When the spray's front reaches a square's middle, ms after the sweep starts (0 to SWEEP_MS): where it sprouts. */
export function frontMs(square: string, orientation: Orientation): number {
  const { col, row } = cellOf(square, orientation);
  const front = (col + 0.5) * 32 - SWEEP.lean * ((row + 0.5) * 32 - SWEEP.board / 2);
  return Math.max(0, Math.min(SWEEP_MS, Math.round(((front - SWEEP.front0) / SWEEP.step) * SWEEP.frameMs)));
}

// ---------------- The board under the watering ----------------

const letter = (l: string) => ({ color: l === l.toUpperCase() ? ("w" as const) : ("b" as const), type: l.toLowerCase() });
/** A grown piece is a pawn, knight, bishop, rook or the queen. */
const grows = (k: WaterGrowth["kind"]) => k === "p" || k === "n" || k === "b" || k === "r" || k === "q";
/** How long a grown piece's pop-in takes (ms). */
export const POP_MS = 160;

/**
 * The position the board shows during his watering: the one before it, until each outcome's cue: a piece a killer plant eats is on its square
 * until the plant's `snap`, a piece grown for him isn't there until the bud's `pop`. Nothing else changes (plants and nothing are not
 * pieces). `decor`: a pop-in on a piece in its first POP_MS (the board draws it as part of the piece). Null with no watering among
 * `moments` (the plain position: Boss.tsx).
 */
export function gardenerFen(boss: Pick<BossView, "id">, moments: readonly Moment[], now: number, fen: string): { fen: string; decor?: PieceDecor } | null {
  const m = boss.id === "gardener" ? moments.find((x) => x.kind === "water") : null;
  if (!m?.growth?.length) return null;
  let out = fen;
  const popping: string[] = [];
  m.growth.forEach((g, i) => {
    const at = m.at + growthAt(i);
    if (g.kind === "killer" && g.ate && now < at + GARDEN_ART.killSnap) out = withPiece(out, g.square, letter(g.ate));
    else if (grows(g.kind)) {
      if (now < at + GARDEN_ART.budPop) out = withoutPiece(out, g.square);
      else if (now < at + GARDEN_ART.budPop + POP_MS) popping.push(g.square);
    }
  });
  if (out === fen && !popping.length) return null;
  return popping.length ? { fen: out, decor: { key: `gd-pop:${popping.join()}`, of: (square) => (popping.includes(square) ? { cls: "gd-pop", kids: null } : undefined) } } : { fen: out };
}

// ---------------- The plain plants ----------------

const GONE_MS = animLength(EFFECTS.gardenPlant.ch.anims.gone!);
/** Each plant's state as this device first saw it, and when it last changed (0: it was so when first seen: a reload shows it as it is). */
const plantSeen = new Map<string, { left: number; since: number }>();
/** The plants drawn last time in each battle (id to square), and those that have just left (id to square and when). */
const plantLast = new Map<string, Map<string, string>>();
const plantGone = new Map<string, { square: string; at: number }>();

/** A new battle: nothing seen or tossed yet (BossCharacter.resetBeats). */
export function resetGarden(): void {
  plantSeen.clear();
  plantLast.clear();
  plantGone.clear();
  resetTosses();
}

export type PlantState = "green" | "fall" | "drop";
/** A plain plant's state by the crowd turns it still blocks (the view's `left`): 3 (the turn it grew), 2, 1. */
export const plantState = (left: number): PlantState => (left >= 3 ? "green" : left === 2 ? "fall" : "drop");

/**
 * The plain plants on the board: each in its state (`green`, then `toFall` into `fall`, then `toDrop` into `drop` as the turns pass,
 * seen by this device), and `gone` for GONE_MS once one leaves the list. `skip`: squares the watering's moment is drawing itself
 * (their `grow` has not played yet). `wake`: when to draw again (a `gone` ends).
 */
function plantItems(boss: BossView, g: GardenView, now: number, skip: ReadonlySet<string>): { items: BoardItem[]; marks: { square: string; state: PlantState | "gone" }[]; wake: number[] } {
  const bkey = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const items: BoardItem[] = [];
  const marks: { square: string; state: PlantState | "gone" }[] = [];
  const wake: number[] = [];
  const here = new Map<string, string>();
  for (const x of g.plants) {
    if (skip.has(x.square)) continue;
    const id = `${bkey}:${x.square}:${x.at}`;
    here.set(id, x.square);
    let s = plantSeen.get(id);
    if (!s) plantSeen.set(id, (s = { left: x.left, since: 0 }));
    else if (s.left !== x.left) plantSeen.set(id, (s = { left: x.left, since: now }));
    const state = plantState(x.left);
    // (Changed in front of us: the leaves turn, then it rests in its new state. Seen already so: it simply is.)
    const into = state === "fall" ? "toFall" : state === "drop" ? "toDrop" : null;
    items.push(into && s.since ? { square: x.square, name: "gardenPlant", anim: into, then: state, since: s.since } : { square: x.square, name: "gardenPlant", anim: state, since: s.since });
    marks.push({ square: x.square, state });
  }
  // One that has left the list is gone: its last leaves fall and the stem folds, once.
  const last = plantLast.get(bkey);
  if (last && !boss.result) for (const [id, square] of last) if (!here.has(id) && !plantGone.has(id)) plantGone.set(id, { square, at: now });
  plantLast.set(bkey, here);
  for (const [id, gone] of plantGone) {
    if (!id.startsWith(`${bkey}:`)) continue;
    if (now >= gone.at + GONE_MS) plantGone.delete(id);
    else {
      items.push({ square: gone.square, name: "gardenPlant", anim: "gone", since: gone.at });
      marks.push({ square: gone.square, state: "gone" });
      wake.push(gone.at + GONE_MS + 30);
    }
  }
  return { items, marks, wake };
}

// ---------------- The watering's outcomes ----------------

/** What the board draws on a seed's square at `now`: its sprout from when the sweep's front reaches it, then its outcome from its turn. */
function waterItems(m: Moment, now: number, orientation: Orientation): BoardItem[] {
  const out: BoardItem[] = [];
  (m.growth ?? []).forEach((g, i) => {
    const sproutAt = m.at + WATER_BEATS.sprayAt + frontMs(g.square, orientation);
    const at = m.at + growthAt(i);
    if (now >= at) {
      // (The queen's pop has a chime of its own: SoundAt below. A plain plant ends on its green and stays so.)
      const how = g.kind === "killer" ? { anim: "kill" } : g.kind === "q" ? { anim: "budQueen", quiet: true } : g.kind === "plant" ? { anim: "grow", then: "green" } : g.kind === "nothing" ? { anim: "wilt" } : { anim: "bud" };
      out.push({ square: g.square, name: "gardenPlant", since: at, ...how });
    } else if (now >= sproutAt) out.push({ square: g.square, name: "gardenPlant", anim: "sprout", since: sproutAt });
  });
  return out;
}

/** The spray crossing the board, then the wet shine: one canvas over the whole board. */
function Sweep({ m, now }: { m: Moment; now: number }) {
  const at = m.at + WATER_BEATS.sprayAt;
  const sheenAt = at + SWEEP_MS;
  const end = sheenAt + animLength(EFFECTS.waterSweep.ch.anims.sheen!);
  if (now < at || now >= end) return null;
  const sheen = now >= sheenAt;
  return (
    <div class="gd-sweep" data-phase={sheen ? "sheen" : "sweep"} aria-hidden="true">
      <BossEffect name="waterSweep" anim={sheen ? "sheen" : "sweep"} since={sheen ? sheenAt : at} id={`${m.key}:${sheen ? "sheen" : "sweep"}`} />
    </div>
  );
}

// ---------------- The toss ----------------

/** Where the seeds leave his hand in his frame (px), at the `toss` cue: the middle of the seeds in the air in that frame (a test measures it). */
export const HAND = { x: 23, y: 54.5 } as const;
/** A seed's flight from his hand to its square (ms), and the gap between the five of the opening (ms). */
export const SEED_FLY_MS = 620;
export const SEED_GAP_MS = 80;
const PLOP_MS = animLength(EFFECTS.seedPlop.ch.anims.plop!);

/**
 * Where his hand is on the board (the board's size as 1, the squares' origin at 0,0), from where his figure stands on this screen: a
 * phone's boss bar, a computer's side, whichever shows. Null where no figure is on screen.
 */
function handOnBoard(root: HTMLElement | null, kit: BossKit): { x: number; y: number } | null {
  const board = root?.closest(".board-wrap")?.querySelector<HTMLElement>(".hb-board");
  if (!board) return null;
  const b = board.getBoundingClientRect();
  if (!b.width) return null;
  for (const el of document.querySelectorAll<HTMLElement>(".boss-char:not(.place-results) .boss-char-sprite")) {
    const r = el.getBoundingClientRect();
    if (r.width < 1) continue;
    return { x: (r.left + (HAND.x / kit.ch.w) * r.width - b.left) / b.width, y: (r.top + (HAND.y / kit.ch.h) * r.height - b.top) / b.width };
  }
  return null;
}

/**
 * A toss of `n` seeds on this screen: his `plant` animation where he stands (unless he's in the middle of another: then only the seeds
 * fly, from where his hand is), and the seeds, leaving at the animation's `toss` cue. Played once per `id` on this device.
 */
function toss(boss: BossView, kit: BossKit, root: HTMLElement | null, kind: "plant" | "plantMany", id: string, n: number): void {
  if (hasTossed(id)) return;
  const a = kit.ch.anims[kind];
  if (!a) return;
  const start = Date.now();
  const leaveAt = start + (cueAt(a, "toss") ?? 0);
  if (!figureBusy(kit.ch, start)) playInPlace(id, [kind], start);
  addToss({ id, hand: handOnBoard(root, kit), seeds: tossSquares(id, n).map((to, i) => ({ to, leaveAt: leaveAt + i * SEED_GAP_MS })) });
  // His word for it: the opening's always, the 30 s seed's now and then (its chance).
  bossVoice.say(pickLine(kit, kind, id), `${boss.id}:${boss.startMove}:${id}`, NORMAL);
}

/**
 * Watches for the tosses on a screen with a board (every one has it, and `hasTossed` keeps a second screen from tossing twice): the
 * opening's five as the first crowd turn's `plantMany` is first seen, and a seed for each landing of the meter that is just now. The
 * timer waits for the next seed's time (no look per frame); a landing a moment ago is tossed, one older is not (a hidden page online,
 * a reload, a screen drawn late), and nothing is tossed while the page is hidden.
 */
function SeedWatch({ boss, root }: { boss: BossView; root: { current: HTMLElement | null } }) {
  const g = boss.powers?.garden ?? null;
  const kit = bossKit(boss.name);
  const key = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const opening = !!boss.powers?.events.some((e) => e.kind === "plantMany");
  useLayoutEffect(() => {
    if (opening && kit && document.visibilityState !== "hidden") toss(boss, kit, root.current, "plantMany", `${key}:plantMany`, BOSS_POWERS.seedsAtStart);
  }, [opening, key]);
  useEffect(() => {
    if (!g || !kit || boss.result) return;
    let timer = 0;
    const step = () => {
      clearTimeout(timer);
      const now = gardenNow();
      const landed = freshLanding(g, now);
      if (landed && document.visibilityState !== "hidden") toss(boss, kit, root.current, "plant", `${key}:plant:${landed.key}`, 1);
      const r = seedReading(g, now);
      if (r.next !== null) timer = window.setTimeout(step, Math.max(0, realMs(r.next - now)) + 40);
    };
    step();
    document.addEventListener("visibilitychange", step);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", step);
    };
  }, [g?.since, g?.base, g?.fixed, g?.taken?.clock, !!boss.result, key]);
  return null;
}

/** Redraws the component when each of `times` (Date.now() time) comes: a seed leaving, landing, its plop ending. */
function useWake(times: readonly number[]): void {
  const [tick, bump] = useState(0);
  const key = times.join();
  useEffect(() => {
    const now = Date.now();
    const next = times.filter((t) => t > now).sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const id = window.setTimeout(() => bump((n) => n + 1), next - now + 5);
    return () => clearTimeout(id);
  }, [key, tick]);
}

/**
 * The seeds in the air and plopping at their own times: each flies from his hand across SEED_FLY_MS (up and over, down onto its square: CSS,
 * in the board's own size), then plops for the art's length, then is gone. Redrawn (on its own, not the board) when a toss is added and
 * when a seed leaves, lands or finishes.
 */
function SeedFlights({ orientation }: { orientation: Orientation }) {
  const [, bump] = useState(0);
  useEffect(() => onTosses(() => bump((n) => n + 1)), []);
  const now = Date.now();
  const wake: number[] = [];
  const out: preact.JSX.Element[] = [];
  for (const t of currentTosses())
    t.seeds.forEach((s, i) => {
      const land = s.leaveAt + SEED_FLY_MS;
      wake.push(s.leaveAt, land, land + PLOP_MS);
      if (now < s.leaveAt || now >= land + PLOP_MS) return;
      const id = `${t.id}:${i}`;
      if (now < land) {
        const { col, row } = cellOf(s.to, orientation);
        const hand = t.hand ?? { x: -0.1, y: -0.12 };
        const [x0, y0, x1, y1] = [hand.x - 1 / 16, hand.y - 1 / 16, col / 8, row / 8];
        const style = { "--x0": x0.toFixed(4), "--y0": y0.toFixed(4), "--x1": x1.toFixed(4), "--y1": y1.toFixed(4), "--yp": (Math.min(y0, y1) - 0.03 - 0.08 * Math.min(1, Math.hypot(x1 - x0, y1 - y0))).toFixed(4), animationDuration: `${SEED_FLY_MS}ms`, animationDelay: `${s.leaveAt - now}ms` };
        out.push(
          <span key={`fly-${id}`} class="gd-seed" data-square={s.to} style={style}>
            <BossEffect name="seedFly" since={s.leaveAt} id={id} />
          </span>,
        );
      } else
        out.push(
          <span key={`plop-${id}`} class="gd-plop" data-square={s.to} style={onSquare(s.to, orientation)}>
            <BossEffect name="seedPlop" since={land} id={id} />
          </span>,
        );
    });
  useWake(wake);
  return <div class="gd-seeds">{out}</div>;
}

// ---------------- The layer over the board ----------------

/**
 * His layer over the board: the toss (a watch for seeds, the seeds in the air and plopping), the plain plants on their squares and the
 * watering's sweep, sprouts and outcomes (one canvas, drawn over the pieces), as the moment of this screen has it (`moments`: the Boss
 * screen's).
 */
function GardenLayer({ boss, p, orientation, moments, now }: BoardLayerProps) {
  const g = p.garden ?? null;
  const root = useRef<HTMLDivElement>(null);
  const water = moments.find((m) => m.kind === "water") ?? null;
  const wake: number[] = [];
  let items: BoardItem[] = [];
  let marks: { square: string; state: PlantState | "gone" }[] = [];
  if (g) {
    // (The watering's own plants are drawn by its moment for as long as this screen has it.)
    const own = new Set(water ? (water.growth ?? []).filter((x) => x.kind === "plant").map((x) => x.square) : []);
    const plants = plantItems(boss, g, now, own);
    items = plants.items;
    marks = plants.marks;
    wake.push(...plants.wake);
  }
  if (water) items = [...waterItems(water, now, orientation), ...items];
  useWake(wake);
  return (
    <div class="gd-layer" ref={root} data-plants={marks.filter((x) => x.state !== "gone").length}>
      <SeedWatch boss={boss} root={root} />
      {items.length > 0 && <BoardEffects items={items} orientation={orientation} class="pw-fire-board gd-plants" />}
      {marks.map((x) => (
        <span key={`plant-${x.square}-${x.state}`} class="gd-plant" style={onSquare(x.square, orientation)} data-square={x.square} data-state={x.state} />
      ))}
      {water && <Sweep m={water} now={now} />}
      <SeedFlights orientation={orientation} />
    </div>
  );
}

// ---------------- The seed meter ----------------

/** The seed icon, 9 x 9 pixels: a sunflower seed, tan with a dark edge. */
const SEED_ICON = [
  "...kk....",
  "..kttk...",
  "..kttmk..",
  ".kttmmk..",
  ".kttmmdk.",
  ".kmmmddk.",
  "..kmddk..",
  "..kddkk..",
  "...kk....",
];
const SEED_COLORS: Record<string, string> = { k: "#3a2412", t: "#efc875", m: "#c48a45", d: "#8a5a2c" };

/**
 * His seed meter, by the rage meter in the boss bar: a seed, "Seeds 7" and a bar filling toward the next seed (full and still at the cap).
 * From the view's `garden` and the garden's clock; held while a watering is being placed. Redraws itself four times a second while a
 * seed is on its way (the screens around it draw only now and then).
 */
export function SeedMeter({ boss }: { boss: BossView }) {
  const g = boss.powers?.garden ?? null;
  const [, bump] = useState(0);
  const r = g && !boss.result ? seedReading(g, gardenNow()) : null;
  const live = !!r && r.next !== null;
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => bump((n) => n + 1), 250);
    const visible = () => document.visibilityState === "visible" && bump((n) => n + 1);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [live]);
  if (!r) return null;
  const max = BOSS_POWERS.seedMax;
  const pct = Math.round(r.fill * 100);
  return (
    <span class={`seed-meter${r.held ? " held" : ""}${r.count >= max ? " full" : ""}`} role="meter" aria-label={`Seeds ${r.count} of ${max}`} aria-valuenow={r.count} aria-valuemin={0} aria-valuemax={max} data-seeds={r.count} data-fill={pct} data-held={r.held ? "1" : "0"}>
      <svg class="seed-icon" viewBox="0 0 9 9" width="9" height="9" shape-rendering="crispEdges" aria-hidden="true">
        {SEED_ICON.flatMap((row, y) => [...row].map((c, x) => (c === "." ? null : <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={SEED_COLORS[c]} />)))}
      </svg>
      <b class="seed-label">Seeds {r.count}</b>
      <span class="seed-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

// ---------------- His moments ----------------

const nothing = () => null;

/** He says it as the plant gulps (ms into its outcome): its `gulp` cue. */
const EATEN_AT = cueAt(EFFECTS.gardenPlant.ch.anims.kill!, "gulp") ?? GARDEN_ART.killSnap;

/** The watering: his cast at the board's corner (the sweep, the sprouts and the outcomes are the board layer's), the queen's chime, his word for a meal of his own piece. */
function waterMoment({ boss, moment, now, cast, kit }: MomentProps) {
  const growth = moment.growth ?? [];
  const eaten = growth.findIndex((x) => x.kind === "killer" && x.own);
  const line = kit && eaten >= 0 ? pickLine(kit, "ownEaten", `${moment.key}:eaten`) : null;
  return (
    <div class="power-moment pm-water">
      {cast("spray", WATER_BEATS.sprayAt)}
      {growth.map((x, i) => (x.kind === "q" ? <SoundAt key={`chime-${i}`} id={`${moment.key}:${boss.startMove}:chime:${i}`} at={moment.at + growthAt(i) + GARDEN_ART.budPop} now={now} sound="gardenerChime" /> : null))}
      {eaten >= 0 && now >= moment.at + growthAt(eaten) + EATEN_AT && <Say voice={bossVoice} text={line} sayKey={`${boss.id}:${boss.startMove}:${moment.key}:eaten`} priority={NORMAL} />}
    </div>
  );
}

/** His reaction after the outcomes: a cheer (a piece grew), a big cheer (a queen), a shrug (nothing came up), at the board's corner. */
const reaction = (cue: string, at: number) =>
  function reactionMoment({ cast }: MomentProps) {
    return <div class="power-moment pm-reaction">{cast(cue, at)}</div>;
  };

const MOMENTS: Record<"plantMany" | "plant" | "water" | "cheer" | "bigCheer" | "shrug", MomentUi> = {
  // The seeds' tosses are the board layer's (SeedWatch), not moments any screen holds; the layer says their lines too.
  plantMany: { order: 0, kit: "plantMany", line: () => null, view: nothing },
  plant: { order: 0, kit: "plant", line: () => null, view: nothing },
  water: { order: 2, kit: "ultimate", view: waterMoment },
  cheer: { order: 3, kit: "cheer", view: reaction("cheer", 80) },
  bigCheer: { order: 3, kit: "bigCheer", view: reaction("cheer", 90) },
  shrug: { order: 3, kit: "shrug", view: reaction("shrug", 300) },
};

/** The dock's line on the turn he spent watering (his whole turn: no move to show). */
export const waterLine = (boss: Pick<BossView, "name">): string => `${boss.name} spent his turn watering.`;

let warmed = false;
/** His tosses, watering and reactions drawn ahead as his battle starts, and the board's sprites. */
export function prewarmGardener(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed) return;
  warmed = true;
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  prewarmSprite(kit.ch, [...frames("plantMany"), ...frames("plant"), ...frames("water"), ...frames("cheer"), ...frames("bigCheer"), ...frames("shrug")]);
  for (const fx of ["seedFly", "seedPlop", "waterSweep", "gardenPlant"] as const) prewarm(fx, Object.entries(EFFECTS[fx].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

export const GARDENER_UI = {
  id: "gardener",
  // (His watering comes at the start of his turn, after your move, as Alfil's Slam.)
  ultimate: { name: "Watering", when: "After your move" },
  moments: MOMENTS,
  // His meter, beside the rage meter in the boss bar.
  bar: ({ boss }) => <SeedMeter boss={boss} />,
  // His watering was his whole turn: no move to show.
  noMove: (boss) => (boss.powers?.garden?.water && boss.powers.garden.water.at === boss.crowdMoves && !boss.lastMove ? waterLine(boss) : null),
  board: (p) => ({ over: <GardenLayer {...p} /> }),
} satisfies BossUi;
