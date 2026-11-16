/**
 * Chandy's challenge in his swamp, drawn flat for a look (Nov 16, round 1's mockup; the game plays it as an intro timeline once it's
 * built): the room's back trees, the water, Chandy at his mark and you at yours, then the board's mossy post rising first out of the
 * water (its foot still under), the platform rising under you both with the post's foot on it, the milk crates dropping on, his
 * entrance (his point and his shot), and the swamp's wipe rising over everything. Every piece is the game's art (chandy-intro-art.ts,
 * chandy-art.ts, Chandy's town figure); the board is a stand-in slab of the board's squares.
 *
 *   npx tsx scripts/boss-art/chandy-home-stills.ts <out dir>     (frames/NNN.png and keeper-b.png; a GIF is made from the frames)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { png } from "../bake-sidekicks.ts";
import { CHANDY } from "../../packages/app/src/characters/chandy.ts";
import { sidekickSwampKeeper } from "../../packages/app/src/characters/sidekicks/swampkeeper.ts";
import { chandyLit } from "../../packages/app/src/town/shops/chandy-art.ts";
import { CHANDY_PLATFORM_TOP, CHANDY_POST_TOP, INTRO_CHANDY_CRATE, INTRO_CHANDY_FRONT, INTRO_CHANDY_PLATFORM, INTRO_CHANDY_POST, INTRO_CHANDY_STORM } from "../../packages/app/src/town/shops/chandy-intro-art.ts";

const out = process.argv[2] ?? "scripts/boss-art/out/chandy-home";
mkdirSync(`${out}/frames`, { recursive: true });
const hex = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const W = 300;
const H = 230;
/** The water's surface at the marks' row (y), and the marks. */
const WL = 168;
const BOSS_X = 70;
const YOU_X = 232;
const MID = 151;

class Img {
  data: Uint8Array;
  constructor(public w: number, public h: number) {
    this.data = new Uint8Array(w * h * 4);
  }
  px(X: number, Y: number, rgb: readonly number[], a = 1) {
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) return;
    const o = (Y * this.w + X) * 4;
    for (let c = 0; c < 3; c++) this.data[o + c] = Math.round(this.data[o + c]! * (1 - a) + rgb[c]! * a);
    this.data[o + 3] = 255;
  }
  /** A character's frame with its foot at (x, y), drawn only above `clip` (the water's surface: what's under it is hidden). */
  draw(ch: Character, anim: string, f: number, x: number, y: number, clip = Infinity, flip = false) {
    const a = ch.anims[anim]!;
    const fr = a.frames[f % a.frames.length]!;
    const { w, h, data } = renderFrame(ch, fr);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const al = data[(j * w + i) * 4 + 3]! / 255;
        if (!al) continue;
        const sx = flip ? w - 1 - i : i;
        const X = Math.round(x + sx - (flip ? w - 1 - ch.foot[0] : ch.foot[0]));
        const Y = Math.round(y + j - ch.foot[1]);
        if (Y >= clip) continue;
        this.px(X, Y, [data[(j * w + i) * 4]!, data[(j * w + i) * 4 + 1]!, data[(j * w + i) * 4 + 2]!], al);
      }
  }
  rect(x0: number, y0: number, w: number, h: number, c: string, a = 1) {
    const rgb = hex(c);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, rgb, a);
  }
  ring(cx: number, cy: number, rx: number, c: string, a: number) {
    const rgb = hex(c);
    for (let t = 0; t < 360; t += 2) this.px(Math.round(cx + rx * Math.cos((t * Math.PI) / 180)), Math.round(cy + rx * 0.25 * Math.sin((t * Math.PI) / 180)), rgb, a);
  }
  save(name: string) {
    writeFileSync(`${out}/${name}`, png(this.w, this.h, this.data));
  }
}

