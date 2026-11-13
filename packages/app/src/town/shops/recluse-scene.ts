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
import { RECLUSE_CHILD_SIT, heelsHand, playName, playShoulder, sitKnee, sitName, sitShoulder, type PlayPose, type SitPose } from "../../characters/recluse-ages.ts";
import { proj, newPt } from "../camera.ts";
import { HIDDEN_ROOM_FEEL, TOWN_FEEL } from "../feel.ts";
import { PAWN_PATH } from "../render.ts";
import { pieceImg } from "./intro.ts";
import { KID_SPOTS, RECLUSE_GAME, kidAt, sideOf, stepsOf, walkPath, type Board, type KidNow } from "./recluse-game.ts";
import { SHOP_RECLUSE_N, SHOP_RECLUSE_SCENE, SHOP_RECLUSE_WALL_H, sideWallGrid } from "./recluse-art.ts";
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

// ---- Where the board's squares are: file 0 (a) on our left, rank 0 (White's first) nearest us.

const B = { c: SHOP_RECLUSE_SCENE.board[0], r: SHOP_RECLUSE_SCENE.board[1], size: K.board } as const;
const B0 = B;
const cell = B.size / 8;
/** A board square's middle in the room's squares. */
const sqC = (i: number) => B.c - B.size / 2 + ((i % 8) + 0.5) * cell;
const sqR = (i: number) => B.r + B.size / 2 - (Math.floor(i / 8) + 0.5) * cell;

// ---- The child's drawings, each pose drawn once into a canvas the first time it's shown.

const kidImgs = new Map<string, HTMLCanvasElement>();
function kidImg(name: string): HTMLCanvasElement {
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

/** The child's hand and the piece in it now: where (squares and lift), and which piece (null: an empty hand). */
interface Hand {
  side: "l" | "r";
  c: number;
  r: number;
  lift: number;
  piece: string | null;
}
/** The child now: where he is (his foot, squares), his drawing, his shoulder in it for the arm out, his hand; seen from behind or not. */
interface KidDraw {
  c: number;
  r: number;
  img: string;
  shoulder: readonly [number, number] | null;
  hand: Hand | null;
  back: boolean;
  moving: number;
  skip: readonly number[];
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const SEAT = { c: B0.c + KID_SPOTS.seat[0], r: B0.r + KID_SPOTS.seat[1] };
const play = (view: "f" | "b", stance: PlayPose["stance"], step: PlayPose["step"] = -1, lean: PlayPose["lean"] = 0, side: PlayPose["side"] = ""): PlayPose => ({ view, stance, step, lean, side });
/** A point `d` squares along a path (squares from the board's middle), in the room's squares. */
function along(pts: readonly (readonly [number, number])[], d: number): { c: number; r: number } {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l || i === pts.length - 1) {
      const u = l ? clamp01(d / l) : 1;
      return { c: B0.c + lerp(a[0], b[0], u), r: B0.r + lerp(a[1], b[1], u) };
    }
    d -= l;
  }
  return { c: B0.c + pts[0]![0], r: B0.r + pts[0]![1] };
}
const lenOf = (pts: readonly (readonly [number, number])[]) => pts.slice(1).reduce((n, q, i) => n + Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]), 0);
/** A room point from a drawing pixel of his, his foot at (c, r): across in squares, up as lift (room pixels). */
const fromPx = (c: number, r: number, px: readonly [number, number]) => ({ c: c + ((px[0] - RECLUSE_CHILD_SIT.foot[0]) * K.scale) / SQ, r: r - 0.02, lift: (RECLUSE_CHILD_SIT.foot[1] - px[1]) * K.scale });

