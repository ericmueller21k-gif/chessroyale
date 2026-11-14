import { render } from "preact";
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { RECLUSE_CUTSCENE as CS, RECLUSE_PHASE2, bannerPlusMs, BOSS_BANNER } from "@chessroyale/core";
import { chess960Fen } from "@chessroyale/chess";
import { RECLUSE, RECLUSE_JUMP, recluseLayers, headOf, suitFrame, type ReclusePose, type Visor } from "../characters/recluse.ts";
import { CUTSCENE_SPOTS, RECLUSE_CUTSCENE } from "../characters/recluse-ages.ts";
import { RECLUSE_CUTSCENE_LINES, RECLUSE_LINES } from "../characters/recluse-lines.ts";
import type { Character, Frame, Layer } from "../characters/sprite.ts";
import { EFFECTS } from "../characters/power-art.ts";
import { Board } from "../components/Board.tsx";
import { SpriteAnim } from "../components/BossEffect.tsx";
import { FightBanner } from "../components/FightBanner.tsx";
import { useFrameNow } from "../components/Countdown.tsx";
import { recluseCutsceneTimeline } from "../components/RecluseCutscene.tsx";
import { cutTyped } from "../recluse-cutscene.ts";
import { ARC_LIFE, ARC_REDRAW, ARC_STRIKES, PHASE_CHANGE, arcPoints, smoothPath, type ArcStrike } from "../recluse-phase2.ts";
import { pacedLine } from "../paced-line.ts";
import { CRITICAL, SpeechBox, bossVoice } from "../speech.tsx";
import { kingVoice } from "../godKing.ts";

/**
 * Dev only (a MOCKUP for Eric, round 3, Nov 14): the Hidden Boss's transformation redone. Nothing in the app imports this:
 * `scripts/preview-recluse-transform.mjs` loads it into a real boss battle mid-game through the Vite dev server.
 *
 * From the cutscene's last line: the book lying flat on the board before him opens and light radiates out of it (the
 * summoning's light from his room, town/shops/recluse-scene.ts, laid on the board). On the music's slam it takes him: his
 * head goes back and his eyes go totally white. A shaft of it lifts him off his knees, his arms hanging relaxed at his sides
 * the whole time, his hair pushed back by it; and it keeps pouring out, more and more, until it engulfs him, shoots up off
 * the board and off the screen, radiates in every direction and whites out the whole screen. Unseen in the white, he
 * changes (and the child and the lens are gone). The light dies back down into the center and shows him in a fitted suit
 * and full helmet (recluse.ts, `suitFrame`), the visor down; it flips up for his line about computation and creativity and
 * back down. He leaps on the music's breath and lands on its drop: the board cracks under him and splits as today (the arcs
 * from his hands, the four boards, the book back in his hands, his leap home, "PHASE 2"), the big board gone from the crack's
 * first frame. His second line after the landing. No God King.
 */

// ---- The timeline (ms from T0: the book starts to open, the transformation theme's intro starts).
const INTRO = 17_435; // recluse-phase3's introSeconds: its loop (the drop) at T0 + INTRO.
const MARK = { pause: 2440, slam: 2640, build: 3040, breath: 16_435, drop: INTRO } as const;
export const TB = (() => {
  const openAt = 0;
  const openMs = 1100;
  const burstAt = MARK.slam; // the light bursts out and takes him (his eyes go white) on the music's slam
  const riseAt = MARK.build; // the shaft climbs into him and lifts him, on the build; the light grows from here
  const riseMs = 1900;
  const beamAt = riseAt + riseMs; // standing in the beam, hovering a little, arms at his sides
  const upShootAt = 5600; // the beam shoots up off the board and off the screen
  const radiateAt = 6300; // and radiates in every direction
  const whiteAt = 7300; // the screen whites out (to full at whiteFull)
  const whiteFull = 8000; // unseen: he changes, the child and the lens are gone
  const downAt = 8700; // the light dies back down into the center
  const revealAt = 10_000; // him, in the suit and helmet, the visor down
  const flipUpAt = revealAt + 300; // the visor flips up: his face
  const line1At = flipUpAt + 300;
  const flipDownAt = 15_750; // and back down over it, his line said

  const crouchAt = MARK.breath - 200;
  const upAt = MARK.breath; // off the ground as the music falls silent
  const crackAt = MARK.drop; // down on the drop: the crack (the big board gone from here)
  const line2At = crackAt + 800; // "Prepare yourself..." after the landing, read through the split and "PHASE 2"
  // (Today's split, its times unchanged, from the crack: PHASE_CHANGE.)
  const C = PHASE_CHANGE;
  const d = crackAt - C.crackAt;
  const partAt = C.partAt + d;
  const growAt = C.growAt + d;
  const growMs = C.growMs;
  const pickupAt = C.pickupAt + d;
  const shuffleAt = C.shuffleAt + d;
  const backAt = C.backAt + d;
  const homeAt = C.homeAt + d;
  const bannerAt = C.bannerAt + d;
  const bannerMs = BOSS_BANNER.phase2Ms + bannerPlusMs();
  return { openAt, openMs, burstAt, riseAt, riseMs, beamAt, upShootAt, radiateAt, whiteAt, whiteFull, downAt, revealAt, flipUpAt, line1At, flipDownAt, crouchAt, upAt, crackAt, line2At, d, partAt, growAt, growMs, pickupAt, shuffleAt, backAt, homeAt, bannerAt, bannerMs, endAt: bannerAt + bannerMs };
})();

