/**
 * Where Ginger's elves and his intro's props are at a time (Nov 5), for the mockups only (intro-ginger-view.ts, ginger-stills.ts):
 * the shopkeeper behind his stand, the three walkers on their loops, the dispensing pair on theirs (SHOP_GINGER_DISPENSE_PATH),
 * and the intro's timeline (INTRO_T, as intro-ginger-nov5.md has it): his moves, the blast, the shard falling and landing, the
 * crack and the puff, the board carried out of the stockroom and tossed onto the table, the white light, the wipe. The game's code
 * does this its own way; the numbers here are the notes'.
 */
import type { Character } from "../../packages/app/src/characters/sprite.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import { GINGERBREAD } from "../../packages/app/src/characters/gingerbread.ts";
import * as SHOP from "./out/house-shop-ginger/house-shop-ginger.ts";
import * as N from "./out/npc-ginger-elf/npc-ginger-elf.ts";
import * as IN from "./out/house-intro-ginger/house-intro-ginger.ts";
import { BOSS_GINGER_INTRO, INTRO_GINGER_BLAST_FROM } from "./out/boss-ginger/boss-ginger.ts";
import { sidekickGingerElf } from "./out/sidekick-ginger-elf/sidekick-ginger-elf.ts";

export type Fig = { ch: Character; anim: string; ms: number; at: readonly [number, number]; lift?: number; flip?: boolean; scale?: number; label?: string };
export type Prop = { ch: Character; anim: string; ms: number; at: readonly [number, number]; lift?: number; dx?: number; depthBias?: number; alpha?: number; slab?: boolean };
export type Decal = { ch: Character; anim: string; ms: number; at: readonly [number, number]; w: number; h: number };

const lenOf = (ch: Character, a: string) => ch.anims[a]!.frames.reduce((s, f) => s + f.ms, 0);
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
export const BOSS_PX = GINGERBREAD.h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.gingerbread ?? 1));

// ---- The walkers: 1.6 squares a second, pausing at their beats.

const WALKER_SPEED = 1.6;
const WALKER_CH = { red: N.NPC_GINGER_ELF_RED, green: N.NPC_GINGER_ELF_GREEN, blue: N.NPC_GINGER_ELF_BLUE } as const;
function walkerAt(name: keyof typeof WALKER_CH, t: number): Fig {
  const pts = SHOP.SHOP_GINGER_WALKERS[name];
  const legs = pts.map((p, i) => ({ from: p.at, to: pts[(i + 1) % pts.length]!.at, pause: p.pause }));
  const total = legs.reduce((s, l) => s + l.pause + (dist(l.from, l.to) / WALKER_SPEED) * 1000, 0);
  let s = ((t % total) + total) % total;
  let lastFace = legs.at(-1)!.to[0] >= legs.at(-1)!.from[0] ? 1 : -1;
  for (const l of legs) {
    const face = l.to[0] >= l.from[0] ? 1 : -1;
    if (s < l.pause) return { ch: WALKER_CH[name], anim: "idle", ms: s, at: l.from, flip: lastFace < 0, label: `walker ${name} pause` };
    s -= l.pause;
    const dur = (dist(l.from, l.to) / WALKER_SPEED) * 1000;
    if (s < dur) {
      const u = s / dur;
      return { ch: WALKER_CH[name], anim: "walk", ms: s, at: [lerp(l.from[0], l.to[0], u), lerp(l.from[1], l.to[1], u)], flip: face < 0 };
    }
    s -= dur;
    lastFace = face;
  }
  return { ch: WALKER_CH[name], anim: "idle", ms: 0, at: pts[0]!.at };
}

// ---- The dispensing pair: 1.4 squares a second; at a stop A plays tap, boxOut, fill, full; B writes.