/** Him now, from where he is in his loop. */
function kidOf(n: KidNow): KidDraw {
  const { plies } = RECLUSE_GAME;
  const ply = n.ply >= 0 && n.ply < plies.length ? plies[n.ply]! : null;
  const rest: SitPose = { lean: 0, reach: "", eyes: "down", mouth: "stern" };
  const seated = (p: SitPose, hand: Hand | null = null, moving = -1, skip: readonly number[] = []): KidDraw => ({ ...SEAT, img: sitName(p), shoulder: hand ? sitShoulder(hand.side, p.lean) : null, hand, back: false, moving, skip });
  if (n.step === "end" || n.step === "fade") return seated({ ...rest, eyes: n.step === "end" && n.u > 0.2 ? "ahead" : "down", mouth: "smile" });
  if (!ply) return seated({ ...rest, eyes: n.u < 0.6 ? "ahead" : "down" });
  const white = n.ply % 2 === 0;
  const from = { c: sqC(ply.from), r: sqR(ply.from) };
  const to = { c: sqC(ply.to), r: sqR(ply.to) };
  // (A move's hand: from where it rests, to the piece, the piece over, and back; the castling rook a step behind.)
  const handAt = (side: "l" | "r", rest: { c: number; r: number; lift: number }): Hand | null => {
    const u = ease(n.u);
    if (n.step === "reach") return { side, c: lerp(rest.c, from.c, u), r: lerp(rest.r, from.r, u), lift: lerp(rest.lift, 0, u) + 6 * Math.sin(u * Math.PI), piece: null };
    if (n.step === "carry") return { side, c: lerp(from.c, to.c, u), r: lerp(from.r, to.r, u), lift: Math.sin(u * Math.PI) * K.lift * cell * SQ, piece: ply.piece };
    if (n.step === "back") return { side, c: lerp(to.c, rest.c, u), r: lerp(to.r, rest.r, u), lift: lerp(0, rest.lift, u) + 6 * Math.sin(u * Math.PI), piece: null };
    return null;
  };
  const moving = n.step === "carry" ? ply.from : -1;
  const skip = n.step === "carry" && ply.rook ? [ply.rook[0]] : [];
  if (!white) {
    // His own move, sitting behind Black: he leans onto the board, the hand on the piece's side (a to d our left), a little stretch.
    const side: "l" | "r" = ply.from % 8 < 4 ? "l" : "r";
    const far = (i: number) => Math.floor(i / 8);
    const lean: 0 | 1 | 2 = Math.min(far(ply.from), far(ply.to)) <= 3 ? 2 : 1;
    if (n.step === "think") return seated({ ...rest, lean: n.u > 0.55 ? 1 : 0, eyes: n.u > 0.82 && n.u < 0.88 ? "shut" : "down" });
    if (n.step === "look") return seated({ ...rest, eyes: n.u > 0.45 && n.u < 0.52 ? "shut" : n.u < 0.75 ? "ahead" : "down" });
    const pose: SitPose = { lean: n.step === "back" && n.u > 0.6 ? 1 : lean, reach: side, eyes: n.step === "back" && n.u > 0.7 ? "ahead" : "down", mouth: "stern" };
    const knee = { c: SEAT.c + ((sitKnee(side)[0] - RECLUSE_CHILD_SIT.foot[0]) * K.scale) / SQ, r: SEAT.r - 0.02, lift: 0 };
    return seated(pose, handAt(side, knee), moving, skip);
  }
  // White's move: up, round the board, kneel beside White's near corner, play, back round, sit.
  const s = sideOf(n.ply);
  const path = walkPath(n.ply);
  const len = lenOf(path);
  const kneel = along(path, len);
  const stood = (c: number, r: number, p: PlayPose): KidDraw => ({ c, r, img: playName(p), shoulder: null, hand: null, back: p.view === "b", moving: -1, skip: [] });
  const stepMs = (n.step === "walk" || n.step === "walkBack" ? stepsOf(n.ply).find(([st]) => st === n.step)![1] : 0) * n.u;
  const walkStep = (Math.floor(stepMs / K.stepMs) % 4) as 0 | 1 | 2 | 3;
  switch (n.step) {
    case "rise":
      return n.u < 0.35 ? seated(rest) : stood(SEAT.c, SEAT.r, play("f", n.u < 0.7 ? "up" : "stand"));
    case "walk": {
      const at = along(path, n.u * len);
      return stood(at.c, at.r, play("f", "stand", walkStep));
    }
    case "turn":
      return stood(kneel.c, kneel.r, play(n.u < 0.5 ? "f" : "b", "stand"));
    case "kneel":
      return stood(kneel.c, kneel.r, n.u < 0.5 ? play("b", "up") : play("b", "heels"));
    case "stand":
      return stood(kneel.c, kneel.r, n.u < 0.5 ? play("b", "up") : play("b", "stand"));
    case "walkBack": {
      const at = along(path, (1 - n.u) * len);
      return stood(at.c, at.r, play("b", "stand", walkStep));
    }
    case "turnBack":
      return stood(SEAT.c, SEAT.r, play(n.u < 0.5 ? "b" : "f", "stand"));
    case "sit":
      return n.u < 0.35 ? stood(SEAT.c, SEAT.r, play("f", "stand")) : n.u < 0.7 ? stood(SEAT.c, SEAT.r, play("f", "up")) : seated(rest);
    case "look":
      return seated({ ...rest, eyes: n.u > 0.45 && n.u < 0.52 ? "shut" : n.u < 0.75 ? "ahead" : "down" });
    default: {
      // On his heels at the corner, the board on his inner side: thinking (leaning in), then the move with that hand.
      const side: "l" | "r" = s < 0 ? "r" : "l";
      if (n.step === "think") return stood(kneel.c, kneel.r, play("b", "heels", -1, n.u > 0.4 ? 1 : 0, ""));
      const reach = Math.max(Math.abs(from.c - kneel.c), Math.abs(to.c - kneel.c)) + Math.max(kneel.r - from.r, kneel.r - to.r) * 0.5;
      const lean: 0 | 1 | 2 = n.step === "back" && n.u > 0.6 ? 1 : reach > 0.75 ? 2 : 1;
      const p = play("b", "heels", -1, lean, side);
      const restAt = fromPx(kneel.c, kneel.r, heelsHand(side));
      return { c: kneel.c, r: kneel.r, img: playName(p), shoulder: playShoulder(p, side), hand: handAt(side, restAt), back: true, moving, skip };
    }
  }
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

// ---- The side walls, each one surface (Nov 13, Eric: "one long thing that actually makes it look like a 3D room").

const WALL_RUN = SHOP_RECLUSE_N + 2;
const wallImgs: (HTMLCanvasElement | null)[] = [null, null];
/** A side wall's picture (the paper, the rail and the baseboard unbroken, `WALL_RUN` squares long), made once. */
function wallImg(west: boolean): HTMLCanvasElement {
  const i = west ? 0 : 1;
  const have = wallImgs[i];
  if (have) return have;
  const { grid, palette } = sideWallGrid(west, WALL_RUN);
  const w = grid[0]!.length;
  const h = grid.length;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const hex = palette[grid[y]![x]!];
      if (!hex) continue;
      const o = (y * w + x) * 4;
      data[o] = parseInt(hex.slice(1, 3), 16);
      data[o + 1] = parseInt(hex.slice(3, 5), 16);
      data[o + 2] = parseInt(hex.slice(5, 7), 16);
      data[o + 3] = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : 255;
    }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(data, w, h), 0, 0);
  return (wallImgs[i] = c);
}
const wa = newPt();
const wb = newPt();
/**
 * Both side walls, each drawn as one surface from the back wall's corner forward past the camera: its foot along the floor's edge, its
 * top `SHOP_RECLUSE_WALL_H` room pixels over the foot as every upright thing is (so it meets the back wall's top and the rooms' scale),
 * in thin slices, each its strip of the wall's picture (about 70 drawImage calls a wall).
 */