// ---- The figures: the man in his own drawing (RECLUSE's size, so his look and the board's leap work as today), the child in
// the cutscene's.
const LIFT = RECLUSE_CUTSCENE.h - RECLUSE.h - 4;
const manPart = (l: Layer) => l.part in RECLUSE.parts;
const manOnly = (f: Frame): Frame => ({ ms: f.ms, layers: f.layers.filter(manPart).map((l) => ({ ...l, y: l.y - LIFT })) });
const kidOnly = (f: Frame): Frame => ({ ms: f.ms, layers: f.layers.filter((l) => !manPart(l)), specks: f.specks, pal: f.pal });
const noBook = (f: Frame): Frame => ({ ...f, layers: f.layers.filter((l) => !l.part.startsWith("book:")) });
const bookOnly = (f: Frame): Frame => ({ ...f, layers: f.layers.filter((l) => l.part.startsWith("book:")) });
const A = RECLUSE.anims;
const chantF = () => A.chant!.frames;
const fr = (ms: number, p: ReclusePose, i = -1): Frame => {
  const c = i >= 0 ? chantF()[i % 8]! : null;
  return { ms, layers: recluseLayers(p), ...(c ? { specks: c.specks, pal: c.pal } : {}) };
};
const OPEN_AT = [46, 123] as const;
const SLUMP_ARMS = { elbowR: [32, 58], wristR: [38, 78], elbowL: [60, 58], wristL: [55, 78] } as const;
/** His arms hanging relaxed at his sides (Eric, Nov 14: "in a more relaxed position to his side the whole time"). */
const SIDE_ARMS = { elbowR: [31, 60], wristR: [33, 80], elbowL: [61, 60], wristL: [60, 80] } as const;
/** The same, drifting a little out from his sides in the light. */
const SIDE_ARMS_OUT = { elbowR: [30, 60], wristR: [31, 80], elbowL: [62, 60], wristL: [62, 80] } as const;
const onGround = (book: "flat" | "half" | "read", at: readonly [number, number] = OPEN_AT, arms: object = SLUMP_ARMS) => ({ book, at: [...at], loose: true, clutched: false, ...arms }) as unknown as ReclusePose["hold"];
const kneelP = (eyes: string, extra: Partial<ReclusePose> = {}): ReclusePose => ({ stance: "kneel", dip: 4, face: { eyes, brows: "up", mouth: "tight" }, ...extra }) as ReclusePose;
const TAKEN = { eyes: "possessed", brows: "up", mouth: "tight" } as const;
const wind3 = (i: number) => ((i % 3) + 1) as 1 | 2 | 3;

/** Phase 2 standing in the suit: his stance, arms at his sides; `extra` over it. (The suit hides his hair: no wind.) */
const P2 = (i: number, extra: Partial<ReclusePose> = {}): ReclusePose => ({ phase: 2, stance: "wide", tie: i % 2 ? 1 : 0, face: { eyes: "hard", brows: "stern", mouth: "stern" }, hold: onGround("read", OPEN_AT, SIDE_ARMS), ...extra }) as ReclusePose;
/** A frame in the suit, its visor as given; the book left on the board (drawn apart). */
const S = (f: Frame, visor: Visor = "down") => suitFrame(noBook(f), visor);

const MAN: Character = {
  ...RECLUSE,
  id: "recluse-transform-lab",
  anims: {
    together: { loop: true, frames: RECLUSE_CUTSCENE.anims.together!.frames.map(manOnly) },
    kidTalk: { loop: true, frames: RECLUSE_CUTSCENE.anims.kidTalk!.frames.map(manOnly) },
    // The book opens before him: its cover lifts, it falls open, the pages catch light; he looks down at it.
    open: {
      loop: false,
      frames: [
        fr(260, kneelP("down", { hold: onGround("flat", [46, 125]) })),
        fr(220, kneelP("down", { dip: 3, hold: onGround("half") })),
        fr(220, kneelP("down", { dip: 3, hold: onGround("half") }), 0),
        fr(400, kneelP("down", { dip: 3, hold: onGround("read") }), 1),
      ],
    },
    glowing: { loop: true, frames: Array.from({ length: 8 }, (_, i) => fr(100, kneelP(i === 5 ? "shut" : "down", { dip: 3, hold: onGround("read") }), i)) },
    // The light takes him: his head goes back, his eyes go totally white; his arms stay down.
    burst: { loop: true, frames: Array.from({ length: 8 }, (_, i) => fr(100, kneelP("possessed", { dip: 2, headDy: -1, wind: i < 4 ? 0 : 1, face: { ...TAKEN, mouth: i % 4 < 2 ? "grit" : "tight" }, hold: onGround("read") } as Partial<ReclusePose>), i)) },
    // Lifted in the beam: off his knees, slowly, his arms hanging at his sides, his hair pushed back. (The book stays on the
    // board: drawn apart, `BOOK`.)
    rise: {
      loop: false,
      frames: [
        noBook(fr(320, kneelP("possessed", { dip: 2, wind: 1, headDy: -1, face: TAKEN, hold: onGround("read") } as Partial<ReclusePose>), 0)),
        noBook(fr(380, { stance: "low", dip: 2, wind: 2, headDy: -1, face: TAKEN, hold: onGround("read", OPEN_AT, { elbowR: [32, 59], wristR: [35, 79], elbowL: [60, 59], wristL: [58, 79] }) } as ReclusePose, 2)),
        noBook(fr(380, { stance: "bend", dip: 1, wind: 3, headDy: -1, face: TAKEN, hold: onGround("read", OPEN_AT, SIDE_ARMS) } as ReclusePose, 4)),
        noBook(fr(380, { stance: "rise", wind: 1, headDy: -1, face: TAKEN, hold: onGround("read", OPEN_AT, SIDE_ARMS) } as ReclusePose, 6)),
        noBook(fr(440, { stance: "stand", wind: 2, headDy: -1, face: TAKEN, hold: onGround("read", OPEN_AT, SIDE_ARMS) } as ReclusePose, 0)),
      ],
    },
    // In the beam: hovering, head back, eyes white, arms at his sides drifting a little out, hair streaming back.
    beam: { loop: true, frames: Array.from({ length: 6 }, (_, i) => noBook(fr(110, { stance: "stand", air: true, wind: wind3(i), headDy: -1, breath: i % 3 === 1 ? 1 : 0, tie: i % 2 ? 1 : -1, face: { ...TAKEN, mouth: i % 6 < 3 ? "tight" : "grit" }, hold: onGround("read", OPEN_AT, i % 6 < 3 ? SIDE_ARMS : SIDE_ARMS_OUT) } as ReclusePose, i))) },
    // Revealed: in the suit and helmet, the visor down (recluse.ts, `suitFrame`), standing, arms at his sides.
    revealed: { loop: true, frames: Array.from({ length: 6 }, (_, i) => S(fr(120, P2(i, { breath: i >= 3 ? 1 : 0 })))) },
    // The visor flips up into the dome (a frame on its way), his face for his line; then back down.
    flipUp: { loop: false, frames: [S(fr(90, P2(0)), "mid"), S(fr(90, P2(1)), "up")] },
    faceOpen: { loop: true, frames: Array.from({ length: 6 }, (_, i) => S(fr(130, P2(i, { breath: i >= 3 ? 1 : 0, face: { eyes: i === 4 ? "narrow" : "hard", brows: "stern", mouth: "stern" } })), "up")) },
    flipDown: { loop: false, frames: [S(fr(90, P2(0)), "mid"), S(fr(90, P2(1)), "down")] },
    // The jump: crouched over the book, then up, and down on the drop; his arms stay at his sides.
    crouch: { loop: false, frames: [S(fr(200, P2(1, { stance: "bend", dip: 1, hold: onGround("read", OPEN_AT, SIDE_ARMS_OUT) })))] },
    air: { loop: true, frames: [0, 1, 2].map((w) => S(fr(120, P2(w, { air: true, stance: "bend", tie: 1, headDy: -1 })))) },
    land: {
      loop: false,
      frames: [
        { ...S(fr(90, P2(0, { stance: "low", dip: 1, hold: onGround("read", OPEN_AT, SIDE_ARMS_OUT) }), 0)), specks: A.leap!.frames[3]!.specks, shake: [0, 1] },
        S(fr(110, P2(1, { stance: "bend", hold: onGround("read", OPEN_AT, SIDE_ARMS_OUT) }), 1)),
      ],
    },
    // Landed, the arcs striking out from his hands at his sides.
    landed: { loop: true, frames: Array.from({ length: 6 }, (_, i) => S(fr(110, P2(i, { hold: onGround("read", OPEN_AT, SIDE_ARMS_OUT) }), i))) },
    // (The rest of today's sequence, in the suit.)
    pickup: { ...A.pickup!, frames: A.pickup!.frames.map((f) => suitFrame(f)) },
    leap2: { ...A.leap2!, frames: A.leap2!.frames.map((f) => suitFrame(f)) },
    idle2: { ...A.idle2!, frames: A.idle2!.frames.map((f) => suitFrame(f)) },
    // (The close-up's: the visor down, up and down again, over and over.)
    flipCycle: { loop: true, frames: [S(fr(900, P2(0))), S(fr(90, P2(1)), "mid"), S(fr(1100, P2(2)), "up"), S(fr(90, P2(0)), "mid")] },
  },
};
const BOOK: Character = { ...RECLUSE, id: "recluse-transform-book", anims: { glow: { loop: true, frames: chantF().map(bookOnly) } } };
const KID: Character = {
  ...RECLUSE_CUTSCENE,
  id: "recluse-transform-kid",
  anims: {
    together: { loop: true, frames: RECLUSE_CUTSCENE.anims.together!.frames.map(kidOnly) },
    kidTalk: { loop: true, frames: RECLUSE_CUTSCENE.anims.kidTalk!.frames.map(kidOnly) },
  },
};
const animMs = (c: Character, n: string) => c.anims[n]!.frames.reduce((s, f) => s + f.ms, 0);

