/**
 * The Colosseum drawn with WebGL 2 (Oct 30, the first look; docs/decisions/2026-10-30-colosseum-look.md). Its own small
 * renderer beside the town's paint-gl.ts, not built on it: paint-gl.ts stands in for a 2D canvas (flat, no depth, a frame
 * recorded call by call), and the arena is a real place in 3D seen from ten spots, its crowd thousands strong. So:
 *
 * - **The arena** (the floor, the board and its plinth, the wall, the stands, the aisles, the gallery, the pillars, the
 *   pedestals, the banners): one vertex buffer built once, one draw call.
 * - **The crowd**: every seat's person one instance of one quad (its place, its picture's cell, which way it faces, its jump's
 *   delay and height), uploaded once and never again; one draw call. Each turns round its own upright axis to face you
 *   (pictures have no sides); one whose front faces away from you is drawn **from behind**: its own picture mirrored and
 *   darkened toward a shadow, so a hat's outline reads but no face looks back at you (no item has back art).
 * - **The props** (the big pieces, the torches' flames, the statues): instances too, one draw call, uploaded again only when a
 *   move is made (the slide itself is worked out on the GPU from when it began).
 *
 * - **The 3D pieces** (only with `?pieces=3d`; pieces3d.ts): the six meshes uploaded once, the pieces as instances written when
 *   a move is made, one draw call a kind on the board. Without the switch the pieces are props, as above.
 *
 * Three draw calls a frame (up to nine with the 3D pieces). A frame sets a few uniforms (the camera, the time, the jump's clock) and draws: nothing is
 * allocated and nothing uploaded. The crowd jumps (a queen captured) by a uniform too.
 */
import { BANNERS, BOARD, FLOOR_R, GALLERY_H, GALLERY_R, PILLARS, PILLAR_ANGLES, SEATING, STANDS, STATUE, WALL_H, WALL_TOP, aisleAngle, fovFor, landingDepth, lookAt, multiply, perspective, rowR, rowY, seats, squareXZ, VIEWS, type View } from "./arena.ts";
import { PROPS, SCENE, SKY, SQUARES, STONE, type CrowdArt, type Rect } from "./art.ts";
import { EYE, KINDS, KNIGHT_TURN, PV, SIZE, SLIT, pieceMeshes, toonPawn } from "./pieces3d.ts";
import { TABLE_INK } from "../town/houses/park.ts";

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
 * A sprite: one quad (corner x -0.5 to 0.5, y 0 to 1) a person or prop. Per instance: where its feet are and how tall its
 * picture is; its cell; its width, the way its front faces (-99: none), its jump's delay and height; where a slide began and
 * when; its feet down the cell, whether it flickers (a flame), and when it goes (a captured piece).
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
  if (iC.y > 0.5) { float f = sin(uTime * 11.0 + iA.z * 9.0) * 0.06 + sin(uTime * 17.0 + iA.z * 3.0) * 0.04; h *= 1.0 + f; w *= 1.0 - f * 0.5; }
  vec2 toEye = uEye.xz - p.xz;
  float d = length(toEye);
  // (Your own seat: whoever sits where your eye is isn't drawn.)
  if (d < 0.5 && abs(uEye.y - p.y) < 1.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 dir = toEye / max(d, 0.0001);
  vec3 right = vec3(dir.y, 0.0, -dir.x);
  vBack = iA.y < -50.0 ? 0.0 : smoothstep(0.15, -0.15, dot(vec2(sin(iA.y), cos(iA.y)), dir));
  // The rows in front of your seat (their backs to you, below you): only the one just in front, smaller and lower (the tops of
  // their heads, as Eric's mockup); the rows below it aren't drawn, so they don't cover the arena.
  if (vBack > 0.5 && p.y < uEye.y - 0.4 && d < 6.0) {
    if (d > 1.7) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    h *= 0.75; w *= 0.75; p.y -= 0.12;
  }
  float cx = vBack > 0.5 ? -aCorner.x : aCorner.x;
  vUV = vec2(mix(iRect.x, iRect.z, cx + 0.5), mix(iRect.w, iRect.y, aCorner.y));
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
 * The 3D pieces (`?pieces=3d`; pieces3d.ts): one mesh a kind, one instance a piece (where it stands, where its slide began,
 * when, when it goes, its color). Each turns round its upright axis to face you, as the flat pieces did (a knight shows its
 * profile, a bishop its slit), slides and hops as they did, and is lit from the arena's sun (the a-file and White's end, high),
 * with a soft fill from your side and a little shine. Its shadow, a soft disc on the board, is drawn with it.
 */
