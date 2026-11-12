/**
 * The Hidden Boss's room's scene (Nov 12, a MOCKUP for Eric): drawn into the room (ShopRoom.tsx's `RoomFx`) by its caller.
 *
 * **The child playing himself** on the rug: his famous 1956 game (shops/recluse-game.ts), all 41 moves to the mate, on a loop. He sits
 * behind the board facing us (Black's side, his side in that game); for each move he thinks, reaches out, lifts the piece, carries it
 * over and puts it down, sits back and looks up. White's moves are on our side of the board: he leans well over to play them. The last
 * move's squares stay tinted, as a board app shows them, so each move reads. At the mate he sits back and smiles; the pieces fade out
 * and the start fades in, and it plays again. His drawing is the age-9 one (characters/recluse-ages.ts, sitting); his reaching arm is
 * drawn here (from his shoulder to the piece), the board flat on the floor through the room's own camera, its pieces the park tables'
 * (intro.ts `pieceImg`). Nothing runs an engine.
 *
 * **The summoning** (Eric, Nov 12, night), with four stand-in players (plain pawns in four colors; real players later): a freeze frame
 * (a flash: the four, and the child, become still images); the board shoots rays of light outward along the floor and upward; the four
 * burst into particles all at once and are drawn into the light; the light and the particles draw back over the board, fall and
 * splash into it; the board wobbles up and down and settles; quiet. Then the transition: the room closes in on the board (an iris) to
 * black, and the match. Times in feel.ts `HIDDEN_ROOM_FEEL`. One canvas, the room's; a few hundred particles at most.
 */
import { renderFrame } from "../../characters/sprite.ts";
import { RECLUSE_CHILD_SIT, sitKnee, sitName, sitShoulder, type SitPose } from "../../characters/recluse-ages.ts";
import { proj, newPt } from "../camera.ts";
import { HIDDEN_ROOM_FEEL, TOWN_FEEL } from "../feel.ts";
import { PAWN_PATH } from "../render.ts";
import { pieceImg } from "./intro.ts";
import { RECLUSE_GAME, kidAt, type Board, type KidNow } from "./recluse-game.ts";
import { SHOP_RECLUSE_SCENE } from "./recluse-art.ts";
import type { FxDraw, RoomFx } from "./ShopRoom.tsx";

const SQ = 37;
const K = HIDDEN_ROOM_FEEL.kid;
const S = HIDDEN_ROOM_FEEL.summon;
const pt = newPt();
const q = newPt();
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (u: number) => u * u * (3 - 2 * u);

/** A point on the floor (squares) on screen, `lift` room pixels up: into `out`; false when it's off the camera. */
function at(d: FxDraw, c: number, r: number, lift: number, out = pt): boolean {
  if (!proj(d.v, c - d.camX, d.camY - r, 0, out)) return false;
  out.y -= (lift * out.k) / SQ;
  return true;
}

// ---- The child's drawings, each pose drawn once into a canvas the first time it's shown.

const kidImgs = new Map<string, HTMLCanvasElement>();
function kidImg(p: SitPose): HTMLCanvasElement {
  const name = sitName(p);
  let c = kidImgs.get(name);
  if (c) return c;
  const ch = RECLUSE_CHILD_SIT;
  const { w, h, data } = renderFrame(ch, ch.anims[name]!.frames[0]!);
  c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  kidImgs.set(name, c);
  return c;
}

// ---- Where the board's squares are: file 0 (a) on our left, rank 0 (White's first) nearest us.

const B = { c: SHOP_RECLUSE_SCENE.board[0], r: SHOP_RECLUSE_SCENE.board[1], size: K.board } as const;
const cell = B.size / 8;
/** A board square's middle in the room's squares. */
const sqC = (i: number) => B.c - B.size / 2 + ((i % 8) + 0.5) * cell;
const sqR = (i: number) => B.r + B.size / 2 - (Math.floor(i / 8) + 0.5) * cell;