// ---- Where things are (shares of the board's width; the board is square): as the cutscene draws them.
const FIG = 0.24; // his figure's width (the phase change's, and the cutscene's man)
const SCENE_SHARE = (FIG * RECLUSE_CUTSCENE.w) / RECLUSE.w;
const SCENE_LEFT = 0.5 - SCENE_SHARE / 2;
const GROUND_Y = 0.66;
/** His feet where he knelt in the light: he stands, jumps and lands there. */
const SPOT = { x: SCENE_LEFT + (RECLUSE_CUTSCENE.foot[0] / RECLUSE_CUTSCENE.w) * SCENE_SHARE, y: GROUND_Y };
const PLACE = { phone: { x: 0.1, y: 0.38 }, computer: { x: -0.12, y: 1 } } as const;
/** A point of his drawing (RECLUSE's pixels) with his feet at `feet`: on the board (shares). */
const onBoard = (feet: { x: number; y: number }, px: number, py: number) => ({ x: feet.x + ((px - RECLUSE.foot[0]) / RECLUSE.w) * FIG, y: feet.y + ((py - RECLUSE.foot[1]) / RECLUSE.w) * FIG });
const BOOK_MID = onBoard(SPOT, RECLUSE.foot[0] + 0, RECLUSE.foot[1] - 5);
/** His hands at his sides when he's landed (the `landed` frames' wrists: drawing space + the frame's offset), on the board in 0-100. */
const HANDS = () => [SIDE_ARMS_OUT.wristR, SIDE_ARMS_OUT.wristL].map(([x, y]) => onBoard(SPOT, x - 14, y + 14 + 3)).map((p) => [p.x * 100, p.y * 100] as const);
/** Over his head, standing: where his line's box points. */
const HEAD_UP = () => onBoard(SPOT, RECLUSE.foot[0], RECLUSE.foot[1] - 118);
/** His chest: the middle of the light that engulfs him and dies back into him. */
const CHEST = () => onBoard(SPOT, RECLUSE.foot[0], RECLUSE.foot[1] - 70);

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;

