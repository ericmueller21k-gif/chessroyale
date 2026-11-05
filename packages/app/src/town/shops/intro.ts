/**
 * A boss's intro, drawn (shops/challenge.ts has the timing; ShopRoom.tsx plays it in the room): loaded only when you challenge the
 * boss (its art is a chunk of its own: Alfil's is shops/alfil-intro-art.ts, Big Boy's shops/bigboy-intro-art.ts, Timber's
 * shops/timber-intro-art.ts with his own moves, characters/timber-intro.ts, copied from `claude/boss-art`), every frame drawn into a
 * canvas of its own as it loads, behind the town's fade, never in a frame loop.
 *
 * - The board coming in: the pyramid's frames (its `rise`, `idle`, `crack` and `crumble`), or the toy blocks' (Big Boy's: `build`,
 *   `plop`, `chairs` and `idle`: the blocks are his table and its stools, the board dropped onto them), the table (the town's park table, in the
 *   boss's colors when its art has them, else the park's stone) and, on it, the slab, the board and the pieces as the town lays them
 *   on a park table (render.ts `drawBoard`: `paintTable` here is that, without the town's cache, the game or the clock): the slab in
 *   the table's stone, its squares in its colors (the palette's `L` / `D`), the pieces in the town's own ink (TABLE_INK), turned to the
 *   layout (challenge.ts `boardSquare`): white's ranks nearest you, black's nearest the boss. The table's picture is three squares
 *   across, a stool in each outer one: across, as it is; facing, its middle square alone and a stool on each player's side.
 *   Timber's (`wood`): his own moves (BOSS_BEAVER_INTRO: walk, lift, carry, setDown, gnaw, done), the log (lying, standing, gnawed),
 *   the shavings' fog (rise, hold, settle), his table (a gnawed log pedestal, no stools: its picture's middle alone) and a stump for
 *   each seat (idle, pop).
 *   Dash's (`dash`, Nov 5): his own moves (BOSS_BLITZ_INTRO: bolt, arrive, brag), his dust trail, the shoe-box table and stools
 *   (land, idle), the pieces' pop (shops/blitz-intro-art.ts, characters/dash-intro.ts).
 * - The boss itself (its town sprite, BOSS_ART: its `idle`), walking in and standing on its mark.
 * - The transition (`startTransition`): a boss's own (`startStorm`, Alfil's sandstorm), or the default (`startWipe`: a flash and a
 *   wipe to black). Each a canvas over the whole page (outside the town's tree, so it stays as the town closes and the
 *   battle opens under it): the storm's tile (tiled, 3x, crisp) sweeps in behind its front, holds while the battle loads, and slides
 *   out with its front mirrored.
 */
import { KING_ATTACK } from "@chessroyale/chess";
import { bossKit } from "../../characters/kits.ts";
import { BULB_KEYS } from "../../characters/hollow.ts";
import { frameKeys, renderFrame, type Character, type Frame } from "../../characters/sprite.ts";
import { play, warmSounds, type SoundName } from "../../sound.ts";
import { newPt, proj, tableLift, type TableLift, type View } from "../camera.ts";
import { TOWN_FEEL } from "../feel.ts";
import { PARK_TABLE, TABLE_BOARD, TABLE_INK, TABLE_PIECES } from "../houses/park.ts";
import { BOSS_ART } from "../render.ts";
import type { HomeId } from "../world.ts";
import { ICE_ELF, ICE_GEAR, ICE_MOVES, iceAnims, type IceElf, type IceGear, type IceMove } from "./challenge.ts";
import { BLITZ_MOVES, CHALLENGE_FEEL, CREW_MOVES, blitzAnims, type BlitzMove, DARK_MOVES, ROPE_MOVES, crewAnims, type CrewMove, boardSquare, darkAnims, drainAt, drawnTop, frameAt, introBeats, introOf, ropeAnims, stormEdge, wipeAt, type BossIntro, type DarkMove, type IntroAnims, type IntroBeat, type IntroLayout, type LogMove, type RopeMove, LOG_MOVES, logAnims } from "./challenge.ts";

/**
 * A boss's intro art, as its file exports it: a pyramid that brings in its table (Alfil's), or toy blocks that are the table and its
 * stools (Big Boy's); the slab's and board's colors; its storm (a tile and its front).
 */
type IntroArt =
  | ((
      | { pyramid: Character; table: Character; blocks?: undefined; wood?: undefined }
      | { blocks: Character; pyramid?: undefined; table?: undefined; wood?: undefined }
      | { wood: WoodArt; table: Character; pyramid?: undefined; blocks?: undefined }
      | { rope: typeof import("./pig-intro-art.ts"); table: Character; pyramid?: undefined; blocks?: undefined; wood?: undefined }
      | { crew: typeof import("./grex-intro-art.ts"); table: Character; rope?: undefined; pyramid?: undefined; blocks?: undefined; wood?: undefined }
      | { ice: IceMods; table: Character; crew?: undefined; rope?: undefined; pyramid?: undefined; blocks?: undefined; wood?: undefined }
      | { dash: typeof import("./blitz-intro-art.ts"); table: Character; ice?: undefined; crew?: undefined; rope?: undefined; pyramid?: undefined; blocks?: undefined; wood?: undefined }
    ) & {
      dark?: undefined;
      dash?: typeof import("./blitz-intro-art.ts");
      ice?: IceMods;
      rope?: typeof import("./pig-intro-art.ts");
      crew?: typeof import("./grex-intro-art.ts");
      /** The slab's keys "1" to "5" and the board's squares `L` / `D`. */
      palette: Readonly<Record<string, string>>;
      storm: Character;
      front: Character;
    })
  // Hollow's: the dark (his moves, the cave's lights going out, the motes); the park table; no storm (the dark is his transition).
  | { dark: typeof import("./hollow-intro-art.ts"); dash?: undefined; ice?: undefined; rope?: undefined; crew?: undefined; pyramid?: undefined; blocks?: undefined; wood?: undefined; table?: undefined; palette?: undefined; storm?: undefined; front?: undefined };