/** The child's hand and the piece in it now: where (squares and lift), and which piece (null: an empty hand). */
interface Hand {
  side: "l" | "r";
  c: number;
  r: number;
  lift: number;
  piece: string | null;
}
/** His pose and his hand now, from where he is in his loop. */
function poseOf(n: KidNow): { pose: SitPose; hand: Hand | null; moving: number; skip: readonly number[] } {
  const { plies } = RECLUSE_GAME;
  const ply = n.ply >= 0 && n.ply < plies.length ? plies[n.ply]! : null;
  const rest: SitPose = { lean: 0, reach: "", eyes: "down", mouth: "stern" };
  if (n.step === "end" || n.step === "fade") return { pose: { ...rest, eyes: n.step === "end" && n.u > 0.2 ? "ahead" : "down", mouth: "smile" }, hand: null, moving: -1, skip: [] };
  if (!ply) return { pose: { ...rest, eyes: n.u < 0.6 ? "ahead" : "down" }, hand: null, moving: -1, skip: [] };
  const white = n.ply % 2 === 0;
  // (The hand on the side of the piece's file: a, b, c, d our left; e to h our right.)
  const side: "l" | "r" = ply.from % 8 < 4 ? "l" : "r";
  // (How far over the board he leans: White's side, nearest us, well over; his own back ranks hardly.)
  const far = (i: number) => Math.floor(i / 8);
  const lean: 0 | 1 | 2 = white ? 2 : Math.min(far(ply.from), far(ply.to)) <= 4 ? 1 : 0;
  const knee = (s: "l" | "r") => ({ c: SHOP_RECLUSE_SCENE.kid[0] + (sitKnee(s)[0] - RECLUSE_CHILD_SIT.foot[0]) * K.scale / SQ, r: SHOP_RECLUSE_SCENE.kid[1] - 0.02 });
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
  if (n.step === "think") return { pose: { ...rest, lean: n.u > 0.5 && lean === 2 ? 1 : 0, eyes: n.u > 0.82 && n.u < 0.9 ? "shut" : "down" }, hand: null, moving: -1, skip: [] };
  const from = { c: sqC(ply.from), r: sqR(ply.from) };
  const to = { c: sqC(ply.to), r: sqR(ply.to) };
  if (n.step === "reach") {
    const u = ease(n.u);
    const k = knee(side);
    return { pose: { lean: u > 0.4 ? lean : (Math.min(lean, 1) as 0 | 1), reach: side, eyes: "down", mouth: "stern" }, hand: { side, c: lerp(k.c, from.c, u), r: lerp(k.r, from.r, u), lift: 6 * Math.sin(u * Math.PI), piece: null }, moving: -1, skip: [] };
  }
  if (n.step === "carry") {
    const u = ease(n.u);
    const up = Math.sin(u * Math.PI) * K.lift * cell * SQ;
    // (Castling: the rook hops over with the king, a step behind.)
    return {
      pose: { lean, reach: side, eyes: "down", mouth: "stern" },
      hand: { side, c: lerp(from.c, to.c, u), r: lerp(from.r, to.r, u), lift: up, piece: ply.piece },
      moving: ply.from,
      skip: ply.rook ? [ply.rook[0]] : [],
    };
  }
  if (n.step === "back") {
    const u = ease(n.u);
    const k = knee(side);
    return { pose: { lean: u < 0.5 ? lean : 0, reach: side, eyes: u > 0.7 ? "ahead" : "down", mouth: "stern" }, hand: { side, c: lerp(to.c, k.c, u), r: lerp(to.r, k.r, u), lift: 6 * Math.sin(u * Math.PI), piece: null }, moving: -1, skip: [] };
  }
  // He looks up at us a moment (a blink in the middle), then back down.
  return { pose: { ...rest, eyes: n.u > 0.45 && n.u < 0.55 ? "shut" : n.u < 0.75 ? "ahead" : "down" }, hand: null, moving: -1, skip: [] };
}

// ---- The board on the floor.

