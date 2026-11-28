/**
 * Chess Town's picture list (Nov 28, the town's structure, phase 1a: DESIGN.md §2, docs/decisions/2026-11-28-town-bake.md): every
 * picture the town draws that is the same for every player, each with its name, its group and how it's painted (paint-jobs.ts: pure
 * pixel work, no browser). One copy, read by both sides:
 * - the build (scripts/bake-town.ts) paints the list in Node and writes it as picture files with a manifest;
 * - the loading screen (render.ts `plan`) takes its jobs from `townWants`, in this order, and puts the build's picture of each name in
 *   its place (since phase 1c nothing of the list is painted on the device).
 * Until this, the list was the body of render.ts's `plan`: nothing outside a running town could say what the town draws.
 *
 * Not here: what a device must make for itself (names, tags, bubbles, outfits, rides, the tables' boards), and the sky. The sidekicks'
 * frames are the build's too (`townSheets`, `sidekickFrame`): cut from their sheets, not painted, so they aren't `Want`s.
 */
import type { Character } from "../characters/sprite.ts";
import { GINGERBREAD } from "../characters/gingerbread.ts";
import { GREX } from "../characters/grex.ts";
import { HOLLOW } from "../characters/hollow.ts";
import { MOO } from "../characters/moo.ts";
import { ALFIL } from "../characters/alfil.ts";
import { BIGBOY } from "../characters/bigboy.ts";
import { CLOWN } from "../characters/clown.ts";
import { GARDENER } from "../characters/gardener.ts";
import { HOPPER } from "../characters/hopper.ts";
import { PIG } from "../characters/pig.ts";
import { SAWYER } from "../characters/sawyer.ts";
import { SMUDGY } from "../characters/smudgy.ts";
import { TIGER_FIGURE } from "../characters/tiger-figure.ts";
import { FOLIO } from "../characters/folio.ts";
import { BOSS_BEAVER } from "../characters/timber.ts";
import { BOSS_BLITZ } from "../characters/boss-blitz.ts";
import { CHANDY_TOWN } from "../characters/chandy-figure.ts";
import { BIRDIE_TOWN } from "../characters/birdie-figure.ts";
import { NPC_ZEBRA_GUARD_A } from "./shops/zebra-crew.ts";
import { geomOf } from "./box-geom.ts";
import { lotArt, streetBoxes, type BoxInst } from "./boxes.ts";
import { bed, bush, hedgeFront, hedgeTop, shed } from "./dressing.ts";
import { PIECE_ART } from "./houses/coliseum.ts";
import { artOf } from "./houses/index.ts";
import type { LightPool, LightSpot } from "./houses/kit.ts";
import { PARK_BENCH, PARK_FOUNTAIN, PARK_LAMP, PARK_LAMP_LIGHTS, PARK_LAMP_POOLS, PARK_TABLE, PARK_TREES } from "./houses/park.ts";
import { statueArt } from "./houses/statues.ts";
import type { PaintSpec } from "./paint-jobs.ts";
import { SIDEKICK_SHEETS, type SidekickSheet } from "./sidekick-sheets.ts";
import { STREET_BUILDINGS, STREET_LOTS, type StreetLot } from "./street.ts";
import { COLISEUM_PLACE, HOMES, PROPS, STATUES, TOWN_BOTS, hasFigure, isSprite, type Home, type HomeId, type IndoorId, type NoFigureId, type Place, type TownBossId } from "./world.ts";

// ---- The town's figures (here since Nov 28, from render.ts: the list names their frames).

export const BOSS_ART: Record<TownBossId, Character> = {
  tiger: TIGER_FIGURE,
  gingerbread: GINGERBREAD,
  grex: GREX,
  hollow: HOLLOW,
  moo: MOO,
  clown: CLOWN,
  bigboy: BIGBOY,
  sawyer: SAWYER,
  pig: PIG,
  smudgy: SMUDGY,
  hopper: HOPPER,
  gardener: GARDENER,
  alfil: ALFIL,
  folio: FOLIO,
  // (His approved drawing, without the room his game figure keeps over his head for his entrance's drop: timber-figure.ts.)
  timber: BOSS_BEAVER,
  // (Dash as drawn, without the room his game figure keeps on its right for his entrance's zip-in: dash-figure.ts.)
  dash: BOSS_BLITZ,
  // (Chandy at rest, his rifle slung, without the room his board figure keeps for it held out: chandy-figure.ts.)
  chandy: CHANDY_TOWN,
  // (Young Birdie on his toy diesel, as drawn: birdie-figure.ts.)
  birdie: BIRDIE_TOWN,
};
/** A home whose boss is inside: its stand-in's sprite out front (world.ts STAND_IN). Rolling Dough's guard (Nov 11): the front room's
 * flat-cap door guard, his roll at port arms; Don's size, as drawn. */