/** His figure at `t` (ms from T0): which animation, since when (from T0), where his feet are. */
function manAt(t: number, pre: { kidTalking: boolean; standAt: number }, desk: boolean) {
  const T = TB;
  const feet = SPOT;
  if (t < T.openAt) return { anim: pre.kidTalking ? "kidTalk" : "together", since: pre.standAt, feet };
  if (t < T.openAt + animMs(MAN, "open")) return { anim: "open", since: T.openAt, feet };
  if (t < T.burstAt) return { anim: "glowing", since: T.openAt, feet };
  if (t < T.riseAt) return { anim: "burst", since: T.burstAt, feet };
  if (t < T.beamAt) return { anim: "rise", since: T.riseAt, feet };
  // (Hovering in the beam, a little higher as the light grows; set down unseen in the white.)
  if (t < T.whiteFull) return { anim: "beam", since: T.beamAt, feet: { x: feet.x, y: feet.y - 0.03 * ease((t - T.beamAt) / (T.whiteFull - T.beamAt)) } };
  if (t < T.flipUpAt) return { anim: "revealed", since: T.whiteFull, feet };
  if (t < T.flipDownAt) return { anim: "flipUp", then: "faceOpen", since: T.flipUpAt, feet };
  if (t < T.crouchAt) return { anim: "flipDown", then: "revealed", since: T.flipDownAt, feet };
  if (t < T.upAt) return { anim: "crouch", since: T.crouchAt, feet };
  if (t < T.crackAt) {
    const u = (t - T.upAt) / (T.crackAt - T.upAt);
    return { anim: "air", since: T.upAt, feet: { x: feet.x, y: feet.y - 0.34 * 4 * u * (1 - u) } };
  }
  if (t < T.pickupAt) return { anim: "land", then: "landed", since: T.crackAt, feet };
  if (t < T.backAt) return { anim: "pickup", since: T.pickupAt, feet };
  const place = desk ? PLACE.computer : PLACE.phone;
  const up = T.backAt + RECLUSE_JUMP.upAt;
  const u = clamp01((t - up) / (RECLUSE_JUMP.landAt - RECLUSE_JUMP.upAt));
  if (t < T.homeAt) return { anim: "leap2", since: T.backAt, feet: { x: feet.x + (place.x - feet.x) * u, y: feet.y + (place.y - feet.y) * u - 0.22 * 4 * u * (1 - u) } };
  return null;
}

// ---- The light: the summoning's (recluse-scene.ts), laid on the board. Its sprites, made once and stretched.
function lightImg(w: number, h: number, rgb: readonly [number, number, number], alpha: (x: number, y: number) => number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      im.data[i] = rgb[0];
      im.data[i + 1] = rgb[1];
      im.data[i + 2] = rgb[2];
      im.data[i + 3] = 255 * clamp01(alpha((x + 0.5) / w, (y + 0.5) / h));
    }
  g.putImageData(im, 0, 0);
  return c;
}
const beam = (foot: number, fade: number, rise: number) => (x: number, y: number) => {
  const half = foot + (1 - foot) * (1 - y);
  const dx = Math.abs(2 * x - 1) / half;
  return dx >= 1 ? 0 : (1 - dx * dx) ** 2 * y ** fade * Math.min(1, (1 - y) / rise);
};
const round = (x: number, y: number) => {
  const r = Math.hypot(2 * x - 1, 2 * y - 1);
  return r >= 1 ? 0 : (1 - r) ** 1.7;
};
let LIGHT: Record<"ray" | "gold" | "shaft" | "pool" | "glow", HTMLCanvasElement> | null = null;
const light = () =>
  (LIGHT ??= {
    ray: lightImg(48, 192, [255, 247, 220], beam(0.22, 1.4, 0.14)),
    gold: lightImg(48, 192, [255, 214, 120], beam(0.3, 1.1, 0.16)),
    shaft: lightImg(96, 192, [255, 240, 196], beam(0.7, 0.75, 0.04)),
    pool: lightImg(128, 128, [255, 206, 112], round),
    glow: lightImg(96, 96, [255, 248, 214], round),
  });
function streak(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number, wx: number, wy: number, alpha: number) {
  if (alpha < 0.01) return;
  g.save();
  g.globalAlpha = Math.min(1, alpha);
  g.transform(wx / img.width, wy / img.width, (x0 - x1) / img.height, (y0 - y1) / img.height, x1 - wx / 2, y1 - wy / 2);
  g.drawImage(img, 0, 0);
  g.restore();
}
const dice = (i: number, k: number) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
/**
 * How much light there is at `t`: the pages' glow; the burst; the beam, and from the build on `grow`, the light pouring out
 * more and more (0 to 1, faster and faster) till the white-out; `white`, the whole screen; `down`, the light dying back into
 * the center (1 to 0); the slam's flash on the drop.
 */
