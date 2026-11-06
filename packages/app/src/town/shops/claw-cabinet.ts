/**
 * Boingo's claw machine as a solid cabinet in his Funhouse (Eric, Nov 6: "the real claw machine in the room, a big 3D arcade cabinet
 * you walk up to"), drawn in true 3D through the room's own camera (`proj` with a lift), so it looks right from wherever you stand:
 * a base with the coin slot, the joystick and the prize door; glass sides you see into, crates piled inside on dark felt, the
 * plexiglass chute in the front left corner; the gantry, its bridge and trolley, the claw on its cable; the lit marquee box on top.
 * Its claw is posed from the play (claw/view.ts `clawPose`): it only ever shows the server's answer.
 *
 * Units: room squares (x across, z along the rows, 0 at the back wall, larger toward the camera) and lift (squares up). Draws only
 * with paths and fills, no pictures; its projected points are made once (a few small corner lists a frame, no canvases).
 */
import { newPt, type Pt } from "../camera.ts";
import { CHUTE, PILE, pickCrate, type ClawPose } from "../../claw/view.ts";

/** The cabinet's box in the room (its squares' edges, a little inside them) and its heights. */
export interface Cabinet {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
/** Heights (squares up): the base's top (the glass's floor), the glass's top, the marquee's top; the gantry under the glass's top. */
export const CAB_H = { base: 1.05, glass: 2.35, top: 2.85, gantry: 2.2, crate: 0.3, coinY: 0.78 } as const;

/** The cabinet over a piece covering `w` x `d` squares from (col, row) (row its south-most). */
export function cabinetOf(col: number, row: number, w: number, d: number): Cabinet {
  return { x0: col - 0.5 + 0.1, x1: col + w - 0.5 - 0.1, z0: row - d + 0.5 + 0.1, z1: row + 0.5 - 0.1 };
}

/** The glass's inside, where the crates and the claw are (fractions of the glass map here). */
const IN = 0.08;
const gx = (c: Cabinet, f: number) => c.x0 + IN + (c.x1 - c.x0 - 2 * IN) * f;
const gz = (c: Cabinet, f: number) => c.z0 + IN + (c.z1 - c.z0 - 2 * IN) * f;

/** The coin slot on the base's front (the right half), in room units: its middle across, and half its width and height. */
export const slotOf = (c: Cabinet) => ({ x: c.x0 + (c.x1 - c.x0) * 0.78, hw: 0.07, y: CAB_H.coinY, hh: 0.1 });

/** A point projector the room gives: (x, z, lift) to the screen, false if it's behind the camera. */
export type P3 = (x: number, z: number, y: number, out: Pt) => boolean;

const Q = Array.from({ length: 8 }, () => newPt());
const R = Array.from({ length: 4 }, () => newPt());

/** Fills a four-cornered face; false if a corner is behind the camera. */
function face(g: CanvasRenderingContext2D, p3: P3, pts: readonly (readonly [number, number, number])[], fill: string): boolean {
  for (let i = 0; i < 4; i++) if (!p3(pts[i]![0], pts[i]![1], pts[i]![2], R[i]!)) return false;
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(R[0]!.x, R[0]!.y);
  for (let i = 1; i < 4; i++) g.lineTo(R[i]!.x, R[i]!.y);
  g.closePath();
  g.fill();
  return true;
}
/** A box's faces the camera sees: its top, its front (z1), and the side toward the camera. */
function box(g: CanvasRenderingContext2D, p3: P3, camX: number, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, top: string, front: string, side: string) {
  if (camX > x1) face(g, p3, [[x1, z0, y0], [x1, z1, y0], [x1, z1, y1], [x1, z0, y1]], side);
  else if (camX < x0) face(g, p3, [[x0, z0, y0], [x0, z1, y0], [x0, z1, y1], [x0, z0, y1]], side);
  face(g, p3, [[x0, z1, y0], [x1, z1, y0], [x1, z1, y1], [x0, z1, y1]], front);
  face(g, p3, [[x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1]], top);
}
function seg(g: CanvasRenderingContext2D, p3: P3, a: readonly [number, number, number], b: readonly [number, number, number], color: string, width: number) {
  if (!p3(a[0], a[1], a[2], Q[0]!) || !p3(b[0], b[1], b[2], Q[1]!)) return;
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, width * Q[0]!.k);
  g.beginPath();
  g.moveTo(Q[0]!.x, Q[0]!.y);
  g.lineTo(Q[1]!.x, Q[1]!.y);
  g.stroke();
}