const STAND_IN_ART: Record<Exclude<IndoorId, NoFigureId>, Character> = { zebra: NPC_ZEBRA_GUARD_A };
/** The town figure's sprite for a home: its boss's, or its stand-in's (a home with nobody out front, world.ts hasFigure, has none). */
export const figureArt = (id: HomeId): Character => (id === "zebra" ? STAND_IN_ART[id] : BOSS_ART[id as TownBossId]);

// ---- The town's art, by where the renderer keeps it.

/** One of the renderer's frame caches (render.ts FrameCache): a character whose idle frames are each painted once, and once a step darker. */
export interface ArtCache {
  readonly ch: Character;
}
/** What a town draws from: its places, its boxes, and the character behind every frame cache the renderer keeps. */
export interface TownArt {
  /** Every place the town names: the homes (in the bosses' order), then the Colosseum. */
  readonly places: readonly Place[];
  /** The homes with someone out front (world.ts hasFigure), in the town's bosses' order. */
  readonly figures: readonly HomeId[];
  /** The street town's boxes (boxes.ts): each lot's, shed's and hedge's. */
  readonly boxes: BoxInst[];
  /** Each place's box and each prop's (null: none). */
  readonly homeBox: readonly (BoxInst | null)[];
  readonly propBox: readonly (BoxInst | null)[];
  /** Each prop's picture (PROPS' order; one cache a picture, shared by every prop that shows it), the hedges' tops (0..2), each place's
   * picture and each figure's. */
  readonly props: readonly ArtCache[];
  readonly hedgeTops: readonly ArtCache[];
  readonly houses: readonly ArtCache[];
  readonly bosses: readonly ArtCache[];
  /** A side's or back's picture: one cache a character. */
  wall(ch: Character): ArtCache;
}

/** The art of the town of `homes` (this town's: world.ts HOMES), its figures out front `figures` (the town's bosses' homes, in order). */
export function makeTownArt(homes: readonly Home[] = HOMES, figures: readonly HomeId[] = homes.filter(hasFigure).map((h) => h.id)): TownArt {
  const places: readonly Place[] = [...homes, COLISEUM_PLACE];
  const boxes = streetBoxes(PROPS);
  const homeBox = places.map((h) => boxes.find((b) => b.home === h.id) ?? null);
  const propBox = PROPS.map((pr, i) => (pr.kind === "front" ? boxes.find((b) => b.kind !== "home" && b.lot === STREET_LOTS.indexOf(STREET_BUILDINGS[pr.lot!]!)) : boxes.find((b) => b.prop === i || b.props.includes(i))) ?? null);
  const cache = (ch: Character): ArtCache => ({ ch });
  const trees = PARK_TREES.map(cache);
  const bench = cache(PARK_BENCH);
  const table = cache(PARK_TABLE);
  const fountain = cache(PARK_FOUNTAIN);
  const lamp = cache(PARK_LAMP);
  // (The street town's, Nov 5: the gardens' hedges, bushes, beds and sheds, and the everyday buildings' fronts, one cache a picture.)
  const street = new Map<string, ArtCache>();
  const art = (key: string, ch: () => Character) => street.get(key) ?? street.set(key, cache(ch())).get(key)!;
  const props = PROPS.map((p) => {
    // (The street town's plaza, the north edge round: the chess pieces on their plinths and the statues stand on it as figures.)
    if (p.kind === "piece") return art(`piece${p.v}`, () => PIECE_ART[p.v]!);
    if (p.kind === "statue") return art(`statue${p.v}`, () => statueArt(STATUES[p.v]!.id, 1));
    if (p.kind === "hedge") return art(`hedge${p.v}`, () => hedgeFront(p.v));
    if (p.kind === "bush") return art(`bush${p.v}`, () => bush(p.v));
    if (p.kind === "bed") return art(`bed${p.v}`, () => bed(p.v));
    if (p.kind === "shed") return art(`shed${p.v}`, () => shed(p.v).front);
    if (p.kind === "front") {
      const box = lotArt(STREET_BUILDINGS[p.lot!]!);
      // (One cache a picture: the Colosseum's stretches share theirs.)
      return art(box.front.id, () => box.front);
    }
    return p.kind === "tree" ? trees[p.v]! : p.kind === "bench" ? bench : p.kind === "table" ? table : p.kind === "lamp" ? lamp : fountain;
  });
  const walls = new Map<Character, ArtCache>();
  return {
    places,
    figures,
    boxes,
    homeBox,
    propBox,
    props,
    hedgeTops: [0, 1, 2].map((v) => cache(hedgeTop(v))),
    houses: places.map((h) => cache(artOf(h).ch)),
    bosses: figures.map((id) => cache(figureArt(id))),
    wall: (ch) => walls.get(ch) ?? walls.set(ch, cache(ch)).get(ch)!,
  };
}