const PAIR_SPEED = 1.4;
const STOP_ANIMS = ["tap", "boxOut", "fill", "full"] as const;
const STOP_MS = STOP_ANIMS.reduce((s, a) => s + lenOf(N.NPC_GINGER_ELF_BOX, a), 0) + 300;
const PATH = SHOP.SHOP_GINGER_DISPENSE_PATH;
type Way = (typeof PATH)[number];
type Seg = { from: Way; to: Way; ms: number; stop?: Way };
const SEGS: Seg[] = [];
for (let i = 0; i < PATH.length - 1; i++) {
  const a = PATH[i]!, b = PATH[i + 1]!;
  SEGS.push({ from: a, to: b, ms: (dist(a.at, b.at) / PAIR_SPEED) * 1000 });
  if (b.stop) SEGS.push({ from: b, to: b, ms: STOP_MS, stop: b });
}
/** The loop's length (ms). */
export const PAIR_LOOP_MS = SEGS.reduce((s, g) => s + g.ms, 0);
/** When (ms into the loop) A reaches each stop, for picking stills. */
export const PAIR_STOP_AT: { label: string; ms: number }[] = [];
{
  let s = 0;
  for (const g of SEGS) {
    if (g.stop) PAIR_STOP_AT.push({ label: `${g.stop.stop!.row} ${g.stop.stop!.piece}`, ms: s });
    s += g.ms;
  }
}
function pairA(t: number): { at: [number, number]; h: number; face: 1 | -1; stop?: Way; ms: number; walked: number } {
  let s = ((t % PAIR_LOOP_MS) + PAIR_LOOP_MS) % PAIR_LOOP_MS;
  let walked = 0;
  let face: 1 | -1 = 1;
  for (const g of SEGS) {
    const d = dist(g.from.at, g.to.at);
    if (g.to.at[0] !== g.from.at[0]) face = g.to.at[0] > g.from.at[0] ? 1 : -1;
    if (s < g.ms) {
      if (g.stop) return { at: [g.to.at[0], g.to.at[1]], h: g.to.h, face: g.stop.stop!.face, stop: g.stop, ms: s, walked };
      const u = s / g.ms;
      return { at: [lerp(g.from.at[0], g.to.at[0], u), lerp(g.from.at[1], g.to.at[1], u)], h: lerp(g.from.h, g.to.h, u), face, ms: s, walked: walked + d * u };
    }
    s -= g.ms;
    walked += d;
  }
  return { at: [PATH[0]!.at[0], PATH[0]!.at[1]], h: 0, face: 1, ms: 0, walked: 0 };
}
function along(d: number): { at: [number, number]; h: number; face: 1 | -1 } {
  let face: 1 | -1 = 1;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i]!, b = PATH[i + 1]!;
    const L = dist(a.at, b.at);
    if (b.at[0] !== a.at[0]) face = b.at[0] > a.at[0] ? 1 : -1;
    if (d <= L) {
      const u = L ? d / L : 0;
      return { at: [lerp(a.at[0], b.at[0], u), lerp(a.at[1], b.at[1], u)], h: lerp(a.h, b.h, u), face };
    }
    d -= L;
  }
  const z = PATH.at(-1)!;
  return { at: [z.at[0], z.at[1]], h: z.h, face };
}
function pairAt(t: number): Fig[] {
  const a = pairA(t);
  let anim = "walk", ms = t;
  if (a.stop) {
    let s = a.ms;
    anim = "idle";
    ms = s;
    for (const n of STOP_ANIMS) {
      const L = lenOf(N.NPC_GINGER_ELF_BOX, n);
      if (s < L) {
        anim = n;
        ms = s;
        break;
      }
      s -= L;
    }
  }
  const A: Fig = { ch: N.NPC_GINGER_ELF_BOX, anim, ms, at: a.at, lift: a.h, flip: a.face < 0 };
  let B: Fig;
  if (a.stop) {
    const b = a.stop.b!;
    B = { ch: N.NPC_GINGER_ELF_PAD, anim: "write", ms: a.ms, at: [b[0], b[1]], lift: b[2], flip: a.stop.stop!.face < 0 };
  } else {
    const p = along(Math.max(0, a.walked - 0.5));
    B = { ch: N.NPC_GINGER_ELF_PAD, anim: "walk", ms: t, at: p.at, lift: p.h, flip: p.face < 0 };
  }
  return [A, B];
}

// ---- Everyone in the room at time t.

const keeper = (t: number): Fig => ({ ch: sidekickGingerElf, anim: "idle", ms: t, at: SHOP.SHOP_GINGER_KEEPER.at, label: "shopkeeper" });
/** The room's elves at time t (`pairT`: the dispensing pair's own time, to pick where they are in their loop). */
export function elvesAt(t: number, _intro = false, pairT = t): Fig[] {
  return [keeper(t), walkerAt("red", t), walkerAt("green", t + 1500), walkerAt("blue", t + 3100), ...pairAt(pairT)];
}
/** The room still's elves: [character, anim, at, lift, flip]. */
export const placeElves = (t: number, pairT = t): [Character, string, readonly [number, number], number, boolean][] =>
  elvesAt(t, false, pairT).sort((a, b) => a.at[1] - b.at[1]).map((f) => [f.ch, f.anim, f.at, f.lift ?? 0, !!f.flip]);