const INK = { light: "#e9d5ac", dark: "#9a6a43", edge: "#5a3820", side: "#3e2616", tint: "rgba(255, 214, 70, 0.55)" } as const;
const grid = Array.from({ length: 81 }, () => newPt());
/** The board, its squares and its pieces (`board`, the piece in the hand left off; the last move tinted), `lift` room pixels up. */
function drawBoard(d: FxDraw, board: Board, last: { from: number; to: number } | null, skip: readonly number[], fade: number, lift: number, glow = 0) {
  const g = d.g;
  const half = B.size / 2;
  // Its frame (a wooden rim round the squares) and its near edge's thickness.
  const rim = cell * 0.35;
  const corners: [number, number][] = [[-half - rim, -half - rim], [half + rim, -half - rim], [half + rim, half + rim], [-half - rim, half + rim]];
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    if (!at(d, B.c + corners[i]![0], B.r + corners[i]![1], lift, q)) return;
    if (i) g.lineTo(q.x, q.y);
    else g.moveTo(q.x, q.y);
  }
  g.closePath();
  g.fillStyle = INK.edge;
  g.fill();
  if (at(d, B.c - half - rim, B.r + half + rim, lift, q)) {
    const x0 = q.x;
    const y0 = q.y;
    at(d, B.c + half + rim, B.r + half + rim, lift, q);
    g.fillStyle = INK.side;
    g.fillRect(x0, y0, q.x - x0, Math.max(1.5, (2.5 * q.k) / SQ));
  }
  // The squares.
  for (let gi = 0; gi < 9; gi++) for (let fi = 0; fi < 9; fi++) if (!at(d, B.c - half + fi * cell, B.r - half + gi * cell, lift, grid[gi * 9 + fi]!)) return;
  for (const dark of [false, true]) {
    g.beginPath();
    for (let gi = 0; gi < 8; gi++)
      for (let fi = 0; fi < 8; fi++) {
        // (Row gi from the far edge: rank 7 - gi; a1 dark, as a board's is.)
        if (((fi + (7 - gi)) % 2 === 0) !== dark) continue;
        const p0 = grid[gi * 9 + fi]!;
        const p1 = grid[gi * 9 + fi + 1]!;
        const p2 = grid[(gi + 1) * 9 + fi + 1]!;
        const p3 = grid[(gi + 1) * 9 + fi]!;
        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
        g.lineTo(p3.x, p3.y);
        g.closePath();
      }
    g.fillStyle = dark ? INK.dark : INK.light;
    g.fill();
  }
  // The last move, tinted.
  if (last) {
    g.fillStyle = INK.tint;
    for (const s of [last.from, last.to]) {
      const fi = s % 8;
      const gi = 7 - Math.floor(s / 8);
      const p0 = grid[gi * 9 + fi]!;
      const p2 = grid[(gi + 1) * 9 + fi + 1]!;
      g.fillRect(p0.x, p0.y, p2.x - p0.x, p2.y - p0.y);
    }
  }
  if (glow > 0) {
    // (The summoning: the board's face lit from within.)
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = glow;
    g.fillStyle = "#ffe9a8";
    g.beginPath();
    g.moveTo(grid[0]!.x, grid[0]!.y);
    g.lineTo(grid[8]!.x, grid[8]!.y);
    g.lineTo(grid[80]!.x, grid[80]!.y);
    g.lineTo(grid[72]!.x, grid[72]!.y);
    g.fill();
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
  }
  // The pieces, far ranks first.
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1 - fade;
  for (let rank = 7; rank >= 0; rank--)
    for (let file = 0; file < 8; file++) {
      const i = rank * 8 + file;
      const p = board[i];
      if (!p || skip.includes(i)) continue;
      drawPiece(d, p, sqC(i), sqR(i), lift);
    }
  g.globalAlpha = 1;
}
/** One piece standing on the board at (c, r), `lift` room pixels up: the park tables' pixel pieces, about a square and a half tall. */
function drawPiece(d: FxDraw, p: string, c: number, r: number, lift: number) {
  if (!at(d, c, r, lift, q)) return;
  const img = pieceImg(p[1]!, p[0] === "w", p[0] === "b");
  const ps = (cell * q.k) / 8.5;
  d.g.drawImage(img, q.x - (img.width * ps) / 2, q.y - (img.height - 2.5) * ps, img.width * ps, img.height * ps);
}