function lightNow(t: number) {
  const T = TB;
  const pages = clamp01((t - T.openAt - 500) / 900);
  const before = t < T.whiteFull;
  const rays = t < T.burstAt || !before ? 0 : easeOut((t - T.burstAt) / 500);
  const shaft = t < T.riseAt || !before ? 0 : easeOut((t - T.riseAt) / 1600);
  const grow = before ? clamp01((t - T.riseAt) / (T.whiteFull - T.riseAt)) ** 1.7 : 0;
  const shoot = before ? ease((t - T.upShootAt) / 700) : 0;
  const radiate = before ? ease((t - T.radiateAt) / (T.whiteFull - T.radiateAt)) : 0;
  // (Then the white is drawn in to the center: `down`'s shrinking disc takes over from the full screen.)
  const white = t < T.whiteAt ? 0 : t < T.whiteFull ? ease((t - T.whiteAt) / (T.whiteFull - T.whiteAt)) ** 1.4 : t < T.downAt ? 1 : 0;
  const down = t < T.downAt ? (t < T.whiteFull ? 0 : 1) : 1 - clamp01((t - T.downAt) / (T.revealAt - T.downAt));
  const slam = t < T.crackAt ? 0 : Math.max(0, 1 - (t - T.crackAt) / 900);
  // (The book's own glow: up as it opens, held on, dying as the boards settle, as today's light does.)
  const glow = pages * (1 - clamp01((t - (T.growAt + T.growMs - 300)) / 500)) * (t >= T.pickupAt ? 0 : 1);
  return { pages: glow, rays, shaft, grow, shoot, radiate, white, down, slam };
}
/** Behind him: the dark coming down round the light, the pool on the board, the rays along it and up out of the book, the shaft. */
function drawBack(g: CanvasRenderingContext2D, t: number, bx: number, by: number, bw: number, W: number, H: number) {
  const L = light();
  const s = lightNow(t);
  const lit = Math.max(s.rays, s.shaft * 0.8);
  const k = bw / 8; // a square
  const gr = 1 + s.grow;
  if (lit > 0) {
    g.fillStyle = `rgba(16,10,30,${(0.32 + 0.22 * s.grow) * ease(lit)})`;
    g.fillRect(0, 0, W, H);
  }
  g.save();
  g.globalCompositeOperation = "lighter";
  g.imageSmoothingEnabled = true;
  const since = t - TB.burstAt;
  const pool = Math.max(s.pages * 0.45, s.rays, s.slam * 0.8);
  if (pool > 0) {
    const r = k * (1.6 + 1.1 * s.rays + 2.4 * s.grow) * (1 + 0.03 * Math.sin(t / 160));
    g.globalAlpha = Math.min(1, 0.55 * pool * (1 + 0.6 * s.grow));
    g.drawImage(L.pool, bx - r, by - r * 0.42, r * 2, r * 0.84);
  }
  if (s.rays > 0) {
    // Along the board, out from the book (flattened, as the board under his feet is), longer as the light grows.
    const spin = t / 5200;
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + spin + (dice(i, 1) - 0.5) * 0.3;
      const shot = easeOut((since - i * 28) / 340) * s.rays;
      const far = k * (0.5 + (1.6 + 1.4 * dice(i, 2)) * shot * (1 + 1.8 * s.grow));
      const wide = k * (0.3 + 0.3 * dice(i, 3)) * gr;
      const ca = Math.cos(a);
      const sa = Math.sin(a) * 0.42;
      streak(g, L.gold, bx + ca * k * 0.4, by + sa * k * 0.4, bx + ca * far, by + sa * far, -sa * wide * 2, ca * wide * 0.84, 0.5 * s.rays * gr * (0.75 + 0.25 * Math.sin(t / 150 + i * 2.1)));
    }
    // Up and outward from the pages: each leans away from the middle, turning slowly, shimmering; more and longer as it grows.
    const n = 13 + Math.round(10 * s.grow);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - spin * 1.6 + (dice(i, 4) - 0.5) * 0.25;
      const lean = 0.3 + 0.55 * dice(i, 5) + 0.04 * Math.sin(t / 300 + i);
      const shot = easeOut((since - 60 - (i % 13) * 34) / 300) * s.rays;
      const len = k * (2.6 + 2.4 * dice(i, 6)) * shot * (0.9 + 0.1 * Math.sin(t / 170 + i * 1.3)) * (1 + 1.6 * s.grow);
      const ox = Math.cos(a) * k * 0.3;
      const oy = Math.sin(a) * k * 0.12;
      const x1 = bx + ox + Math.cos(a) * len * Math.sin(lean);
      const y1 = by + oy + Math.sin(a) * len * Math.sin(lean) * 0.42 - len * Math.cos(lean);
      const lx = x1 - bx - ox;
      const ly = y1 - by - oy;
      const ll = Math.hypot(lx, ly) || 1;
      const shimmer = 0.72 + 0.28 * Math.sin(t / 110 + i * 1.9);
      const wd = k * (0.4 + 0.35 * dice(i, 7)) * gr;
      streak(g, L.gold, bx + ox, by + oy, x1, y1, (-ly / ll) * wd * 1.7, (lx / ll) * wd * 1.7, 0.4 * s.rays * shimmer);
      streak(g, L.ray, bx + ox, by + oy, x1, y1, (-ly / ll) * wd * 0.6, (lx / ll) * wd * 0.6, 0.8 * s.rays * shimmer);
    }
  }
  // The shaft standing on the book, up through him: wide and soft (behind him); wider as it grows, then up off the screen.
  if (s.shaft > 0) {
    const tall = k * 6.2 * s.shaft + (by + H * 0.3) * s.shoot;
    streak(g, L.shaft, bx, by, bx, by - tall, k * 2.1 * (1 + 1.3 * s.grow), 0, Math.min(1, 0.42 * s.shaft * (1 + s.grow)));
  }
  // The pages, blazing.
  if (s.pages > 0) {
    const gs = k * (0.9 + 0.08 * Math.sin(t / 120)) * (1 + 0.6 * s.rays + s.grow);
    g.globalAlpha = Math.min(1, 0.55 * s.pages);
    g.drawImage(L.glow, bx - gs, by - gs * 0.62, gs * 2, gs * 1.24);
  }
  g.restore();
}
/**
 * Over him: the bright core of the beam and the motes in it; the glow engulfing him; the light radiating out over the whole
 * screen; his white eyes' glow; the white-out; the light dying back into the center; the slam's flash.
 */