/** A boss crate in the glass: red with a gold band and lid, `s` squares a side, its foot's middle at (x, z) on `y`. */
function crate(g: CanvasRenderingContext2D, p3: P3, camX: number, x: number, z: number, y: number, s: number) {
  const h = s / 2;
  box(g, p3, camX, x - h, x + h, z - h, z + h, y, y + s, "#f05a5f", "#c42a36", "#a3202b");
  // (Its gold band across the front and the top, its lid's rim.)
  face(g, p3, [[x - h, z + h, y + s * 0.42], [x + h, z + h, y + s * 0.42], [x + h, z + h, y + s * 0.58], [x - h, z + h, y + s * 0.58]], "#f2c14e");
  face(g, p3, [[x - s * 0.08, z - h, y + s], [x + s * 0.08, z - h, y + s], [x + s * 0.08, z + h, y + s], [x - s * 0.08, z + h, y + s]], "#f2c14e");
}

/** What the room needs back after drawing: the coin slot's box on screen (for a tap). */
export interface CabinetHits {
  slot: { x0: number; y0: number; x1: number; y1: number; on: boolean };
}
export const newHits = (): CabinetHits => ({ slot: { x0: 0, y0: 0, x1: 0, y1: 0, on: false } });

/**
 * Draws the cabinet `c` with its claw at `pose`, as the camera at `camX` sees it; `now` for its marquee's chase. Fills `hits`.
 * Painter's order for a see-through box: the far inside first (the back glass, the far side, the felt), then what's inside back to
 * front, then the near glass, its frame and the marquee.
 */