// ---- The child.

const SKIN = { dark: "#9c522f", mid: "#c87a4a", light: "#e4a06c" } as const;
const SLEEVE = { red: "#c4443a", cream: "#efe7d6", line: "#2a1a14" } as const;
/** The child at his place, in a pose (his drawing, scaled to the room as the bosses are), and his reaching arm and hand. */
function drawKid(d: FxDraw, pose: SitPose, hand: Hand | null, alpha = 1) {
  const g = d.g;
  if (!at(d, SHOP_RECLUSE_SCENE.kid[0], SHOP_RECLUSE_SCENE.kid[1], 0)) return;
  const ch = RECLUSE_CHILD_SIT;
  const s = (pt.k / SQ) * K.scale;
  const img = kidImg(pose);
  const x0 = pt.x - ch.foot[0] * s;
  const y0 = pt.y - ch.foot[1] * s;
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = s < 1.5;
  g.drawImage(img, x0, y0, img.width * s, img.height * s);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  return { x0, y0, s };
}
/** His arm out to his hand (drawn over the board): a short striped sleeve, the forearm, the hand round the piece. */
function drawArm(d: FxDraw, pose: SitPose, hand: Hand, kid: { x0: number; y0: number; s: number }) {
  const g = d.g;
  const sh = sitShoulder(hand.side, pose.lean);
  const sx = kid.x0 + sh[0] * kid.s;
  const sy = kid.y0 + sh[1] * kid.s;
  if (!at(d, hand.c, hand.r, hand.lift + (hand.piece ? 6 : 2), q)) return;
  const hx = q.x;
  const hy = q.y;
  const w = 3.6 * kid.s;
  // (Elbow: a little out to his side, a little down, so the arm bends.)
  const ex = sx + (hx - sx) * 0.45 + (hand.side === "l" ? -1 : 1) * 2.5 * kid.s;
  const ey = sy + (hy - sy) * 0.55 + 2 * kid.s;
  g.lineCap = "round";
  g.lineJoin = "round";
  const stroke = (pts: readonly (readonly [number, number])[], width: number, color: string) => {
    g.beginPath();
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]![0], pts[i]![1]);
    g.lineWidth = width;
    g.strokeStyle = color;
    g.stroke();
  };
  const arm = [[sx, sy], [ex, ey], [hx, hy]] as const;
  stroke(arm, w + 2 * kid.s, SLEEVE.line);
  stroke(arm, w, SKIN.mid);
  // (A lit stripe down the arm's top.)
  stroke([[sx, sy - w * 0.2], [ex, ey - w * 0.2], [hx, hy - w * 0.2]], w * 0.35, SKIN.light);
  // The short sleeve: red and cream stripes over the shoulder.
  const ux = sx + (ex - sx) * 0.5;
  const uy = sy + (ey - sy) * 0.5;
  stroke([[sx, sy], [ux, uy]], w + 2.6 * kid.s, SLEEVE.line);
  stroke([[sx, sy], [ux, uy]], w + 1.2 * kid.s, SLEEVE.red);
  stroke([[sx + (ux - sx) * 0.35, sy + (uy - sy) * 0.35], [sx + (ux - sx) * 0.6, sy + (uy - sy) * 0.6]], w + 1.2 * kid.s, SLEEVE.cream);
  // The piece in his fingers, then the hand round it.
  if (hand.piece) drawPiece(d, hand.piece, hand.c, hand.r, hand.lift);
  g.beginPath();
  g.ellipse(hx, hy, w * 0.9, w * 0.75, 0, 0, Math.PI * 2);
  g.fillStyle = SLEEVE.line;
  g.fill();
  g.beginPath();
  g.ellipse(hx, hy, w * 0.9 - kid.s, w * 0.75 - kid.s, 0, 0, Math.PI * 2);
  g.fillStyle = SKIN.light;
  g.fill();
}