function drawFront(g: CanvasRenderingContext2D, t: number, bx: number, by: number, bw: number, W: number, H: number, mid: { x: number; y: number }, eyes: readonly { x: number; y: number }[]) {
  const L = light();
  const s = lightNow(t);
  const k = bw / 8;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.imageSmoothingEnabled = true;
  if (s.shaft > 0) {
    const tall = k * 5.8 * s.shaft + (by + H * 0.3) * s.shoot;
    streak(g, L.shaft, bx, by, bx, by - tall, k * 1.1 * (1 + 1.8 * s.grow), 0, Math.min(1, 0.38 * s.shaft * (0.9 + 0.1 * Math.sin(t / 90)) * (1 + 1.4 * s.grow)));
    g.fillStyle = "#fff6cf";
    const motes = 26 + Math.round(30 * s.grow);
    for (let i = 0; i < motes; i++) {
      const up = ((t / ((900 + 700 * dice(i, 8)) * (1 - 0.5 * s.grow)) + dice(i, 9)) % 1) * 5.6 * s.shaft;
      g.globalAlpha = s.shaft * (1 - up / 5.7) * 0.9;
      const sz = Math.max(1.5, k * (0.04 + 0.03 * dice(i, 12)));
      g.fillRect(bx + (dice(i, 10) - 0.5) * k * 1.3 * (1 + s.grow) - sz / 2, by - up * k - sz / 2, sz, sz);
    }
  }
  // His eyes, white and glowing, from the moment the light takes him.
  if (eyes.length && t >= TB.burstAt && t < TB.whiteFull) {
    const e = Math.min(1, (t - TB.burstAt) / 200) * (0.85 + 0.15 * Math.sin(t / 70));
    for (const p of eyes) {
      const r = k * (0.22 + 0.1 * s.grow);
      g.globalAlpha = e;
      g.drawImage(L.glow, p.x - r, p.y - r, r * 2, r * 2);
    }
  }
  // Engulfing him: a glow round him that grows till he's lost in it.
  if (s.grow > 0) {
    const gs = k * (1.2 + 5 * s.grow);
    g.globalAlpha = Math.min(1, 1.3 * s.grow);
    g.drawImage(L.glow, mid.x - gs, mid.y - gs * 1.3, gs * 2, gs * 2.6);
  }
  // Radiating out in every direction over the whole screen, turning slowly.
  const reach = Math.hypot(W, H);
  const rad = Math.max(s.radiate, s.down * 0.9);
  if (rad > 0) {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t / 3000 + (dice(i, 20) - 0.5) * 0.2;
      const len = reach * (0.35 + 0.65 * Math.min(1, s.radiate * 1.4) * (0.7 + 0.3 * dice(i, 21))) * (s.down > 0 ? s.down ** 1.5 : 1);
      const x1 = mid.x + Math.cos(a) * len;
      const y1 = mid.y + Math.sin(a) * len;
      const wd = k * (0.5 + 1.2 * rad) * (0.6 + 0.6 * dice(i, 22));
      streak(g, L.ray, mid.x, mid.y, x1, y1, -Math.sin(a) * wd, Math.cos(a) * wd, rad * (0.55 + 0.25 * Math.sin(t / 90 + i)));
    }
  }
  // Dying back into the center: the light drawn in to a point (the glow left at its core).
  if (s.down > 0) {
    const gs = k * 0.4 + reach * 0.9 * s.down ** 2;
    g.globalAlpha = Math.min(1, 1.2 * s.down);
    g.drawImage(L.glow, mid.x - gs, mid.y - gs, gs * 2, gs * 2);
  }
  if (s.slam > 0) {
    const gs = k * (1 + 2.5 * (1 - s.slam));
    g.globalAlpha = Math.min(1, 0.8 * s.slam);
    g.drawImage(L.glow, bx - gs, by - gs * 0.45, gs * 2, gs * 0.9);
  }
  g.restore();
  // The white-out: the whole screen. Then it dies back: a disc of white shrinking into the center, a soft edge, gone at the reveal.
  if (s.white > 0) {
    g.globalAlpha = s.white;
    g.fillStyle = "#fffdf6";
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  } else if (s.down > 0) {
    const r = reach * s.down ** 1.6 + 1;
    const grad = g.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, r);
    grad.addColorStop(0, "rgba(255,253,246,1)");
    grad.addColorStop(0.5, `rgba(255,250,230,${Math.min(1, 0.4 + s.down).toFixed(3)})`);
    grad.addColorStop(1, "rgba(255,244,210,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }
}

/** The arcs strike from his raised hands: up a moment after he lands (the landing's frame, then chantRaise's first). */
const ARC_DELAY = 200;
function Arcs({ t, hands }: { t: number; hands: readonly (readonly [number, number])[] }) {
  const tt = t - TB.d - ARC_DELAY; // today's arcs, shifted to the new crack, and to his hands up after the landing
  const live = ARC_STRIKES.filter((s) => tt >= s.at && tt < s.at + ARC_LIFE);
  let pulse = 0;
  for (const s of live) pulse = Math.max(pulse, (s.big ? 1 : 0.55) * (1 - (tt - s.at) / ARC_LIFE));
  const shape = (s: ArcStrike, from: readonly [number, number], redraw: number) => smoothPath(arcPoints(from, s.to, s.seed * 31 + redraw, 4, s.big ? 0.13 : 0.16));
  return (
    <>
      <span class="rc-zap" style={{ opacity: String(pulse.toFixed(3)) }} />
      <svg class="rc-arcs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {live.map((s) => {
          const age = tt - s.at;
          const o = age < 40 ? 1 : Math.pow(1 - (age - 40) / (ARC_LIFE - 40), 1.6);
          const main = shape(s, hands[s.hand]!, Math.floor(age / ARC_REDRAW));
          const w = s.big ? 1.3 : 1;
          return (
            <g key={`${s.at}:${s.hand}`} opacity={o.toFixed(3)}>
              <circle class="rc-arc-hit" cx={s.to[0]} cy={s.to[1]} r={(2.4 + 3.6 * (age / ARC_LIFE)) * w} />
              <path class="rc-arc-glow2" d={main} stroke-width={3.2 * w} />
              <path class="rc-arc-glow" d={main} stroke-width={1.3 * w} />
              <path class="rc-arc-core" d={main} stroke-width={0.45 * w} />
            </g>
          );
        })}
      </svg>
    </>
  );
}

const QUARTER_BOARD = [1, 2, 0, 3] as const;
function quarterStyle(q: number, t: number, desk: boolean): Record<string, string> {
  const right = q % 2 === 1;
  const bottom = q >= 2;
  const part = ease((t - TB.partAt) / (TB.growAt - TB.partAt));
  const grow = ease((t - TB.growAt) / TB.growMs);
  const gap = (1 - grow) * part * 3;
  const scale = 1 - (1 - (desk ? 0.445 : 0.48)) * grow;
  const down = desk && !bottom ? 4.6 * grow : 0;
  const half = 50 * (1 - grow);
  return {
    clipPath: `inset(${bottom ? half : 0}% ${right ? 0 : half}% ${bottom ? 0 : half}% ${right ? half : 0}%)`,
    transformOrigin: `${right ? "100%" : "0"} ${bottom ? "100%" : "0"}`,
    transform: `translate(${right ? gap : -gap}%, ${bottom ? gap : down - gap}%) scale(${scale})`,
  };
}

