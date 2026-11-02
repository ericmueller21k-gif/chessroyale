/**
 * A boss's intro, drawn (shops/challenge.ts has the timing; ShopRoom.tsx plays it in the room): loaded only when you challenge the
 * boss (its art is a chunk of its own: Alfil's is shops/alfil-intro-art.ts, copied from `claude/boss-art`), every frame drawn into
 * a canvas of its own as it loads, behind the town's fade, never in a frame loop.
 *
 * - The board coming in: the pyramid's frames (its `rise`, `idle`, `crack` and `crumble`), the table (the town's park table in the
 *   boss's colors) and, on it, the slab, the board and the pieces as the town lays them on a park table (render.ts `drawBoard`:
 *   `paintTable` here is that, without the town's cache, the game or the clock): the slab in the boss's stone, its squares in his
 *   colors (the art's palette `L` / `D`), the pieces in the town's own ink (TABLE_INK), white's on the rank nearest you.
 * - The boss itself (its town sprite, BOSS_ART: its `idle`), walking in and standing on its mark.
 * - The transition: `startStorm`, a canvas over the whole page (outside the town's tree, so it stays as the town closes and the
 *   battle opens under it): the storm's tile (tiled, 3x, crisp) sweeps in behind its front, holds while the battle loads, and slides
 *   out with its front mirrored.
 */
import { KING_ATTACK } from "@chessroyale/chess";
import { bossKit } from "../../characters/kits.ts";
import { renderFrame, type Character } from "../../characters/sprite.ts";
import { play, warmSounds, type SoundName } from "../../sound.ts";
import { newPt, proj, tableLift, type TableLift, type View } from "../camera.ts";
import { TOWN_FEEL } from "../feel.ts";
import { TABLE_BOARD, TABLE_INK, TABLE_PIECES } from "../houses/park.ts";
import { BOSS_ART } from "../render.ts";
import type { HomeId } from "../world.ts";
import { CHALLENGE_FEEL, introBeats, introOf, stormEdge, type BossIntro, type IntroAnims, type IntroBeat } from "./challenge.ts";

/** A boss's intro art, as its file exports it. */
interface IntroArt {
  pyramid: Character;
  table: Character;
  /** The slab's keys "1" to "5" and the board's squares `L` / `D`. */
  palette: Readonly<Record<string, string>>;
  storm: Character;
  front: Character;
}
const ART: Partial<Record<HomeId, () => Promise<IntroArt>>> = {
  alfil: () =>
    import("./alfil-intro-art.ts").then((m) => ({ pyramid: m.INTRO_ALFIL_PYRAMID, table: m.INTRO_ALFIL_TABLE, palette: m.INTRO_ALFIL_TABLE_PALETTE, storm: m.INTRO_ALFIL_STORM, front: m.INTRO_ALFIL_FRONT })),
};

type PyramidAnim = "rise" | "idle" | "crack" | "crumble";

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
  anims: IntroAnims;
  beats: IntroBeat[];
  pyramid: { ch: Character; frames: Record<PyramidAnim, HTMLCanvasElement[]> };
  table: { ch: Character; img: HTMLCanvasElement; palette: Readonly<Record<string, string>> };
  /** The boss: its sprite's idle frames, when each ends, and how many squares tall it stands (the town's size). */
  boss: { ch: Character; frames: HTMLCanvasElement[]; ends: number[]; loop: number; squares: number };
  storm: StormArt;
  /**
   * Its God King attack (its kit's `kingAttack`), or null: a boss without one skips it. Its frames, each one's ms and cue, its
   * sounds by cue (the kit's), how it faces, where its feet stand off its target (frame pixels: `stand` squares of `perSquare`).
   */
  attack: { ch: Character; frames: HTMLCanvasElement[]; ms: number[]; cues: (string | undefined)[]; sounds: Readonly<Record<string, SoundName>>; facesLeft: boolean; standPx: number; beat: typeof KING_ATTACK } | null;
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

