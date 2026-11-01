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
 * - **Pixel** (the gear's Pieces: Pixel, the default since Nov 1; pieces-pixel.ts): the whole arena drawn into a small target
 *   (an art pixel `pixelScale` screen pixels square) and scaled up nearest-neighbor, one chunky pixel grid as Eric's picture;
 *   the pixel set drawn like the 3D pieces (one draw call a kind), cel-shaded in flat tones, each facing the screen and
 *   leaning back a little like a sprite, its axis on a pixel's middle; each piece's one-pixel outline drawn in the small
 *   target, then the scaling up (one read a screen pixel).
 *
 * Three draw calls a frame with 2D; eight with 3D (the arena, the crowd and one a kind: the props then have nothing to draw);
 * ten with Pixel (those, the outline and the scaling up). A frame sets a few uniforms (the camera, the time, the jump's clock) and draws:
 * nothing is allocated and nothing uploaded. The crowd jumps (a queen captured) by a uniform too.
 */
import { BANNERS, BOARD, FLOOR_R, bossSeats, project, type Seat, GALLERY_H, GALLERY_R, PILLARS, PILLAR_ANGLES, SEATING, STANDS, STATUE, WALL_H, WALL_TOP, aisleAngle, fovFor, landingDepth, lookAt, multiply, perspective, rowR, rowY, seatR, seats, squareXZ, VIEWS, type View } from "./arena.ts";
import { FIGURE_STRIDE, PILLAR_TOP_PX, PROPS, SCENE, SEAT_SINK, SKY, SQUARES, STANDS_SEATS, STONE, type CrowdArt, type Figure, type Rect } from "./art.ts";
import { EYE, KINDS, KNIGHT_TURN, PV, SIZE, SLIT, pieceMeshes, type Kind, type PieceMesh } from "./pieces3d.ts";
import { PIXEL_EYE, PIXEL_KNIGHT_TURN, PIXEL_SIZE, PIXEL_SLIT, pixelMeshes } from "./pieces-pixel.ts";

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
 * The pixel set (Pixel; pieces-pixel.ts), drawn into the small target: each piece faces the screen (the camera's plane, not
 * its eye, so none leans sideways), leaning back by part of your view's pitch so it stands up on screen as a sprite does, its
 * axis on a pixel's middle (so it rasterizes the same both sides). Its contact shadow lies flat under it, a little to the
 * lower right. The normal stays the piece's own (it always faces the screen): the light is the screen's, from the top left.
 */
const VS_PIECE_PX = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in float aMat;
layout(location=3) in vec4 iA;
layout(location=4) in vec4 iB;
uniform mat4 uVP;
uniform float uTime;
uniform float uSlide;
uniform float uLift;
uniform float uKind;
uniform float uTilt;
uniform vec2 uRes;
uniform vec3 uFwd;
out vec3 vN;
out vec3 vObj;
out float vMat;
out float vBlack;
out float vDepth;
flat out float vId;
void main() {
  vMat = aMat;
  vBlack = iB.z;
  vN = aNrm;
  vObj = aPos / ${PIXEL_SIZE.toFixed(4)};
  vId = uKind * 32.0 + float(gl_InstanceID) + 1.0;
  if (uTime >= iB.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vDepth = 0.0; return; }
  float s = clamp((uTime - iB.x) / uSlide, 0.0, 1.0);
  s = s * s * (3.0 - 2.0 * s);
  vec2 xz = mix(iA.zw, iA.xy, s);
  float hop = sin(3.14159 * s) * 0.35 * step(0.001, distance(iA.zw, iA.xy));
  vec2 f = -normalize(uFwd.xz);
  vec3 R = vec3(f.y, 0.0, -f.x);
  vec3 F = vec3(f.x, 0.0, f.y);
  vec3 w;
  bool shadow = aMat > 2.5 && aMat < 3.5;
  if (shadow) {
    w = vec3(xz.x, uLift + 0.006, xz.y) + R * (aPos.x + 0.06) + F * (aPos.z - 0.05);
  } else {
    float a = asin(clamp(-uFwd.y, -1.0, 1.0)) * uTilt;
    vec3 U = vec3(0.0, cos(a), 0.0) - F * sin(a);
    vec3 F2 = F * cos(a) + vec3(0.0, sin(a), 0.0);
    w = vec3(xz.x, uLift + hop, xz.y) + R * aPos.x + U * aPos.y + F2 * aPos.z;
  }
  gl_Position = uVP * vec4(w, 1.0);
  vDepth = gl_Position.w;
  if (!shadow) {
    vec4 c = uVP * vec4(xz.x, uLift + hop, xz.y, 1.0);
    vec2 px = (c.xy / c.w * 0.5 + 0.5) * uRes;
    gl_Position.xy += (floor(px) + 0.5 - px) / uRes * 2.0 * gl_Position.w;
  }
}`;
/**
 * The pixel set's look, from Eric's picture: flat tones, hard steps, no gradients and no shine but a few highlight pixels;
 * cream with warm (brown) shadows, navy, gold. The second output marks which piece a pixel is and how near (the outline).
 */
const FS_PIECE_PX = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vObj;
in float vMat;
in float vBlack;
in float vDepth;
flat in float vId;
layout(location=0) out vec4 o;
layout(location=1) out vec4 o2;
const vec3 CREAM_L = vec3(250.0, 238.0, 214.0) / 255.0;
const vec3 CREAM_M = vec3(214.0, 186.0, 148.0) / 255.0;
const vec3 CREAM_S = vec3(160.0, 127.0, 93.0) / 255.0;
const vec3 NAVY_H = vec3(104.0, 108.0, 146.0) / 255.0;
const vec3 NAVY_M = vec3(55.0, 57.0, 80.0) / 255.0;
const vec3 NAVY_D = vec3(27.0, 27.0, 40.0) / 255.0;
const vec3 GOLD_H = vec3(255.0, 222.0, 140.0) / 255.0;
const vec3 GOLD_L = vec3(228.0, 168.0, 72.0) / 255.0;
const vec3 GOLD_D = vec3(150.0, 100.0, 38.0) / 255.0;
const vec3 L = vec3(-0.55, 0.7, 0.45) * ${(1 / Math.hypot(0.55, 0.7, 0.45)).toFixed(5)};
const vec3 H = vec3(-0.55, 0.7, 1.45) * ${(1 / Math.hypot(0.55, 0.7, 1.45)).toFixed(5)};
void main() {
  if (vMat > 2.5 && vMat < 3.5) { o = vec4(0.13, 0.07, 0.03, vN.x > 0.3 ? 0.62 : 0.0); o2 = vec4(0.0); return; }
  vec3 N = normalize(vN);
  float t = dot(N, L);
  bool hi = pow(max(dot(N, H), 0.0), 60.0) > 0.55;
  bool gold = vBlack > 0.5 && vMat > 4.5;
  vec3 c;
  if (gold) c = hi ? GOLD_H : t > 0.1 ? GOLD_L : GOLD_D;
  else if (vBlack > 0.5) c = hi ? NAVY_H : t > 0.2 ? NAVY_M : NAVY_D;
  else c = t > 0.62 ? CREAM_L : t > 0.2 ? CREAM_M : CREAM_S;
  // The bishop's slit (pieces-pixel.ts PIXEL_SLIT), across the mitre's front.
  if (vMat > 1.5 && vMat < 2.5 && vObj.z > 0.03 && abs(vObj.x * ${PIXEL_SLIT.k.toFixed(3)} + vObj.y - ${PIXEL_SLIT.c.toFixed(3)}) * ${(1 / Math.hypot(PIXEL_SLIT.k, 1)).toFixed(4)} < ${PIXEL_SLIT.w.toFixed(3)}) c = vBlack > 0.5 ? GOLD_L : CREAM_S;
  // The knight's eye (PIXEL_EYE), on both sides of its head.
  if (vMat > 3.5 && vMat < 4.5) {
    vec2 p = vec2(vObj.x * ${Math.cos(PIXEL_KNIGHT_TURN).toFixed(4)} - vObj.z * ${Math.sin(PIXEL_KNIGHT_TURN).toFixed(4)}, vObj.y);
    if (distance(p, vec2(${PIXEL_EYE.x.toFixed(3)}, ${PIXEL_EYE.y.toFixed(3)})) < ${PIXEL_EYE.r.toFixed(3)}) c = vBlack > 0.5 ? GOLD_L : vec3(0.18, 0.12, 0.08);
  }
  o = vec4(c, 1.0);
  float d = clamp(vDepth / 64.0, 0.0, 1.0) * 255.0;
  o2 = vec4(vId / 255.0, floor(d) / 255.0, fract(d), 1.0);
}`;

/** A full-screen triangle (Pixel's outline and scaling up). */
const VS_FULL = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;
/** Pixel's outline, in the small target (a pixel's four neighbors read there, not a screen pixel's): one dark pixel round each piece. */
const FS_OUTLINE = `#version 300 es
precision highp float;
uniform sampler2D uCol;
uniform sampler2D uId;
uniform ivec2 uSize;
out vec4 o;
const vec3 OUTLINE = vec3(30.0, 21.0, 12.0) / 255.0;
float near(vec4 m) { return m.a > 0.5 ? m.g + m.b / 255.0 : 2.0; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 m = texelFetch(uId, p, 0);
  float d = near(m);
  bool edge = false;
  for (int k = 0; k < 4; k++) {
    ivec2 q = clamp(p + (k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1)), ivec2(0), uSize - 1);
    vec4 n = texelFetch(uId, q, 0);
    // Round a piece, between two pieces (on the farther), and inside one where a part stands well in front (a collar's edge).
    if (n.a > 0.5 && near(n) < d && (abs(n.r - m.r) > 0.001 || d - near(n) > 0.13 / 64.0)) edge = true;
  }
  o = vec4(edge ? OUTLINE : texelFetch(uCol, p, 0).rgb, 1.0);
}`;
/** Pixel's scaling up to the screen, nearest-neighbor: one read a screen pixel. */
const FS_UP = `#version 300 es
precision mediump float;
uniform sampler2D uOut;
uniform float uScale;
uniform ivec2 uSize;
out vec4 o;
void main() {
  o = texelFetch(uOut, min(ivec2(floor(gl_FragCoord.xy / uScale)), uSize - 1), 0);
}`;

/**
 * Pixel: a pawn standing on the board's middle is about this many art pixels tall (`pixelScale`: whole screen pixels an art
 * pixel, set when the view or the screen's size changes, never a frame); the proof of concept's grid, which Eric approved.
 */
const PAWN_ART_PX = 16;
/** Pixel: how far the pieces lean back, a share of your view's pitch. */
const PIXEL_TILT = 0.38;

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
/** Pixel: the reference pawn's height (m) the art pixel is worked out from; the clear colors and draw buffers, made once. */
const PAWN_M = 1.0;
const SKY_RGBA = new Float32Array([SKY[0], SKY[1], SKY[2], 1]);
const NONE_RGBA = new Float32Array(4);
/** (WebGL's COLOR_ATTACHMENT0 and 1, and NONE: numbers, so Node's tests can load this file.) */
const DRAW_COLOR = [0x8ce0, 0];
const DRAW_BOTH = [0x8ce0, 0x8ce1];
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

/** A set of solid pieces (3D or Pixel): its program, its instances, a VAO a kind. */
interface Solid {
  prog: WebGLProgram;
  uVP: WebGLUniformLocation;
  uEye: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation;
  uSlide: WebGLUniformLocation;
  uLift: WebGLUniformLocation;
  /** (Pixel's: which kind, the lean, the small target's size, the way you look.) */
  uKind: WebGLUniformLocation | null;
  uTilt: WebGLUniformLocation | null;
  uRes: WebGLUniformLocation | null;
  uFwd: WebGLUniformLocation | null;
  buf: WebGLBuffer;
  data: Float32Array;
  /** A kind's VAO, its triangles' first index and count, and how many of it stand on the board now. */
  kinds: { vao: WebGLVertexArrayObject; first: number; count: number; n: number }[];
}

/** The WebGL 2 arena. `create` returns null where there's no WebGL 2 (the page shows a still instead). */
export class ArenaGL {
  readonly gl: WebGL2RenderingContext;
  private readonly scene: { prog: WebGLProgram; vao: WebGLVertexArrayObject; n: number; tex: WebGLTexture; uVP: WebGLUniformLocation };
  private readonly sprite: { prog: WebGLProgram; uVP: WebGLUniformLocation; uEye: WebGLUniformLocation; uTime: WebGLUniformLocation; uJump: WebGLUniformLocation; uSlide: WebGLUniformLocation };
  /** The crowd and the arena's figures: `n` instances drawn, `people` of them the crowd. */
  private readonly crowd: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; n: number; people: number; tex: WebGLTexture | null };
  private readonly props: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; data: Float32Array; n: number; tex: WebGLTexture | null };
  /** The 3D pieces and the pixel set, each built the first time it's chosen (the gear's Pieces); 2D: the props, exactly as before. */
  private readonly solids: Partial<Record<"3d" | "pixel", Solid>> = {};
  /** Which pieces are drawn (the gear's Pieces: Pixel, 3D, 2D = "flat"); Pixel draws the whole arena on the pixel grid. */
  private style: PieceStyle = "flat";
  /** Pixel's small target: color, the pieces' marks (which, how near), depth; its size, and its program (made the first time). */
  private px: {
    fb: WebGLFramebuffer;
    col: WebGLTexture;
    id: WebGLTexture;
    depth: WebGLRenderbuffer;
    /** The outlined picture, still small, and its framebuffer. */
    outFb: WebGLFramebuffer;
    out: WebGLTexture;
    w: number;
    h: number;
    line: { prog: WebGLProgram; uSize: WebGLUniformLocation };
    up: { prog: WebGLProgram; uScale: WebGLUniformLocation; uSize: WebGLUniformLocation };
    vao: WebGLVertexArrayObject;
  } | null = null;
  /** Pixel: screen pixels an art pixel, and the view and screen size it was worked out for. */
  pixelScale = 1;
  private scaleFor: { view: View | null; w: number; h: number } = { view: null, w: 0, h: 0 };
  private last: { pieces: readonly FloorPiece[]; t0: number } = { pieces: [], t0: -NEVER };
  private readonly proj = new Float32Array(16);
  private readonly viewM = new Float32Array(16);
  private readonly vp = new Float32Array(16);
  readonly fwd = new Float32Array(3);
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
    if (style !== "flat") {
      this.solids[style] = this.buildSolid(style);
      this.style = style;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(SKY[0], SKY[1], SKY[2], 1);
  }

  /** The 3D pieces or the pixel set: the six meshes in one buffer (built once), the instances' buffer, a VAO a kind. */
  private buildSolid(style: "3d" | "pixel"): Solid {
    const gl = this.gl;
    const prog = style === "pixel" ? program(gl, VS_PIECE_PX, FS_PIECE_PX) : program(gl, VS_PIECE, FS_PIECE);
    const meshes: Record<Kind, PieceMesh> = style === "pixel" ? pixelMeshes() : pieceMeshes();
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
    return { prog, uVP: u("uVP"), uEye: v("uEye"), uTime: u("uTime"), uSlide: u("uSlide"), uLift: u("uLift"), uKind: v("uKind"), uTilt: v("uTilt"), uRes: v("uRes"), uFwd: v("uFwd"), buf, data, kinds };
  }

  /** Which pieces are drawn. */
  get pieceStyle(): PieceStyle {
    return this.style;
  }
  /** Draws the pieces as Pixel, 3D or 2D (the gear's Pieces, at once: the same position), a set built the first time it's chosen. */
  setPieceStyle(style: PieceStyle): void {
    if (style === this.style) return;
    if (style !== "flat" && !this.solids[style]) {
      this.solids[style] = this.buildSolid(style);
      this.gl.bindVertexArray(null);
    }
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
    const solid = this.style === "flat" ? null : (this.solids[this.style] ?? null);
    if (solid) for (const k of solid.kinds) k.n = 0;
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
    const pixel = this.style === "pixel";
    const px = pixel ? this.pixelTarget(view, w, h) : null;
    if (px) {
      // Pixel: everything into the small target; the arena and the crowd mark no piece.
      gl.bindFramebuffer(gl.FRAMEBUFFER, px.fb);
      gl.viewport(0, 0, px.w, px.h);
      gl.drawBuffers(DRAW_BOTH);
      gl.clearBufferfv(gl.COLOR, 0, SKY_RGBA);
      gl.clearBufferfv(gl.COLOR, 1, NONE_RGBA);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.drawBuffers(DRAW_COLOR);
    } else {
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
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
    const solid = this.style === "flat" ? null : (this.solids[this.style] ?? null);
    if (solid) {
      // The 3D pieces or the pixel set: a draw call a kind on the board; their shadows blend onto the board.
      gl.useProgram(solid.prog);
      gl.uniformMatrix4fv(solid.uVP, false, this.vp);
      if (solid.uEye) gl.uniform3f(solid.uEye, view.eye[0], view.eye[1], view.eye[2]);
      gl.uniform1f(solid.uTime, time);
      gl.uniform1f(solid.uSlide, SLIDE_S);
      gl.uniform1f(solid.uLift, BOARD.lift);
      if (px) {
        gl.drawBuffers(DRAW_BOTH);
        gl.uniform1f(solid.uTilt, PIXEL_TILT);
        gl.uniform2f(solid.uRes, px.w, px.h);
        gl.uniform3f(solid.uFwd, this.fwd[0]!, this.fwd[1]!, this.fwd[2]!);
      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (let i = 0; i < solid.kinds.length; i++) {
        const k = solid.kinds[i]!;
        if (!k.n) continue;
        if (px) gl.uniform1f(solid.uKind, i);
        gl.bindVertexArray(k.vao);
        gl.drawElementsInstanced(gl.TRIANGLES, k.count, gl.UNSIGNED_SHORT, k.first * 2, k.n);
        calls++;
      }
      gl.disable(gl.BLEND);
    }
    if (px) {
      // The pieces' outline, still small; then up to the screen, nearest-neighbor.
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(px.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, px.outFb);
      gl.useProgram(px.line.prog);
      gl.uniform2i(px.line.uSize, px.w, px.h);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, px.id);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, px.col);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      calls++;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(px.up.prog);
      gl.uniform1f(px.up.uScale, this.pixelScale);
      gl.uniform2i(px.up.uSize, px.w, px.h);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, px.out);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      calls++;
      gl.enable(gl.DEPTH_TEST);
    }
    gl.bindVertexArray(null);
    this.drawCalls = calls;
  }

  /**
   * Pixel's small target for this view on a w × h screen: made the first time, sized again only when the screen's size or the
   * art pixel's changes. The art pixel (`pixelScale`) is worked out only when the view or the screen's size changes: a pawn on
   * the board's middle (standing as the pieces do) about PAWN_ART_PX art pixels tall, at least 2 screen pixels an art pixel.
   */
  private pixelTarget(view: View, w: number, h: number): NonNullable<ArenaGL["px"]> {
    const gl = this.gl;
    const f = this.scaleFor;
    if (f.view !== view || f.w !== w || f.h !== h) {
      f.view = view;
      f.w = w;
      f.h = h;
      // (Standing as the pieces do: leaning back toward you by PIXEL_TILT of your pitch.)
      const lean = Math.asin(Math.max(-1, Math.min(1, -this.fwd[1]!))) * PIXEL_TILT;
      const fl = Math.hypot(this.fwd[0]!, this.fwd[2]!) || 1;
      const k = (Math.sin(lean) * PAWN_M) / fl;
      const a = project(this.vp, 0, BOARD.lift, 0, w, h);
      const b = project(this.vp, this.fwd[0]! * k, BOARD.lift + Math.cos(lean) * PAWN_M, this.fwd[2]! * k, w, h);
      this.pixelScale = a && b ? Math.max(2, Math.round(Math.abs(a[1] - b[1]) / PAWN_ART_PX)) : 2;
    }
    if (!this.px) {
      const line = program(gl, VS_FULL, FS_OUTLINE);
      const up = program(gl, VS_FULL, FS_UP);
      const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n)!;
      gl.useProgram(line);
      gl.uniform1i(u(line, "uCol"), 0);
      gl.uniform1i(u(line, "uId"), 1);
      gl.useProgram(up);
      gl.uniform1i(u(up, "uOut"), 0);
      this.px = {
        fb: gl.createFramebuffer()!,
        col: gl.createTexture()!,
        id: gl.createTexture()!,
        depth: gl.createRenderbuffer()!,
        outFb: gl.createFramebuffer()!,
        out: gl.createTexture()!,
        w: 0,
        h: 0,
        line: { prog: line, uSize: u(line, "uSize") },
        up: { prog: up, uScale: u(up, "uScale"), uSize: u(up, "uSize") },
        vao: gl.createVertexArray()!,
      };
    }
    const t = this.px;
    const tw = Math.ceil(w / this.pixelScale);
    const th = Math.ceil(h / this.pixelScale);
    if (t.w !== tw || t.h !== th) {
      t.w = tw;
      t.h = th;
      for (const tex of [t.col, t.id, t.out]) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      gl.bindRenderbuffer(gl.RENDERBUFFER, t.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, tw, th);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.col, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, t.id, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.depth);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.outFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.out, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    return t;
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