export function drawCabinet(g: CanvasRenderingContext2D, p3: P3, camX: number, c: Cabinet, pose: ClawPose, now: number, hits: CabinetHits): void {
  const { x0, x1, z0, z1 } = c;
  const { base, glass, top, gantry } = CAB_H;
  // -- Its shadow on the carpet.
  face(g, p3, [[x0 - 0.12, z0 - 0.05, 0], [x1 + 0.12, z0 - 0.05, 0], [x1 + 0.12, z1 + 0.18, 0], [x0 - 0.12, z1 + 0.18, 0]], "rgba(5,4,12,0.45)");
  // -- The base: pink with a gold kick plate, the prize door front left (under the chute).
  box(g, p3, camX, x0, x1, z0, z1, 0, base, "#7d3b93", "#e0447a", "#a8325e");
  face(g, p3, [[x0, z1, 0], [x1, z1, 0], [x1, z1, 0.12], [x0, z1, 0.12]], "#f2c14e");
  const door = { a: gx(c, CHUTE.x) - 0.24, b: gx(c, CHUTE.x) + 0.24 };
  face(g, p3, [[door.a, z1, 0.2], [door.b, z1, 0.2], [door.b, z1, 0.6], [door.a, z1, 0.6]], "#1a0e22");
  // (The won crate in the prize door's tray.)
  if (pose.inTray) crate(g, p3, camX, gx(c, CHUTE.x), z1 - 0.12, 0.22, 0.24);
  face(g, p3, [[door.a, z1, 0.6], [door.b, z1, 0.6], [door.b, z1, 0.64], [door.a, z1, 0.64]], "#f2c14e");
  // The coin slot: a gold plate with its dark slit (the tap target), and the coin going in.
  const sl = slotOf(c);
  face(g, p3, [[sl.x - sl.hw, z1, sl.y - sl.hh], [sl.x + sl.hw, z1, sl.y - sl.hh], [sl.x + sl.hw, z1, sl.y + sl.hh], [sl.x - sl.hw, z1, sl.y + sl.hh]], "#f2c14e");
  face(g, p3, [[sl.x - 0.012, z1, sl.y - sl.hh * 0.7], [sl.x + 0.012, z1, sl.y - sl.hh * 0.7], [sl.x + 0.012, z1, sl.y + sl.hh * 0.7], [sl.x - 0.012, z1, sl.y + sl.hh * 0.7]], "#150c11");
  hits.slot.on = false;
  if (p3(sl.x - sl.hw, z1, sl.y + sl.hh, Q[2]!) && p3(sl.x + sl.hw, z1, sl.y - sl.hh, Q[3]!)) {
    hits.slot.x0 = Q[2]!.x;
    hits.slot.y0 = Q[2]!.y;
    hits.slot.x1 = Q[3]!.x;
    hits.slot.y1 = Q[3]!.y;
    hits.slot.on = true;
  }
  if (pose.coin >= 0 && pose.coin < 1 && p3(sl.x, z1 + 0.02, sl.y + sl.hh + 0.35 * (1 - pose.coin), Q[4]!)) {
    g.fillStyle = "#ffd04a";
    g.beginPath();
    g.ellipse(Q[4]!.x, Q[4]!.y, Math.max(2, 0.05 * Q[4]!.k), Math.max(2, 0.07 * Q[4]!.k), 0, 0, Math.PI * 2);
    g.fill();
  }
  // The control ledge: the joystick and the big button.
  const ledge = { x: c.x0 + (c.x1 - c.x0) * 0.5 };
  box(g, p3, camX, x0 + 0.1, x1 - 0.1, z1, z1 + 0.16, base - 0.12, base - 0.04, "#3e3150", "#2c2238", "#2c2238");
  seg(g, p3, [ledge.x - 0.12, z1 + 0.08, base - 0.04], [ledge.x - 0.12, z1 + 0.08, base + 0.14], "#565b67", 0.03);
  if (p3(ledge.x - 0.12, z1 + 0.08, base + 0.15, Q[5]!)) {
    g.fillStyle = "#e2343b";
    g.beginPath();
    g.arc(Q[5]!.x, Q[5]!.y, Math.max(2, 0.05 * Q[5]!.k), 0, Math.PI * 2);
    g.fill();
  }
  if (p3(ledge.x + 0.16, z1 + 0.08, base - 0.03, Q[6]!)) {
    g.fillStyle = "#ffd04a";
    g.beginPath();
    g.ellipse(Q[6]!.x, Q[6]!.y, Math.max(3, 0.09 * Q[6]!.k), Math.max(2, 0.04 * Q[6]!.k), 0, 0, Math.PI * 2);
    g.fill();
  }

  // -- The far inside: the back glass, the far side, the felt floor.
  face(g, p3, [[x0, z0, base], [x1, z0, base], [x1, z0, glass], [x0, z0, glass]], "#3a2a63");
  if (camX >= x0) face(g, p3, [[x0, z0, base], [x0, z1, base], [x0, z1, glass], [x0, z0, glass]], "#33245a");
  if (camX <= x1) face(g, p3, [[x1, z0, base], [x1, z1, base], [x1, z1, glass], [x1, z0, glass]], "#33245a");
  face(g, p3, [[x0, z0, base], [x1, z0, base], [x1, z1, base], [x0, z1, base]], "#1f6f6a");
  // -- The pile, back to front, without the crate the claw has taken.
  const s = CAB_H.crate;
  const took = pose.taken ? pickCrate(pose.x, pose.z) : -1;
  for (let layer = 0; layer < 2; layer++)
    for (let i = 0; i < PILE.length; i++) {
      const [px, pz, l] = PILE[i]!;
      if (l !== layer || i === took) continue;
      crate(g, p3, camX, gx(c, px), gz(c, pz), base + l * s, s);
    }
  // -- The chute: a clear box in the front left corner, its gold rim.
  const cx = gx(c, CHUTE.x);
  const cz = gz(c, CHUTE.z);
  const ch = 0.26;
  face(g, p3, [[cx - ch, cz - ch, base + 0.42], [cx + ch, cz - ch, base + 0.42], [cx + ch, cz + ch, base + 0.42], [cx - ch, cz + ch, base + 0.42]], "rgba(20,10,30,0.85)");
  seg(g, p3, [cx - ch, cz - ch, base + 0.42], [cx + ch, cz - ch, base + 0.42], "#f2c14e", 0.03);
  seg(g, p3, [cx + ch, cz - ch, base + 0.42], [cx + ch, cz + ch, base + 0.42], "#f2c14e", 0.03);
  seg(g, p3, [cx - ch, cz - ch, base + 0.42], [cx - ch, cz + ch, base + 0.42], "#f2c14e", 0.03);
  face(g, p3, [[cx - ch, cz + ch, base], [cx + ch, cz + ch, base], [cx + ch, cz + ch, base + 0.42], [cx - ch, cz + ch, base + 0.42]], "rgba(190,235,255,0.22)");

  // -- The gantry: two rails across the top, the bridge along the rows at the claw's x, the trolley at its place.
  const ax = gx(c, pose.x);
  const az = gz(c, pose.z);
  seg(g, p3, [x0 + 0.04, z0 + 0.06, gantry], [x1 - 0.04, z0 + 0.06, gantry], "#cfd6e4", 0.05);
  seg(g, p3, [x0 + 0.04, z1 - 0.06, gantry], [x1 - 0.04, z1 - 0.06, gantry], "#cfd6e4", 0.05);
  seg(g, p3, [ax, z0 + 0.06, gantry], [ax, z1 - 0.06, gantry], "#8790a6", 0.05);
  box(g, p3, camX, ax - 0.08, ax + 0.08, az - 0.08, az + 0.08, gantry - 0.06, gantry + 0.02, "#e4e6ec", "#9ca0ab", "#8790a6");
  // The claw: its cable, its head, three prongs spread by `open`; down to just round the pile's top crate when `down` is 1.
  const reach = gantry - 0.12 - (base + 2 * s + 0.12);
  const headY = gantry - 0.12 - reach * pose.down;
  seg(g, p3, [ax, az, gantry - 0.06], [ax, az, headY + 0.08], "#565b67", 0.02);
  box(g, p3, camX, ax - 0.06, ax + 0.06, az - 0.06, az + 0.06, headY, headY + 0.1, "#f2c14e", "#b58430", "#b58430");
  const spread = 0.05 + 0.12 * pose.open;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    const ex = ax + Math.cos(a) * spread;
    const ez = az + Math.sin(a) * spread;
    seg(g, p3, [ax + Math.cos(a) * 0.05, az + Math.sin(a) * 0.05, headY], [ex, ez, headY - 0.12], "#e4e6ec", 0.025);
    seg(g, p3, [ex, ez, headY - 0.12], [ax + Math.cos(a) * spread * 0.55, az + Math.sin(a) * spread * 0.55, headY - 0.22], "#e4e6ec", 0.025);
  }
  // The crate it holds, or one falling (back onto the pile, or down the chute).
  if (pose.held) crate(g, p3, camX, ax, az, headY - 0.22 - s * 0.55, s);
  if (pose.fall) {
    const f = pose.fall;
    const fromY = gantry - 0.12 - reach * f.fromDown - 0.22 - s * 0.55;
    if (f.into === "pile") {
      const [px, pz, l] = PILE[pickCrate(pose.x, pose.z)]!;
      const toY = base + l * s;
      crate(g, p3, camX, gx(c, px), gz(c, pz), fromY + (toY - fromY) * f.t, s);
    } else crate(g, p3, camX, cx, cz, fromY + (base - s - fromY) * f.t, s);
  }

  // -- The near glass (see-through, a glare streak), the corner posts, the marquee box with its bulbs chasing.
  if (camX > x1) face(g, p3, [[x1, z0, base], [x1, z1, base], [x1, z1, glass], [x1, z0, glass]], "rgba(190,235,255,0.14)");
  if (camX < x0) face(g, p3, [[x0, z0, base], [x0, z1, base], [x0, z1, glass], [x0, z0, glass]], "rgba(190,235,255,0.14)");
  face(g, p3, [[x0, z1, base], [x1, z1, base], [x1, z1, glass], [x0, z1, glass]], "rgba(190,235,255,0.12)");
  const gl = x0 + (x1 - x0) * 0.62;
  face(g, p3, [[gl, z1, base + 0.2], [gl + 0.12, z1, base + 0.2], [gl + 0.32, z1, glass - 0.15], [gl + 0.2, z1, glass - 0.15]], "rgba(255,255,255,0.16)");
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) seg(g, p3, [px, pz, base], [px, pz, glass], "#f2c14e", 0.05);
  box(g, p3, camX, x0 - 0.04, x1 + 0.04, z0 - 0.04, z1 + 0.04, glass, top, "#c43a7f", "#ff5aa8", "#c43a7f");
  // Its bulbs along the marquee's front, chasing (one lit in three, stepping every 260 ms as the walls' do).
  const step = Math.floor(now / 260);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const bx = x0 + 0.1 + ((x1 - x0 - 0.2) * i) / (n - 1);
    if (!p3(bx, z1 + 0.05, (glass + top) / 2, Q[7]!)) continue;
    const lit = (i + step) % 3 === 0;
    g.fillStyle = lit ? "#fff3b0" : "#ffd04a";
    g.beginPath();
    g.arc(Q[7]!.x, Q[7]!.y, Math.max(1.5, (lit ? 0.055 : 0.04) * Q[7]!.k), 0, Math.PI * 2);
    g.fill();
  }
}