function Transform({ at, board, fen, pre }: { at: number; board: HTMLElement; fen: string; pre: { lastAt: number; lastUntil: number; standAt: number } }) {
  const now = useFrameNow();
  const T = TB;
  const t = now - at;
  const rect = board.getBoundingClientRect();
  const desk = innerWidth >= 900;
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const headAt = useRef<readonly [number, number] | null>(null);
  const [fens] = useState(() => [0, 1, 2, 3].map((i) => chess960Fen([212, 77, 518 - 9, 333][i]!)));
  const lines = RECLUSE_CUTSCENE_LINES;
  const last = lines.at(-1)!;
  // (Pre-roll: the cutscene's last line, its time as the cutscene's.)
  const sceneT = pre.lastUntil + 400 + t; // the cutscene's own clock
  const lastBox = recluseCutsceneTimeline().boxes.at(-1)!;
  const kidTalking = sceneT >= lastBox.at && sceneT < lastBox.typed;
  const fig = manAt(t, { kidTalking, standAt: pre.standAt - pre.lastUntil - 400 }, desk);
  const W = innerWidth;
  const H = innerHeight;
  const bw = rect.width;
  const bx = rect.x + BOOK_MID.x * bw;
  const by = rect.y + BOOK_MID.y * bw;
  // (The big board is gone from the crack's first frame: only the four quarters show from then on. Eric, Nov 14.)
  useLayoutEffect(() => {
    board.style.visibility = t >= T.crackAt ? "hidden" : "";
  });
  useLayoutEffect(() => {
    const feet = fig?.feet ?? SPOT;
    const chest = onBoard(feet, RECLUSE.foot[0], RECLUSE.foot[1] - 70);
    const mid = t < T.whiteFull ? { x: rect.x + chest.x * bw, y: rect.y + chest.y * bw } : { x: rect.x + CHEST().x * bw, y: rect.y + CHEST().y * bw };
    const h = headAt.current;
    const eyes = h ? [onBoard(feet, h[0] + 9, h[1] + 18.5), onBoard(feet, h[0] + 16, h[1] + 18.5)].map((p) => ({ x: rect.x + p.x * bw, y: rect.y + p.y * bw })) : [];
    for (const [c, f] of [[back.current, "b"], [front.current, "f"]] as const) {
      if (!c) continue;
      const dpr = devicePixelRatio || 1;
      if (c.width !== Math.round(W * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      if (f === "b") drawBack(g, t, bx, by, bw, W, H);
      else drawFront(g, t, bx, by, bw, W, H, mid, eyes);
    }
  });
  // His first line after the reveal, in a cutscene box over his head; his second after the landing, in his bubble.
  const l1 = { who: "man" as const, say: RECLUSE_LINES.chantSay[0]! };
  const typeMs = CS.typeMs;
  const l1Typed = l1.say.reduce((s, x) => s + x.length * typeMs, 0) + CS.sentencePauseMs;
  const l1Text = l1.say.join(" ");
  const l1Until = Math.min(T.flipDownAt - 50, T.line1At + l1Typed + Math.min(CS.maxReadMs, CS.readMs + CS.perCharMs * l1Text.length) + CS.boxFadeMs);
  const said = useRef(false);
  useLayoutEffect(() => {
    if (t >= T.line2At && !said.current) {
      said.current = true;
      bossVoice.unhush();
      const pace = RECLUSE_PHASE2.change.chantLines;
      bossVoice.sayPaced(pacedLine(RECLUSE_LINES.chantSay[1]!, { ...pace, fadeMs: pace.fadeMs }), `lab:l2:${at}`, CRITICAL, at + T.line2At);
    }
  });
  const lens = t < T.whiteFull ? 1 : 0;
  const kid = t < T.whiteFull ? { anim: kidTalking ? "kidTalk" : "together", since: pre.standAt - pre.lastUntil - 400 } : null;
  const head = HEAD_UP();
  const px = (x: number) => `${x * 100}%`;
  const figStyle = (feet: { x: number; y: number }) => ({ left: px(feet.x - (FIG * RECLUSE.foot[0]) / RECLUSE.w), top: `${(feet.y - (FIG * RECLUSE.foot[1]) / RECLUSE.w) * bw}px`, width: px(FIG), aspectRatio: `${RECLUSE.w} / ${RECLUSE.h}` });
  const split = t >= T.crackAt;
  const cracking = t >= T.crackAt && t < T.growAt;
  const lastShown = sceneT >= lastBox.at && sceneT < lastBox.until;
  const bookApart = t >= T.riseAt && t < T.crackAt + 90;
  return createPortal(
    <div class="cs-layer lab-transform" data-t={Math.round(t)}>
      <div class="cs-stage rc-stage" style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${bw}px`, height: `${bw}px`, containerType: "inline-size" }}>
        {QUARTER_BOARD.map((id, q) => (
          <div key={q} class={`rc-cell rc-split rc-q${q}`} style={split ? quarterStyle(q, t, desk) : {}}>
            <Board fen={t >= T.shuffleAt ? fens[id]! : fen} orientation="white" silent />
          </div>
        ))}
      </div>
      <div class="cs-dim" style={{ opacity: String(lens), "--cs-x": `${rect.x + bw / 2}px`, "--cs-y": `${rect.y + bw / 2}px`, "--cs-r": `${bw * CS.spot}px`, "--cs-in": `${CS.spotInner * 100}%`, "--cs-a": String(CS.dimAlpha) }} />
      <canvas ref={back} style={{ position: "fixed", inset: 0, width: `${W}px`, height: `${H}px` }} />
      <div class="cs-stage" style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${bw}px`, height: `${bw}px` }}>
        {cracking && (
          <>
            <span class="rc-crack">
              <SpriteAnim ch={EFFECTS.boardGap.ch} anim={t < T.partAt ? "run" : "part"} then="gap" since={at + (t < T.partAt ? T.crackAt : T.partAt)} id="lab-v" />
            </span>
            <span class="rc-crack rc-crack-h">
              <SpriteAnim ch={EFFECTS.boardGap.ch} anim={t < T.partAt ? "run" : "part"} then="gap" since={at + (t < T.partAt ? T.crackAt : T.partAt)} id="lab-h" />
            </span>
          </>
        )}
        {kid && (
          <span class="cs-fig" style={{ left: px(SCENE_LEFT), top: `${(GROUND_Y - (SCENE_SHARE * RECLUSE_CUTSCENE.foot[1]) / RECLUSE_CUTSCENE.w) * bw}px`, width: px(SCENE_SHARE), aspectRatio: `${RECLUSE_CUTSCENE.w} / ${RECLUSE_CUTSCENE.h}` }}>
            <SpriteAnim ch={KID} anim={kid.anim} since={at + kid.since} id="lab-kid" />
          </span>
        )}
        {bookApart && (
          <span class="cs-fig" style={figStyle(SPOT)}>
            <SpriteAnim ch={BOOK} anim="glow" since={at + T.riseAt} id="lab-book" />
          </span>
        )}
        {fig && (
          <span class="cs-fig rc-fig-lab" style={{ ...figStyle(fig.feet), zIndex: 7 }}>
            <SpriteAnim
              ch={MAN}
              anim={fig.anim}
              then={fig.then}
              since={at + fig.since}
              id="lab-man"
              onFrame={(f) => {
                headAt.current = headOf(f);
              }}
            />
          </span>
        )}
        {lastShown && (
          <span class="cs-anchor cs-kid" style={{ left: px(SCENE_LEFT + (CUTSCENE_SPOTS.kid.x / RECLUSE_CUTSCENE.w) * SCENE_SHARE), top: `${(GROUND_Y - (SCENE_SHARE * (RECLUSE_CUTSCENE.foot[1] - CUTSCENE_SPOTS.kid.head)) / RECLUSE_CUTSCENE.w) * bw - 14}px` }}>
            <SpeechBox class="bc-bubble cs-say" text={lastBox.text} at={at + lastBox.at - sceneT + t} until={at + lastBox.until - sceneT + t} now={now} typed={cutTyped(last, lastBox, sceneT)} fits={1} />
            <span class="cs-tail" />
          </span>
        )}
        {t >= T.line1At && t < l1Until && (
          <span class="cs-anchor cs-man" style={{ left: px(head.x), top: `${head.y * bw - 34}px` }}>
            <SpeechBox class="bc-bubble cs-say" text={l1Text} at={at + T.line1At} until={at + l1Until} now={now} typed={cutTyped(l1, { who: "man", text: l1Text, at: T.line1At, starts: [T.line1At, T.line1At + l1.say[0]!.length * typeMs + CS.sentencePauseMs], typed: T.line1At + l1Typed, until: l1Until }, t)} fits={1} />
            <span class={`cs-tail${l1Until - t < CS.boxFadeMs ? " leaving" : ""}`} />
          </span>
        )}
        {t >= T.crackAt && t < T.growAt + ARC_DELAY + T.growMs + ARC_LIFE && <Arcs t={t} hands={HANDS()} />}
        {t >= T.bannerAt && <FightBanner text="PHASE 2" sub="Win all four boards" tone="boss" ms={T.bannerMs} />}
      </div>
      <canvas ref={front} style={{ position: "fixed", inset: 0, width: `${W}px`, height: `${H}px`, zIndex: 8 }} />
    </div>,
    document.body,
  );
}