/** A town table ink (houses/park.ts TABLE_INK) as a shader color. */
const ink = (k: keyof typeof TABLE_INK) => {
  const h = TABLE_INK[k];
  return `vec3(${[1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(", ")})`;
};
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
uniform float uHull;
out vec3 vN;
out vec3 vLN;
out vec3 vW;
out vec3 vObj;
out float vMat;
out float vBlack;
void main() {
  vMat = aMat;
  vLN = aNrm;
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
    // The toon outline (an inverted hull): the piece pushed out along its normals, about as thick on screen from any seat.
    // (Its foot kept on the board, so the base's bottom line shows on the squares.)
    if (uHull > 0.0) { w += normalize(vN) * uHull * distance(uEye, w); w.y = max(w.y, uLift + hop + 0.004); }
  }
  if (uHull > 0.0 && aMat > 2.5 && aMat < 3.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vW = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
const FS_PIECE = `#version 300 es
precision highp float;
uniform vec3 uEye;
in vec3 vN;
in vec3 vW;
in vec3 vObj;
in vec3 vLN;
in float vMat;
in float vBlack;
uniform float uToon;
uniform float uHull;
out vec4 o;
const vec3 IVORY = vec3(0.93, 0.87, 0.74);
const vec3 EBONY = vec3(0.15, 0.15, 0.18);
const vec3 GOLD = vec3(0.86, 0.64, 0.24);
const vec3 SUN = vec3(-0.43, 0.75, 0.5);
void main() {
  if (vMat > 2.5 && vMat < 3.5) { o = vec4(0.12, 0.08, 0.04, vN.x * 0.55); return; }
  // The toon pawn (the town's table pieces' inks): its outline, then two flat tones with a hard edge, lit from your upper left
  // (light: cream, its right side shaded; dark: charcoal, its left side a lighter grey), no shine.
  if (uHull > 0.0) { o = vec4(mix(${ink("lightLine")}, ${ink("darkLine")}, vBlack), 1.0); return; }
  if (uToon > 0.5) {
    // (Each flat face its own tone, so the facets show, as the table pieces' pixels.)
    vec3 fn = normalize(cross(dFdx(vObj), dFdy(vObj)));
    if (dot(fn, vec3(0.0, 0.5, 1.0)) < 0.0) fn = -fn;
    float d = dot(fn, normalize(vec3(-0.65, 0.5, 0.55)));
    vec3 c = vBlack > 0.5 ? (d > 0.55 ? ${ink("darkShade")} : ${ink("dark")}) : (d > -0.05 ? ${ink("light")} : ${ink("lightShade")});
    o = vec4(c, 1.0);
    return;
  }
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

/** Floats a scene vertex (position, uv, color) and a sprite instance (five vec4s). */
const SV = 9;
const SI = 20;
/** Props: 32 pieces, the flames, the statues. */
const PIECES = 32;
const PROP_N = PIECES + PILLAR_ANGLES.length + STATUE.angles.length;
/** Which pieces are drawn: the flat pictures, the 3D set (`?pieces=3d`), or the toon pawn (`?pieces=toon`). */
export type PieceStyle = "flat" | "3d" | "toon";
/** The toon outline's thickness: meters per meter from your eye (about 3 px on a phone from a seat). */
const HULL = 0.0045;
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
  /** A quad a, b, c, d (each [x, y, z]) in one color, or textured from `r` (a to b along u, b to c down v). */
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
  // The sun from the south-west, high: a wall facing it is lit, one facing away in shade.
  const sun = [-0.5, 0.8];
  const lit = (a: number) => 0.72 + 0.28 * Math.max(0, -(Math.sin(a) * sun[0]! + Math.cos(a) * sun[1]!));

  // The floor: sand out to the wall, its texture laid flat over the whole disc.
  const N = 120;
  const S = SCENE.sand;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const p = [[0, 0], [Math.sin(a0) * FLOOR_R, Math.cos(a0) * FLOOR_R], [Math.sin(a1) * FLOOR_R, Math.cos(a1) * FLOOR_R]];
    for (const [x, z] of p) v(x!, 0, z!, S.u0 + (S.u1 - S.u0) * (x! / FLOOR_R / 2 + 0.5), S.v0 + (S.v1 - S.v0) * (z! / FLOOR_R / 2 + 0.5), [255, 255, 255], 1);
  }
  // The board: a stone plinth, the squares on it.
  const hb = BOARD.half + BOARD.rim;
  const y = BOARD.lift;
  quad([-hb, y, -hb], [hb, y, -hb], [hb, y, hb], [-hb, y, hb], STONE.light, 0.95);
  quad([-hb, y, hb], [hb, y, hb], [hb, 0, hb], [-hb, 0, hb], STONE.mid, 0.85);
  quad([hb, y, -hb], [-hb, y, -hb], [-hb, 0, -hb], [hb, 0, -hb], STONE.mid, 0.7);
  quad([hb, y, hb], [hb, y, -hb], [hb, 0, -hb], [hb, 0, hb], STONE.mid, 0.8);
  quad([-hb, y, -hb], [-hb, y, hb], [-hb, 0, hb], [-hb, 0, -hb], STONE.mid, 0.75);
  for (let f = 0; f < 8; f++)
    for (let r = 0; r < 8; r++) {
      const x0 = f - 4;
      const z0 = 4 - r - 1;
      const col = (f + r) % 2 ? SQUARES.light : SQUARES.dark;
      quad([x0, y + 0.004, z0], [x0 + 1, y + 0.004, z0], [x0 + 1, y + 0.004, z0 + 1], [x0, y + 0.004, z0 + 1], col, 1);
    }
  // The arena wall: arches all round (24, five segments each), facing in; its top.
  const A = 24;
  const segs = A * 5;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const k = lit((a0 + a1) / 2);
    const t = (i % 5) / 5;
    quad(at(a0, FLOOR_R, WALL_H), at(a1, FLOOR_R, WALL_H), at(a1, FLOOR_R, 0), at(a0, FLOOR_R, 0), [255, 255, 255], k, SCENE.arch, t, t + 0.2);
    quad(at(a0, FLOOR_R + WALL_TOP, WALL_H), at(a1, FLOOR_R + WALL_TOP, WALL_H), at(a1, FLOOR_R, WALL_H), at(a0, FLOOR_R, WALL_H), STONE.light, 1);
  }
  // The stands: each row a riser and a step; the aisles' stairs a lighter strip over the steps.
  const M = 160;
  for (let r = 0; r < STANDS.rows; r++) {
    const R0 = rowR(r);
    const R1 = R0 + STANDS.depth + landingDepth(r);
    const yTop = rowY(r);
    const yBot = r ? rowY(r - 1) : WALL_H;
    const shade = 0.93 + (r % 2) * 0.06;
    for (let i = 0; i < M; i++) {
      const a0 = (i / M) * Math.PI * 2;
      const a1 = ((i + 1) / M) * Math.PI * 2;
      const k = lit((a0 + a1) / 2);
      quad(at(a0, R0, yTop), at(a1, R0, yTop), at(a1, R0, yBot), at(a0, R0, yBot), STONE.mid, k * 0.82);
      quad(at(a0, R1, yTop), at(a1, R1, yTop), at(a1, R0, yTop), at(a0, R0, yTop), STONE.light, shade * (0.9 + 0.1 * k));
    }
    for (let s = 0; s < SEATING.aisles; s++) {
      const a = aisleAngle(s);
      const h0 = SEATING.aisleHalf / R0;
      const h1 = SEATING.aisleHalf / R1;
      quad(at(a - h1, R1, yTop + 0.01), at(a + h1, R1, yTop + 0.01), at(a + h0, R0, yTop + 0.01), at(a - h0, R0, yTop + 0.01), [244, 232, 210], 1);
      // (Each step's nosing: a dark line at its front edge.)
      quad(at(a - h0, R0 + 0.06, yTop + 0.012), at(a + h0, R0 + 0.06, yTop + 0.012), at(a + h0, R0, yTop + 0.012), at(a - h0, R0, yTop + 0.012), STONE.shade, 1);
    }
  }
  // The gallery at the top: arches round (44, four segments each).
  const G = 44 * 4;
  const gy = rowY(STANDS.rows - 1);
  for (let i = 0; i < G; i++) {
    const a0 = (i / G) * Math.PI * 2;
    const a1 = ((i + 1) / G) * Math.PI * 2;
    const t = (i % 4) / 4;
    quad(at(a0, GALLERY_R, gy + GALLERY_H), at(a1, GALLERY_R, gy + GALLERY_H), at(a1, GALLERY_R, gy), at(a0, GALLERY_R, gy), [255, 255, 255], lit((a0 + a1) / 2), SCENE.gallery, t, t + 0.25);
  }
  // Banners: on the arena wall (between the pillars) and on the gallery wall.
  for (let i = 0; i < BANNERS.wall; i++) {
    const a = (i / BANNERS.wall) * Math.PI * 2;
    const h = BANNERS.wallW / 2 / FLOOR_R;
    const r = FLOOR_R - 0.04;
    quad(at(a - h, r, BANNERS.wallTop), at(a + h, r, BANNERS.wallTop), at(a + h, r, BANNERS.wallBottom), at(a - h, r, BANNERS.wallBottom), [255, 255, 255], 1, SCENE.banner);
  }
  for (let i = 0; i < BANNERS.gallery; i++) {
    const a = ((i + 0.5) / BANNERS.gallery) * Math.PI * 2;
    const h = BANNERS.galleryW / 2 / GALLERY_R;
    const r = GALLERY_R - 0.05;
    quad(at(a - h, r, gy + GALLERY_H - 0.2), at(a + h, r, gy + GALLERY_H - 0.2), at(a + h, r, gy + 0.6), at(a - h, r, gy + 0.6), [255, 255, 255], 1, SCENE.banner);
  }
  // A box (pillars, their capitals and braziers, the statues' plinths): four sides lit by the sun, and its top.
  const box = (cx: number, cz: number, hx: number, y0: number, y1: number, col: readonly number[], k: number) => {
    const c = [
      [cx - hx, cz - hx],
      [cx + hx, cz - hx],
      [cx + hx, cz + hx],
      [cx - hx, cz + hx],
    ];
    for (let s = 0; s < 4; s++) {
      const [x0, z0] = c[s]!;
      const [x1, z1] = c[(s + 1) % 4]!;
      const nx = z1! - z0!;
      const nz = -(x1! - x0!);
      const l = Math.hypot(nx, nz);
      const kk = 0.68 + 0.32 * Math.max(0, (nx * sun[0]! + nz * sun[1]!) / (l * Math.hypot(sun[0]!, sun[1]!)));
      quad([x1!, y1, z1!], [x0!, y1, z0!], [x0!, y0, z0!], [x1!, y0, z1!], col, k * kk);
    }
    quad([cx - hx, y1, cz - hx], [cx + hx, y1, cz - hx], [cx + hx, y1, cz + hx], [cx - hx, y1, cz + hx], col, k);
  };
  for (const a of PILLAR_ANGLES) {
    const x = Math.sin(a) * PILLARS.r;
    const z = Math.cos(a) * PILLARS.r;
    box(x, z, PILLARS.half + 0.1, 0, 0.25, STONE.dark, 1);
    box(x, z, PILLARS.half, 0.25, PILLARS.h - 0.2, STONE.light, 0.95);
    box(x, z, PILLARS.half + 0.08, PILLARS.h - 0.2, PILLARS.h, STONE.mid, 1);
    box(x, z, PILLARS.half * 0.8, PILLARS.h, PILLARS.h + 0.22, [90, 62, 40], 1);
  }
  for (const a of STATUE.angles) box(Math.sin(a) * STATUE.r, Math.cos(a) * STATUE.r, 0.65, 0, 1.0, STONE.mid, 1);
  return new Float32Array(out);
}

/** Where each crowd member sits, its cell, which way it faces, its jump: the crowd's instances (built once). */
export function buildCrowd(art: Pick<CrowdArt, "cells">, seed = 20261030): Float32Array {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pawns = art.cells.flatMap((c, i) => (c.kind === "pawn" ? [i] : []));
  const kids = art.cells.flatMap((c, i) => (c.kind === "sidekick" ? [i] : []));
  const bosses = art.cells.flatMap((c, i) => (c.kind === "boss" ? [i] : []));
  const all = seats();
  const out = new Float32Array(all.length * SI);
  let n = 0;
  let skip = false;
  for (const seat of all) {
    if (skip) {
      skip = false;
      continue;
    }
    const u = rnd();
    // (No boss sits just in front of a view's seat: a big figure there would hide the board.)
    const nearView = VIEWS.some((v) => Math.hypot(v.eye[0] - seat.x, v.eye[2] - seat.z) < 5);
    const cell = u < 0.012 && bosses.length && !nearView ? bosses[Math.floor(rnd() * bosses.length)]! : u < 0.07 && kids.length ? kids[Math.floor(rnd() * kids.length)]! : pawns[Math.floor(rnd() * pawns.length)]!;
    const c = art.cells[cell]!;
    if (c.kind === "boss") skip = true;
    // (Each a little to one side or the other of its seat, and a little forward or back: a crowd, not a grid.)
    const jx = (rnd() - 0.5) * 0.12;
    const o = n * SI;
    out[o] = seat.x + Math.cos(seat.face) * jx;
    out[o + 1] = seat.y;
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
  }
  return out.subarray(0, n * SI);
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

/** The WebGL 2 arena. `create` returns null where there's no WebGL 2 (the page shows a still instead). */
export class ArenaGL {
  readonly gl: WebGL2RenderingContext;
  private readonly scene: { prog: WebGLProgram; vao: WebGLVertexArrayObject; n: number; tex: WebGLTexture; uVP: WebGLUniformLocation };
  private readonly sprite: { prog: WebGLProgram; uVP: WebGLUniformLocation; uEye: WebGLUniformLocation; uTime: WebGLUniformLocation; uJump: WebGLUniformLocation; uSlide: WebGLUniformLocation };
  private readonly crowd: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; n: number; tex: WebGLTexture | null };
  private readonly props: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; data: Float32Array; n: number; tex: WebGLTexture | null };
  /** The 3D pieces (`?pieces=3d`), or null: the flat pieces, exactly as before. */
  private readonly solid: {
    prog: WebGLProgram;
    uVP: WebGLUniformLocation;
    uEye: WebGLUniformLocation;
    uTime: WebGLUniformLocation;
    uSlide: WebGLUniformLocation;
    uLift: WebGLUniformLocation;
    uToon: WebGLUniformLocation;
    uHull: WebGLUniformLocation;
    buf: WebGLBuffer;
    data: Float32Array;
    /** A kind's VAO, its triangles' first index and count, and how many of it stand on the board now. */
    kinds: { vao: WebGLVertexArrayObject; first: number; count: number; n: number }[];
  } | null = null;
  /** Which pieces are drawn: "3d" or "toon" only when made with them (the switch); the tests' still pairs flip it back to "flat". */
  private style: PieceStyle = "flat";
  /** The 3D style the arena was made with (`?pieces=3d` or `?pieces=toon`), if any. */
  private readonly solidStyle: PieceStyle = "flat";
  private last: { pieces: readonly FloorPiece[]; t0: number } = { pieces: [], t0: -NEVER };
  private readonly proj = new Float32Array(16);
  private readonly viewM = new Float32Array(16);
  private readonly vp = new Float32Array(16);
  readonly fwd = new Float32Array(3);
  /** Draw calls in the last frame. */
  drawCalls = 0;
  private statueFoot = 0.8;

  static create(cv: HTMLCanvasElement, pieces: PieceStyle = "flat"): ArenaGL | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = cv.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    } catch {
      gl = null;
    }
    if (!gl) return null;
    try {
      return new ArenaGL(gl, pieces);
    } catch (e) {
      console.warn("Colosseum: WebGL 2 failed", e);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext, pieces: PieceStyle) {
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
    this.crowd = { vao: spriteVao(cb), buf: cb, n: 0, tex: null };
    const pb = gl.createBuffer()!;
    const data = new Float32Array(PROP_N * SI);
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    this.props = { vao: spriteVao(pb), buf: pb, data, n: 0, tex: null };
    if (pieces !== "flat") {
      this.solid = this.buildSolid(pieces === "toon");
      this.style = this.solidStyle = pieces;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(SKY[0], SKY[1], SKY[2], 1);
  }

  /** The 3D pieces: the six meshes in one buffer (built once), the instances' buffer, a VAO a kind. */
  private buildSolid(toon: boolean): NonNullable<ArenaGL["solid"]> {
    const gl = this.gl;
    const prog = program(gl, VS_PIECE, FS_PIECE);
    const meshes = pieceMeshes();
    // (The toon look is the pawn alone for now, a mockup: the other kinds stay flat.)
    if (toon) meshes.p = toonPawn();
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
    return { prog, uVP: u("uVP"), uEye: u("uEye"), uTime: u("uTime"), uSlide: u("uSlide"), uLift: u("uLift"), uToon: u("uToon"), uHull: u("uHull"), buf, data, kinds };
  }

  /** Which pieces are drawn ("3d" only when the arena was made with them). */
  get pieceStyle(): PieceStyle {
    return this.style;
  }
  /** (The tests' still pairs) Draws the pieces flat or in the 3D style the arena was made with, the same position. */
  setPieceStyle(style: PieceStyle): void {
    if (style !== "flat" && style !== this.solidStyle) return;
    this.style = style;
    this.setPieces(this.last.pieces, this.last.t0);
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
  /** The crowd: its pictures and its seats, uploaded once. */
  setCrowd(art: CrowdArt, instances: Float32Array): void {
    const gl = this.gl;
    this.crowd.tex = this.texture(art.canvas, true);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crowd.buf);
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW);
    this.crowd.n = instances.length / SI;
  }
  get crowdCount(): number {
    return this.crowd.n;
  }
  /** The props' picture (art.ts `propArt`). */
  setProps(c: HTMLCanvasElement, statueFoot: number): void {
    this.props.tex = this.texture(c, false);
    this.statueFoot = statueFoot;
  }

  /**
   * The pieces now (after a move: the ones that moved slide from where they were, starting `t0` seconds into the page's
   * clock; a taken one goes as the slide lands), with the flames and the statues: written into the props' instances and
   * uploaded (a move's work, not a frame's).
   */
  setPieces(pieces: readonly FloorPiece[], t0: number): void {
    this.last.pieces = pieces;
    this.last.t0 = t0;
    const d = this.props.data;
    let n = 0;
    const solid = this.style !== "flat" ? this.solid : null;
    if (solid) for (const k of solid.kinds) k.n = 0;
    const put = (x: number, y: number, z: number, h: number, w: number, r: Rect, fx: number, fz: number, t: number, foot: number, flicker: number, goes: number, phase = 0) => {
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
      d[o + 10] = phase;
      d[o + 11] = 0;
      d[o + 12] = fx;
      d[o + 13] = fz;
      d[o + 14] = t;
      d[o + 15] = 0;
      d[o + 16] = foot;
      d[o + 17] = flicker;
      d[o + 18] = goes;
      d[o + 19] = 0;
    };
    for (const p of pieces) {
      if (n >= PIECES) break;
      const [x, z] = squareXZ(p.sq);
      const [fx, fz] = p.from ? squareXZ(p.from) : [x, z];
      if (solid && (this.style === "3d" || p.key[1] === "p")) {
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
      put(x, BOARD.lift, z, PIECE_M, PIECE_M, PROPS.piece[p.key]!, fx, fz, p.from ? t0 : -NEVER, PROPS.pieceFoot, 0, p.taken ? t0 + SLIDE_S * 0.85 : NEVER);
    }
    PILLAR_ANGLES.forEach((a, i) => {
      const x = Math.sin(a) * PILLARS.r;
      const z = Math.cos(a) * PILLARS.r;
      put(x, PILLARS.h + 0.12, z, 0.9, 0.45, PROPS.flame, x, z, -NEVER, 0.94, 1, NEVER, i * 0.37);
    });
    for (const a of STATUE.angles) {
      const x = Math.sin(a) * STATUE.r;
      const z = Math.cos(a) * STATUE.r;
      put(x, 1.0, z, 3.0, 3.0, PROPS.statue, x, z, -NEVER, this.statueFoot, 0, NEVER);
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
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let calls = 0;
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
    const solid = this.style !== "flat" ? this.solid : null;
    if (solid) {
      // The 3D pieces: a draw call a kind on the board; their shadows blend onto the board.
      gl.useProgram(solid.prog);
      gl.uniformMatrix4fv(solid.uVP, false, this.vp);
      gl.uniform3f(solid.uEye, view.eye[0], view.eye[1], view.eye[2]);
      gl.uniform1f(solid.uTime, time);
      gl.uniform1f(solid.uSlide, SLIDE_S);
      gl.uniform1f(solid.uLift, BOARD.lift);
      gl.uniform1f(solid.uToon, this.style === "toon" ? 1 : 0);
      gl.uniform1f(solid.uHull, 0);
      if (this.style === "toon") {
        // The outline first: the pushed-out hull's far side only (its near side culled), in the outline's ink.
        const k = solid.kinds[0]!;
        if (k.n) {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.BACK);
          gl.uniform1f(solid.uHull, HULL);
          gl.bindVertexArray(k.vao);
          gl.drawElementsInstanced(gl.TRIANGLES, k.count, gl.UNSIGNED_SHORT, k.first * 2, k.n);
          calls++;
          gl.disable(gl.CULL_FACE);
          gl.uniform1f(solid.uHull, 0);
        }
      }
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
    gl.bindVertexArray(null);
    this.drawCalls = calls;
  }

  /** The last frame's view-projection (tests: where a point lands). */
  get viewProj(): Float32Array {
    return this.vp;
  }

  dispose(): void {
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