// ---- The stand-in players: plain pawns, four colors, a little life in them until the freeze.

const PAWN = typeof Path2D === "undefined" ? null : new Path2D(PAWN_PATH);
const PAWN_FOOT = (39.5 + 0.75) / 45;
const STAND_INS = ["#ffffff", "#2b2b33", "#8fc7ff", "#ffb3c9"] as const;
function drawPawn(d: FxDraw, i: number, now: number, still: boolean, alpha = 1) {
  if (!PAWN) return;
  const [c, r] = SHOP_RECLUSE_SCENE.players[i]!;
  if (!at(d, c, r, 0)) return;
  const g = d.g;
  const h = TOWN_FEEL.youSquares * pt.k;
  // (Alive: a slow sway and a bob, each its own time; still: as it was at the freeze.)
  const t = still ? frozenAt : now;
  const bob = Math.max(0, Math.sin(t / 420 + i * 1.7)) * 0.04 * h;
  const tilt = Math.sin(t / 900 + i) * 0.05;
  g.save();
  g.globalAlpha = alpha;
  // (Its shadow.)
  g.fillStyle = "rgba(26,14,8,0.35)";
  g.beginPath();
  g.ellipse(pt.x, pt.y, h * 0.24, h * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  g.translate(pt.x, pt.y - bob);
  g.rotate(tilt);
  const u = h / 45;
  g.translate(-h / 2, -PAWN_FOOT * h);
  g.scale(u, u);
  g.fillStyle = STAND_INS[i]!;
  g.fill(PAWN);
  g.lineWidth = 1.5;
  g.lineCap = "round";
  g.strokeStyle = "#000000";
  g.stroke(PAWN);
  if (still) {
    // (A still image: a white photo edge round it, a touch washed out.)
    g.globalAlpha = alpha * 0.35;
    g.fillStyle = "#f4ecd8";
    g.fill(PAWN);
    g.globalAlpha = alpha;
    g.lineWidth = 3;
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.stroke(PAWN);
  }
  g.restore();
}

// ---- The summoning's particles: the players burst into them, all at once.

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  /** Its place in the light column it's drawn into (0 to 1, up the column) and its turn round it. */
  up: number;
  turn: number;
}
let bits: Bit[] = [];
let frozenAt = 0;
let kidFrozen: { pose: SitPose; hand: Hand | null; n: KidNow; moving: number; skip: readonly number[] } | null = null;
/** Each player's pixels at the freeze, into particles (screen pixels). */
function burst(d: FxDraw) {
  bits = [];
  for (let i = 0; i < 4; i++) {
    const [c, r] = SHOP_RECLUSE_SCENE.players[i]!;
    if (!at(d, c, r, 0)) continue;
    const h = TOWN_FEEL.youSquares * pt.k;
    for (let b = 0; b < S.bits; b++) {
      // (Points inside the pawn's shape: its head, its body and its base; the base widest.)
      const a = (b * 2.399) % (Math.PI * 2);
      const v = (b / S.bits) ** 0.8;
      const y = pt.y - h * (0.05 + 0.75 * v);
      const wHalf = h * (v > 0.75 ? 0.12 : v < 0.2 ? 0.22 : 0.1 + 0.04 * Math.sin(v * 9));
      const x = pt.x + Math.cos(a) * wHalf * ((b * 7919) % 100) / 100;
      const out = Math.atan2(y - (pt.y - h * 0.4), x - pt.x);
      const sp = (0.6 + ((b * 37) % 10) / 10) * pt.k * 0.012;
      bits.push({ x, y, vx: Math.cos(out) * sp, vy: Math.sin(out) * sp - pt.k * 0.004, color: b % 5 === 0 ? "#fff6cf" : STAND_INS[i]!, size: Math.max(1.2, (pt.k / SQ) * (1.2 + (b % 3) * 0.5)), up: ((b * 0.618) % 1) * 0.9 + 0.1, turn: (b * 1.3) % (Math.PI * 2) });
    }
  }
}