const LAB_STYLE =
  ".boss-char canvas, .boss-char > .bc-engine { visibility: hidden !important; } .lab-transform .rc-fig-lab > .fx-sprite, .lab-transform .cs-fig > .fx-sprite, .lab-closeup .fx-sprite { display:block; width:100%; height:100%; image-rendering: pixelated; } .lab-transform .rc-fig-lab .bc-engine, .lab-closeup .bc-engine { position:absolute; inset:0; }";

/** Plays it over the biggest board on screen; returns the times (ms from the call) of each beat. `pre`: ms of the cutscene's last line shown first. */
export function playTransform(): { at: number; t0: number; tb: typeof TB } {
  const boards = [...document.querySelectorAll<HTMLElement>(".board-wrap")].filter((b) => b.offsetParent);
  const board = boards.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]!;
  const style = document.createElement("style");
  // (His place stands empty: he's on the board, as in the cutscene and the phase change.)
  style.textContent = LAB_STYLE;
  document.head.appendChild(style);
  const tl = recluseCutsceneTimeline();
  const lastBox = tl.boxes.at(-1)!;
  // T0 (the book opening) comes 400 ms after the last box is gone; the GIF starts as that line starts typing.
  const preMs = lastBox.until + 400 - lastBox.at;
  const at = Date.now() + preMs;
  bossVoice.hush(at + TB.line2At - 100);
  kingVoice.hush(at + TB.endAt);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const fen = (window as unknown as { match: { phase: { board: { fen: string } } } }).match.phase.board.fen;
  document.body.classList.add("cs-on");
  render(<Transform at={at} board={board} fen={fen} pre={{ lastAt: lastBox.at, lastUntil: lastBox.until, standAt: tl.standAt }} />, host);
  return { at, t0: preMs, tb: TB };
}

/** The suit up close: his head and shoulders (`whole`: all of him), big, on a dark backdrop, the visor flipping up and down. */
export function showCloseup(whole = false): void {
  const style = document.createElement("style");
  style.textContent = LAB_STYLE;
  document.head.appendChild(style);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const at = Date.now();
  // (Whole: his figure 90% of the height; else his head about 37% of the width.)
  const w = whole ? (innerHeight * 0.9 * RECLUSE.w) / RECLUSE.h : Math.min(innerWidth, innerHeight) * 1.5;
  const top = whole ? innerHeight * 0.05 : innerHeight * 0.1 - w * (10 / RECLUSE.w);
  render(
    <div class="lab-closeup" style={{ position: "fixed", inset: 0, zIndex: 50, background: "radial-gradient(circle at 50% 35%, #3a3450, #14111e 70%)", overflow: "hidden" }}>
      <span style={{ position: "absolute", left: `${innerWidth / 2 - w * (RECLUSE.foot[0] / RECLUSE.w)}px`, top: `${top}px`, width: `${w}px`, aspectRatio: `${RECLUSE.w} / ${RECLUSE.h}` }}>
        <SpriteAnim ch={MAN} anim="flipCycle" since={at} id="lab-close" />
      </span>
    </div>,
    host,
  );
}