function drawSideWalls(d: FxDraw) {
  const g = d.g;
  const H = SHOP_RECLUSE_WALL_H;
  const STRIPS = 72;
  g.imageSmoothingEnabled = false;
  for (const west of [true, false]) {
    const img = wallImg(west);
    // (The wall's face: the inner edge of its column of squares.)
    const c = west ? 0.5 : SHOP_RECLUSE_N - 1.5;
    for (let i = 0; i < STRIPS; i++) {
      // (Slices thinner far off, where the wall is foreshortened most... evenly in depth is fine at this room's size.)
      const ra = (i / STRIPS) * (WALL_RUN - 0.01);
      const rb = ((i + 1) / STRIPS) * (WALL_RUN - 0.01);
      if (!at(d, c, ra, 0, wa) || !at(d, c, rb, 0, wb)) break;
      const ha = (H * wa.k) / SQ;
      const hb = (H * wb.k) / SQ;
      const sx = ra * SQ;
      const sw = (rb - ra) * SQ;
      const hm = (ha + hb) / 2;
      // (An affine strip: its two ends' tops, its height the two ends' mean; a hair wider so no seam shows.)
      g.save();
      g.transform((wb.x - wa.x) / sw, (wb.y - hb - (wa.y - ha)) / sw, 0, hm / H, wa.x, wa.y - ha - (hm - ha) / 2);
      g.drawImage(img, sx, 0, sw, H, 0, 0, sw + 0.6, H);
      g.restore();
      if (wb.x < -50 || wb.x > d.W + 50) break;
    }
  }
}

