/**
 * The Colosseum drawn with WebGL 2 (Oct 30, the first look; docs/decisions/2026-10-30-colosseum-look.md). Its own small
 * renderer beside the town's paint-gl.ts, not built on it: paint-gl.ts stands in for a 2D canvas (flat, no depth, a frame
 * recorded call by call), and the arena is a real place in 3D seen from ten spots, its crowd thousands strong. So:
 *
 * - **The arena** (the floor, the board and its border, the wall, the stands, the aisles, the gallery): one vertex buffer
 *   built once, one draw call.
 * - **The crowd**: every seat's person one instance of one quad (its place, its picture's cell, which way it faces, its jump's
 *   delay and height), uploaded once and never again; one draw call. Each turns round its own upright axis to face you
 *   (pictures have no sides); one whose front faces away from you is drawn **from behind**: its own picture mirrored and
 *   darkened toward a shadow, so a hat's outline reads but no face looks back at you (no item has back art). The arena's
 *   standing figures ride in the same draw (uploaded once with the crowd): the torch pillars and the statues turning to
 *   face you, the banners flat on their walls; the pillars' flames and the banners' sway are their drawings' frames, picked
 *   on the GPU from the clock (nothing uploaded a frame).
 * - **The props** (the big pieces): instances too, one draw call, uploaded again only when a move is made (the slide itself
 *   is worked out on the GPU from when it began).
 *
 * - **The 3D pieces** (the gear's Pieces: 3D; pieces3d.ts): the six meshes uploaded once, the pieces as instances written when
 *   a move is made, one draw call a kind on the board. With 2D the pieces are props, as above.
 * - **Pixel** (the gear's Pieces: Pixel, the default; since Nov 2 the art session's models, pieces-gba.ts): the arena and the
 *   crowd full size as in 3D and 2D; each piece a sprite drawn from its model for your seat's pitch (when the view changes,
 *   never a frame), farther ones at a smaller share, laid on one texel an art pixel (`pixelScale` screen pixels), its foot on
 *   an art pixel, so it's crisp and still as it slides. One draw call.
 *
 * Three draw calls a frame with 2D; eight with 3D (the arena, the crowd and one a kind: the props then have nothing to draw);
 * three with Pixel (the arena, the crowd, the sprites). A frame sets a few uniforms (the camera, the time, the jump's clock) and draws:
 * nothing is allocated and nothing uploaded. The crowd jumps (a queen captured) by a uniform too.
 */
import { BANNERS, BOARD, FLOOR_R, bossSeats, project, type Seat, GALLERY_H, GALLERY_R, PILLARS, PILLAR_ANGLES, SEATING, STANDS, STATUE, WALL_H, WALL_TOP, aisleAngle, fovFor, landingDepth, lookAt, multiply, perspective, rowR, rowY, seatR, seats, squareXZ, VIEWS, type View } from "./arena.ts";
import { FIGURE_STRIDE, PILLAR_TOP_PX, PROPS, SCENE, SEAT_SINK, SKY, SQUARES, STANDS_SEATS, STONE, type CrowdArt, type Figure, type Rect } from "./art.ts";
import { EYE, KINDS, KNIGHT_TURN, PV, SIZE, SLIT, pieceMeshes, type Kind, type PieceMesh } from "./pieces3d.ts";
import { FRAME as GBA_FRAME, MODELS as GBA_MODELS, PALETTE as GBA_PALETTE, drawModel } from "./pieces-gba.ts";