/** The summoning now, from its start (ms): each beat's 0 to 1. */
export interface SummonNow {
  t: number;
  flash: number;
  rays: number;
  burst: number;
  drawBack: number;
  fall: number;
  splash: number;
  wobble: number;
  iris: number;
}
export function summonAt(t: number): SummonNow {
  const u = (a: number, ms: number) => clamp01((t - a) / ms);
  return {
    t,
    flash: t < S.rays ? 1 - t / S.rays : 0,
    rays: t < S.rays ? 0 : t < S.drawBack ? u(S.rays, 500) : 1 - u(S.drawBack, S.fall - S.drawBack),
    burst: u(S.burst, S.drawBack - S.burst),
    drawBack: u(S.drawBack, S.fall - S.drawBack),
    fall: u(S.fall, S.splash - S.fall),
    splash: u(S.splash, 700),
    wobble: u(S.splash, S.wobbleMs),
    iris: u(S.iris, S.irisMs),
  };
}

/** The board's lift as it wobbles (room pixels): up and down, settling. */
export const wobbleLift = (w: number): number => (w <= 0 || w >= 1 ? 0 : 7 * Math.sin(w * Math.PI * 5) * (1 - w) ** 1.6);

/** The scene: the child at his game; `summon(at)` starts the summoning at the room's time `at`; `t0` shifts the child's loop (ms). */
export interface RecluseScene {
  fx: RoomFx;
  summon: (at: number) => void;
  reset: () => void;
  /** Where the summoning is (null: not started), for the preview and its tests. */
  state: () => { summonT: number | null; ply: number };
}
export function recluseScene(t0 = 0): RecluseScene {
  let start: number | null = null;
  let lastNow = 0;
  let burstDone = false;
  const kidState = (now: number) => {
    const n = kidAt(now + t0);
    const p = poseOf(n);
    return { n, ...p };
  };
  const figures: { z: number; draw: (d: FxDraw, now: number) => void }[] = [];
  const kidFig = {
    z: SHOP_RECLUSE_SCENE.kid[1],
    draw: (d: FxDraw, now: number) => {
      const s = start === null ? null : summonAt(now - start);
      const k = kidFrozen && s ? kidFrozen : kidState(now);
      const n = k.n;
      const last = n.ply > 0 && (n.step === "think" || n.step === "reach" || n.step === "end") ? RECLUSE_GAME.plies[n.ply - 1] ?? null : n.step === "back" || n.step === "look" ? RECLUSE_GAME.plies[n.ply] ?? null : null;
      const kid = drawKid(d, k.pose, k.hand);
      const lift = s ? wobbleLift(s.wobble) : 0;
      const glow = s ? Math.max(s.rays * 0.5, s.splash > 0 ? (1 - s.splash) * 0.8 : 0) : 0;
      drawBoard(d, n.board, n.step === "fade" ? null : last, k.moving >= 0 ? [k.moving, ...k.skip] : k.skip, n.fade, lift, glow);
      // (Castling's rook, a step behind the king.)
      if (k.skip.length && k.hand) {
        const ply = RECLUSE_GAME.plies[n.ply]!;
        const u = Math.max(0, n.u - 0.25) / 0.75;
        drawPiece(d, n.board[ply.rook![0]]!, sqC(ply.rook![0]) + (sqC(ply.rook![1]) - sqC(ply.rook![0])) * ease(u), sqR(ply.rook![0]), Math.sin(u * Math.PI) * cell * SQ * 0.4);
      }
      if (k.hand && kid) drawArm(d, k.pose, k.hand, kid);
    },
  };
  const pawnFigs = SHOP_RECLUSE_SCENE.players.map((p, i) => ({
    z: p[1],
    draw: (d: FxDraw, now: number) => {
      const s = start === null ? null : summonAt(now - start);
      if (s && s.burst > 0) return;
      drawPawn(d, i, now, !!s);
    },
  }));
  const fx: RoomFx = {
    hideYou: () => true,
    figures: (now) => {
      lastNow = now;
      figures.length = 0;
      figures.push(kidFig, ...pawnFigs);
      return figures;
    },
    over: (d, now) => {
      if (start === null) return;
      const s = summonAt(now - start);
      if (!burstDone && s.burst > 0) {
        burst(d);
        burstDone = true;
      }
      drawSummon(d, s);
    },
  };
  return {
    fx,
    summon: (when) => {
      start = when;
      frozenAt = when;
      burstDone = false;
      const k = kidState(when);
      kidFrozen = k;
    },
    reset: () => {
      start = null;
      kidFrozen = null;
      bits = [];
    },
    state: () => ({ summonT: start === null ? null : lastNow - start, ply: kidAt(lastNow + t0).ply }),
  };
}