/** Ginger's: his props (shops/ginger-intro-art.ts), his moves (characters/ginger-intro.ts) and his elves (the board carriers). */
interface IceMods {
  props: typeof import("./ginger-intro-art.ts");
  moves: typeof import("../../characters/ginger-intro.ts");
  elves: typeof import("./ginger-elves-art.ts");
}
/** Timber's: his own moves (facing east), where the lying log and the standing one are from his foot (his pixels), the props. */
interface WoodArt {
  mover: Character;
  liftAt: readonly [number, number];
  reach: readonly [number, number];
  log: Character;
  fog: Character;
  stump: Character;
}
const ART: Partial<Record<HomeId, () => Promise<IntroArt>>> = {
  alfil: () =>
    import("./alfil-intro-art.ts").then((m) => ({ pyramid: m.INTRO_ALFIL_PYRAMID, table: m.INTRO_ALFIL_TABLE, palette: m.INTRO_ALFIL_TABLE_PALETTE, storm: m.INTRO_ALFIL_STORM, front: m.INTRO_ALFIL_FRONT })),
  bigboy: () =>
    import("./bigboy-intro-art.ts").then((m) => ({ blocks: m.INTRO_BIGBOY_BLOCKS, palette: m.INTRO_BIGBOY_TABLE_PALETTE, storm: m.INTRO_BIGBOY_SWIRL, front: m.INTRO_BIGBOY_SWIRL_FRONT })),
  timber: () =>
    import("./timber-intro-art.ts").then((m) => ({
      wood: { mover: m.BOSS_BEAVER_INTRO, liftAt: m.TIMBER_INTRO_LIFT_AT, reach: m.TIMBER_INTRO_REACH, log: m.INTRO_TIMBER_LOG, fog: m.INTRO_TIMBER_SHAVINGS, stump: m.INTRO_TIMBER_STUMP },
      table: m.INTRO_TIMBER_TABLE,
      palette: m.INTRO_TIMBER_TABLE_PALETTE,
      storm: m.INTRO_TIMBER_STORM,
      front: m.INTRO_TIMBER_FRONT,
    })),
  hollow: () => import("./hollow-intro-art.ts").then((m) => ({ dark: m })),
  // (Wrangler's: his moves, the lasso's loop, the bale (his table: the barn's board stand), the buckets, his wipe; one chunk.)
  pig: () => import("./pig-intro-art.ts").then((m) => ({ rope: m, table: m.INTRO_PIG_TABLE, palette: m.INTRO_PIG_TABLE_PALETTE, storm: m.INTRO_PIG_STORM, front: m.INTRO_PIG_FRONT })),
  // (Jefferson's: his moves, the crate-stack table (the warehouse's board stand without its slab and board), your lift, his wipe; one
  // chunk. His crew are the room's: their baked sheets.)
  grex: () => import("./grex-intro-art.ts").then((m) => ({ crew: m, table: m.INTRO_GREX_TABLE, palette: m.INTRO_GREX_TABLE_PALETTE, storm: m.INTRO_GREX_STORM, front: m.INTRO_GREX_FRONT })),
  // (Ginger's: his moves, the blast, the icicle (his table), the crack and the puff, the light, the board and its two carriers, his
  // blizzard; the room's own elves keep working.)
  // (Dash's: his moves, the shoe-box table and stools, his dust trail, the pieces' pop, his clock rush; one chunk.)
  dash: () => import("./blitz-intro-art.ts").then((m) => ({ dash: m, table: m.INTRO_BLITZ_TABLE, palette: m.INTRO_BLITZ_TABLE_PALETTE, storm: m.INTRO_BLITZ_STORM, front: m.INTRO_BLITZ_FRONT })),
  gingerbread: () =>
    Promise.all([import("./ginger-intro-art.ts"), import("../../characters/ginger-intro.ts"), import("./ginger-elves-art.ts")]).then(([props, moves, elves]) => ({
      ice: { props, moves, elves },
      table: props.INTRO_GINGER_TABLE,
      palette: props.INTRO_GINGER_TABLE_PALETTE,
      storm: props.INTRO_GINGER_STORM,
      front: props.INTRO_GINGER_FRONT,
    })),
};

type PyramidAnim = "rise" | "idle" | "crack" | "crumble";
type BlocksAnim = "build" | "plop" | "chairs" | "idle";

/**
 * The storm's frames, ready: each tile `stormScale` times its size, the front and the front mirrored, and each frame's ms; and the cues
 * on its frames as it comes in (its first loop's, but "storm", which the storm's start plays: Wrangler's spurs' jingle and cap's pop).
 */
export interface StormArt {
  tiles: HTMLCanvasElement[];
  fronts: HTMLCanvasElement[];
  backs: HTMLCanvasElement[];
  ms: number[];
  cues: { cue: string; at: number }[];
}

/** An intro ready to play: its timing, its frames, its boss. */
export interface LoadedIntro {
  home: HomeId;
  def: BossIntro;
  /** Its own art's timing (null: the default intro). */
  anims: IntroAnims | null;
  beats: IntroBeat[];
  /** Its pyramid (null: none: toy blocks, or the default intro, whose table pops in). */
  pyramid: { ch: Character; frames: Record<PyramidAnim, HTMLCanvasElement[]> } | null;
  /** Its toy blocks (Big Boy's: the table and its stools, built as you watch; null: none). */
  blocks: { ch: Character; frames: Record<BlocksAnim, HTMLCanvasElement[]> } | null;
  /**
   * Timber's log (null: another's): his own moves' frames (drawn at his town size, facing east: mirrored to walk west), where the lying
   * log's foot and the standing log's are from his foot (his pixels: TIMBER_INTRO_LIFT_AT, TIMBER_INTRO_REACH), and the props' frames:
   * the log (at his size: it's the log in his paws), the shavings' fog and a stump (at the room's: the table's size).
   */
  wood: {
    mover: { ch: Character; frames: Record<LogMove | "idle", HTMLCanvasElement[]> };
    liftAt: readonly [number, number];
    reach: readonly [number, number];
    log: { ch: Character; frames: Record<"lying" | "standing" | "gnawed", HTMLCanvasElement[]> };
    fog: { ch: Character; frames: Record<"rise" | "hold" | "settle", HTMLCanvasElement[]> };
    stump: { ch: Character; frames: Record<"idle" | "pop", HTMLCanvasElement[]> };
  } | null;
  /**
   * The table: its picture (three squares across: a stool, the leg, a stool), its middle square alone (`leg`) and a stool alone
   * (`stool`, its foot at its middle), and the slab's and board's colors.
   */
  table: { ch: Character; img: HTMLCanvasElement; leg: HTMLCanvasElement; stool: HTMLCanvasElement; palette: Readonly<Record<string, string>> };
  /**
   * The boss: its sprite's idle frames, when each ends, how many squares tall it stands (the town's size), and the top of its drawing
   * at rest (`head`, a share of its frame's height: challenge.ts drawnTop), where its line's bubble sits.
   */
  boss: { ch: Character; frames: HTMLCanvasElement[]; ends: number[]; loop: number; squares: number; head: number };
  /** Its storm (null: the default transition, the flash and the wipe). */
  storm: StormArt | null;
  /**
   * Its God King attack (its kit's `kingAttack`), or null: a boss without one skips it. Its frames, each one's ms and cue, its
   * sounds by cue (the kit's), how it faces. (Swung where the boss stands, clear of its stool: not off the board, as at a king.)
   */
  attack: { ch: Character; frames: HTMLCanvasElement[]; ms: number[]; cues: (string | undefined)[]; sounds: Readonly<Record<string, SoundName>>; facesLeft: boolean; beat: typeof KING_ATTACK } | null;
  /** Hollow's dark (null: another's): his moves' frames, the cave's pieces going out, the motes; see DarkArt. */
  dark: DarkArt | null;
  /** Wrangler's lasso (null: another's): his moves' frames, his ropes, the bale, the buckets; see RopeArt. */
  rope: RopeArt | null;
  /** Jefferson's crew (null: another's): his moves' frames, the crate-stack table, your lift; see CrewArt. */
  crew: CrewArt | null;
  /** Ginger's icicle (null: another's): his moves' frames, his props', the carriers', where things go; see IceArt. */
  ice: IceArt | null;
  /** Dash's dashes (null: another's): his moves' frames, the shoe-box table's and stools', his dust trail's, the pop's; see DashArt. */
  dash: DashArt | null;
}

/**
 * Dash's intro, ready (shops/blitz-intro-art.ts, characters/dash-intro.ts; ShopRoom draws it): his moves' frames (BOSS_BLITZ_INTRO,
 * at his town figure's pixels, facing you as drawn: not mirrored) and his dust trail's (at his pixels: its foot at his spot); the
 * shoe-box table's and a stool's frames (`land`, `idle`) and the pop's (at the room's scale, their feet the table's and the stools').
 */
export interface DashArt {
  mover: { ch: Character; frames: Record<BlitzMove, HTMLCanvasElement[]> };
  dust: { ch: Character; frames: HTMLCanvasElement[] };
  table: { ch: Character; frames: Record<"land" | "idle", HTMLCanvasElement[]> };
  stool: { ch: Character; frames: Record<"land" | "idle", HTMLCanvasElement[]> };
  pop: { ch: Character; frames: HTMLCanvasElement[] };
}

/**
 * Ginger's intro, ready (shops/ginger-intro-art.ts, characters/ginger-intro.ts, the carriers of shops/ginger-elves-art.ts; ShopRoom
 * draws it): his moves' frames (BOSS_GINGER_INTRO, at his town figure's pixels, as drawn: not mirrored) and where the blast leaves his
 * hook on them; each prop's frames by its animation (ICE_GEAR) with its sprite (its foot); the carriers' frames and the board's
 * heights in their hands; the route, the spots, the table's place and its top's height. At the room's scale (1:1), but his.
 */