const room = chandyLit("day").pieces;
const trees = ["trees-a", "trees-b", "trees-c", "trees-d"].map((n) => room[n]!);
/** The stage: the sky, a row of the room's trees at the back, the water to the front edge. */
function stage(im: Img) {
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / 90);
    const c = [Math.round(110 + 90 * t), Math.round(170 + 50 * t), Math.round(236 + 10 * t)];
    for (let x = 0; x < W; x++) im.px(x, y, c);
  }
  for (let i = 0; i < 9; i++) im.draw(trees[(i * 3 + 1) % 4]!, "idle", 0, 18 + i * 37, 112);
  for (let y = 112; y < H; y++)
    for (let x = 0; x < W; x++) {
      const streak = (y % 5 === 0 && ((x * 7 + y * 3) % 29) < 6) || ((x * 13 + y * 7) % 97) < 2;
      im.px(x, y, hex(streak ? "#4b7d5d" : y > 196 ? "#1d3a2c" : "#284c37"));
    }
}
/** A plain white pawn (your figure on foot), its foot at (x, y), clipped at the water. */
function pawn(im: Img, x: number, y: number, clip: number) {
  for (let j = -30; j <= 0; j++)
    for (let i = -11; i <= 11; i++) {
      const Y = y + j;
      if (Y >= clip) continue;
      const head = Math.hypot(i, j + 24) <= 5.5;
      const body = j > -19 && Math.abs(i) <= 3 + ((j + 19) / 19) * 8 && (j > -6 || Math.abs(i) <= 3 + ((j + 19) / 13) * 3);
      const neck = j >= -19 && j <= -17 && Math.abs(i) <= 6;
      const inside = head || body || neck;
      const edge = !inside && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
        const ii = i + a!;
        const jj = j + b!;
        return Math.hypot(ii, jj + 24) <= 5.5 || (jj > -19 && jj <= 0 && Math.abs(ii) <= 3 + ((jj + 19) / 19) * 8 && (jj > -6 || Math.abs(ii) <= 3 + ((jj + 19) / 13) * 3)) || (jj >= -19 && jj <= -17 && Math.abs(ii) <= 6);
      });
      if (inside) im.px(x + i, Y, [255, 255, 255]);
      else if (edge) im.px(x + i, Y, [0, 0, 0]);
    }
}
/** The board: a slab of its squares seen a little from above, its front edge, on the post's cap at (x, y). */
function board(im: Img, x: number, y: number, clip: number) {
  const bw = 52;
  const bh = 14;
  for (let j = 0; j < bh; j++) {
    const half = bw / 2 - (bh - j) * 0.35;
    for (let i = -Math.floor(half); i < half; i++) {
      const Y = y - bh - 3 + j;
      if (Y >= clip) continue;
      const cx = Math.floor(((i + half) / (2 * half)) * 8);
      const cy = Math.floor((j / bh) * 8);
      im.px(x + i, Y, (cx + cy) % 2 ? [173, 128, 88] : [238, 197, 139]);
    }
  }
  for (let j = 0; j < 3; j++) for (let i = -bw / 2; i < bw / 2; i++) if (y - 3 + j < clip) im.px(x + i, y - 3 + j, j === 0 ? [120, 80, 50] : [80, 50, 30]);
}