// ---- The summoning's light: drawn over the room.

/** A soft round glow, made once. */
let glowImg: HTMLCanvasElement | null = null;
function glow(): HTMLCanvasElement {
  if (glowImg) return glowImg;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,248,214,1)");
  gr.addColorStop(0.35, "rgba(255,226,140,0.55)");
  gr.addColorStop(1, "rgba(255,210,110,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return (glowImg = c);
}
const RAYS_UP = 9;
const RAYS_FLOOR = 12;
function drawSummon(d: FxDraw, s: SummonNow) {
  const g = d.g;
  if (!at(d, B.c, B.r, 0, q)) return;
  const bx = q.x;
  const by = q.y;
  const k = q.k;
  g.save();
  g.globalCompositeOperation = "lighter";
  // The rays: along the floor, outward (flattened as the floor is), and upward in a fan; flickering, turning slowly.
  if (s.rays > 0) {
    const len = ease(s.rays) * k * 4.2;
    const spin = s.t / 2600;
    g.fillStyle = "#ffe7a0";
    for (let i = 0; i < RAYS_FLOOR; i++) {
      const a = (i / RAYS_FLOOR) * Math.PI * 2 + spin;
      const wd = 0.07 + 0.03 * Math.sin(i * 3.1 + s.t / 140);
      g.globalAlpha = 0.28 * s.rays * (0.7 + 0.3 * Math.sin(s.t / 90 + i));
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a - wd) * len, by + Math.sin(a - wd) * len * 0.42);
      g.lineTo(bx + Math.cos(a + wd) * len, by + Math.sin(a + wd) * len * 0.42);
      g.fill();
    }
    for (let i = 0; i < RAYS_UP; i++) {
      const a = -Math.PI / 2 + ((i - (RAYS_UP - 1) / 2) / RAYS_UP) * 2.2 + Math.sin(spin * 2 + i) * 0.05;
      const wd = 0.035 + 0.02 * Math.sin(i * 1.7 + s.t / 120);
      const l = len * (1.1 + 0.25 * Math.sin(i * 2.3));
      g.globalAlpha = 0.34 * s.rays * (0.7 + 0.3 * Math.sin(s.t / 70 + i * 2));
      g.beginPath();
      g.moveTo(bx - k * 0.1, by);
      g.lineTo(bx + Math.cos(a - wd) * l, by + Math.sin(a - wd) * l);
      g.lineTo(bx + Math.cos(a + wd) * l, by + Math.sin(a + wd) * l);
      g.lineTo(bx + k * 0.1, by);
      g.fill();
    }
    // The column of light over the board, and its glow.
    g.globalAlpha = 0.5 * s.rays;
    const cw = k * 0.5 * (1 - s.drawBack * 0.7);
    const ch = len * 1.2;
    g.fillRect(bx - cw / 2, by - ch, cw, ch);
    g.globalAlpha = 0.9 * s.rays;
    const gs = k * (1.6 + 0.2 * Math.sin(s.t / 110));
    g.drawImage(glow(), bx - gs, by - gs * 0.6, gs * 2, gs * 1.2);
  }
  // The particles: out from where each player stood, then drawn into the light column, round it and up; then all of them, and the
  // light, drawn back to a point over the board; then falling into it.
  if (s.burst > 0 && s.splash <= 0) {
    const top = by - k * 2.2;
    const pull = ease(clamp01((s.burst - 0.12) / 0.88));
    const gather = ease(s.drawBack);
    const fall = s.fall * s.fall;
    const px = bx;
    const py = top + (by - top) * fall;
    for (const b of bits) {
      // (A burst: out for a moment, slowing.)
      const tb = Math.min(s.burst, 0.15) / 0.15;
      const ox = b.x + b.vx * 18 * (1 - (1 - tb) ** 2);
      const oy = b.y + b.vy * 18 * (1 - (1 - tb) ** 2);
      // (The column: round it, up it.)
      const turn = b.turn + s.t / 300;
      const cx = bx + Math.cos(turn) * k * 0.3 * (1 - gather);
      const cy = by - k * 0.3 - b.up * (by - top) * (1 - gather * 0.6);
      let x = ox + (cx - ox) * pull;
      let y = oy + (cy - oy) * pull;
      x += (px - x) * gather;
      y += (py - y) * Math.max(gather, fall);
      g.globalAlpha = 0.95;
      g.fillStyle = b.color;
      const sz = b.size * (1 + 0.6 * gather);
      g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    if (s.drawBack > 0) {
      g.globalAlpha = 0.85;
      const gs = k * (0.5 + 0.5 * s.drawBack) * (1 - 0.4 * s.fall);
      g.drawImage(glow(), px - gs, py - gs, gs * 2, gs * 2);
    }
  }
  // The splash: a ring of light out across the floor from the board, and drops of light thrown up and falling back.
  if (s.splash > 0 && s.splash < 1) {
    const u = s.splash;
    g.globalAlpha = 0.8 * (1 - u);
    g.strokeStyle = "#fff1c0";
    g.lineWidth = Math.max(1.5, k * 0.06 * (1 - u));
    g.beginPath();
    g.ellipse(bx, by, k * (0.6 + 2 * u), k * (0.6 + 2 * u) * 0.42, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#fff6cf";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = k * (0.5 + 1.2 * u);
      const hgt = k * 1.1 * Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(i * 2.7));
      const sz = Math.max(1.5, k * 0.05);
      g.globalAlpha = 0.9 * (1 - u);
      g.fillRect(bx + Math.cos(a) * r - sz / 2, by + Math.sin(a) * r * 0.42 - hgt - sz / 2, sz, sz);
    }
    g.globalAlpha = 0.9 * (1 - u);
    const gs = k * 1.4 * (1 - u * 0.5);
    g.drawImage(glow(), bx - gs, by - gs * 0.5, gs * 2, gs);
  }
  g.restore();
  // The freeze frame's flash.
  if (s.flash > 0) {
    g.fillStyle = `rgba(255,255,255,${0.6 * s.flash})`;
    g.fillRect(0, 0, d.W, d.H);
  }
  // The quiet: the room a touch dimmer; then the iris closing on the board, to black.
  const quiet = clamp01((s.t - S.quiet + 600) / 600);
  if (quiet > 0 && s.iris <= 0) {
    g.fillStyle = `rgba(10,8,18,${0.18 * quiet})`;
    g.fillRect(0, 0, d.W, d.H);
  }
  if (s.iris > 0) {
    const big = Math.hypot(d.W, d.H);
    const r = big * (1 - ease(s.iris));
    g.fillStyle = "#000";
    g.beginPath();
    g.rect(0, 0, d.W, d.H);
    if (r > 0.5) g.arc(bx, by - k * 0.2, r, 0, Math.PI * 2, true);
    g.fill("evenodd");
  }
}