export interface IceArt {
  mover: { ch: Character; frames: Record<IceMove, HTMLCanvasElement[]>; blastFrom: readonly [number, number] };
  props: Record<IceGear, { ch: Character; frames: HTMLCanvasElement[] }>;
  carriers: { a: { ch: Character; frames: Record<IceElf, HTMLCanvasElement[]> }; b: { ch: Character; frames: Record<IceElf, HTMLCanvasElement[]> } };
  /** The board as they carry it (its `carry` frame). */
  board: { ch: Character; carry: HTMLCanvasElement };
  /** Where things are, as iceAt wants them (the art's). */
  at: {
    route: readonly (readonly [number, number])[];
    table: readonly [number, number];
    top: number;
    hands: { carry: readonly number[]; toss: readonly (number | null)[] };
    spots: { carry: { a: number; b: number }; watch: { a: { at: readonly [number, number]; face: number }; b: { at: readonly [number, number]; face: number } } };
  };
  /** The blast's target (over the table's spot, `lift` px up). */
  blastTo: { at: readonly [number, number]; lift: number };
}

/**
 * Jefferson's intro, ready (shops/grex-intro-art.ts; ShopRoom draws it): his moves' frames (BOSS_GREX_INTRO, at his town figure's
 * pixels, as drawn: not mirrored); the crate-stack table's frames (INTRO_GREX_TABLE: its slab and board drawn on it `top` px over its
 * foot, shifted by `sway` a frame, as the top crate wobbles); your lift's (INTRO_GREX_LIFT: the plate `h` px up a frame). At the
 * room's scale but his.
 */
export interface CrewArt {
  mover: { ch: Character; frames: Record<CrewMove, HTMLCanvasElement[]> };
  table: { ch: Character; frames: Record<"idle" | "creak", HTMLCanvasElement[]>; sway: Readonly<Record<string, readonly (readonly [number, number])[]>>; top: number };
  lift: { ch: Character; frames: Record<"flush" | "rise" | "up", HTMLCanvasElement[]>; h: Readonly<Record<string, readonly number[]>> };
  /** The crew's spots round the table (squares, a figure's foot; facing), and each one's delay setting off (ms): the art's. */
  spots: Readonly<Record<CrewKey, { readonly at: readonly [number, number]; readonly face: number }>>;
  setoff: Readonly<Record<CrewKey, number>>;
}
/** The crew who come over, by the art's names. */
export type CrewKey = "lift-guy" | "fork-guy" | "leaner-a" | "leaner-b" | "crew-c" | "crew-d" | "dealer";

/**
 * Wrangler's lasso, ready (shops/pig-intro-art.ts; ShopRoom draws it): his moves' frames (BOSS_PIG_INTRO, at his town figure's
 * pixels, as drawn: not mirrored) and where each rope leaves his fists on them (PIG_INTRO_HANDS, _HANDS2: his frame's pixels); the
 * loop's frames and where its line meets it (INTRO_PIG_ROPE_KNOT); the bale's (INTRO_PIG_TABLE: its slab and board raised by
 * INTRO_PIG_TABLE_LIFT); each bucket's, `b` the black (his, from our left) and `w` the white (yours, from our right), and where its
 * handle's grip is (INTRO_PIG_BUCKET_HANDLE); the line's ink (INTRO_PIG_ROPE_INK). All at the room's scale but his.
 */
export interface RopeArt {
  mover: { ch: Character; frames: Record<RopeMove, HTMLCanvasElement[]> };
  hands: Readonly<Record<string, readonly (readonly [number, number] | null)[]>>;
  hands2: Readonly<Record<string, readonly (readonly [number, number] | null)[]>>;
  loop: { ch: Character; frames: Record<"fly" | "catch" | "cinched" | "free", HTMLCanvasElement[]>; knot: Readonly<Record<string, readonly (readonly [number, number])[]>> };
  bale: { ch: Character; frames: Record<"idle" | "slide" | "land", HTMLCanvasElement[]>; lift: Readonly<Record<string, readonly number[]>> };
  buckets: Record<"b" | "w", { ch: Character; frames: Record<"tumble" | "drop" | "stool", HTMLCanvasElement[]> }>;
  handle: Readonly<Record<string, readonly (readonly [number, number])[]>>;
  ink: { outline: string; dark: string; mid: string; light: string; width: number; twist: number; sag: number };
}

/** A picture's lit pixels alone (its lights' own pixels, to draw over the dark), cropped: drawn at (x, y) of its picture's pixels. */
export interface Emis {
  img: HTMLCanvasElement;
  x: number;
  y: number;
}
/** A frame and its lit pixels (null: none lit). */
export interface Lit {
  img: HTMLCanvasElement;
  emis: Emis | null;
}
/**
 * Hollow's dark, ready (shops/hollow-intro-art.ts; ShopRoom draws it): his moves' frames at each count of his strand's bulbs he plays
 * them with (`him[move][bulbs]`: the charge and swell all lit, the drink at each, full and settle none), his idle with his strand dark
 * (once he has settled), his eyes alone in the black (full, settle); the cave's pieces going out (`pieces[name][anim]`: the lanterns'
 * `gutter<k>` and dark `idle`, the bulbs' `l<n>` / `r<n>`, the tree's `drain` and dark `idle`) and, for the cave's own frames still lit,
 * their lit pixels (`lit[name]`, by the room's frame); the motes and their sip; and the art's numbers.
 */
export interface DarkArt {
  him: Record<DarkMove, (Lit[] | undefined)[]>;
  idle0: HTMLCanvasElement[];
  eyes: Record<"full" | "settle", (Emis | null)[]>;
  pieces: Record<string, Record<string, Lit[]>>;
  lit: Record<string, (Emis | null)[]>;
  motes: Record<string, HTMLCanvasElement[]>;
  /** Each bulb of the string's run (INTRO_HOLLOW_BULB_RUN): its mote's kind, from its glass (null: a burnt-out one sends none). */
  runMote: (string | null)[];
  art: typeof import("./hollow-intro-art.ts");
}

const canvasOf = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
const toCanvas = (ch: Character, anim: string, i: number): HTMLCanvasElement => {
  const { w, h, data } = renderFrame(ch, ch.anims[anim]!.frames[i]!);
  const c = canvasOf(w, h);
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return c;
};
/** `src` drawn `k` times its size, crisp (and mirrored left to right with `flip`). */
const scaled = (src: HTMLCanvasElement, k: number, flip = false): HTMLCanvasElement => {
  const c = canvasOf(src.width * k, src.height * k);
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  if (flip) {
    g.translate(c.width, 0);
    g.scale(-1, 1);
  }
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
};

/** A picture's third (0 the left square, 1 the middle, 2 the right), as a canvas of its own. */
const third = (img: HTMLCanvasElement, i: number): HTMLCanvasElement => {
  const w = Math.round(img.width / 3);
  const c = canvasOf(w, img.height);
  c.getContext("2d")!.drawImage(img, i * w, 0, w, img.height, 0, 0, w, img.height);
  return c;
};