// ---- The child.

const SKIN = { dark: "#9c522f", mid: "#c87a4a", light: "#e4a06c" } as const;
const SLEEVE = { red: "#c4443a", cream: "#efe7d6", line: "#2a1a14" } as const;
/** The child at his place, in a pose (his drawing, scaled to the room as the bosses are), and his reaching arm and hand. */
function drawKid(d: FxDraw, k: KidDraw, alpha = 1) {
  const g = d.g;
  if (!at(d, k.c, k.r, 0)) return;
  const ch = RECLUSE_CHILD_SIT;
  const s = (pt.k / SQ) * K.scale;
  const img = kidImg(k.img);
  const x0 = pt.x - ch.foot[0] * s;
  const y0 = pt.y - ch.foot[1] * s;
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = s < 1.5;
  g.drawImage(img, x0, y0, img.width * s, img.height * s);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  return { x0, y0, s };
}
/** Where his drawing goes this frame (as drawKid places it), without drawing it. */
function kidBox(d: FxDraw, k: KidDraw): { x0: number; y0: number; s: number } | null {
  if (!at(d, k.c, k.r, 0, q)) return null;
  const s = (q.k / SQ) * K.scale;
  return { x0: q.x - RECLUSE_CHILD_SIT.foot[0] * s, y0: q.y - RECLUSE_CHILD_SIT.foot[1] * s, s };
}
/** His arm out to his hand (drawn over the board): a short striped sleeve, the forearm, the hand round the piece. */
function drawArm(d: FxDraw, sh: readonly [number, number], hand: Hand, kid: { x0: number; y0: number; s: number }) {
  const g = d.g;
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
let kidFrozen: { n: KidNow; k: KidDraw } | null = null;
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

/**
 * The scene: the child at his game; `summon(at)` starts the summoning at the room's time `at`; `t0` shifts the child's loop (ms);
 * `walls`: each side wall drawn as one surface (the room's layout then has blanks there: `SHOP_RECLUSE_LAYOUT`); false: the cards.
 */
export interface RecluseScene {
  fx: RoomFx;
  summon: (at: number) => void;
  reset: () => void;
  /** Where the summoning is (null: not started), for the preview and its tests. */
  state: () => { summonT: number | null; ply: number; step: string };
  /** (The preview's stills) Jump the child's loop to `ms` now. */
  seek: (ms: number) => void;
}
export function recluseScene(t0 = 0, walls = true): RecluseScene {
  let start: number | null = null;
  let lastNow = 0;
  let burstDone = false;
  const kidState = (now: number) => {
    const n = kidAt(now + t0);
    return { n, k: kidOf(n) };
  };
  /** This frame's child (worked out once a frame, by the first figure drawn: the walls, or the board). */
  let cur: { n: KidNow; k: KidDraw } | null = null;
  let curAt = -1;
  const curOf = (now: number) => {
    if (curAt === now && cur) return cur;
    const s = start === null ? null : summonAt(now - start);
    curAt = now;
    return (cur = kidFrozen && s ? kidFrozen : kidState(now));
  };
  const figures: { z: number; draw: (d: FxDraw, now: number) => void }[] = [];
  const boardFig = {
    z: B.r,
    draw: (d: FxDraw, now: number) => {
      const s = start === null ? null : summonAt(now - start);
      const { n, k } = curOf(now);
      const putDown = n.step === "back" || n.step === "stand" || n.step === "walkBack" || n.step === "turnBack" || n.step === "sit" || n.step === "look";
      const last = n.ply > 0 && !putDown && n.step !== "fade" ? RECLUSE_GAME.plies[n.ply - 1] ?? null : putDown ? RECLUSE_GAME.plies[n.ply] ?? null : null;
      const lift = s ? wobbleLift(s.wobble) : 0;
      const glow = s ? Math.max(s.rays * 0.5, s.splash > 0 ? (1 - s.splash) * 0.8 : 0) : 0;
      drawBoard(d, n.board, n.step === "fade" ? null : last, k.moving >= 0 ? [k.moving, ...k.skip] : k.skip, n.fade, lift, glow);
      // (Castling's rook, a step behind the king.)
      if (k.skip.length && k.hand) {
        const ply = RECLUSE_GAME.plies[n.ply]!;
        const u = Math.max(0, n.u - 0.25) / 0.75;
        drawPiece(d, n.board[ply.rook![0]]!, sqC(ply.rook![0]) + (sqC(ply.rook![1]) - sqC(ply.rook![0])) * ease(u), sqR(ply.rook![0]), Math.sin(u * Math.PI) * cell * SQ * 0.4);
      }
      // (Sitting behind the board, facing us: his arm comes over the board, so it's drawn after it.)
      if (!k.back && k.hand && k.shoulder) {
        const box = kidBox(d, k);
        if (box) drawArm(d, k.shoulder, k.hand, box);
      }
    },
  };
  const kidFig = {
    z: 0,
    draw: (d: FxDraw, now: number) => {
      const { k } = curOf(now);
      // (From behind, on White's side: his arm goes out from his shoulder to the board, under his back.)
      if (k.back && k.hand && k.shoulder) {
        const box = kidBox(d, k);
        if (box) drawArm(d, k.shoulder, k.hand, box);
      }
      drawKid(d, k);
    },
  };
  const wallFig = { z: 0.01, draw: (d: FxDraw) => drawSideWalls(d) };
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
      // (From behind, beside or in front of the board: after it, so his arm reaches over it and his back is nearer us.)
      const k = curOf(now).k;
      kidFig.z = k.back ? Math.max(k.r, B.r + 0.01) : k.r;
      if (walls) figures.push(wallFig);
      figures.push(kidFig, boardFig, ...pawnFigs);
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
      kidFrozen = kidState(when);
    },
    reset: () => {
      start = null;
      kidFrozen = null;
      bits = [];
    },
    seek: (ms) => {
      t0 = ms - lastNow;
    },
    state: () => ({ summonT: start === null ? null : lastNow - start, ply: kidAt(lastNow + t0).ply, step: kidAt(lastNow + t0).step }),
  };
}