/** Which of its art's roof paintings box `b` shows facing quarter `q`. (A flat roof is lit the same whichever way the camera faces:
 * one painting serves all four. Round 4's flat fronts are most of them.) */
export const roofKey = (b: BoxInst, q: number): string => (geomOf(b.box).faces.every((f) => f.nz > 0.999) ? "flat" : `${b.facing}${q}`);

// ---- The list.

/** Whose a glow is: a place's (its index), a front's (its prop's index), the park's lamps', or a side's (its character). */
export type GlowOf = { of: "place"; i: number } | { of: "front"; i: number } | { of: "lamp" } | { of: "side"; ch: Character };

/**
 * One thing the loading screen makes ready, in its order: a picture (a frame, a statue), or a roof's or a glow's (its sheets). `name`:
 * the picture's own, the same in every town and build that draws it (a frame's `<art>#<frame>`, `d` a step darker; `roof:<box>:<painting>`;
 * `glow:<art>`; `statue:<id>`): two wants of one name are one picture's pixels. `group`: the piece of town it belongs to (`groupNames`).
 * `spec`: how it's painted (paint-jobs.ts `paintSpec`).
 */
export type Want = { name: string; group: string; spec: PaintSpec } & (
  | {
      kind: "frame";
      cache: ArtCache;
      k: number;
      dark: boolean;
      /** The first want of this frame in this cache: the renderer paints it then; a later one finds it there. */
      fresh: boolean;
    }
  | {
      kind: "roof";
      b: BoxInst;
      q: number;
      /** The first want of this painting of this box's art (`roofKey`). */
      fresh: boolean;
    }
  | { kind: "glow"; ch: Character; spots: readonly LightSpot[]; pools: readonly LightPool[]; to: GlowOf }
  | { kind: "statue"; i: number }
);

/** A lot's group: its street's row on its side (the row's fronts face `facing`), or the Colosseum for what stands on its plaza. */
const lotGroup = (l: StreetLot): string => (l.street === "plaza" ? "colosseum" : `row:${l.street}:${l.facing}`);
const PARK_KINDS: ReadonlySet<string> = new Set(["tree", "bench", "table", "lamp", "fountain"]);

/**
 * Everything the loading screen makes ready for the town of `art`, in its order (render.ts `plan` runs one job a want): the lights'
 * glows first (every home's, front's, lamp's and side's), then each box's sides, back and front (each frame, and a step darker) and its
 * roof for the camera's four quarters, then every frame of the hedges' tops, the props, the places and the figures, then the statues.
 * `count`: how many frames a character's idle has (the device, with the build's manifest in hand, reads it there: a character's
 * animation is then never built just to count its frames; by default its animation's own).
 */