const loading = new Map<HomeId, Promise<LoadedIntro>>();
/** Loads a boss's intro (its art's chunk, if it has its own, every frame drawn), once; null for a boss without one. */
export function loadIntro(home: HomeId): Promise<LoadedIntro> | null {
  const def = introOf(home);
  const load = ART[home];
  if (!def || (def.custom && !load)) return null;
  let p = loading.get(home);
  if (p) return p;
  p = (def.custom && load ? load() : Promise.resolve(null)).then((art) => {
    let anims: IntroAnims | null = null;
    let pyramid: LoadedIntro["pyramid"] = null;
    let blocks: LoadedIntro["blocks"] = null;
    let wood: LoadedIntro["wood"] = null;
    let storm: StormArt | null = null;
    let dark: DarkArt | null = null;
    let rope: RopeArt | null = null;
    let crew: CrewArt | null = null;
    let ice: IceArt | null = null;
    let dash: DashArt | null = null;
    const all = <A extends string>(ch: Character, names: readonly A[]) => Object.fromEntries(names.map((a) => [a, ch.anims[a]!.frames.map((_, i) => toCanvas(ch, a, i))])) as Record<A, HTMLCanvasElement[]>;
    if (art?.dash) {
      const m = art.dash;
      anims = blitzAnims({ mover: m.BOSS_BLITZ_INTRO, table: m.INTRO_BLITZ_TABLE, stool: m.INTRO_BLITZ_STOOL, dust: m.INTRO_BLITZ_DUST, pop: m.INTRO_BLITZ_POP });
      dash = {
        mover: { ch: m.BOSS_BLITZ_INTRO, frames: all(m.BOSS_BLITZ_INTRO, BLITZ_MOVES) },
        dust: { ch: m.INTRO_BLITZ_DUST, frames: all(m.INTRO_BLITZ_DUST, ["idle"]).idle },
        table: { ch: m.INTRO_BLITZ_TABLE, frames: all(m.INTRO_BLITZ_TABLE, ["land", "idle"]) },
        stool: { ch: m.INTRO_BLITZ_STOOL, frames: all(m.INTRO_BLITZ_STOOL, ["land", "idle"]) },
        pop: { ch: m.INTRO_BLITZ_POP, frames: all(m.INTRO_BLITZ_POP, ["idle"]).idle },
      };
    } else if (art?.ice) {
      const { props: m, moves: g, elves: e } = art.ice;
      const route = m.INTRO_GINGER_BOARD_ROUTE;
      const len = route.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - route[i - 1]![0], p[1] - route[i - 1]![1]) : 0), 0);
      const letGo = Math.max(0, e.ELF_BOARD_HANDS.toss.findIndex((h) => h === null));
      const pieces = { mover: g.BOSS_GINGER_INTRO, blast: m.INTRO_GINGER_BLAST, shard: m.INTRO_GINGER_SHARD, crack: m.INTRO_GINGER_CRACK, puff: m.INTRO_GINGER_PUFF, table: m.INTRO_GINGER_TABLE, light: m.INTRO_GINGER_LIGHT, board: m.INTRO_GINGER_BOARD, carrier: e.NPC_GINGER_ELF_BOARD_A };
      anims = iceAnims(pieces, letGo, len);
      const where: Record<IceGear, [Character, string]> = {
        fly: [m.INTRO_GINGER_BLAST, "fly"],
        burst: [m.INTRO_GINGER_BLAST, "burst"],
        form: [m.INTRO_GINGER_SHARD, "form"],
        fall: [m.INTRO_GINGER_SHARD, "fall"],
        land: [m.INTRO_GINGER_SHARD, "land"],
        crack: [m.INTRO_GINGER_CRACK, "crack"],
        puff: [m.INTRO_GINGER_PUFF, "puff"],
        tableIdle: [m.INTRO_GINGER_TABLE, "idle"],
        appear: [m.INTRO_GINGER_LIGHT, "appear"],
        shine: [m.INTRO_GINGER_LIGHT, "shine"],
        fade: [m.INTRO_GINGER_LIGHT, "fade"],
        spin: [m.INTRO_GINGER_BOARD, "spin"],
      };
      ice = {
        mover: { ch: g.BOSS_GINGER_INTRO, frames: all(g.BOSS_GINGER_INTRO, ICE_MOVES), blastFrom: g.INTRO_GINGER_BLAST_FROM },
        props: Object.fromEntries(ICE_GEAR.map((k) => [k, { ch: where[k][0], frames: all(where[k][0], [where[k][1]])[where[k][1]]! }])) as IceArt["props"],
        carriers: { a: { ch: e.NPC_GINGER_ELF_BOARD_A, frames: all(e.NPC_GINGER_ELF_BOARD_A, ICE_ELF) }, b: { ch: e.NPC_GINGER_ELF_BOARD_B, frames: all(e.NPC_GINGER_ELF_BOARD_B, ICE_ELF) } },
        board: { ch: m.INTRO_GINGER_BOARD, carry: toCanvas(m.INTRO_GINGER_BOARD, "carry", 0) },
        at: { route, table: m.INTRO_GINGER_TABLE_AT, top: m.INTRO_GINGER_TABLE_TOP, hands: e.ELF_BOARD_HANDS, spots: m.INTRO_GINGER_ELF_SPOTS },
        blastTo: m.INTRO_GINGER_BLAST_TO,
      };
    } else if (art?.crew) {
      const m = art.crew;
      anims = crewAnims({ mover: m.BOSS_GREX_INTRO, lift: m.INTRO_GREX_LIFT, table: m.INTRO_GREX_TABLE });
      crew = {
        mover: { ch: m.BOSS_GREX_INTRO, frames: all(m.BOSS_GREX_INTRO, CREW_MOVES) },
        table: { ch: m.INTRO_GREX_TABLE, frames: all(m.INTRO_GREX_TABLE, ["idle", "creak"]), sway: m.INTRO_GREX_TABLE_SWAY, top: m.INTRO_GREX_TABLE_TOP },
        lift: { ch: m.INTRO_GREX_LIFT, frames: all(m.INTRO_GREX_LIFT, ["flush", "rise", "up"]), h: m.INTRO_GREX_LIFT_H },
        spots: m.INTRO_GREX_CREW_SPOTS,
        setoff: m.INTRO_GREX_CREW_SETOFF,
      };
    } else if (art?.rope) {
      const m = art.rope;
      anims = ropeAnims({ mover: m.BOSS_PIG_INTRO, rope: m.INTRO_PIG_ROPE, table: m.INTRO_PIG_TABLE, bucket: m.INTRO_PIG_BUCKET_B, release: m.PIG_INTRO_RELEASE });
      const bucket = (ch: Character) => {
        const f = all(ch, ["tumble", "land", "stool"]);
        return { ch, frames: { tumble: f.tumble, drop: f.land, stool: f.stool } };
      };
      rope = {
        mover: { ch: m.BOSS_PIG_INTRO, frames: all(m.BOSS_PIG_INTRO, ROPE_MOVES) },
        hands: m.PIG_INTRO_HANDS,
        hands2: m.PIG_INTRO_HANDS2,
        loop: { ch: m.INTRO_PIG_ROPE, frames: all(m.INTRO_PIG_ROPE, ["fly", "catch", "cinched", "free"]), knot: m.INTRO_PIG_ROPE_KNOT },
        bale: { ch: m.INTRO_PIG_TABLE, frames: all(m.INTRO_PIG_TABLE, ["idle", "slide", "land"]), lift: m.INTRO_PIG_TABLE_LIFT },
        buckets: { b: bucket(m.INTRO_PIG_BUCKET_B), w: bucket(m.INTRO_PIG_BUCKET_W) },
        handle: m.INTRO_PIG_BUCKET_HANDLE,
        ink: m.INTRO_PIG_ROPE_INK,
      };
    } else if (art?.dark) {
      const m = art.dark;
      anims = darkAnims({ mover: m.BOSS_HOLLOW_INTRO, lantern: m.INTRO_HOLLOW_LANTERN_OUT, tree: m.INTRO_HOLLOW_SHOWPIECE_OUT, glow: m.INTRO_HOLLOW_LANTERN_GLOW, run: m.INTRO_HOLLOW_BULB_RUN, dark: m.INTRO_HOLLOW_DARK, pool: m.INTRO_HOLLOW_DIMPOOL });
      dark = buildDark(m);
    } else if (art?.wood) {
      const w = art.wood;
      // (His pixels are his town figure's, BOSS_ART's, `bossSquares` tall.)
      anims = logAnims(w, BOSS_ART[home].h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale[home] ?? 1)));
      wood = {
        mover: { ch: w.mover, frames: all(w.mover, [...LOG_MOVES, "idle"]) },
        liftAt: w.liftAt,
        reach: w.reach,
        log: { ch: w.log, frames: all(w.log, ["lying", "standing", "gnawed"]) },
        fog: { ch: w.fog, frames: all(w.fog, ["rise", "hold", "settle"]) },
        stump: { ch: w.stump, frames: all(w.stump, ["idle", "pop"]) },
      };
    } else if (art?.blocks) {
      const bl = art.blocks;
      const ms = (a: BlocksAnim) => bl.anims[a]!.frames.map((f) => f.ms);
      const cues = (a: BlocksAnim) => bl.anims[a]!.frames.map((f) => f.cue);
      anims = { build: ms("build"), plop: ms("plop"), chairs: ms("chairs"), cues: { build: cues("build"), plop: cues("plop"), chairs: cues("chairs") } };
      const frames = {} as Record<BlocksAnim, HTMLCanvasElement[]>;
      for (const a of ["build", "plop", "chairs", "idle"] as const) frames[a] = bl.anims[a]!.frames.map((_, i) => toCanvas(bl, a, i));
      blocks = { ch: bl, frames };
    } else if (art) {
      const py = art.pyramid;
      const ms = (a: PyramidAnim) => py.anims[a]!.frames.map((f) => f.ms);
      // (The art's "table" cue: the crumble frame whose middle is clear, the table showing behind the falling sand.)
      const tableFrame = Math.max(0, py.anims.crumble!.frames.findIndex((f) => f.cue === "table"));
      anims = { rise: ms("rise"), idle: ms("idle"), crack: ms("crack"), crumble: ms("crumble"), tableFrame };
      const frames = {} as Record<PyramidAnim, HTMLCanvasElement[]>;
      for (const a of ["rise", "idle", "crack", "crumble"] as const) frames[a] = py.anims[a]!.frames.map((_, i) => toCanvas(py, a, i));
      pyramid = { ch: py, frames };
    }
    if (art?.storm) {
      const k = CHALLENGE_FEEL.stormScale;
      const stormFrames = art.storm.anims.idle!.frames;
      let at = 0;
      const stormCues: { cue: string; at: number }[] = [];
      for (const f of stormFrames) {
        if (f.cue && f.cue !== "storm") stormCues.push({ cue: f.cue, at });
        at += Math.max(16, f.ms);
      }
      storm = {
        cues: stormCues,
        tiles: stormFrames.map((_, i) => scaled(toCanvas(art.storm, "idle", i), k)),
        fronts: art.front.anims.idle!.frames.map((_, i) => scaled(toCanvas(art.front, "idle", i), k)),
        backs: art.front.anims.idle!.frames.map((_, i) => scaled(toCanvas(art.front, "idle", i), k, true)),
        ms: stormFrames.map((f) => Math.max(16, f.ms)),
      };
    }
    // The table: the boss's own (its blocks, built; Timber's gnawed pedestal, its stumps apart), or the town's park table in its stone
    // (the same geometry: a stool, the leg, a stool).
    const tch = art?.blocks ?? art?.table ?? PARK_TABLE;
    const img = toCanvas(tch, "idle", 0);
    const table = { ch: tch, img, leg: third(img, 1), stool: third(img, 0), palette: art?.palette ?? PARK_TABLE.palette };
    const bossCh = BOSS_ART[home];
    let t = 0;
    const bossIdle = bossCh.anims.idle!.frames;
    const ends = bossIdle.map((f) => (t += Math.max(16, f.ms)));
    // Its God King attack, if its kit has one (every playable boss's does, Timber's too since Nov 2; the Hidden Boss has no home).
    const kit = bossKit(def.name);
    // (Hollow's own intro has none: the dark is his transition.)
    const ka = dark ? null : (kit?.kingAttack ?? null);
    const attack = ka
      ? {
          ch: ka.ch,
          frames: ka.ch.anims[ka.anim]!.frames.map((_, i) => toCanvas(ka.ch, ka.anim, i)),
          ms: ka.ch.anims[ka.anim]!.frames.map((f) => Math.max(16, f.ms)),
          cues: ka.ch.anims[ka.anim]!.frames.map((f) => f.cue),
          sounds: ka.sounds ?? kit!.sounds,
          facesLeft: !!ka.facesLeft,
          beat: KING_ATTACK,
        }
      : null;
    // (The cues' sounds made ahead, in the sound worker: playing one never costs a frame.)
    warmSounds([...(Object.values(def.cues) as SoundName[]), ...(attack ? Object.values(attack.sounds) : [])]);
    return {
      home,
      def,
      anims,
      beats: introBeats(anims),
      pyramid,
      blocks,
      wood,
      table,
      boss: { ch: bossCh, frames: bossIdle.map((_, i) => toCanvas(bossCh, "idle", i)), ends, loop: t, squares: TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale[home] ?? 1), head: drawnTop(bossIdle.map((f) => renderFrame(bossCh, f).data), bossCh.w, bossCh.h) },
      storm,
      attack,
      dark,
      rope,
      crew,
      ice,
      dash,
    };
  });
  p.catch(() => loading.delete(home));
  loading.set(home, p);
  return p;
}