const VS_SCENE = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aCol;
uniform mat4 uVP;
out vec2 vUV;
out vec4 vCol;
void main() {
  vUV = aUV;
  vCol = aCol;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;
const FS_SCENE = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vUV;
in vec4 vCol;
out vec4 o;
void main() {
  o = vec4(texture(uTex, vUV).rgb * vCol.rgb, 1.0);
}`;

/**
 * A sprite: one quad (corner x -0.5 to 0.5, y 0 to 1) a person, figure or prop. Per instance: where its feet are and how tall
 * its picture is; its cell; its width, the way its front faces (-99: none), its jump's delay (a loop's phase, in frames) and
 * height; where a slide began and when, its loop (frames + each frame's seconds: 5.12 is five frames of 0.12 s; 0: none);
 * its feet down the cell, when it goes (a captured piece), and a flat figure's facing (the angle + 10: a banner on its wall;
 * 0: turns to face you).
 */
const VS_SPRITE = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iPos;
layout(location=2) in vec4 iRect;
layout(location=3) in vec4 iA;
layout(location=4) in vec4 iB;
layout(location=5) in vec4 iC;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uTime;
uniform float uJump;
uniform float uSlide;
out vec2 vUV;
out float vBack;
void main() {
  vec3 p = iPos.xyz;
  float h = iPos.w;
  float w = iA.x;
  if (uTime >= iC.z) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float s = clamp((uTime - iB.z) / uSlide, 0.0, 1.0);
  s = s * s * (3.0 - 2.0 * s);
  p.xz = mix(iB.xy, p.xz, s);
  p.y += sin(3.14159 * s) * 0.35 * step(0.001, distance(iB.xy, iPos.xz));
  float j = uJump - iA.z;
  if (j > 0.0 && j < 0.9) p.y += iA.w * abs(sin(3.14159 * j / 0.45));
  vec4 r = iRect;
  if (iB.w > 1.5) r.xz += mod(floor(uTime / fract(iB.w)) + iA.z, floor(iB.w)) * ${FIGURE_STRIDE.toFixed(6)};
  vec2 toEye = uEye.xz - p.xz;
  float d = length(toEye);
  // (Your own seat: whoever sits where your eye is isn't drawn.)
  if (d < 0.5 && abs(uEye.y - p.y) < 1.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 dir = toEye / max(d, 0.0001);
  vec3 right = iC.w > 5.0 ? vec3(-cos(iC.w - 10.0), 0.0, sin(iC.w - 10.0)) : vec3(dir.y, 0.0, -dir.x);
  vBack = iA.y < -50.0 ? 0.0 : smoothstep(0.15, -0.15, dot(vec2(sin(iA.y), cos(iA.y)), dir));
  // The rows in front of your seat (their backs to you, below you): only the one just in front, smaller and lower (the tops of
  // their heads, as Eric's mockup); the rows below it aren't drawn, so they don't cover the arena.
  // (Not from a high view: its eye floats far above the stands, and the rows under it aren't in front of a seat.)
  if (vBack > 0.5 && p.y < uEye.y - 0.4 && uEye.y - p.y < 6.0 && d < 6.0) {
    if (d > 1.7) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    h *= 0.75; w *= 0.75; p.y -= 0.12;
  }
  float cx = vBack > 0.5 ? -aCorner.x : aCorner.x;
  vUV = vec2(mix(r.x, r.z, cx + 0.5), mix(r.w, r.y, aCorner.y));
  vec3 world = p + right * (aCorner.x * w) + vec3(0.0, (aCorner.y - (1.0 - iC.x)) * h, 0.0);
  gl_Position = uVP * vec4(world, 1.0);
}`;
const FS_SPRITE = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vUV;
in float vBack;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUV);
  if (c.a < 0.5) discard;
  vec3 col = c.rgb / max(c.a, 0.001);
  o = vec4(mix(col, col * 0.34 + vec3(0.07, 0.06, 0.08), vBack), 1.0);
}`;

/**
 * The 3D pieces (the gear's Pieces: 3D; pieces3d.ts): one mesh a kind, one instance a piece (where it stands, where its slide began,
 * when, when it goes, its color). Each turns round its upright axis to face you, as the flat pieces did (a knight shows its
 * profile, a bishop its slit), slides and hops as they did, and is lit from the arena's sun (the a-file and White's end, high),
 * with a soft fill from your side and a little shine. Its shadow, a soft disc on the board, is drawn with it.
 */
const VS_PIECE = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in float aMat;
layout(location=3) in vec4 iA;
layout(location=4) in vec4 iB;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uTime;
uniform float uSlide;
uniform float uLift;
out vec3 vN;
out vec3 vW;
out vec3 vObj;
out float vMat;
out float vBlack;
void main() {
  vMat = aMat;
  vBlack = iB.z;
  vObj = aPos / ${SIZE.toFixed(4)};
  if (uTime >= iB.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float s = clamp((uTime - iB.x) / uSlide, 0.0, 1.0);
  s = s * s * (3.0 - 2.0 * s);
  vec2 xz = mix(iA.zw, iA.xy, s);
  float hop = sin(3.14159 * s) * 0.35 * step(0.001, distance(iA.zw, iA.xy));
  vec2 d = uEye.xz - xz;
  d /= max(length(d), 0.0001);
  vec3 R = vec3(d.y, 0.0, -d.x);
  vec3 F = vec3(d.x, 0.0, d.y);
  vec3 w;
  if (aMat > 2.5 && aMat < 3.5) {
    // The shadow: flat on the board, a little away from the sun, not lifted by the hop.
    w = vec3(xz.x + aPos.x + 0.035, uLift + 0.006, xz.y + aPos.z - 0.055);
    vN = aNrm;
  } else {
    w = vec3(xz.x, uLift + hop, xz.y) + R * aPos.x + vec3(0.0, aPos.y, 0.0) + F * aPos.z;
    vN = R * aNrm.x + vec3(0.0, aNrm.y, 0.0) + F * aNrm.z;
  }
  vW = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
const FS_PIECE = `#version 300 es
precision highp float;
uniform vec3 uEye;
in vec3 vN;
in vec3 vW;
in vec3 vObj;
in float vMat;
in float vBlack;
out vec4 o;
const vec3 IVORY = vec3(0.93, 0.87, 0.74);
const vec3 EBONY = vec3(0.15, 0.15, 0.18);
const vec3 GOLD = vec3(0.86, 0.64, 0.24);
const vec3 SUN = vec3(-0.43, 0.75, 0.5);
void main() {
  if (vMat > 2.5 && vMat < 3.5) { o = vec4(0.12, 0.08, 0.04, vN.x * 0.55); return; }
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vW);
  vec3 L = normalize(SUN);
  vec3 base = mix(IVORY, EBONY, vBlack);
  float spec = mix(0.22, 0.35, vBlack);
  float shine = 22.0;
  if (vMat > 0.5 && vMat < 1.5) { base = GOLD; spec = 0.55; shine = 30.0; }
  // The bishop's slit: a groove across the mitre's front (pieces3d.ts SLIT).
  if (vMat > 1.5 && vMat < 2.5) {
    float g = abs(vObj.x * ${SLIT.k.toFixed(3)} + vObj.y - ${SLIT.c.toFixed(3)}) * ${(1 / Math.hypot(SLIT.k, 1)).toFixed(4)};
    float m = (1.0 - smoothstep(${SLIT.w.toFixed(3)}, ${(SLIT.w * 1.6).toFixed(3)}, g)) * smoothstep(0.0, 0.07, vObj.z);
    base = mix(base, mix(vec3(0.24, 0.17, 0.12), vec3(0.02), vBlack), m);
  }
  // The knight's eye (pieces3d.ts EYE), on both sides of its head.
  if (vMat > 3.5) {
    vec2 e = vec2(${EYE.x.toFixed(3)}, ${EYE.y.toFixed(3)});
    vec2 p = vec2(vObj.x * ${Math.cos(KNIGHT_TURN).toFixed(4)} - vObj.z * ${Math.sin(KNIGHT_TURN).toFixed(4)}, vObj.y);
    float m = 1.0 - smoothstep(${EYE.r.toFixed(3)}, ${(EYE.r * 1.4).toFixed(3)}, distance(p, e));
    base = mix(base, mix(vec3(0.2, 0.13, 0.08), GOLD, vBlack), m);
  }
  float key = max(dot(N, L), 0.0);
  float fill = max(dot(N, V), 0.0);
  float sky = 0.5 + 0.5 * N.y;
  vec3 c = base * (0.2 + 0.18 * sky + 0.72 * key + 0.22 * fill) + spec * pow(max(dot(N, normalize(L + V)), 0.0), shine) * vec3(1.0, 0.96, 0.88);
  o = vec4(c, 1.0);
}`;

/**
 * Pixel: farther pieces drawn smaller, as the picture's: each piece is drawn at a share of its size by how wide its square is
 * on screen against the square nearest you (1, 0.9, … 0.5: `buckets` steps of `step`), each share's sprites drawn ahead from
 * the model itself, so a smaller piece is as crisp, its outline still one pixel.
 */
export const GBA_SCALE = { step: 0.1, buckets: 6 } as const;
/**
 * Pixel's pieces (Nov 2; pieces-gba.ts, the art session's models): each a sprite drawn from its 3D model for your seat's
 * pitch, laid on the full-size arena one texel an art pixel (`pixelScale` screen pixels square), its foot on the art pixel
 * its square's middle (sliding: its place on the slide) falls in, so its pixels never change as it moves: crisp and still.
 * Far ranks first (the instances are written in that order), no depth: nothing in the arena stands over the board's pieces.
 * Per instance: where it stands and where its slide began, when the slide began and when it goes, and its cell in the atlas.
 */
const VS_GBA = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iA;
layout(location=2) in vec4 iB;
uniform mat4 uVP;
uniform float uTime;
uniform float uSlide;
uniform float uLift;
uniform float uScale;
uniform vec2 uRes;
uniform vec4 uFrame;
uniform vec2 uAtlas;
uniform vec3 uRight;
uniform float uNear;
uniform float uReady;
out vec2 vUV;
void main() {
  vUV = vec2(0.0);
  if (uTime >= iB.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float s = clamp((uTime - iB.x) / uSlide, 0.0, 1.0);
  s = s * s * (3.0 - 2.0 * s);
  vec2 xz = mix(iA.zw, iA.xy, s);
  float hop = sin(3.14159 * s) * 0.35 * step(0.001, distance(iA.zw, iA.xy));
  vec4 c = uVP * vec4(xz.x, uLift + hop, xz.y, 1.0);
  vec2 at = (c.xy / c.w * 0.5 + 0.5) * uRes;
  vec2 art = floor(at / uScale);
  // Smaller farther off: the square here against the one nearest you, in whole steps (GBA_SCALE), each drawn ahead.
  vec4 c2 = uVP * vec4(vec3(xz.x, uLift + hop, xz.y) + uRight, 1.0);
  float f = distance((c2.xy / c2.w * 0.5 + 0.5) * uRes, at) / uNear;
  float b = clamp(floor((1.0 - f) / ${GBA_SCALE.step.toFixed(3)} + 0.5), 0.0, uReady - 1.0);
  // (The sprite's rows run down from its top; its foot pixel (ax, ay) on that art pixel.)
  vec2 p = vec2(art.x - uFrame.z + (aCorner.x + 0.5) * uFrame.x, art.y + uFrame.w + 1.0 - (1.0 - aCorner.y) * uFrame.y);
  gl_Position = vec4(p * uScale / uRes * 2.0 - 1.0, 0.0, 1.0);
  vUV = (vec2(iB.z, b * 2.0 + iB.w) * uFrame.xy + vec2(aCorner.x + 0.5, 1.0 - aCorner.y) * uFrame.xy) / uAtlas;
}`;
const FS_GBA = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vUV;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUV);
  if (c.a < 0.5) discard;
  o = vec4(c.rgb, 1.0);
}`;

/**
 * Pixel: a board square near you is about this many art pixels across (`pixelScale`: whole screen pixels an art pixel, at
 * least 2, set when the view or the screen's size changes, never a frame): the size the art session drew the pieces for.
 */
export const SQUARE_ART_PX = 20;
/**
 * Pixel: the pitch the sprites are drawn at, a share of your seat's own (the high view behind White looks down 47 degrees,
 * its sprites drawn at 30, as the art session's mockups Eric approved), at most `max`; rounded to `step` so a seat's turn
 * doesn't redraw them.
 */
export const GBA_PITCH = { share: 30 / 47, max: 0.7, step: 0.02 } as const;
/** Pixel: the sprites' atlas, a column a kind (p n b r q k), two rows a share (White, then Black). */
const GBA_KINDS = ["p", "n", "b", "r", "q", "k"] as const;
export const GBA_ATLAS = { w: GBA_FRAME.w * 6, h: GBA_FRAME.h * 2 * GBA_SCALE.buckets } as const;
/** Floats a Pixel piece's instance. */
const PG = 8;

/** Pixel's sprite pitch (radians) for a view: a share of how far it looks down, rounded. */
export function gbaPitch(view: View): number {
  const dy = view.eye[1] - view.at[1];
  const p = Math.atan2(dy, Math.hypot(view.eye[0] - view.at[0], view.eye[2] - view.at[2])) * GBA_PITCH.share;
  return Math.min(GBA_PITCH.max, Math.max(0, Math.round(p / GBA_PITCH.step) * GBA_PITCH.step));
}

/**
 * Pixel's art pixel for a view through `vp` on a w × h screen (`scale`: whole screen pixels, at least 2), so the board square
 * nearest you (on the line from the board's middle toward your eye) is about SQUARE_ART_PX art pixels across; `near`: that
 * square's width on screen (pixels), what the farther pieces' shares are measured against.
 */
export function gbaArtPixel(vp: Float32Array, view: View, w: number, h: number): { scale: number; near: number } {
  const ex = view.eye[0];
  const ez = view.eye[2];
  const el = Math.hypot(ex, ez) || 1;
  const [nx, nz] = [(ex / el) * 3.5, (ez / el) * 3.5];
  const a = project(vp, nx - (ez / el) * 0.5, BOARD.lift, nz + (ex / el) * 0.5, w, h);
  const b = project(vp, nx + (ez / el) * 0.5, BOARD.lift, nz - (ex / el) * 0.5, w, h);
  const near = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 2 * SQUARE_ART_PX;
  return { scale: Math.max(2, Math.round(near / SQUARE_ART_PX)), near };
}

/**
 * One of Pixel's sprites (pieces-gba.ts, the art session's model drawn by its own `drawModel`) into the atlas's pixels (RGBA,
 * straight alpha) at its cell: `kind` 0 to 5 (p n b r q k), Black's or White's, at this pitch, its share `bucket` of its size.
 */
export function paintGba(atlas: Uint8Array, kind: number, black: boolean, pitch: number, bucket = 0): void {
  const m = GBA_MODELS[GBA_KINDS[kind]!];
  const f = 1 - bucket * GBA_SCALE.step;
  const shot = drawModel(f === 1 ? m : { inside: (x, y, z) => m.inside(x / f, y / f, z / f) }, black ? "b" : "w", pitch);
  const x0 = kind * GBA_FRAME.w;
  const y0 = (bucket * 2 + (black ? 1 : 0)) * GBA_FRAME.h;
  for (let y = 0; y < GBA_FRAME.h; y++)
    for (let x = 0; x < GBA_FRAME.w; x++) {
      const o = ((y0 + y) * GBA_ATLAS.w + x0 + x) * 4;
      const k = shot.keys[y]?.[x];
      const n = k ? parseInt(GBA_PALETTE[k]!.slice(1, 7), 16) : 0;
      atlas[o] = (n >> 16) & 255;
      atlas[o + 1] = (n >> 8) & 255;
      atlas[o + 2] = n & 255;
      atlas[o + 3] = k ? 255 : 0;
    }
}

/** Floats a scene vertex (position, uv, color) and a sprite instance (five vec4s). */
const SV = 9;
const SI = 20;
/** Props: the 32 pieces. */
const PIECES = 32;
const PROP_N = PIECES;
/** The 3D pieces: instance slots a kind (every piece of a kind fits, promotions too), floats an instance. */
const KIND_CAP = 32;
const PI3 = 8;
/** A slide's length (s). */
export const SLIDE_S = 0.45;
/** "Never" for a sprite's going (s). */
const NEVER = 1e9;

/** The arena's mesh, built once: triangles of [x, y, z, u, v, r, g, b, a]. */
export function buildScene(): Float32Array {
  const out: number[] = [];
  const v = (x: number, y: number, z: number, u: number, w: number, c: readonly number[], k: number) => out.push(x, y, z, u, w, (c[0]! / 255) * k, (c[1]! / 255) * k, (c[2]! / 255) * k, 1);
  const W = SCENE.white;
  const wu = (W.u0 + W.u1) / 2;
  const wv = (W.v0 + W.v1) / 2;
  const WHITE = [255, 255, 255] as const;
  /** A quad a, b, c, d (each [x, y, z]) in one color, or textured from `r` (a to b along u, from u0 to u1 of it; b to c down v). */
  const quad = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], col: readonly number[], k: number, r?: Rect, u0 = 0, u1 = 1) => {
    const U = (t: number) => (r ? r.u0 + (r.u1 - r.u0) * t : wu);
    const V = (t: number) => (r ? r.v0 + (r.v1 - r.v0) * t : wv);
    const P = [
      [a, U(u0), V(0)],
      [b, U(u1), V(0)],
      [c, U(u1), V(1)],
      [d, U(u0), V(1)],
    ] as const;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [p, uu, vv] = P[i]!;
      v(p[0]!, p[1]!, p[2]!, uu, vv, col, k);
    }
  };
  const at = (a: number, r: number, y: number) => [Math.sin(a) * r, y, Math.cos(a) * r];
  // (Seen from the middle, a growing angle runs to the left: the drawings round the ring are laid right to left, u from 1 to
  // 0, so they read as drawn, lit from the top left.)
  // The sun from the south-west, high: a wall facing it is lit, one facing away in shade.
  const sun = [-0.5, 0.8];
  const lit = (a: number) => 0.72 + 0.28 * Math.max(0, -(Math.sin(a) * sun[0]! + Math.cos(a) * sun[1]!));

  // The floor: arena-floor's flags out to the wall (a tile a meter, as the board's squares), laid flat over the whole disc.
  const N = 120;
  const S = SCENE.floor;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const p = [[0, 0], [Math.sin(a0) * FLOOR_R, Math.cos(a0) * FLOOR_R], [Math.sin(a1) * FLOOR_R, Math.cos(a1) * FLOOR_R]];
    for (const [x, z] of p) v(x!, 0, z!, S.u0 + (S.u1 - S.u0) * (x! / FLOOR_R / 2 + 0.5), S.v0 + (S.v1 - S.v0) * (z! / FLOOR_R / 2 + 0.5), WHITE, 1);
  }
  // The board: the squares, flush with its border's top (nothing stands above them to hide a square from a low seat); the
  // border (arena-floor's `side`, a tile a meter, its outer edge out; its corners `corner`, turned) and its outer faces.
  const sq = BOARD.half;
  const hb = BOARD.half + BOARD.rim;
  const y = BOARD.lift;
  for (let f = 0; f < 8; f++)
    for (let r = 0; r < 8; r++) {
      const x0 = f - 4;
      const z0 = 4 - r - 1;
      const col = (f + r) % 2 ? SQUARES.light : SQUARES.dark;
      quad([x0, y + 0.004, z0], [x0 + 1, y + 0.004, z0], [x0 + 1, y + 0.004, z0 + 1], [x0, y + 0.004, z0 + 1], col, 1);
    }
  // Each side: `o(t, s)` the point `t` meters along it and `s` out from the squares' edge (0 to the rim), on the top.
  const sides: { o: (t: number, s: number, h?: number) => number[]; k: number }[] = [
    { o: (t, s, h = y) => [t, h, sq + s], k: 1 },
    { o: (t, s, h = y) => [-t, h, -sq - s], k: 0.82 },
    { o: (t, s, h = y) => [sq + s, h, -t], k: 0.9 },
    { o: (t, s, h = y) => [-sq - s, h, t], k: 0.86 },
  ];
  for (const { o, k } of sides) {
    for (let t = -sq; t < sq; t++) quad(o(t, BOARD.rim), o(t + 1, BOARD.rim), o(t + 1, 0), o(t, 0), WHITE, k, SCENE.sideTop);
    // Its corner (at the side's far end: each corner once), and the outer face under the whole side, the corner's too.
    quad(o(sq, BOARD.rim), o(hb, BOARD.rim), o(hb, 0), o(sq, 0), WHITE, k, SCENE.corner, 1, 0);
    for (let t = -hb; t < hb - 1e-6; t += 1) {
      const t1 = Math.min(hb, t + 1);
      quad(o(t, BOARD.rim), o(t1, BOARD.rim), o(t1, BOARD.rim, 0), o(t, BOARD.rim, 0), WHITE, k * 0.92, SCENE.sideFace, 0, t1 - t);
    }
  }
  // The arena wall: arches all round (arena-wall: 24, five segments each), facing in; its top (the stands' parapet's coping).
  const A = 24;
  const segs = A * 5;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const k = lit((a0 + a1) / 2);
    const t = (i % 5) / 5;
    quad(at(a0, FLOOR_R, WALL_H), at(a1, FLOOR_R, WALL_H), at(a1, FLOOR_R, 0), at(a0, FLOOR_R, 0), WHITE, k, SCENE.arch, 1 - t, 0.8 - t);
    quad(at(a0, FLOOR_R + WALL_TOP, WALL_H), at(a1, FLOOR_R + WALL_TOP, WALL_H), at(a1, FLOOR_R, WALL_H), at(a0, FLOOR_R, WALL_H), WHITE, 0.94 + 0.06 * k, SCENE.wallTop, 1 - t, 0.8 - t);
  }
  // The stands (arena-stands): each row a riser and a step, cut a seat at a time so each seat's quarter of the slice (its
  // seat point in the middle, the bench's grooves either side) lies under the seat seats() puts there; the first row's riser
  // is the parapet on the wall's top. Each row's count starts at its first aisle, so a row's one seam lies under its stairs.
  for (let r = 0; r < STANDS.rows; r++) {
    const R0 = rowR(r);
    const R1 = R0 + STANDS.depth + landingDepth(r);
    const yTop = rowY(r);
    const yBot = r ? rowY(r - 1) : WALL_H;
    const n = Math.floor((Math.PI * 2 * seatR(r)) / SEATING.seatGap);
    const first = Math.ceil((aisleAngle(0) / (Math.PI * 2)) * n - (r % 2) * 0.5);
    for (let i = 0; i < n; i++) {
      const a0 = ((i + (r % 2) * 0.5 - 0.5) / n) * Math.PI * 2;
      const a1 = ((i + (r % 2) * 0.5 + 0.5) / n) * Math.PI * 2;
      const k = lit((a0 + a1) / 2);
      const q = ((((i - first) % n) + n) % n) % STANDS_SEATS;
      const u0 = 1 - q / STANDS_SEATS;
      const u1 = 1 - (q + 1) / STANDS_SEATS;
      quad(at(a0, R0, yTop), at(a1, R0, yTop), at(a1, R0, yBot), at(a0, R0, yBot), WHITE, k * 0.95, r ? SCENE.riser : SCENE.parapet, u0, u1);
      quad(at(a0, R1, yTop), at(a1, R1, yTop), at(a1, R0, yTop), at(a0, R0, yTop), WHITE, 0.9 + 0.1 * k, SCENE.stepTop, u0, u1);
    }
    for (let s = 0; s < SEATING.aisles; s++) {
      const a = aisleAngle(s);
      const h0 = SEATING.aisleHalf / R0;
      const h1 = SEATING.aisleHalf / R1;
      quad(at(a - h1, R1, yTop + 0.01), at(a + h1, R1, yTop + 0.01), at(a + h0, R0, yTop + 0.01), at(a - h0, R0, yTop + 0.01), STONE.pale, 0.97);
      // (Each step's nosing: a dark line at its front edge.)
      quad(at(a - h0, R0 + 0.06, yTop + 0.012), at(a + h0, R0 + 0.06, yTop + 0.012), at(a + h0, R0, yTop + 0.012), at(a - h0, R0, yTop + 0.012), STONE.shade, 1);
    }
  }
  // The gallery at the top: arena-wall's arches round (44, four segments each).
  const G = 44 * 4;
  const gy = rowY(STANDS.rows - 1);
  for (let i = 0; i < G; i++) {
    const a0 = (i / G) * Math.PI * 2;
    const a1 = ((i + 1) / G) * Math.PI * 2;
    const t = (i % 4) / 4;
    quad(at(a0, GALLERY_R, gy + GALLERY_H), at(a1, GALLERY_R, gy + GALLERY_H), at(a1, GALLERY_R, gy), at(a0, GALLERY_R, gy), WHITE, lit((a0 + a1) / 2), SCENE.arch, 1 - t, 0.75 - t);
  }
  return new Float32Array(out);
}

/**
 * Where each crowd member sits, its cell, which way it faces, its jump: the crowd's instances (built once). Every boss with
 * a sidekick sits once, its sidekick beside it, at its fixed seats in the first three rows (arena.ts `bossSeats`, the same in
 * every view and on every load); pawns fill every other seat. Everyone sits a little into the bench (`SEAT_SINK` of a pawn's
 * height, from arena-stands' seat points), so the step's top and the riser in front hide their feet.
 */
export function buildCrowd(art: Pick<CrowdArt, "cells">, seed = 20261030): Float32Array {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pawns = art.cells.flatMap((c, i) => (c.kind === "pawn" ? [i] : []));
  const bosses = art.cells.flatMap((c, i) => (c.kind === "boss" ? [i] : []));
  const kidOf = (home: string | undefined) => art.cells.findIndex((c) => c.kind === "sidekick" && c.home === home);
  const pairs = bosses.map((b) => ({ boss: b, kid: kidOf(art.cells[b]!.home) })).filter((p) => p.kid >= 0);
  const places = bossSeats(pairs.length);
  const taken = new Set(places.flatMap((p) => p.taken));
  const all = seats();
  const out = new Float32Array(all.length * SI);
  let n = 0;
  const put = (seat: Seat, cell: number, jx: number) => {
    const c = art.cells[cell]!;
    const o = n * SI;
    out[o] = seat.x + Math.cos(seat.face) * jx;
    out[o + 1] = seat.y - SINK_M;
    out[o + 2] = seat.z - Math.sin(seat.face) * jx;
    out[o + 3] = c.meters;
    out[o + 4] = c.rect.u0;
    out[o + 5] = c.rect.v0;
    out[o + 6] = c.rect.u1;
    out[o + 7] = c.rect.v1;
    out[o + 8] = c.meters;
    out[o + 9] = seat.face;
    out[o + 10] = rnd() * 0.35;
    out[o + 11] = 0.12 + rnd() * 0.2;
    out[o + 12] = out[o]!;
    out[o + 13] = out[o + 2]!;
    out[o + 14] = -NEVER;
    out[o + 15] = 0;
    out[o + 16] = c.foot;
    out[o + 17] = 0;
    out[o + 18] = NEVER;
    out[o + 19] = 0;
    n++;
  };
  all.forEach((seat, i) => {
    if (taken.has(i)) return;
    // (Each a little to one side or the other of its seat: a crowd, not a grid.)
    const cell = pawns[Math.floor(rnd() * pawns.length)]!;
    put(seat, cell, (rnd() - 0.5) * 0.12);
  });
  places.forEach((p, k) => {
    put(p.boss, pairs[k]!.boss, 0);
    put(p.kid, pairs[k]!.kid, 0);
  });
  return out.subarray(0, n * SI);
}

/** How far everyone in the stands sits into the bench (meters: a share of a pawn's height, art.ts SEAT_SINK). */
const SINK_M = SEAT_SINK * 0.62;

/**
 * The arena's standing figures as sprite instances (built once, drawn with the crowd): the torch pillars (their capitals'
 * tops at PILLARS.h, their flames on their own phase), the statues (STATUE.h tall, plinth and all) turning to face you, and
 * the banners flat on the arena wall (between the pillars) and on the gallery wall, hung by their rods' tops, swaying each
 * on its own phase.
 */
export function buildFigures(f: CrowdArt["figures"]): Float32Array {
  const out = new Float32Array((PILLAR_ANGLES.length + STATUE.angles.length + BANNERS.wall + BANNERS.gallery) * SI);
  let n = 0;
  const put = (fig: Figure, a: number, r: number, y: number, h: number, phase: number, flat: boolean) => {
    const o = n++ * SI;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    out.set([x, y, z, h, fig.rect.u0, fig.rect.v0, fig.rect.u1, fig.rect.v1, h * fig.aspect, -99, phase, 0, x, z, -NEVER, fig.frames > 1 ? fig.frames + fig.ms / 1000 : 0, fig.foot, 0, NEVER, flat ? a + 10 : 0], o);
  };
  PILLAR_ANGLES.forEach((a, i) => put(f.pillar, a, PILLARS.r, 0, (PILLARS.h * f.pillar.px) / (f.pillar.px - PILLAR_TOP_PX), i * 2, false));
  for (const a of STATUE.angles) put(f.statue, a, STATUE.r, 0, STATUE.h, 0, false);
  for (let i = 0; i < BANNERS.wall; i++) put(f.banner, (i / BANNERS.wall) * Math.PI * 2, FLOOR_R - 0.04, BANNERS.wallTop, BANNERS.wallTop - BANNERS.wallBottom, i * 2, true);
  const gy = rowY(STANDS.rows - 1);
  for (let i = 0; i < BANNERS.gallery; i++) put(f.banner, ((i + 0.5) / BANNERS.gallery) * Math.PI * 2, GALLERY_R - 0.05, gy + GALLERY_H - 0.2, GALLERY_H - 0.8, i * 3, true);
  return out;
}

/** A piece on the floor: its kind ("wp" … "bk"), its square, where it slides from (a square) and whether it's taken. */
export interface FloorPiece {
  key: string;
  sq: string;
  from: string | null;
  /** Taken by this move: it stays till the slide lands, then goes. */
  taken: boolean;
}

/** How tall a big piece's picture stands (meters, its cell's height). */
const PIECE_M = 1.1;

/** The gear's Pieces: Pixel (the default), 3D or 2D ("flat": the props). */
export type PieceStyle = "pixel" | "3d" | "flat";
/** The gear's Pieces, in the order a tap steps through them, and each one's name on the gear's pill. */
export const PIECE_STYLES: readonly PieceStyle[] = ["pixel", "3d", "flat"];
export const PIECE_STYLE_NAME: Record<PieceStyle, string> = { pixel: "Pixel", "3d": "3D", flat: "2D" };
/** The Pieces a device has saved (`saved`), or else what it had saved for the old "3D pieces" (`old`): "on" keeps 3D; else Pixel. */
export function pieceStyleOf(saved: string | null, old: string | null): PieceStyle {
  if (saved === "pixel" || saved === "3d" || saved === "flat") return saved;
  return old === "on" ? "3d" : "pixel";
}

/** The 3D pieces: their program, their instances, a VAO a kind. */
interface Solid {
  prog: WebGLProgram;
  uVP: WebGLUniformLocation;
  uEye: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation;
  uSlide: WebGLUniformLocation;
  uLift: WebGLUniformLocation;
  buf: WebGLBuffer;
  data: Float32Array;
  /** A kind's VAO, its triangles' first index and count, and how many of it stand on the board now. */
  kinds: { vao: WebGLVertexArrayObject; first: number; count: number; n: number }[];
}

/** Pixel's sprites being drawn for a new pitch, one a task: the next to draw, the atlas's new pixels, the task waiting. */
interface GbaDrawing {
  pitch: number;
  next: number;
  pixels: Uint8Array;
  timer: ReturnType<typeof setTimeout> | null;
}

/** The WebGL 2 arena. `create` returns null where there's no WebGL 2 (the page shows a still instead). */
export class ArenaGL {
  readonly gl: WebGL2RenderingContext;
  private readonly scene: { prog: WebGLProgram; vao: WebGLVertexArrayObject; n: number; tex: WebGLTexture; uVP: WebGLUniformLocation };
  private readonly sprite: { prog: WebGLProgram; uVP: WebGLUniformLocation; uEye: WebGLUniformLocation; uTime: WebGLUniformLocation; uJump: WebGLUniformLocation; uSlide: WebGLUniformLocation };
  /** The crowd and the arena's figures: `n` instances drawn, `people` of them the crowd. */
  private readonly crowd: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; n: number; people: number; tex: WebGLTexture | null };
  private readonly props: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; data: Float32Array; n: number; tex: WebGLTexture | null };
  /** The 3D pieces, built the first time they're chosen (the gear's Pieces); 2D: the props, exactly as before. */
  private solid: Solid | null = null;
  /** Which pieces are drawn (the gear's Pieces: Pixel, 3D, 2D = "flat"). */
  private style: PieceStyle = "flat";
  /**
   * Pixel's pieces (made the first time they're chosen): the sprites' atlas (its pixels, the pitch they're drawn for, and a
   * pitch being drawn off the frame loop), the instances (far ranks first) and the program.
   */
  private gba: {
    prog: WebGLProgram;
    vao: WebGLVertexArrayObject;
    buf: WebGLBuffer;
    data: Float32Array;
    n: number;
    tex: WebGLTexture;
    pixels: Uint8Array;
    pitch: number;
    drawing: GbaDrawing | null;
    /** How many shares (GBA_SCALE) the atlas holds now, from 1 down; and the nearest square's width on screen. */
    ready: number;
    near: number;
    u: Record<"uVP" | "uTime" | "uSlide" | "uLift" | "uScale" | "uRes" | "uFrame" | "uAtlas" | "uRight" | "uNear" | "uReady", WebGLUniformLocation>;
  } | null = null;
  /** Pixel: screen pixels an art pixel (a square near you about SQUARE_ART_PX art pixels across), at least 2. */
  pixelScale = 2;
  private scaleFor: { view: View | null; w: number; h: number } = { view: null, w: 0, h: 0 };
  private last: { pieces: readonly FloorPiece[]; t0: number } = { pieces: [], t0: -NEVER };
  private readonly proj = new Float32Array(16);
  private readonly viewM = new Float32Array(16);
  private readonly vp = new Float32Array(16);
  readonly fwd = new Float32Array(3);
  /** Pixel: where you look from (x, z) when its pieces were last put in order (far ranks first), and that view. */
  private sortEye: [number, number] = [0, 99];
  private sortView: View | null = null;
  /** Draw calls in the last frame. */
  drawCalls = 0;

  static create(cv: HTMLCanvasElement, style: PieceStyle = "flat"): ArenaGL | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = cv.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    } catch {
      gl = null;
    }
    if (!gl) return null;
    try {
      return new ArenaGL(gl, style);
    } catch (e) {
      console.warn("Colosseum: WebGL 2 failed", e);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext, style: PieceStyle) {
    this.gl = gl;
    const sp = program(gl, VS_SCENE, FS_SCENE);
    const mesh = buildScene();
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, SV * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, SV * 4, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, SV * 4, 20);
    this.scene = { prog: sp, vao, n: mesh.length / SV, tex: gl.createTexture()!, uVP: gl.getUniformLocation(sp, "uVP")! };

    const pp = program(gl, VS_SPRITE, FS_SPRITE);
    this.sprite = {
      prog: pp,
      uVP: gl.getUniformLocation(pp, "uVP")!,
      uEye: gl.getUniformLocation(pp, "uEye")!,
      uTime: gl.getUniformLocation(pp, "uTime")!,
      uJump: gl.getUniformLocation(pp, "uJump")!,
      uSlide: gl.getUniformLocation(pp, "uSlide")!,
    };
    const corner = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 0, 0.5, 1, -0.5, 1]), gl.STATIC_DRAW);
    const spriteVao = (buf: WebGLBuffer) => {
      const a = gl.createVertexArray()!;
      gl.bindVertexArray(a);
      gl.bindBuffer(gl.ARRAY_BUFFER, corner);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      for (let i = 0; i < 5; i++) {
        gl.enableVertexAttribArray(1 + i);
        gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, SI * 4, i * 16);
        gl.vertexAttribDivisor(1 + i, 1);
      }
      return a;
    };
    const cb = gl.createBuffer()!;
    this.crowd = { vao: spriteVao(cb), buf: cb, n: 0, people: 0, tex: null };
    const pb = gl.createBuffer()!;
    const data = new Float32Array(PROP_N * SI);
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    this.props = { vao: spriteVao(pb), buf: pb, data, n: 0, tex: null };
    this.style = style;
    if (style === "3d") this.solid = this.buildSolid();
    if (style === "pixel") this.gba = this.buildGba();
    this.crisp();
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(SKY[0], SKY[1], SKY[2], 1);
  }

  /** The 3D pieces: the six meshes in one buffer (built once), the instances' buffer, a VAO a kind. */
  private buildSolid(): Solid {
    const gl = this.gl;
    const prog = program(gl, VS_PIECE, FS_PIECE);
    const meshes: Record<Kind, PieceMesh> = pieceMeshes();
    let nv = 0;
    let ni = 0;
    for (const k of KINDS) ((nv += meshes[k].verts.length / PV), (ni += meshes[k].index.length));
    const verts = new Float32Array(nv * PV);
    const index = new Uint16Array(ni);
    const at: { first: number; count: number }[] = [];
    let ov = 0;
    let oi = 0;
    for (const k of KINDS) {
      const m = meshes[k];
      verts.set(m.verts, ov * PV);
      for (let i = 0; i < m.index.length; i++) index[oi + i] = m.index[i]! + ov;
      at.push({ first: oi, count: m.index.length });
      ov += m.verts.length / PV;
      oi += m.index.length;
    }
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const ib = gl.createBuffer()!;
    const data = new Float32Array(KINDS.length * KIND_CAP * PI3);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const kinds = at.map(({ first, count }, k) => {
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, PV * 4, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, PV * 4, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, PV * 4, 24);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      for (let i = 0; i < 2; i++) {
        gl.enableVertexAttribArray(3 + i);
        gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, PI3 * 4, (k * KIND_CAP * PI3 + i * 4) * 4);
        gl.vertexAttribDivisor(3 + i, 1);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      if (k === 0) gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
      return { vao, first, count, n: 0 };
    });
    gl.bindVertexArray(null);
    const u = (n: string) => gl.getUniformLocation(prog, n)!;
    const v = (n: string) => gl.getUniformLocation(prog, n);
    return { prog, uVP: u("uVP"), uEye: v("uEye"), uTime: u("uTime"), uSlide: u("uSlide"), uLift: u("uLift"), buf, data, kinds };
  }

  /** Which pieces are drawn. */
  get pieceStyle(): PieceStyle {
    return this.style;
  }
  /** Draws the pieces as Pixel, 3D or 2D (the gear's Pieces, at once: the same position), a set built the first time it's chosen. */
  setPieceStyle(style: PieceStyle): void {
    if (style === this.style) return;
    if (style === "3d" && !this.solid) this.solid = this.buildSolid();
    if (style === "pixel" && !this.gba) this.gba = this.buildGba();
    this.gl.bindVertexArray(null);
    this.style = style;
    this.crisp();
    this.setPieces(this.last.pieces, this.last.t0);
  }

  /** Pixel's pieces: the program, a quad's corners, the instances' buffer and the atlas (drawn at the first frame's pitch). */
  private buildGba(): NonNullable<ArenaGL["gba"]> {
    const gl = this.gl;
    const prog = program(gl, VS_GBA, FS_GBA);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const corner = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 0, 0.5, 1, -0.5, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const buf = gl.createBuffer()!;
    const data = new Float32Array(PIECES * PG);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 2; i++) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, PG * 4, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }
    gl.bindVertexArray(null);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]] as const) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const u = (n: string) => gl.getUniformLocation(prog, n)!;
    gl.useProgram(prog);
    gl.uniform1i(u("uTex"), 0);
    return {
      prog,
      vao,
      buf,
      data,
      n: 0,
      tex,
      pixels: new Uint8Array(GBA_ATLAS.w * GBA_ATLAS.h * 4),
      pitch: -1,
      drawing: null,
      ready: 0,
      near: 2 * SQUARE_ART_PX,
      u: { uVP: u("uVP"), uTime: u("uTime"), uSlide: u("uSlide"), uLift: u("uLift"), uScale: u("uScale"), uRes: u("uRes"), uFrame: u("uFrame"), uAtlas: u("uAtlas"), uRight: u("uRight"), uNear: u("uNear"), uReady: u("uReady") },
    };
  }

  /**
   * Pixel's sprites for this pitch: twelve a share (GBA_SCALE), about 150 ms each twelve. The first time, the full-size twelve
   * at once, then the smaller shares one sprite a task off the frame loop, each share shown as it's done (until then a
   * farther piece shows the smallest share there is). After that (Change seat), the new set drawn the same way off the frame
   * loop while the old one still shows, then put in its place whole.
   */
  private gbaSprites(pitch: number): void {
    const g = this.gba!;
    if (g.pitch === pitch || g.drawing?.pitch === pitch) return;
    const upload = (px: Uint8Array, ready: number) => {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, g.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, GBA_ATLAS.w, GBA_ATLAS.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      g.pixels = px;
      g.pitch = pitch;
      g.ready = ready;
    };
    if (g.drawing?.timer) clearTimeout(g.drawing.timer);
    g.drawing = null;
    const first = g.pitch < 0 || g.ready < 1;
    const d: GbaDrawing = { pitch, next: 0, pixels: first ? g.pixels : new Uint8Array(g.pixels.length), timer: null };
    const all = GBA_SCALE.buckets * 12;
    const paint = () => {
      const b = Math.floor(d.next / 12);
      const i = d.next % 12;
      paintGba(d.pixels, i % 6, i >= 6, pitch, b);
      d.next++;
      // (The first time, each share goes up as it's done; after, the whole new set at the end.)
      if (first && d.next % 12 === 0) upload(d.pixels, d.next / 12);
      else if (!first && d.next === all) upload(d.pixels, GBA_SCALE.buckets);
    };
    if (first) while (d.next < 12) paint();
    if (d.next >= all) return;
    const step = () => {
      if ((g.drawing as GbaDrawing | null) !== d) return;
      paint();
      if (d.next < all) d.timer = setTimeout(step, 0);
      else g.drawing = null;
    };
    g.drawing = d;
    d.timer = setTimeout(step, 0);
  }

  /**
   * Pixel: the browser scales the canvas up to the screen nearest-neighbor too (a phone's canvas is capped at 2x, so on a 3x
   * phone a piece's art pixel of 2 canvas pixels is 3 screen pixels, kept sharp, not blurred); 3D and 2D smooth, as before.
   */
  private crisp(): void {
    const c = this.gl.canvas as HTMLCanvasElement;
    if (c.style) c.style.imageRendering = this.style === "pixel" ? "pixelated" : "";
  }

  private texture(src: TexImageSource, pixelArt: boolean, into?: WebGLTexture): WebGLTexture {
    const gl = this.gl;
    const t = into ?? gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, pixelArt ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** The scene's picture (art.ts `sceneArt`), uploaded once. */
  setScene(c: HTMLCanvasElement): void {
    this.texture(c, true, this.scene.tex);
  }
  /** The crowd (`people`: buildCrowd) and the arena's figures (buildFigures): their pictures and places, uploaded once. */
  setCrowd(art: CrowdArt, people: Float32Array): void {
    const gl = this.gl;
    this.crowd.tex = this.texture(art.canvas, true);
    const figures = buildFigures(art.figures);
    const all = new Float32Array(people.length + figures.length);
    all.set(people);
    all.set(figures, people.length);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crowd.buf);
    gl.bufferData(gl.ARRAY_BUFFER, all, gl.STATIC_DRAW);
    this.crowd.n = all.length / SI;
    this.crowd.people = people.length / SI;
  }
  /** How many people sit in the stands. */
  get crowdCount(): number {
    return this.crowd.people;
  }
  /** The props' picture (art.ts `propArt`). */
  setProps(c: HTMLCanvasElement): void {
    this.props.tex = this.texture(c, false);
  }

  /**
   * The pieces now (after a move: the ones that moved slide from where they were, starting `t0` seconds into the page's
   * clock; a taken one goes as the slide lands): written into the props' instances and uploaded (a move's work, not a
   * frame's).
   */
  setPieces(pieces: readonly FloorPiece[], t0: number): void {
    this.last.pieces = pieces;
    this.last.t0 = t0;
    const d = this.props.data;
    let n = 0;
    const solid = this.style === "3d" ? this.solid : null;
    if (solid) for (const k of solid.kinds) k.n = 0;
    const gba = this.style === "pixel" ? this.gba : null;
    if (gba) {
      // Pixel: far ranks first (from where you look), each its kind's cell in the atlas.
      const e = this.sortEye;
      const far = (p: FloorPiece) => {
        const [x, z] = squareXZ(p.sq);
        return -Math.hypot(x - e[0], z - e[1]);
      };
      const order = pieces.slice(0, PIECES).sort((a, b) => far(a) - far(b));
      order.forEach((p, i) => {
        const [x, z] = squareXZ(p.sq);
        const [fx, fz] = p.from ? squareXZ(p.from) : [x, z];
        const o = i * PG;
        const g = gba.data;
        g[o] = x;
        g[o + 1] = z;
        g[o + 2] = fx;
        g[o + 3] = fz;
        g[o + 4] = p.from ? t0 : -NEVER;
        g[o + 5] = p.taken ? t0 + SLIDE_S * 0.85 : NEVER;
        g[o + 6] = Math.max(0, GBA_KINDS.indexOf(p.key[1] as (typeof GBA_KINDS)[number]));
        g[o + 7] = p.key[0] === "b" ? 1 : 0;
      });
      gba.n = order.length;
      this.props.n = 0;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, gba.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, gba.data, 0, order.length * PG);
      return;
    }
    const put = (x: number, y: number, z: number, h: number, w: number, r: Rect, fx: number, fz: number, t: number, foot: number, goes: number) => {
      const o = n++ * SI;
      d[o] = x;
      d[o + 1] = y;
      d[o + 2] = z;
      d[o + 3] = h;
      d[o + 4] = r.u0;
      d[o + 5] = r.v0;
      d[o + 6] = r.u1;
      d[o + 7] = r.v1;
      d[o + 8] = w;
      d[o + 9] = -99;
      d[o + 10] = 0;
      d[o + 11] = 0;
      d[o + 12] = fx;
      d[o + 13] = fz;
      d[o + 14] = t;
      d[o + 15] = 0;
      d[o + 16] = foot;
      d[o + 17] = 0;
      d[o + 18] = goes;
      d[o + 19] = 0;
    };
    for (const p of pieces) {
      if (n >= PIECES) break;
      const [x, z] = squareXZ(p.sq);
      const [fx, fz] = p.from ? squareXZ(p.from) : [x, z];
      if (solid) {
        const ki = KINDS.indexOf(p.key[1] as (typeof KINDS)[number]);
        const kind = solid.kinds[ki];
        if (!kind || kind.n >= KIND_CAP) continue;
        const o = (ki * KIND_CAP + kind.n++) * PI3;
        const s = solid.data;
        s[o] = x;
        s[o + 1] = z;
        s[o + 2] = fx;
        s[o + 3] = fz;
        s[o + 4] = p.from ? t0 : -NEVER;
        s[o + 5] = p.taken ? t0 + SLIDE_S * 0.85 : NEVER;
        s[o + 6] = p.key[0] === "b" ? 1 : 0;
        s[o + 7] = 0;
        continue;
      }
      put(x, BOARD.lift, z, PIECE_M, PIECE_M, PROPS.piece[p.key]!, fx, fz, p.from ? t0 : -NEVER, PROPS.pieceFoot, p.taken ? t0 + SLIDE_S * 0.85 : NEVER);
    }
    this.props.n = n;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.props.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * SI);
    if (solid) {
      gl.bindBuffer(gl.ARRAY_BUFFER, solid.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, solid.data);
    }
  }

  /** Sizes the drawing buffer (device pixels). */
  size(w: number, h: number): void {
    const cv = this.gl.canvas as HTMLCanvasElement;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
  }

  /** Draws a frame: `view` turned by `yaw` and `pitch`; `time` the page's clock (s); `jump` seconds since the crowd's jump began (large: none). */
  /**
   * The lens's shift (NDC; Colosseum.tsx sets it from the overlay on a computer): the board's middle drawn left and down of the
   * screen's middle by this much, so it sits in the middle of the arena the overlay leaves open.
   */
  readonly shift = { x: 0, y: 0 };

  draw(view: View, yaw: number, pitch: number, time: number, jump: number): void {
    const gl = this.gl;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const aspect = w / Math.max(1, h);
    perspective(this.proj, fovFor(view, aspect), aspect, 0.2, 120);
    this.proj[8] = this.shift.x;
    this.proj[9] = this.shift.y;
    lookAt(this.viewM, view.eye, view.at, yaw, pitch, this.fwd);
    multiply(this.vp, this.proj, this.viewM);
    let calls = 0;
    // The arena and the crowd, full size in every style (Pixel too, since Nov 2: only its pieces are on the art pixel's grid).
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.scene.prog);
    gl.uniformMatrix4fv(this.scene.uVP, false, this.vp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.bindVertexArray(this.scene.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.scene.n);
    calls++;
    const sp = this.sprite;
    gl.useProgram(sp.prog);
    gl.uniformMatrix4fv(sp.uVP, false, this.vp);
    gl.uniform3f(sp.uEye, view.eye[0], view.eye[1], view.eye[2]);
    gl.uniform1f(sp.uTime, time);
    gl.uniform1f(sp.uJump, jump);
    gl.uniform1f(sp.uSlide, SLIDE_S);
    if (this.crowd.n && this.crowd.tex) {
      gl.bindTexture(gl.TEXTURE_2D, this.crowd.tex);
      gl.bindVertexArray(this.crowd.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.crowd.n);
      calls++;
    }
    if (this.props.n && this.props.tex) {
      gl.bindTexture(gl.TEXTURE_2D, this.props.tex);
      gl.bindVertexArray(this.props.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.props.n);
      calls++;
    }
    const solid = this.style === "3d" ? this.solid : null;
    if (solid) {
      // The 3D pieces: a draw call a kind on the board; their shadows blend onto the board.
      gl.useProgram(solid.prog);
      gl.uniformMatrix4fv(solid.uVP, false, this.vp);
      if (solid.uEye) gl.uniform3f(solid.uEye, view.eye[0], view.eye[1], view.eye[2]);
      gl.uniform1f(solid.uTime, time);
      gl.uniform1f(solid.uSlide, SLIDE_S);
      gl.uniform1f(solid.uLift, BOARD.lift);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (let i = 0; i < solid.kinds.length; i++) {
        const k = solid.kinds[i]!;
        if (!k.n) continue;
        gl.bindVertexArray(k.vao);
        gl.drawElementsInstanced(gl.TRIANGLES, k.count, gl.UNSIGNED_SHORT, k.first * 2, k.n);
        calls++;
      }
      gl.disable(gl.BLEND);
    }
    const g = this.style === "pixel" ? this.gba : null;
    if (g) {
      this.gbaView(view, w, h);
      if (g.n) {
        // Pixel: the sprites, far ranks first, over the board (no depth: nothing stands over the board's pieces).
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(g.prog);
        gl.uniformMatrix4fv(g.u.uVP, false, this.vp);
        gl.uniform1f(g.u.uTime, time);
        gl.uniform1f(g.u.uSlide, SLIDE_S);
        gl.uniform1f(g.u.uLift, BOARD.lift);
        gl.uniform1f(g.u.uScale, this.pixelScale);
        gl.uniform2f(g.u.uRes, w, h);
        gl.uniform4f(g.u.uFrame, GBA_FRAME.w, GBA_FRAME.h, GBA_FRAME.ax, GBA_FRAME.ay);
        gl.uniform2f(g.u.uAtlas, GBA_ATLAS.w, GBA_ATLAS.h);
        // (The screen's right along the board, a meter: the square's width here, against the nearest's.)
        const fl = Math.hypot(this.fwd[0]!, this.fwd[2]!) || 1;
        gl.uniform3f(g.u.uRight, -this.fwd[2]! / fl, 0, this.fwd[0]! / fl);
        gl.uniform1f(g.u.uNear, g.near);
        gl.uniform1f(g.u.uReady, g.ready);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, g.tex);
        gl.bindVertexArray(g.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, g.n);
        calls++;
        gl.enable(gl.DEPTH_TEST);
      }
    }
    gl.bindVertexArray(null);
    this.drawCalls = calls;
  }

  /**
   * Pixel, when the view or the screen's size changes (never a frame): the art pixel (`pixelScale`: a board square near you
   * about SQUARE_ART_PX art pixels across, at least 2 screen pixels), the sprites for this view's pitch, and the pieces in
   * order from it (far ranks first).
   */
  private gbaView(view: View, w: number, h: number): void {
    const f = this.scaleFor;
    if (f.view === view && f.w === w && f.h === h) return;
    f.view = view;
    f.w = w;
    f.h = h;
    const art = gbaArtPixel(this.vp, view, w, h);
    this.pixelScale = art.scale;
    this.gba!.near = art.near;
    this.gbaSprites(gbaPitch(view));
    if (this.sortView !== view) {
      this.sortView = view;
      this.sortEye = [view.eye[0], view.eye[2]];
      this.setPieces(this.last.pieces, this.last.t0);
    }
  }

  /** The last frame's view-projection (tests: where a point lands). */
  get viewProj(): Float32Array {
    return this.vp;
  }

  dispose(): void {
    const d = this.gba?.drawing;
    if (d?.timer) clearTimeout(d.timer);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return p;
}