// ---- The summoning's light: drawn over the room.
// (The second go, Eric, Nov 13, of the first's flat wedges from one point: "the light doesn't look right".) The board is the lamp: its
// face blazes; a shaft of light stands on it; rays shoot from its face up and outward, each a line in the room (the camera's own
// projection), soft-edged, bright at its foot and gone at its tip; more rays lie along the floor, flattened as the floor is; a pool of
// light spreads on the boards round it; and the room dims, so the light reads as light. All sprites made once and stretched: no
// gradient is built in a frame.

/** A sprite made once from its alpha at each point (0 to 1 across, 0 at its top to 1 at its foot). */
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
/**
 * A beam's alpha: soft sides, `foot` of the sprite's width at its foot widening to all of it at its tip; it comes up out of nothing
 * over `rise` of its length (so a dozen feet in one place don't add up to a white blob) and fades to its tip along `fade`.
 */
const beam = (foot: number, fade: number, rise: number) => (x: number, y: number) => {
  const half = foot + (1 - foot) * (1 - y);
  const dx = Math.abs(2 * x - 1) / half;
  return dx >= 1 ? 0 : (1 - dx * dx) ** 2 * y ** fade * Math.min(1, (1 - y) / rise);
};
const round = (x: number, y: number) => {
  const r = Math.hypot(2 * x - 1, 2 * y - 1);
  return r >= 1 ? 0 : (1 - r) ** 1.7;
};
let LIGHT: { ray: HTMLCanvasElement; gold: HTMLCanvasElement; shaft: HTMLCanvasElement; pool: HTMLCanvasElement; glow: HTMLCanvasElement } | null = null;
const light = () =>
  (LIGHT ??= {
    ray: lightImg(48, 192, [255, 247, 220], beam(0.22, 1.4, 0.14)),
    gold: lightImg(48, 192, [255, 214, 120], beam(0.3, 1.1, 0.16)),
    shaft: lightImg(96, 192, [255, 240, 196], beam(0.7, 0.75, 0.04)),
    pool: lightImg(128, 128, [255, 206, 112], round),
    glow: lightImg(96, 96, [255, 248, 214], round),
  });