// ---- Hollow's dark (his intro's art drawn: shops/hollow-intro-art.ts).

/** A pixel bright enough to be a light's own (the art's mockup: its lit pixels drawn over the dark). */
const LIT_LUM = 0.28;
/** His own lit pixels: his eyes, the ball's bright violet and the light landing on it, his strand's bulbs. */
const HIS_LIT = new Set(["e", "E", "U", "x", "a", "b", ...BULB_KEYS.flat()]);
/** A frame drawn (with a look), and its pixels' keys. */
function painted(ch: Character, frame: Frame, look?: string) {
  const { w, h, data } = renderFrame(ch, frame, { look });
  const c = canvasOf(w, h);
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return { c, data, w, h };
}
/** Where a picture's lights are: boxes of its pixels (x0, y0 to x1, y1 exclusive) and the keys lit in each. */
type LitBox = { x0: number; y0: number; x1: number; y1: number; keys: ReadonlySet<string> };
/**
 * A frame's lit pixels alone (its keys `keys`, its pixels `data`): those of a box's keys in it, bright enough (recolored `to`), cropped;
 * null when none is. Only the boxes are walked (Nov 3: walking every pixel of every frame made his intro slow to load on a phone).
 */
function emisOf(w: number, h: number, keys: ReturnType<typeof frameKeys>, data: Uint8ClampedArray, boxes: readonly LitBox[], to?: string): Emis | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const keep = new Uint8Array(w * h);
  for (const b of boxes)
    for (let y = Math.max(0, b.y0); y < Math.min(h, b.y1); y++) {
      const row = keys[y];
      if (!row) continue;
      for (let x = Math.max(0, b.x0); x < Math.min(w, b.x1); x++) {
        const k = row[x];
        if (!k || !b.keys.has(k)) continue;
        const i = (y * w + x) * 4;
        if (!data[i + 3] || (0.3 * data[i]! + 0.59 * data[i + 1]! + 0.11 * data[i + 2]!) / 255 < LIT_LUM) continue;
        keep[y * w + x] = 1;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  const rgb = to ? [1, 3, 5].map((j) => parseInt(to.slice(j, j + 2), 16)) : null;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!keep[y * w + x]) continue;
      const i = (y * w + x) * 4;
      const o = ((y - y0) * cw + (x - x0)) * 4;
      out[o] = rgb ? rgb[0]! : data[i]!;
      out[o + 1] = rgb ? rgb[1]! : data[i + 1]!;
      out[o + 2] = rgb ? rgb[2]! : data[i + 2]!;
      out[o + 3] = data[i + 3]!;
    }
  const img = canvasOf(cw, ch);
  img.getContext("2d")!.putImageData(new ImageData(out, cw, ch), 0, 0);
  return { img, x: x0, y: y0 };
}
/**
 * Hollow's dark, every frame drawn as it loads (behind the town's fade, never in a frame loop): only the frames the intro plays (the
 * bulbs' anims the run reaches on each placement, his moves at the strand's counts he plays them with), and each one's lit pixels.
 */