// ---- The intro's timeline (ms from his line's start: you're both on your marks).

export const INTRO_T = {
  line: [0, 2500],
  charge: 2800,
  blast: 3900, // its cue (f1) at 3990: the blast flies from his hook
  fly: [3990, 4440],
  burst: 4440,
  form: 4560,
  fall: [5000, 5320],
  land: 5320,
  door: [6000, 7300],
  run: 6100,
  coming: [6300, 7700], // "Coming, boss!" (the code's line) over the carriers
  toss: 8000,
  boardFly: [8330, 8780], // let go at the toss's f3; lands (`clack`)
  cheer: 8590,
  watch: 9100,
  cast: 9000, // its cue (f3) at 9320: the light on the board
  light: 9320,
  swing: [10600, 11900], // (the code's God King attack swing: his idle here)
  brag: 11900,
  wipe: [12600, 13200],
} as const;
const RUN_SPEED = 3.5;
const ROUTE = IN.INTRO_GINGER_BOARD_ROUTE;
const routeLen = ROUTE.slice(1).reduce((s, p, i) => s + dist(ROUTE[i]!, p), 0);
function onRoute(d: number): { at: [number, number]; face: 1 | -1 } {
  for (let i = 1; i < ROUTE.length; i++) {
    const a = ROUTE[i - 1]!, b = ROUTE[i]!;
    const L = dist(a, b);
    if (d <= L) return { at: [lerp(a[0], b[0], d / L), lerp(a[1], b[1], d / L)], face: 1 };
    d -= L;
  }
  return { at: [ROUTE.at(-1)![0], ROUTE.at(-1)![1]], face: 1 };
}
export type IntroNow = { figs: Fig[]; props: Prop[]; decals: Decal[]; bubble: null | { at: readonly [number, number]; up: number; text: string }; wipe: number; slab: null | readonly [number, number]; hide: string[]; swap: Record<string, string> };
export function introAt(t: number): IntroNow {
  const T = INTRO_T;
  const figs: Fig[] = [];
  const props: Prop[] = [];
  const decals: Decal[] = [];
  const B = BOSS_GINGER_INTRO;
  // Him.
  let anim = "idle", ms = t;
  for (const [a, at] of [["charge", T.charge], ["blast", T.blast], ["cast", T.cast], ["brag", T.brag]] as const)
    if (t >= at && t < at + lenOf(B, a)) ((anim = a), (ms = t - at));
  const bossAt = SHOP.SHOP_GINGER_MARKS.boss;
  figs.push({ ch: anim === "idle" ? GINGERBREAD : B, anim, ms, at: bossAt, scale: BOSS_PX, label: "Ginger" });
  // The blast: from his hook (on his frame, scaled to the room) to over the table, in an arc.
  const to = IN.INTRO_GINGER_BLAST_TO;
  const k = 37 / BOSS_PX; // his frame px to room px
  const fromLift = (GINGERBREAD.foot[1] - INTRO_GINGER_BLAST_FROM[1]) * k;
  const fromDx = (INTRO_GINGER_BLAST_FROM[0] - GINGERBREAD.foot[0]) * k;
  if (t >= T.fly[0] && t < T.fly[1]) {
    const u = (t - T.fly[0]) / (T.fly[1] - T.fly[0]);
    const c = lerp(bossAt[0] + fromDx / 37, to.at[0], u);
    const r = lerp(bossAt[1], to.at[1], u);
    props.push({ ch: IN.INTRO_GINGER_BLAST, anim: "fly", ms: t - T.fly[0], at: [c, r], lift: lerp(fromLift, to.lift, u) + Math.sin(u * Math.PI) * 30, depthBias: -3 });
  }
  if (t >= T.burst && t < T.burst + lenOf(IN.INTRO_GINGER_BLAST, "burst")) props.push({ ch: IN.INTRO_GINGER_BLAST, anim: "burst", ms: t - T.burst, at: to.at, lift: to.lift, depthBias: -3 });
  // The shard: forms, hangs, falls, lands (then the table).
  const SH = IN.INTRO_GINGER_SHARD;
  const tableAt = IN.INTRO_GINGER_TABLE_AT;
  let slab: IntroNow["slab"] = null;
  if (t >= T.form && t < T.fall[0]) props.push({ ch: SH, anim: t < T.form + lenOf(SH, "form") ? "form" : "fall", ms: t - T.form, at: tableAt, lift: to.lift - 40, depthBias: -0.01 });
  else if (t >= T.fall[0] && t < T.land) {
    const u = (t - T.fall[0]) / (T.fall[1] - T.fall[0]);
    props.push({ ch: SH, anim: "fall", ms: t - T.fall[0], at: tableAt, lift: (to.lift - 40) * (1 - u * u), depthBias: -0.01 });
  } else if (t >= T.land && t < T.land + lenOf(SH, "land")) props.push({ ch: SH, anim: "land", ms: t - T.land, at: tableAt, depthBias: -0.01 });
  else if (t >= T.land) {
    props.push({ ch: IN.INTRO_GINGER_TABLE, anim: "idle", ms: t, at: tableAt, depthBias: -0.01, slab: true });
  }
  if (t >= T.land) decals.push({ ch: IN.INTRO_GINGER_CRACK, anim: t < T.land + lenOf(IN.INTRO_GINGER_CRACK, "crack") ? "crack" : "idle", ms: t - T.land, at: tableAt, w: 3, h: 2 });
  if (t >= T.land && t < T.land + lenOf(IN.INTRO_GINGER_PUFF, "puff")) props.push({ ch: IN.INTRO_GINGER_PUFF, anim: "puff", ms: t - T.land, at: [tableAt[0], tableAt[1] + 0.05], depthBias: -0.02 });
  // The board carriers: out of the stockroom door, round behind you both, the toss, the cheer, to their watch spots.
  const A = N.NPC_GINGER_ELF_BOARD_A, Bc = N.NPC_GINGER_ELF_BOARD_B;
  const S = IN.INTRO_GINGER_ELF_SPOTS;
  const hide: string[] = [];
  const swap: Record<string, string> = {};
  if (t >= T.door[0] && t < T.door[1]) swap["bay-door"] = "bay-door-open";
  let bubble: IntroNow["bubble"] = null;
  if (t >= T.run) {
    const d = ((t - T.run) / 1000) * RUN_SPEED;
    const end = ROUTE.at(-1)!;
    if (d < routeLen) {
      const p = onRoute(d);
      figs.push({ ch: A, anim: "carry", ms: t, at: [p.at[0] + S.carry.a, p.at[1]] }, { ch: Bc, anim: "carry", ms: t, at: [p.at[0] + S.carry.b, p.at[1]] });
      const i = Math.floor((t % lenOf(A, "carry")) / 80);
      props.push({ ch: IN.INTRO_GINGER_BOARD, anim: "carry", ms: 0, at: p.at, lift: N.ELF_BOARD_HANDS.carry[i % 6]!, depthBias: -0.01 });
    } else if (t < T.cheer) {
      // Waiting a beat, then the toss.
      const tossing = t >= T.toss;
      const tm = t - T.toss;
      figs.push({ ch: A, anim: tossing ? "toss" : "carry", ms: tossing ? tm : 0, at: [end[0] + S.carry.a, end[1]] }, { ch: Bc, anim: tossing ? "toss" : "carry", ms: tossing ? tm : 0, at: [end[0] + S.carry.b, end[1]] });
      const fi = tossing ? Math.min(4, [120, 230, 330, 450, 590].findIndex((e) => tm < e)) : -1;
      const h = fi < 0 ? N.ELF_BOARD_HANDS.carry[0]! : N.ELF_BOARD_HANDS.toss[fi];
      if (h !== null && h !== undefined && t < T.boardFly[0]) props.push({ ch: IN.INTRO_GINGER_BOARD, anim: "carry", ms: 0, at: end, lift: h, depthBias: -0.01 });
    } else if (t < T.watch) {
      figs.push({ ch: A, anim: "cheer", ms: t - T.cheer, at: [end[0] + S.carry.a, end[1]] }, { ch: Bc, anim: "cheer", ms: t - T.cheer, at: [end[0] + S.carry.b, end[1]] });
    } else {
      // To their watch spots (0.5 s), then watching (idle), facing the table.
      const u = clamp01((t - T.watch) / 500);
      const wa = S.watch.a, wb = S.watch.b;
      figs.push(
        { ch: A, anim: u < 1 ? "walk" : "idle", ms: t, at: [lerp(end[0] + S.carry.a, wa.at[0], u), lerp(end[1], wa.at[1], u)], flip: u < 1 ? wa.at[0] < end[0] + S.carry.a : wa.face < 0, label: "board elf A watching" },
        { ch: Bc, anim: u < 1 ? "walk" : "idle", ms: t, at: [lerp(end[0] + S.carry.b, wb.at[0], u), lerp(end[1], wb.at[1], u)], flip: u < 1 ? wb.at[0] < end[0] + S.carry.b : wb.face < 0, label: "board elf B watching" },
      );
    }
    if (t >= T.coming[0] && t < T.coming[1]) {
      const p = d < routeLen ? onRoute(d).at : end;
      bubble = { at: p, up: 46, text: "Coming, boss!" };
    }
  }
  // The board in the air, tossed onto the table.
  if (t >= T.boardFly[0] && t < T.boardFly[1]) {
    const u = (t - T.boardFly[0]) / (T.boardFly[1] - T.boardFly[0]);
    const end = ROUTE.at(-1)!;
    props.push({ ch: IN.INTRO_GINGER_BOARD, anim: "spin", ms: t - T.boardFly[0], at: [lerp(end[0], tableAt[0], u), lerp(end[1], tableAt[1], u)], lift: lerp(23, IN.INTRO_GINGER_TABLE_TOP, u) + Math.sin(u * Math.PI) * 34, depthBias: -0.05 });
  }
  if (t >= T.boardFly[1]) slab = tableAt;
  // The white light on the board.
  const LI = IN.INTRO_GINGER_LIGHT;
  if (t >= T.light) {
    const s = t - T.light;
    const a = lenOf(LI, "appear"), sh = 500, f = lenOf(LI, "fade");
    const an = s < a ? "appear" : s < a + sh ? "shine" : s < a + sh + f ? "fade" : null;
    if (an) props.push({ ch: LI, anim: an, ms: an === "appear" ? s : an === "shine" ? s - a : s - a - sh, at: tableAt, lift: IN.INTRO_GINGER_TABLE_TOP + 4, depthBias: -0.1 });
  }
  if (t >= T.line[0] && t < T.line[1]) bubble = { at: bossAt, up: 78, text: "Cold enough for you?" };
  const wipe = clamp01((t - T.wipe[0]) / (T.wipe[1] - T.wipe[0]));
  return { figs, props, decals, bubble, wipe, slab, hide, swap };
}
/** Every resting place (each pause, stop and spot) for the on-screen check. */
export function restingFigures(): Fig[] {
  const out: Fig[] = [keeper(0)];
  for (const [name, pts] of Object.entries(SHOP.SHOP_GINGER_WALKERS)) for (const p of pts) out.push({ ch: WALKER_CH[name as keyof typeof WALKER_CH], anim: "idle", ms: 0, at: p.at, label: `walker ${name} pause` });
  for (const p of PATH) {
    if (!p.stop) continue;
    out.push({ ch: N.NPC_GINGER_ELF_BOX, anim: "fill", ms: 0, at: p.at, lift: p.h, flip: p.stop.face < 0, label: `elf A ${p.stop.row} ${p.stop.piece}` });
    out.push({ ch: N.NPC_GINGER_ELF_PAD, anim: "write", ms: 0, at: [p.b![0], p.b![1]], lift: p.b![2], flip: p.stop.face < 0, label: `elf B ${p.stop.row} ${p.stop.piece}` });
  }
  out.push({ ch: GINGERBREAD, anim: "idle", ms: 0, at: SHOP.SHOP_GINGER_MARKS.boss, scale: BOSS_PX, label: "Ginger on his mark" });
  const end = ROUTE.at(-1)!;
  const S = IN.INTRO_GINGER_ELF_SPOTS;
  out.push({ ch: N.NPC_GINGER_ELF_BOARD_A, anim: "toss", ms: 0, at: [end[0] + S.carry.a, end[1]], label: "board elf A at the toss" });
  out.push({ ch: N.NPC_GINGER_ELF_BOARD_B, anim: "toss", ms: 0, at: [end[0] + S.carry.b, end[1]], label: "board elf B at the toss" });
  out.push({ ch: N.NPC_GINGER_ELF_BOARD_A, anim: "idle", ms: 0, at: S.watch.a.at, flip: S.watch.a.face < 0, label: "board elf A watching" });
  out.push({ ch: N.NPC_GINGER_ELF_BOARD_B, anim: "idle", ms: 0, at: S.watch.b.at, flip: S.watch.b.face < 0, label: "board elf B watching" });
  return out;
}