const loading = new Map<HomeId, Promise<LoadedIntro>>();
/** Loads a boss's intro (its art's chunk, every frame drawn), once; null for a boss without one. */
export function loadIntro(home: HomeId): Promise<LoadedIntro> | null {
  const def = introOf(home);
  const load = ART[home];
  if (!def || !load) return null;
  let p = loading.get(home);
  if (p) return p;
  p = load().then((art) => {
    const py = art.pyramid;
    const ms = (a: PyramidAnim) => py.anims[a]!.frames.map((f) => f.ms);
    // (The art's "table" cue: the crumble frame whose middle is clear, the table showing behind the falling sand.)
    const tableFrame = Math.max(0, py.anims.crumble!.frames.findIndex((f) => f.cue === "table"));
    const anims: IntroAnims = { rise: ms("rise"), idle: ms("idle"), crack: ms("crack"), crumble: ms("crumble"), tableFrame };
    const frames = {} as Record<PyramidAnim, HTMLCanvasElement[]>;
    for (const a of ["rise", "idle", "crack", "crumble"] as const) frames[a] = py.anims[a]!.frames.map((_, i) => toCanvas(py, a, i));
    const bossCh = BOSS_ART[home];
    let t = 0;
    const bossIdle = bossCh.anims.idle!.frames;
    const ends = bossIdle.map((f) => (t += Math.max(16, f.ms)));
    const k = CHALLENGE_FEEL.stormScale;
    const stormFrames = art.storm.anims.idle!.frames;
    const storm: StormArt = {
      tiles: stormFrames.map((_, i) => scaled(toCanvas(art.storm, "idle", i), k)),
      fronts: art.front.anims.idle!.frames.map((_, i) => scaled(toCanvas(art.front, "idle", i), k)),
      backs: art.front.anims.idle!.frames.map((_, i) => scaled(toCanvas(art.front, "idle", i), k, true)),
      ms: stormFrames.map((f) => Math.max(16, f.ms)),
    };
    // Its God King attack, if its kit has one (every playable boss's does but Timber's, today).
    const kit = bossKit(def.name);
    const ka = kit?.kingAttack ?? null;
    const attack = ka
      ? {
          ch: ka.ch,
          frames: ka.ch.anims[ka.anim]!.frames.map((_, i) => toCanvas(ka.ch, ka.anim, i)),
          ms: ka.ch.anims[ka.anim]!.frames.map((f) => Math.max(16, f.ms)),
          cues: ka.ch.anims[ka.anim]!.frames.map((f) => f.cue),
          sounds: kit!.sounds,
          facesLeft: !!ka.facesLeft,
          standPx: ka.stand * ka.perSquare,
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
      pyramid: { ch: py, frames },
      table: { ch: art.table, img: toCanvas(art.table, "idle", 0), palette: art.palette },
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

/** White's back rank from the a-file, as you look at it from your mark (the a-file on your left). */
const BACK_RANK = ["R", "N", "B", "Q", "K", "B", "N", "R"] as const;
const pieceImgs = new Map<string, HTMLCanvasElement>();
/** A piece in pixels (TABLE_PIECES, in the town's TABLE_INK: its fill shaded on the right, an outline round it), made once. */
function pieceImg(kind: string, light: boolean): HTMLCanvasElement {
  const key = kind + (light ? "l" : "d");
  let c = pieceImgs.get(key);
  if (c) return c;
  let rows = TABLE_PIECES[kind]!;
  if (!light && kind === "N") rows = rows.map((r) => [...r].reverse().join(""));
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

const bp = newPt();
const bq = newPt();
const grid = Array.from({ length: 81 }, newPt);
const lift: TableLift = { dz: 0, top: 0, thick: 0, grow: 1 };
/**
 * The table's top at (dx, dz) through view `v` (as the town's park tables: render.ts drawBoard): the slab's front, its top and its
 * gold far edge, the 8 x 8 squares lying flat, the pieces standing on them, far ones first. `alpha`: how much it shows.
 */
export function paintTable(g: CanvasRenderingContext2D, v: View, dx: number, dz: number, pal: Readonly<Record<string, string>>, alpha = 1): void {
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
  // The squares: the light in one fill, the dark in another (rank 0, nearest you, has its a-file square dark, as a board does).
  for (const dark of [false, true]) {
    g.beginPath();
    for (let gi = 0; gi < 8; gi++)
      for (let fi = 0; fi < 8; fi++) {
        if (((fi + gi) % 2 === 0) !== dark) continue;
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
  // The pieces, far ranks first: black's (the boss's side), then white's (yours).
  g.imageSmoothingEnabled = false;
  for (let gi = 7; gi >= 0; gi--) {
    if (gi > 1 && gi < 6) continue;
    const light = gi < 2;
    for (let fi = 0; fi < 8; fi++) {
      const kind = gi === 0 || gi === 7 ? BACK_RANK[fi]! : "P";
      if (!proj(v, dx - hb + (fi + 0.5) * sq, z - hb + (gi + 0.5) * sq, top, bq)) continue;
      const img = pieceImg(kind, light);
      const ps = bq.k * B.piecePx;
      g.drawImage(img, bq.x - shift - (img.width * ps) / 2, bq.y - (img.height - 1) * ps, img.width * ps, img.height * ps);
    }
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
export function startStorm(intro: LoadedIntro): Storm {
  const F = CHALLENGE_FEEL;
  const art = intro.storm;
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