export function townWants(art: TownArt, count: (ch: Character) => number = (ch) => ch.anims.idle!.frames.length): Want[] {
  const out: Want[] = [];
  const placeGroup = (i: number) => (art.places[i]!.id === "coliseum" ? "colosseum" : `home:${art.places[i]!.id}`);
  const propGroup = (i: number) => {
    const pr = PROPS[i]!;
    return pr.kind === "front" ? lotGroup(STREET_BUILDINGS[pr.lot!]!) : PARK_KINDS.has(pr.kind) ? "park" : pr.kind === "piece" || pr.kind === "statue" ? "colosseum" : "props";
  };
  const boxGroup = (b: BoxInst) => (b.home === "coliseum" ? "colosseum" : b.home ? `home:${b.home}` : b.lot >= 0 ? lotGroup(STREET_LOTS[b.lot]!) : "props");

  const glowSeen = new Set<object>();
  const glow = (key: object, group: string, ch: Character, spots: readonly LightSpot[], pools: readonly LightPool[], to: GlowOf) => {
    if (glowSeen.has(key)) return;
    glowSeen.add(key);
    out.push({ kind: "glow", name: `glow:${ch.id}`, group, spec: { kind: "glow", ch, spots, pools }, ch, spots, pools, to });
  };
  const framesOf = new Map<ArtCache, Set<number>>();
  const frame = (cache: ArtCache, k: number, dark: boolean, group: string) => {
    let m = framesOf.get(cache);
    if (!m) framesOf.set(cache, (m = new Set()));
    const key = dark ? -1 - k : k;
    const fresh = !m.has(key);
    m.add(key);
    const name = `${cache.ch.id}#${k}${dark ? "d" : ""}`;
    out.push({ kind: "frame", name, group, spec: { kind: "frame", ch: cache.ch, k, dark }, cache, k, dark, fresh });
  };
  const whole = new Set<ArtCache>();
  const frames = (cache: ArtCache, group: string) => {
    if (whole.has(cache)) return;
    whole.add(cache);
    for (let k = 0, n = count(cache.ch); k < n; k++) frame(cache, k, false, group);
  };
  const roofsOf = new Map<object, Set<string>>();
  const roof = (b: BoxInst, q: number) => {
    let m = roofsOf.get(b.box);
    if (!m) roofsOf.set(b.box, (m = new Set()));
    const key = roofKey(b, q);
    const fresh = !m.has(key);
    m.add(key);
    const name = `roof:${b.box.id}:${key}`;
    out.push({ kind: "roof", name, group: boxGroup(b), spec: { kind: "roof", b, q: key === "flat" ? 0 : q }, b, q, fresh });
  };

  // The lights (Nov 26): every home's, front's, side's and lamp's glow, whatever the sky now (the clock brings dusk as you play).
  art.places.forEach((pl, i) => {
    const a = artOf(pl);
    if (a.lights.length || a.pools.length) glow(a, placeGroup(i), a.ch, a.lights, a.pools, { of: "place", i });
  });
  PROPS.forEach((pr, i) => {
    if (pr.lot !== undefined) {
      const box = lotArt(STREET_BUILDINGS[pr.lot]!);
      if (box.lights.length) glow(art.props[i]!, propGroup(i), box.front, box.lights, [], { of: "front", i });
    }
    if (pr.kind === "lamp") glow(PARK_LAMP, "park", PARK_LAMP, PARK_LAMP_LIGHTS, PARK_LAMP_POOLS, { of: "lamp" });
  });
  for (const b of art.boxes)
    for (const side of [b.box.left, b.box.right, b.box.back ?? b.box.rear])
      if (side?.lights.length) glow(side.ch, boxGroup(b), side.ch, side.lights, [], { of: "side", ch: side.ch });
  // Each box: its sides' and back's (as drawn, and a step darker, turned from the light), its front's frames (and each a step darker: a
  // front at a slant), its roof for each quarter.
  for (const b of art.boxes) {
    const B = b.box;
    const g = boxGroup(b);
    for (const side of [b.hideL ? null : B.left, b.hideR ? null : B.right, B.back ?? B.rear]) {
      if (!side) continue;
      const c = art.wall(side.ch);
      frame(c, 0, false, g);
      frame(c, 0, true, g);
    }
    const hi = b.home ? art.places.findIndex((h) => h.id === b.home) : -1;
    const pi = hi < 0 ? art.propBox.indexOf(b) : -1;
    const front = hi >= 0 ? art.houses[hi] : pi >= 0 ? art.props[pi] : undefined;
    if (front)
      for (let k = 0, n = count(front.ch); k < n; k++) {
        frame(front, k, false, g);
        frame(front, k, true, g);
      }
    for (let q = 0; q < 4; q++) roof(b, q);
  }
  for (const c of art.hedgeTops) frames(c, "props");
  art.props.forEach((c, i) => frames(c, propGroup(i)));
  art.houses.forEach((c, i) => frames(c, placeGroup(i)));
  art.bosses.forEach((c, i) => frames(c, `home:${art.figures[i]!}`));
  STATUES.forEach((s, i) => {
    const name = `statue:${s.id}`;
    out.push({ kind: "statue", name, group: "colosseum", spec: { kind: "frame", ch: statueArt(s.id, 1), k: 0, dark: false }, i });
  });
  return out;
}

/** A sheet's animations, in its rows' order (scripts/bake-sidekicks.ts). */
export const SHEET_ANIMS = ["idle", "walk", "sit", "wave"] as const;
/** A sidekick's sheet's name in SIDEKICK_SHEETS: its picture file's too (sidekicks/<name>.png), and what its baked frames are named by. */
export const sheetName = (sheet: SidekickSheet): string => Object.keys(SIDEKICK_SHEETS).find((k) => (SIDEKICK_SHEETS as Record<string, SidekickSheet>)[k] === sheet)!;
/** A sidekick's frame's picture's name: its sheet's name, the animation, the frame. Its group, a file of its own: `sidekick:<sheet>`. */
export const sidekickFrame = (sheet: string, anim: (typeof SHEET_ANIMS)[number], k: number): string => `sidekick:${sheet}:${anim}#${k}`;

/**
 * The sidekicks' sheets this town shows, each once, by its name in SIDEKICK_SHEETS (made by scripts/bake-sidekicks.ts). The build
 * bakes each frame of each as a picture of its own (Nov 28, phase 1c: `sidekickFrame`; scripts/bake-town.ts), a group a sidekick.
 */
export function townSheets(): string[] {
  const out = new Set<string>();
  for (const b of TOWN_BOTS) if (isSprite(b.look)) out.add(sheetName(b.look.sprite));
  return [...out];
}