const CH = { ...CHANDY, w: CHANDY.w };
const ms = (s: number) => Math.round(s * 1000);
const FPS = 12;
const TL = {
  face: 0.8, // on the marks, facing each other
  post: 2.0, // the post rises (its foot stays in the water)
  plat: 1.6, // the platform rises under you both, the post's foot on it
  crates: 0.8, // the crates drop on
  entrance: 2.2, // his point, then his shot (his God King swing in the game)
  wipe: 1.4, // the water rises over the screen
};
const ease = (u: number) => u * u * (3 - 2 * u);
let frame = 0;
const ends: number[] = [];
let t0 = 0;
for (const [k, v] of Object.entries(TL)) ends.push((t0 += v));
const total = t0;
const pointA = CHANDY.anims.point!;
const fireA = CHANDY.anims.fire!;
const PLAT_UP = 22; // how far the platform rises (its deck over the water), lifting all on it
for (let t = 0; t < total; t += 1 / FPS) {
  const im = new Img(W, H);
  stage(im);
  const step = ends.findIndex((e) => t < e);
  const at = (i: number) => (i ? ends[i - 1]! : 0);
  const u = (i: number) => Math.max(0, Math.min(1, (t - at(i)) / (ends[i]! - at(i))));
  // The platform's deck: below the water until its rise, then PLAT_UP over it.
  const plat = step < 2 ? -6 : step === 2 ? -6 + (PLAT_UP + 6) * ease(u(2)) : PLAT_UP;
  // The post: rising alone from deep under the water until its cap is well over it (its foot on the sunken deck, under the water), then
  // carried up with the platform. Under the water's surface nothing shows.
  const deck = WL - plat;
  const py = step < 1 ? WL + 90 : step === 1 ? deck + (1 - ease(u(1))) * 84 : deck;
  const lifted = Math.max(0, plat);
  // The platform (once it's near the surface), streaming as it rises.
  if (step >= 2) im.draw(INTRO_CHANDY_PLATFORM, step === 2 ? "stream" : "idle", frame, MID, deck + (INTRO_CHANDY_PLATFORM.foot[1] - CHANDY_PLATFORM_TOP), WL + 1);
  if (step === 2) for (const dx of [-80, 0, 80]) im.ring(MID + dx, WL, 30 + 20 * u(2), "#d6f0e0", 0.6 * (1 - u(2)));
  im.draw(INTRO_CHANDY_POST, step <= 2 ? "stream" : "idle", frame, MID, py, WL);
  board(im, MID, py - (INTRO_CHANDY_POST.foot[1] - CHANDY_POST_TOP), WL);
  if (step === 1) im.ring(MID, WL, 26 + 10 * u(1), "#d6f0e0", 0.7);
  // The crates: dropping onto the platform beside the post.
  if (step >= 3) {
    const d = step === 3 ? 1 - ease(u(3)) : 0;
    im.draw(INTRO_CHANDY_CRATE, "blue", 0, MID - 46, deck - d * 70);
    im.draw(INTRO_CHANDY_CRATE, "orange", 0, MID + 46, deck - d * 70);
  }
  // Chandy and you, on your marks, lifted with the platform (in the water, your feet hidden).
  const fy = WL - lifted;
  const water = lifted > 0 ? WL : WL - 5;
  if (step === 4) {
    const k = (t - at(4)) * 1000;
    const p = pointA.frames.reduce((s, f) => s + f.ms, 0);
    if (k < p) {
      let acc = 0;
      const i = pointA.frames.findIndex((f) => (acc += f.ms) > k);
      im.draw(CH, "point", Math.max(0, i), BOSS_X, fy, water);
    } else {
      let acc = 0;
      const i = fireA.frames.findIndex((f) => (acc += f.ms) > k - p);
      im.draw(CH, "fire", i < 0 ? fireA.frames.length - 1 : i, BOSS_X, fy, water);
    }
  } else im.draw(CH, "idle", Math.floor(t * 4), BOSS_X, fy, water);
  pawn(im, YOU_X, fy, water);
  if (lifted <= 0) for (const x of [BOSS_X, YOU_X]) im.ring(x, WL - 5, 14, "#bee8cd", 0.85);
  // The wipe: the water rising over the screen from its foot, its wavy front riding up.
  if (step === 5) {
    const top = Math.round(H - (H + 40) * ease(u(5)));
    for (let x = 0; x < W; x += 74) {
      for (let y = top + 30; y < H; y += 74) im.draw(INTRO_CHANDY_STORM, "idle", frame, x + 37, y + 73);
      im.draw(INTRO_CHANDY_FRONT, "idle", frame, x + 37, top + 39);
    }
  }
  im.save(`frames/${String(frame).padStart(3, "0")}.png`);
  frame++;
}
// Keeper option B (a snapping turtle in waders) is described in the README; option A, the bullfrog, at 4x on the water.
{
  const im = new Img(120, 80);
  for (let y = 0; y < 80; y++) for (let x = 0; x < 120; x++) im.px(x, y, hex(y > 60 ? "#284c37" : "#9ec9e8"));
  im.draw(sidekickSwampKeeper, "idle", 0, 40, 64);
  im.draw(sidekickSwampKeeper, "wave", 1, 90, 64);
  im.save("keeper-a.png");
}
console.log(`${frame} frames at ${FPS} fps (${total.toFixed(1)} s), the post up at ${ends[1]}, the platform at ${ends[2]}, crates ${ends[3]}, wipe from ${ends[4]}`);
void ms;