/** `img` drawn from its foot (its bottom's middle) at (x0, y0) to its tip at (x1, y1), (wx, wy) its width across. */
function streak(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number, wx: number, wy: number, alpha: number) {
  if (alpha < 0.01) return;
  g.save();
  g.globalAlpha = Math.min(1, alpha);
  g.transform(wx / img.width, wy / img.width, (x0 - x1) / img.height, (y0 - y1) / img.height, x1 - wx / 2, y1 - wy / 2);
  g.drawImage(img, 0, 0);
  g.restore();
}
const p0 = newPt();
const p1 = newPt();
const p2 = newPt();
/** A point in the room: on the floor at (c, r), `up` squares above it. */
const at3 = (d: FxDraw, c: number, r: number, up: number, out: ReturnType<typeof newPt>) => proj(d.v, c - d.camX, d.camY - r, up, out);
/** A number from 0 to 1 that is always the same for the same two numbers. */
const dice = (i: number, k: number) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
const RAYS_UP = 13;
const RAYS_FLOOR = 11;
const MOTES = 26;
/** A round sprite laid on the floor round (c, r), `rad` squares out. */
function onFloor(d: FxDraw, img: HTMLCanvasElement, c: number, r: number, rad: number, alpha: number) {
  if (alpha < 0.01 || !at3(d, c, r, 0, p0) || !at3(d, c + rad, r, 0, p1) || !at3(d, c, r + rad, 0, p2)) return;
  const g = d.g;
  const ax = p1.x - p0.x;
  const ay = p1.y - p0.y;
  const bx = p2.x - p0.x;
  const by = p2.y - p0.y;
  g.save();
  g.globalAlpha = Math.min(1, alpha);
  g.transform((2 * ax) / img.width, (2 * ay) / img.width, (2 * bx) / img.height, (2 * by) / img.height, p0.x - ax - bx, p0.y - ay - by);
  g.drawImage(img, 0, 0);
  g.restore();
}
function drawSummon(d: FxDraw, s: SummonNow) {
  const g = d.g;
  if (!at(d, B.c, B.r, 0, q)) return;
  const bx = q.x;
  const by = q.y;
  const k = q.k;
  const L = light();
  // How much light there is (it comes on, holds, and is drawn back), and how long since the rays began.
  const lit = s.rays;
  const since = s.t - S.rays;
  const back = ease(s.drawBack);
  // The room dims as the light comes on.
  if (lit > 0) {
    g.fillStyle = `rgba(16,10,30,${0.42 * ease(lit)})`;
    g.fillRect(0, 0, d.W, d.H);
  }
  g.save();
  g.globalCompositeOperation = "lighter";
  g.imageSmoothingEnabled = true;
  if (lit > 0) {
    const grow = easeOut(since / 420) * (1 - back);
    const half = B.size / 2;
    // The pool of light on the floor round the board, breathing a little; and the rays along the floor, out from the board's edge.
    onFloor(d, L.pool, B.c, B.r, (3.2 + 1.4 * grow) * (1 + 0.03 * Math.sin(s.t / 160)), 0.5 * lit);
    const spin = s.t / 5200;
    for (let i = 0; i < RAYS_FLOOR; i++) {
      const a = (i / RAYS_FLOOR) * Math.PI * 2 + spin + (dice(i, 1) - 0.5) * 0.3;
      const shot = easeOut((since - i * 28) / 340) * (1 - back);
      const far = 0.7 + (2.6 + 2.2 * dice(i, 2)) * shot;
      const wide = 0.32 + 0.3 * dice(i, 3);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      if (!at3(d, B.c + ca * 0.55, B.r + sa * 0.55, 0, p0) || !at3(d, B.c + ca * far, B.r + sa * far, 0, p1)) continue;
      const mid = (0.55 + far) / 2;
      if (!at3(d, B.c + ca * mid - sa * wide, B.r + sa * mid + ca * wide, 0, p2)) continue;
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      streak(g, L.gold, p0.x, p0.y, p1.x, p1.y, 2 * (p2.x - mx), 2 * (p2.y - my), 0.5 * lit * (0.75 + 0.25 * Math.sin(s.t / 150 + i * 2.1)));
    }
    // The board's face, blazing.
    for (const [dc, dr, out] of [[-half, -half, p0], [half, -half, p1]] as const) at3(d, B.c + dc, B.r + dr, 0, out);
    g.globalAlpha = Math.min(1, 0.8 * lit);
    g.fillStyle = "#fff3c8";
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    at3(d, B.c + half, B.r + half, 0, p1);
    g.lineTo(p1.x, p1.y);
    at3(d, B.c - half, B.r + half, 0, p0);
    g.lineTo(p0.x, p0.y);
    g.fill();
    const nearY = p0.y;
    const faceW = p1.x - p0.x;
    // The shaft standing on it: wide and soft, and a brighter one inside it.
    const tall = k * 6.4 * grow;
    streak(g, L.shaft, bx, nearY, bx, nearY - tall, faceW * 1.45, 0, 0.42 * lit);
    streak(g, L.shaft, bx, nearY, bx, nearY - tall * 0.94, faceW * 0.8, 0, 0.55 * lit * (0.9 + 0.1 * Math.sin(s.t / 90)));
    // The rays from its face, up and outward all round: each leans away from the middle, turning slowly, shimmering.
    for (let i = 0; i < RAYS_UP; i++) {
      const a = (i / RAYS_UP) * Math.PI * 2 - spin * 1.6 + (dice(i, 4) - 0.5) * 0.25;
      const lean = 0.3 + 0.55 * dice(i, 5) + 0.04 * Math.sin(s.t / 300 + i);
      const shot = easeOut((since - 60 - i * 34) / 300) * (1 - back);
      const len = (3.4 + 2.8 * dice(i, 6)) * shot * (0.9 + 0.1 * Math.sin(s.t / 170 + i * 1.3));
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      if (!at3(d, B.c + ca * 0.4, B.r + sa * 0.4, 0, p0)) continue;
      if (!at3(d, B.c + ca * (0.4 + len * Math.sin(lean)), B.r + sa * (0.4 + len * Math.sin(lean)), len * Math.cos(lean), p1)) continue;
      const lx = p1.x - p0.x;
      const ly = p1.y - p0.y;
      const ll = Math.hypot(lx, ly) || 1;
      const shimmer = 0.72 + 0.28 * Math.sin(s.t / 110 + i * 1.9);
      const wd = k * (0.5 + 0.45 * dice(i, 7));
      streak(g, L.gold, p0.x, p0.y, p1.x, p1.y, (-ly / ll) * wd * 1.7, (lx / ll) * wd * 1.7, 0.3 * lit * shimmer);
      streak(g, L.ray, p0.x, p0.y, p1.x, p1.y, (-ly / ll) * wd * 0.6, (lx / ll) * wd * 0.6, 0.6 * lit * shimmer);
    }
    // Its glow at the foot, and motes rising in the shaft.
    const gs = k * (0.95 + 0.08 * Math.sin(s.t / 120));
    g.globalAlpha = Math.min(1, 0.5 * lit);
    g.drawImage(L.glow, bx - gs, by - gs * 0.62, gs * 2, gs * 1.24);
    g.fillStyle = "#fff6cf";
    for (let i = 0; i < MOTES; i++) {
      const up = ((since / (900 + 700 * dice(i, 8)) + dice(i, 9)) % 1) * 5.2 * grow;
      if (!at3(d, B.c + (dice(i, 10) - 0.5) * 1.3, B.r + (dice(i, 11) - 0.5) * 1.3, up, p0)) continue;
      g.globalAlpha = lit * (1 - up / 5.3) * 0.9;
      const sz = Math.max(1.5, (p0.k / SQ) * (1.4 + dice(i, 12)));
      g.fillRect(p0.x - sz / 2, p0.y - sz / 2, sz, sz);
    }
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
      // (The light gathered: a ball over the board, its glow on the floor under it; then it falls.)
      onFloor(d, L.pool, B.c, B.r, 1.6 + 1.2 * (1 - s.fall), 0.6 * s.drawBack);
      g.globalAlpha = 0.95 * Math.min(1, s.drawBack * 1.6);
      const gs = k * (0.45 + 0.6 * s.drawBack) * (1 - 0.35 * s.fall);
      g.drawImage(L.glow, px - gs, py - gs, gs * 2, gs * 2);
      g.drawImage(L.glow, px - gs * 0.45, py - gs * 0.45, gs * 0.9, gs * 0.9);
    }
  }
  // The splash: the board's face flashes, a ring of light runs out across the floor from it, and drops of light are thrown up and
  // fall back; all on the floor as the room's camera sees it.
  if (s.splash > 0 && s.splash < 1) {
    const u = s.splash;
    const half = B.size / 2;
    onFloor(d, L.pool, B.c, B.r, 1.2 + 3.4 * easeOut(u), 0.9 * (1 - u) ** 1.5);
    g.strokeStyle = "#fff1c0";
    for (const [rad, a] of [[0.7 + 2.6 * easeOut(u), 0.85 * (1 - u)], [0.5 + 1.5 * easeOut(u), 0.5 * (1 - u)]] as const) {
      g.beginPath();
      for (let i = 0; i <= 28; i++) {
        const an = (i / 28) * Math.PI * 2;
        if (!at3(d, B.c + Math.cos(an) * rad, B.r + Math.sin(an) * rad, 0, p0)) continue;
        if (i) g.lineTo(p0.x, p0.y);
        else g.moveTo(p0.x, p0.y);
      }
      // (A soft wide stroke under a thin bright one.)
      g.lineWidth = 4 + k * 0.3 * (1 - u) ** 2;
      g.globalAlpha = a * 0.28;
      g.stroke();
      g.lineWidth = 1.5 + k * 0.08 * (1 - u) ** 2;
      g.globalAlpha = a;
      g.stroke();
    }
    g.fillStyle = "#fff6cf";
    for (let i = 0; i < 28; i++) {
      const an = (i / 28) * Math.PI * 2 + dice(i, 13);
      const rad = half * 0.6 + (0.5 + 1.3 * dice(i, 14)) * u;
      const up = (0.7 + 0.9 * dice(i, 15)) * Math.sin(u * Math.PI);
      if (!at3(d, B.c + Math.cos(an) * rad, B.r + Math.sin(an) * rad, up, p0)) continue;
      const sz = Math.max(2, (p0.k / SQ) * 3);
      g.globalAlpha = 0.95 * (1 - u * u);
      g.fillRect(p0.x - sz / 2, p0.y - sz / 2, sz, sz);
    }
    const gs = k * 1.5 * (1 - u * 0.5);
    g.globalAlpha = 0.95 * (1 - u) ** 2;
    g.drawImage(L.glow, bx - gs, by - gs * 0.55, gs * 2, gs * 1.1);
  }
  g.restore();
  // The freeze frame's flash.
  if (s.flash > 0) {
    g.fillStyle = `rgba(255,250,235,${0.32 * s.flash})`;
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