function buildDark(m: typeof import("./hollow-intro-art.ts")): DarkArt {
  /** A cave piece's lights' boxes (SHOP_HOLLOW_LIGHTS). */
  const boxesOf = (name: string): LitBox[] =>
    m.SHOP_HOLLOW_LIGHTS.filter((l) => l.piece === name && l.keys).map((l) => ({ x0: Math.floor(l.x), y0: Math.floor(l.y), x1: Math.ceil(l.x + l.w), y1: Math.ceil(l.y + l.h), keys: new Set(l.keys) }));
  /** A move's frames drawn (`only`: just these, the rest left out: never shown), each with its lit pixels (and its eyes alone). */
  const litFrames = (ch: Character, anim: string, boxes: readonly LitBox[], look?: string, eyes?: LitBox[], eyesTo?: string, only?: ReadonlySet<number>): (Lit & { eyes: Emis | null })[] =>
    ch.anims[anim]!.frames.map((fr, i) => {
      if (only && !only.has(i)) return undefined as unknown as Lit & { eyes: Emis | null };
      const p = painted(ch, fr, look);
      const keys = frameKeys(ch, fr);
      return { img: p.c, emis: emisOf(ch.w, ch.h, keys, p.data, boxes), eyes: eyes ? emisOf(ch.w, ch.h, keys, p.data, eyes, eyesTo) : null };
    });
  const emisFrames = (ch: Character, anim: string, boxes: readonly LitBox[]) =>
    ch.anims[anim]!.frames.map((fr) => emisOf(ch.w, ch.h, frameKeys(ch, fr), renderFrame(ch, fr).data, boxes));
  const pieces: DarkArt["pieces"] = {};
  const lit: DarkArt["lit"] = {};
  // The lanterns: each `gutter<k>` (k its sway frame as it starts) and its dark `idle`; the cave's own lit frames' lit pixels.
  for (const [name, ch] of [["lantern", m.INTRO_HOLLOW_LANTERN_OUT], ["lantern-b", m.INTRO_HOLLOW_LANTERN_B_OUT]] as const) {
    const on = boxesOf(name);
    pieces[name] = Object.fromEntries(Object.keys(ch.anims).filter((a) => a !== "lit").map((a) => [a, litFrames(ch, a, on)]));
    lit[name] = emisFrames(m.SHOP_HOLLOW_PIECES[name]!, "idle", on);
  }
  // The bulbs: on each placement, the anims the run reaches (`l<n>`, or `r<n>` on a mirrored placement); `l0` is the cave's own. One
  // on the way to the last (all its bulbs dark) shows a bulb's turn, about 30 ms: its first flicker frame alone stands for all of them.
  const need = new Map<string, Map<string, boolean>>();
  const count = new Map<string, number>();
  for (const b of m.INTRO_HOLLOW_BULB_RUN) {
    const key = `${b.piece}|${b.col}|${b.row}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  for (const b of m.INTRO_HOLLOW_BULB_RUN) {
    const n = m.INTRO_HOLLOW_BULB_RUN.filter((x) => x.piece === b.piece && x.col === b.col && x.row === b.row).indexOf(b) + 1;
    const anims = need.get(b.piece) ?? new Map<string, boolean>();
    const last = n === count.get(`${b.piece}|${b.col}|${b.row}`);
    const a = `${b.flip ? "r" : "l"}${n}`;
    anims.set(a, (anims.get(a) ?? false) || last);
    need.set(b.piece, anims);
  }
  const first = new Set([0]);
  for (const [name, anims] of need) {
    const ch = m.INTRO_HOLLOW_BULB_PIECES[name]!;
    const on = boxesOf(name);
    pieces[name] = Object.fromEntries([...anims].map(([a, last]) => [a, litFrames(ch, a, on, undefined, undefined, undefined, last ? undefined : first)]));
    lit[name] = emisFrames(m.SHOP_HOLLOW_PIECES[name]!, "idle", on);
  }
  // The tree: its `drain` and its dark `idle`.
  {
    const ch = m.INTRO_HOLLOW_SHOWPIECE_OUT;
    const on = boxesOf("showpiece");
    pieces.showpiece = { drain: litFrames(ch, "drain", on), idle: litFrames(ch, "idle", on) };
    lit.showpiece = emisFrames(m.SHOP_HOLLOW_PIECES.showpiece!, "idle", on);
  }
  // Him: each move at the strand's counts he plays it with (his lit pixels: his eyes, the ball's violet, his bulbs); his eyes alone
  // (dim violet) in the black, as he stands full and settles.
  const H = m.BOSS_HOLLOW_INTRO;
  const D = m.INTRO_HOLLOW_DARK;
  const whole = (keys: Iterable<string>): LitBox[] => [{ x0: 0, y0: 0, x1: H.w, y1: H.h, keys: new Set(keys) }];
  const his = whole(HIS_LIT);
  const eyeBox = whole(["e", "E"]);
  const looks: Record<DarkMove, readonly number[]> = { charge: [3], swell: [3], drink: [3, 2, 1, 0], full: [0], settle: [0] };
  // (His drink with two thirds and one third of his strand lit shows a beat each, `dark.drain.strand`'s gaps: just its frames then.)
  const d = drainAt();
  const drinkMs = H.anims.drink!.frames.map((x) => x.ms);
  const shown = (from: number, to: number) => {
    const out = new Set<number>();
    for (let t = from; t < to; t += 5) out.add(frameAt(drinkMs, t, true));
    return out;
  };
  const drinkOnly: Partial<Record<number, ReadonlySet<number>>> = { 2: shown(d.strand[0]!, d.strand[1]!), 1: shown(d.strand[1]!, d.strand[2]!) };
  const eyes = { full: [] as (Emis | null)[], settle: [] as (Emis | null)[] };
  const him = Object.fromEntries(
    DARK_MOVES.map((a) => {
      const by: (Lit[] | undefined)[] = [];
      for (const n of looks[a]) {
        const dark = a === "full" || a === "settle";
        const fr = litFrames(H, a, his, `bulbs${n}`, dark ? eyeBox : undefined, D.eyes, a === "drink" ? drinkOnly[n] : undefined);
        if (dark) eyes[a] = fr.map((x) => x.eyes);
        by[n] = fr;
      }
      return [a, by];
    }),
  ) as DarkArt["him"];
  const idleCh = BOSS_ART.hollow;
  const idle0 = idleCh.anims.idle!.frames.map((fr) => painted(idleCh, fr, "bulbs0").c);
  // The motes: each kind's twinkle, and the sip.
  const M = m.INTRO_HOLLOW_MOTE;
  const motes = Object.fromEntries(Object.keys(M.anims).map((a) => [a, M.anims[a]!.frames.map((fr) => painted(M, fr).c)]));
  // Each bulb's mote, from its glass (the key at its middle, or one next to it).
  const runMote = m.INTRO_HOLLOW_BULB_RUN.map((b) => {
    const ch = m.SHOP_HOLLOW_PIECES[b.piece]!;
    const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const k = keys[Math.round(b.at[1]) + dy]?.[Math.round(b.at[0]) + dx];
        const kind = k ? m.INTRO_HOLLOW_BULB_MOTE[k] : undefined;
        if (kind) return kind;
      }
    return null;
  });
  return { him, idle0, eyes, pieces, lit, motes, runMote, art: m };
}

/** Plays a cue's sound, if the boss has one for it (none: silent). */
export function playCue(intro: LoadedIntro, cue: string): void {
  const s = intro.def.cues[cue];
  if (s) play(s as SoundName);
}

// ---- The board on the table (render.ts drawBoard, without its cache, game or clock).

/** White's back rank from the a-file (the a-file on your left as you sit at it). */
const BACK_RANK = ["R", "N", "B", "Q", "K", "B", "N", "R"] as const;
const pieceImgs = new Map<string, HTMLCanvasElement>();
/**
 * A piece in pixels (TABLE_PIECES, in the town's TABLE_INK: its fill shaded on the right, an outline round it), made once. `flip`:
 * its knight turned to face left (the art's faces right).
 */
function pieceImg(kind: string, light: boolean, flip: boolean): HTMLCanvasElement {
  const key = kind + (light ? "l" : "d") + (flip && kind === "N" ? "f" : "");
  let c = pieceImgs.get(key);
  if (c) return c;
  let rows = TABLE_PIECES[kind]!;
  if (flip && kind === "N") rows = rows.map((r) => [...r].reverse().join(""));
  const w = rows[0]!.length + 2;
  const h = rows.length + 2;
  c = canvasOf(w, h);
  const g = c.getContext("2d")!;
  const ink = TABLE_INK;
  const fill = (x: number, y: number) => rows[y - 1]?.[x - 1] === "#";
  const inside = (x: number, y: number) => fill(x, y) || rows[y - 1]?.[x - 1] === "x";
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let col: string | null = null;
      if (fill(x, y)) col = light ? (fill(x + 1, y) ? ink.light : ink.lightShade) : fill(x - 1, y) ? ink.dark : ink.darkShade;
      else if (inside(x, y) || inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) col = light ? ink.lightLine : ink.darkLine;
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  pieceImgs.set(key, c);
  return c;
}

/** The 32 pieces at the start, where they stand on the table for a layout (challenge.ts boardSquare), far (north) ones first. */
const piecesOf = new Map<IntroLayout, { kind: string; light: boolean; x: number; z: number }[]>();
function tablePieces(how: IntroLayout) {
  let out = piecesOf.get(how);
  if (out) return out;
  out = [];
  for (const rank of [0, 1, 6, 7])
    for (let file = 0; file < 8; file++) out.push({ kind: rank === 0 || rank === 7 ? BACK_RANK[file]! : "P", light: rank < 2, ...boardSquare(how, file, rank) });
  out.sort((a, b) => b.z - a.z);
  piecesOf.set(how, out);
  return out;
}

const bp = newPt();
const bq = newPt();
const grid = Array.from({ length: 81 }, newPt);
const lift: TableLift = { dz: 0, top: 0, thick: 0, grow: 1 };
/**
 * Where the slab's front edge's foot (its bottom, middle) is on the screen, for a table at (dx, dz) through view `v`, as paintTable
 * draws it: its y. Null: off the view. (Toy blocks: the slab reaches half a board toward you from the top block it lies on, so it is
 * lifted until this edge rests on that block's top, or its front would hide the blocks under it.)
 */
export function slabFrontY(v: View, dx: number, dz: number): number | null {
  const B = TABLE_BOARD;
  if (!proj(v, dx, dz, 0, bp)) return null;
  const fy = bp.y;
  const fk = bp.k;
  if (!tableLift(v, dx, dz, B.top, B.thick, lift)) return null;
  const z = lift.dz;
  if (z !== dz && !proj(v, dx, z, 0, bp)) return null;
  const m = fk / bp.k;
  const ty = fy - bp.y * m;
  if (!proj(v, dx, z - B.half, lift.top - lift.thick, bq)) return null;
  return bq.y * m + ty;
}

/**
 * The table's top at (dx, dz) through view `v` (as the town's park tables: render.ts drawBoard): the slab's front, its top and its
 * gold far edge, the 8 x 8 squares lying flat, the pieces standing on them, far ones first, turned for the layout (`boardSquare`:
 * white's nearest you). `alpha`: how much it shows.
 */
export function paintTable(g: CanvasRenderingContext2D, v: View, dx: number, dz: number, pal: Readonly<Record<string, string>>, how: IntroLayout, alpha = 1, pieces = 1): void {
  const B = TABLE_BOARD;
  if (!proj(v, dx, dz, 0, bp)) return;
  const fx = bp.x;
  const fy = bp.y;
  const fk = bp.k;
  if (!tableLift(v, dx, dz, B.top, B.thick, lift)) return;
  const z = lift.dz;
  if (z !== dz && !proj(v, dx, z, 0, bp)) return;
  const m = fk / bp.k;
  const tx = fx - bp.x * m;
  const ty = fy - bp.y * m;
  const { top, thick } = lift;
  const footX = bp.x;
  if (!proj(v, dx, z, top, bq)) return;
  const shift = bq.x - footX;
  const hb = B.board;
  const sq = (2 * hb) / 8;
  for (let gi = 0; gi < 9; gi++) for (let fi = 0; fi < 9; fi++) if (!proj(v, dx - hb + fi * sq, z - hb + gi * sq, top, grid[gi * 9 + fi]!)) return;
  g.save();
  g.globalAlpha = alpha;
  g.transform(m, 0, 0, m, tx, ty);
  const quad = (pts: readonly (readonly [number, number, number])[], fill: string) => {
    g.beginPath();
    for (let n = 0; n < pts.length; n++) {
      const [x, zz, l] = pts[n]!;
      if (!proj(v, dx + x, z + zz, l, bp)) return;
      if (n === 0) g.moveTo(bp.x - shift, bp.y);
      else g.lineTo(bp.x - shift, bp.y);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  const h = B.half;
  quad([[-h, -h, top], [h, -h, top], [h, -h, top - thick], [-h, -h, top - thick]], pal["4"]!);
  quad([[-h, -h, top], [h, -h, top], [h, h, top], [-h, h, top]], pal["2"]!);
  quad([[-h, h, top], [h, h, top], [h, h - 0.03, top], [-h, h - 0.03, top]], pal["1"]!);
  // The squares: the light in one fill, the dark in another (a1, white's a-file square on its back rank, is dark, as a board's is).
  for (const dark of [false, true]) {
    g.beginPath();
    for (let gi = 0; gi < 8; gi++)
      for (let fi = 0; fi < 8; fi++) {
        // (The square's x column `fi` and z row `gi` as a file and rank: across, the ranks run east to west and the files north.)
        const file = how === "across" ? gi : fi;
        const rank = how === "across" ? 7 - fi : gi;
        if (((file + rank) % 2 === 0) !== dark) continue;
        const p0 = grid[gi * 9 + fi]!;
        const p1 = grid[gi * 9 + fi + 1]!;
        const p2 = grid[(gi + 1) * 9 + fi + 1]!;
        const p3 = grid[(gi + 1) * 9 + fi]!;
        g.moveTo(p0.x - shift, p0.y);
        g.lineTo(p1.x - shift, p1.y);
        g.lineTo(p2.x - shift, p2.y);
        g.lineTo(p3.x - shift, p3.y);
        g.closePath();
      }
    g.fillStyle = dark ? pal.D! : pal.L!;
    g.fill();
  }
  // The pieces, far ones first (by their row on the table, north to south). Across, the knights face the other side: yours west
  // (left, toward the boss), its east; facing, black's turned (as the town's tables have them).
  g.imageSmoothingEnabled = false;
  // (`pieces`: how much the pieces show: Ginger's come in as his light fades.)
  if (pieces <= 0) {
    g.restore();
    return;
  }
  g.globalAlpha = alpha * Math.min(1, pieces);
  for (const p of tablePieces(how)) {
    if (!proj(v, dx + p.x * sq, z + p.z * sq, top, bq)) continue;
    const img = pieceImg(p.kind, p.light, how === "across" ? p.light : !p.light);
    const ps = bq.k * B.piecePx;
    g.drawImage(img, bq.x - shift - (img.width * ps) / 2, bq.y - (img.height - 1) * ps, img.width * ps, img.height * ps);
  }
  g.restore();
}

// ---- The storm: over the whole page, outside the town (it stays as the town closes and the battle opens under it).

export interface Storm {
  /** Resolves once the storm covers the screen (the battle can load under it). */
  covered: Promise<void>;
  /** Slides the storm out (after `coveredMinMs` covered at least) and takes it away; resolves once it's gone. */
  out: () => Promise<void>;
}
/**
 * Starts the storm: its front sweeps in from the left over `stormInMs` with the storm tiled behind it (all on one frame index),
 * then it holds, covering everything, until `out()`. The canvas takes every tap while it shows. Its phase is on the element
 * (`data-phase`: "in", "covered", "out"; `data-covered="1"` once it has covered the screen) for tests.
 */
/** The boss's transition: its own (Alfil's sandstorm), or the default (the flash and the wipe). */
export const startTransition = (intro: LoadedIntro): Storm => (intro.dark ? startDark(intro) : intro.storm ? startStorm(intro) : startWipe(intro));

export function startStorm(intro: LoadedIntro): Storm {
  const F = CHALLENGE_FEEL;
  const art = intro.storm!;
  const cv = document.createElement("canvas");
  cv.className = "boss-storm";
  cv.setAttribute("aria-hidden", "true");
  cv.dataset.boss = intro.home;
  // (Its own styles, inline: it outlives the town's page and its stylesheet's scope. Over everything, taking every tap.)
  cv.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483000;touch-action:none;pointer-events:auto";
  document.body.append(cv);
  const g = cv.getContext("2d")!;
  const patterns = art.tiles.map((t) => g.createPattern(t, "repeat")!);
  const fw = art.fronts[0]!.width;
  const fh = art.fronts[0]!.height;
  let loop = 0;
  const ends = art.ms.map((ms) => (loop += ms));
  let phase: "in" | "covered" | "out" = "in";
  let t0 = performance.now();
  let coveredAt = 0;
  let edge = -fw;
  let W = 0;
  let H = 0;
  let dpr = 1;
  const size = () => {
    const w = innerWidth;
    const h = innerHeight;
    const d = Math.min(2, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr) return;
    W = w;
    H = h;
    dpr = d;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  };
  const draw = (now: number) => {
    size();
    const t = now - t0;
    const u = now % loop;
    let i = 0;
    while (i < ends.length - 1 && u >= ends[i]!) i++;
    if (phase === "in") edge = stormEdge("in", t, F.stormInMs, W, fw);
    else if (phase === "covered") edge = W;
    else edge = stormEdge("out", t, F.stormOutMs, W, fw);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    // The storm, its tiles lined up on the edge (where the front's left side carries on from a tile's right).
    const pat = patterns[i]!;
    pat.setTransform(new DOMMatrix([1, 0, 0, 1, edge, 0]));
    g.fillStyle = pat;
    if (phase === "out") g.fillRect(Math.max(0, edge), 0, W - Math.max(0, edge), H);
    else g.fillRect(0, 0, Math.min(W, Math.max(0, edge)), H);
    // Its front: ahead of it coming in, behind it (mirrored) going out.
    const img = phase === "out" ? art.backs[i]! : art.fronts[i]!;
    const x = phase === "out" ? edge - fw : edge;
    if (phase !== "covered") for (let y = 0; y < H; y += fh) g.drawImage(img, x, y);
  };
  let raf = 0;
  const frame = (now: number) => {
    draw(now);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  cv.dataset.phase = phase;
  playCue(intro, "storm");
  // (Its frames' own cues as it sweeps in, once: Wrangler's spurs jingling and a toy cap's pop.)
  for (const c of art.cues) setTimeout(() => playCue(intro, c.cue), c.at);
  // (The phases go by the clock, not by frames: a hidden tab still gets to the battle.)
  const covered = new Promise<void>((ok) =>
    setTimeout(() => {
      phase = "covered";
      coveredAt = performance.now();
      cv.dataset.phase = phase;
      cv.dataset.covered = "1";
      ok();
    }, F.stormInMs),
  );
  const out = async () => {
    await covered;
    const wait = coveredAt + F.coveredMinMs - performance.now();
    if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
    phase = "out";
    t0 = performance.now();
    cv.dataset.phase = phase;
    await new Promise((ok) => setTimeout(ok, F.stormOutMs));
    cancelAnimationFrame(raf);
    cv.remove();
  };
  return { covered, out };
}

// ---- The default transition: a flash, then a wipe to black (Pokémon style; Eric, Nov 2: "a default transition").

/**
 * Starts the default transition: the screen flashes white (`flashes` times over `flashMs`), then black bands wipe across it, every
 * other one from the other side (`wipeBands` of them, over `wipeMs`), and it holds black while the battle loads; `out()` fades the
 * black off over `wipeOutMs`. A canvas over the whole page, outside the town's tree, taking every tap (as the storm's). Its phase is
 * on the element (`data-phase`: "flash", "in", "covered", "out"; `data-covered="1"` once it covers the screen) for tests.
 */
export function startWipe(intro: LoadedIntro): Storm {
  const F = CHALLENGE_FEEL;
  const cv = document.createElement("canvas");
  cv.className = "boss-wipe";
  cv.setAttribute("aria-hidden", "true");
  cv.dataset.boss = intro.home;
  cv.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483000;touch-action:none;pointer-events:auto";
  document.body.append(cv);
  const g = cv.getContext("2d")!;
  // (The canvas is drawn at one pixel per CSS pixel: flat fills only, nothing to be crisp.)
  const t0 = performance.now();
  let outAt = -1;
  let raf = 0;
  const setPhase = (ph: string) => {
    if (cv.dataset.phase !== ph) cv.dataset.phase = ph;
  };
  const frame = (now: number) => {
    const W = innerWidth;
    const H = innerHeight;
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    g.clearRect(0, 0, W, H);
    if (outAt >= 0) {
      g.globalAlpha = Math.max(0, 1 - (now - outAt) / F.wipeOutMs);
      g.fillStyle = "#000";
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    } else {
      const { flash, wipe } = wipeAt(now - t0);
      if (flash) {
        g.fillStyle = "rgba(255,255,255,0.92)";
        g.fillRect(0, 0, W, H);
      }
      if (wipe > 0) {
        const n = F.wipeBands;
        const bh = Math.ceil(H / n);
        const w = Math.ceil(W * wipe);
        g.fillStyle = "#000";
        for (let i = 0; i < n; i++) g.fillRect(i % 2 ? W - w : 0, i * bh, w, bh);
      }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  setPhase("flash");
  playCue(intro, "wipe");
  // (The phases go by the clock, not by frames: a hidden tab still gets to the battle.)
  setTimeout(() => setPhase("in"), F.flashMs);
  let coveredAt = 0;
  const covered = new Promise<void>((ok) =>
    setTimeout(() => {
      coveredAt = performance.now();
      setPhase("covered");
      cv.dataset.covered = "1";
      ok();
    }, F.flashMs + F.wipeMs),
  );
  const out = async () => {
    await covered;
    const wait = coveredAt + F.coveredMinMs - performance.now();
    if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
    outAt = performance.now();
    setPhase("out");
    await new Promise((ok) => setTimeout(ok, F.wipeOutMs));
    cancelAnimationFrame(raf);
    cv.remove();
  };
  return { covered, out };
}

// ---- Hollow's: the dark (Nov 3, the director's call, Eric may change it: no second blackout, no storm). The room has closed the dim
// light in on the board to black (its iris); this black takes over at once, holds while the battle loads, and the match comes up out
// of it (a fade from black over `dark.outMs`).

/**
 * Starts Hollow's transition: a black canvas over the whole page (as the wipe's: outside the town's tree, taking every tap), covering
 * from its first frame (the room is already black under it); `out()` fades it off the battle. `data-phase` "covered" then "out".
 */
export function startDark(intro: LoadedIntro): Storm {
  const F = CHALLENGE_FEEL;
  const cv = document.createElement("canvas");
  cv.className = "boss-dark";
  cv.setAttribute("aria-hidden", "true");
  cv.dataset.boss = intro.home;
  cv.width = cv.height = 1;
  // (One black pixel stretched over the page: its opacity fades it, nothing to redraw.)
  cv.style.cssText = `position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483000;touch-action:none;pointer-events:auto;background:#000;opacity:1;transition:opacity ${F.dark.outMs}ms ease-out`;
  document.body.append(cv);
  cv.dataset.phase = "covered";
  cv.dataset.covered = "1";
  const coveredAt = performance.now();
  const covered = Promise.resolve();
  const out = async () => {
    const wait = coveredAt + F.coveredMinMs - performance.now();
    if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
    cv.dataset.phase = "out";
    cv.style.opacity = "0";
    await new Promise((ok) => setTimeout(ok, F.dark.outMs));
    cv.remove();
  };
  return { covered, out };
}
