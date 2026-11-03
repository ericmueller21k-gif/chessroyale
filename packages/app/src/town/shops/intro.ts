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
 * - The boss itself (its town sprite, BOSS_ART: its `idle`), walking in and standing on its mark.
 * - The transition (`startTransition`): a boss's own (`startStorm`, Alfil's sandstorm), or the default (`startWipe`: a flash and a
 *   wipe to black). Each a canvas over the whole page (outside the town's tree, so it stays as the town closes and the
 *   battle opens under it): the storm's tile (tiled, 3x, crisp) sweeps in behind its front, holds while the battle loads, and slides
 *   out with its front mirrored.
 */
import { KING_ATTACK } from "@chessroyale/chess";
import { bossKit } from "../../characters/kits.ts";
import { renderFrame, type Character, type Frame } from "../../characters/sprite.ts";
import { play, warmSounds, type SoundName } from "../../sound.ts";
import { newPt, proj, tableLift, type TableLift, type View } from "../camera.ts";
import { TOWN_FEEL } from "../feel.ts";
import { PARK_TABLE, TABLE_BOARD, TABLE_INK, TABLE_PIECES } from "../houses/park.ts";
import { BOSS_ART } from "../render.ts";
import type { HomeId } from "../world.ts";
import { CHALLENGE_FEEL, boardSquare, introBeats, introOf, stormEdge, wipeAt, type BossIntro, type IntroAnims, type IntroBeat, type IntroLayout, type LogAnims, type LogMove } from "./challenge.ts";

/**
 * A boss's intro art, as its file exports it: a pyramid that brings in its table (Alfil's), or toy blocks that are the table and its
 * stools (Big Boy's); the slab's and board's colors; its storm (a tile and its front).
 */
type IntroArt = (
  | { pyramid: Character; table: Character; blocks?: undefined; wood?: undefined }
  | { blocks: Character; pyramid?: undefined; table?: undefined; wood?: undefined }
  | { wood: WoodArt; table: Character; pyramid?: undefined; blocks?: undefined }
) & {
  /** The slab's keys "1" to "5" and the board's squares `L` / `D`. */
  palette: Readonly<Record<string, string>>;
  storm: Character;
  front: Character;
};
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
};

type PyramidAnim = "rise" | "idle" | "crack" | "crumble";
type BlocksAnim = "build" | "plop" | "chairs" | "idle";
const LOG_MOVES = ["walk", "lift", "carry", "setDown", "gnaw", "done"] as const;

/** The storm's frames, ready: each tile `stormScale` times its size, the front and the front mirrored, and each frame's ms. */
export interface StormArt {
  tiles: HTMLCanvasElement[];
  fronts: HTMLCanvasElement[];
  backs: HTMLCanvasElement[];
  ms: number[];
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
  /** The boss: its sprite's idle frames, when each ends, and how many squares tall it stands (the town's size). */
  boss: { ch: Character; frames: HTMLCanvasElement[]; ends: number[]; loop: number; squares: number };
  /** Its storm (null: the default transition, the flash and the wipe). */
  storm: StormArt | null;
  /**
   * Its God King attack (its kit's `kingAttack`), or null: a boss without one skips it. Its frames, each one's ms and cue, its
   * sounds by cue (the kit's), how it faces. (Swung where the boss stands, clear of its stool: not off the board, as at a king.)
   */
  attack: { ch: Character; frames: HTMLCanvasElement[]; ms: number[]; cues: (string | undefined)[]; sounds: Readonly<Record<string, SoundName>>; facesLeft: boolean; beat: typeof KING_ATTACK } | null;
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
    const all = <A extends string>(ch: Character, names: readonly A[]) => Object.fromEntries(names.map((a) => [a, ch.anims[a]!.frames.map((_, i) => toCanvas(ch, a, i))])) as Record<A, HTMLCanvasElement[]>;
    if (art?.wood) {
      const w = art.wood;
      const msOf = (ch: Character, a: string) => ch.anims[a]!.frames.map((f) => f.ms);
      const cuesOf = (ch: Character, a: string) => ch.anims[a]!.frames.map((f) => f.cue);
      // (Its places in squares: his pixels are his town figure's, BOSS_ART's, `bossSquares` tall. His dusting off steps him back: the
      // way his foot's layer moves from his still to the move's last frame.)
      const perSq = BOSS_ART[home].h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale[home] ?? 1));
      const footX = (fr: Frame) => fr.layers.find((l) => l.part.startsWith("foot"))?.x ?? 0;
      const back = (footX(w.mover.anims.idle!.frames[0]!) - footX(w.mover.anims.done!.frames.at(-1)!)) / perSq;
      const moves = Object.fromEntries(LOG_MOVES.map((m) => [m, msOf(w.mover, m)])) as Record<LogMove, number[]>;
      const props = { gnawed: msOf(w.log, "gnawed"), rise: msOf(w.fog, "rise"), hold: msOf(w.fog, "hold"), settle: msOf(w.fog, "settle"), pop: msOf(w.stump, "pop") };
      const cues = {
        ...(Object.fromEntries(LOG_MOVES.map((m) => [m, cuesOf(w.mover, m)])) as Record<LogMove, (string | undefined)[]>),
        gnawed: cuesOf(w.log, "gnawed"),
        rise: cuesOf(w.fog, "rise"),
        hold: cuesOf(w.fog, "hold"),
        settle: cuesOf(w.fog, "settle"),
        pop: cuesOf(w.stump, "pop"),
      };
      anims = { moves, props, cues, reach: w.reach[0] / perSq, back } satisfies LogAnims;
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
    if (art) {
      const k = CHALLENGE_FEEL.stormScale;
      const stormFrames = art.storm.anims.idle!.frames;
      storm = {
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
    const ka = kit?.kingAttack ?? null;
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
      boss: { ch: bossCh, frames: bossIdle.map((_, i) => toCanvas(bossCh, "idle", i)), ends, loop: t, squares: TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale[home] ?? 1) },
      storm,
      attack,
    };
  });
  p.catch(() => loading.delete(home));
  loading.set(home, p);
  return p;
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
export function paintTable(g: CanvasRenderingContext2D, v: View, dx: number, dz: number, pal: Readonly<Record<string, string>>, how: IntroLayout, alpha = 1): void {
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
export const startTransition = (intro: LoadedIntro): Storm => (intro.storm ? startStorm(intro) : startWipe(intro));

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

