/**
 * The claw machine in Boingo's Funhouse, as the room draws it (Eric, Nov 6, correcting the first build: "the real claw machine in the
 * room, a big 3D arcade cabinet you walk up to … you watch the cabinet's own claw move over the crates inside, grab one, lift it and
 * usually drop it", not a separate screen). The machine's controls (ClawMachine.tsx: the picker, STOP, the result) write the play's
 * stage here as it changes; the room (shops/ShopRoom.tsx) reads it every frame and draws the cabinet's own claw from `clawPose`.
 * Pure (no DOM): a test drives it. The play itself is the server's (server/claw.ts): the pose only ever shows its answer, and STOP
 * only changes where the claw drops, never what it brings up.
 */
import { CLAW } from "@chessroyale/core";
import { roamX, type ClawStage } from "./flow.ts";

/** The play as the room sees it: its stage and when that began (performance.now()), and what the server said. */
export interface ClawPlay {
  stage: ClawStage;
  /** When this stage began. */
  at: number;
  /** When the claw came out (roam), and when it was told to drop (STOP, or on its own). */
  roamAt: number;
  dropAt: number;
  /** The server's answer: won (true), lost (false), not yet (null). */
  won: boolean | null;
  /** This play's id: picks, as cosmetics only, how a loss looks (`lossOf`). */
  request: string | null;
  /** The controls are open (the camera stays in close). */
  open: boolean;
}

/** The one play the room shows. The controls write it; nothing else does. */
export const CLAW_PLAY: ClawPlay = { stage: "insert", at: 0, roamAt: 0, dropAt: 0, won: null, request: null, open: false };

/** The controls' stage changed at `now`: keeps the times the pose needs. */
export function clawStage(p: ClawPlay, stage: ClawStage, now: number, won: boolean | null, request: string | null): void {
  if (p.stage === stage && p.request === request) return;
  if (stage === "roam") p.roamAt = now;
  if (stage === "drop") p.dropAt = now;
  p.stage = stage;
  p.at = now;
  p.won = won;
  p.request = request;
}

/** How long the coin takes to drop into the slot (ms): the controls wait this long before the claw can come out. */
export const COIN_MS = 700;
/** How long the claw takes to come home after a loss, and the crate to fall down the chute after a win (ms). */
export const HOME_MS = 800;
export const CHUTE_MS = 350;

/** The claw's home and the chute (fractions of the glass: x 0 left to 1 right, z 0 back to 1 front), front left as on most machines. */
export const CHUTE = { x: 0.13, z: 0.82 } as const;

/** Where the claw roams while it's out (z: back and front, on its own slow wave, so it wanders over the whole pile). */
export const roamZ = (ms: number): number => 0.45 + 0.22 * Math.sin((ms / 1000) * 0.9 + 1.1);

/**
 * How a loss looks (cosmetic only, from the play's id so it's the same on every redraw): usually the crate is grabbed and drops
 * back on the pile partway up (`drop`, at `at` of the lift: 0.35 to 0.75), sometimes the prongs just slip off it (`slip`: a quarter).
 */
export function lossOf(request: string | null): { kind: "drop" | "slip"; at: number } {
  let h = 2166136261;
  for (const ch of request ?? "") h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  return { kind: h % 4 === 0 ? "slip" : "drop", at: 0.35 + ((h >>> 8) % 1000) / 2500 };
}

export interface ClawPose {
  /** Over the glass: x 0 left to 1 right, z 0 back to 1 front. */
  x: number;
  z: number;
  /** How far down the cable is: 0 at the gantry, 1 down on the pile. */
  down: number;
  /** The prongs: 1 open, 0 shut. */
  open: number;
  /** The claw holds the crate. */
  held: boolean;
  /**
   * A crate let go and falling: how far it has fallen (0 to 1) and from where (`fromDown`, the cable's reach when it fell), and where
   * to (`into`: the pile, or the chute). Null: none falling.
   */
  fall: { t: number; fromDown: number; into: "pile" | "chute" } | null;
  /** The crate the claw went for is off the pile (held, falling into the chute, or won and in the tray). */
  taken: boolean;
  /** The won crate is in the tray under the chute. */
  inTray: boolean;
  /** The coin dropping into the slot: 0 to 1, or -1. */
  coin: number;
}

export const newPose = (): ClawPose => ({ x: CHUTE.x, z: CHUTE.z, down: 0, open: 1, held: false, fall: null, taken: false, inTray: false, coin: -1 });

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where the claw is while it roams, `ms` after it came out (it glides out from home over its first 0.6 s). */
function roamAt(ms: number, out: ClawPose): void {
  const k = ease(ms / 600);
  out.x = lerp(CHUTE.x, roamX(ms), k);
  out.z = lerp(CHUTE.z, roamZ(ms), k);
}

/**
 * The claw's pose at `now` for the play `p` (no allocation but the `fall` object it reuses). A win (`p.won` true) lifts the crate and
 * carries it to the chute; a loss either drops it back partway up the lift or slips (`lossOf`). Every stage follows the controls' own
 * timers (CLAW.dropMs, liftMs, carryMs), so the room and the controls never disagree.
 */
export function clawPose(p: ClawPlay, now: number, out: ClawPose): ClawPose {
  const t = Math.max(0, now - p.at);
  out.coin = -1;
  out.fall = null;
  out.held = false;
  out.taken = false;
  out.inTray = false;
  out.down = 0;
  out.open = 1;
  out.x = CHUTE.x;
  out.z = CHUTE.z;
  const loss = lossOf(p.request);
  switch (p.stage) {
    case "coin":
      out.coin = clamp(t / COIN_MS);
      return out;
    case "roam":
      roamAt(now - p.roamAt, out);
      return out;
    case "drop":
      roamAt(p.dropAt - p.roamAt, out);
      out.down = ease(t / CLAW.dropMs);
      // (The prongs close as it lands, in the drop's last fifth.)
      out.open = 1 - ease((t / CLAW.dropMs - 0.8) / 0.2);
      return out;
    case "lift":
    case "lost": {
      roamAt(p.dropAt - p.roamAt, out);
      const u = p.stage === "lift" ? clamp(t / CLAW.liftMs) : 1;
      out.down = 1 - ease(u);
      if (p.won === true) {
        out.open = 0;
        out.held = out.taken = true;
        return out;
      }
      if (loss.kind === "slip") {
        // The prongs close on the crate but it slides out at once: the claw comes up open a little and empty.
        out.open = 0.35;
        if (p.stage === "lost") goHome(t, out);
        return out;
      }
      // Grabbed, then dropped back on the pile partway up.
      if (u < loss.at) {
        out.open = 0;
        out.held = out.taken = true;
        return out;
      }
      out.open = 0.45;
      const sinceDrop = p.stage === "lift" ? (u - loss.at) * CLAW.liftMs : CLAW.liftMs * (1 - loss.at) + t;
      const fallMs = 380;
      if (sinceDrop < fallMs) {
        out.fall = { t: ease(sinceDrop / fallMs), fromDown: 1 - ease(loss.at), into: "pile" };
        out.taken = true;
      }
      if (p.stage === "lost") goHome(t, out);
      return out;
    }
    case "carry": {
      roamAt(p.dropAt - p.roamAt, out);
      const k = ease(t / CLAW.carryMs);
      out.x = lerp(out.x, CHUTE.x, k);
      out.z = lerp(out.z, CHUTE.z, k);
      out.open = 0;
      out.held = out.taken = true;
      return out;
    }
    case "won":
    case "opening": {
      out.taken = true;
      out.open = 1;
      if (t < CHUTE_MS && p.stage === "won") out.fall = { t: ease(t / CHUTE_MS), fromDown: 0, into: "chute" };
      else out.inTray = true;
      return out;
    }
    default:
      return out;
  }
}

/** After a loss, the claw glides back home over HOME_MS (from where it dropped). */
function goHome(t: number, out: ClawPose): void {
  const k = ease(t / HOME_MS);
  out.x = lerp(out.x, CHUTE.x, k);
  out.z = lerp(out.z, CHUTE.z, k);
}

/**
 * The crates piled in the glass: x, z (fractions of the glass) and layer (0 on the floor, 1 on top). Kept clear of the chute's corner.
 * The claw goes for the top crate nearest where it drops (`pickCrate`).
 */
export const PILE: readonly (readonly [x: number, z: number, layer: number])[] = [
  [0.4, 0.25, 0], [0.6, 0.22, 0], [0.8, 0.28, 0], [0.5, 0.5, 0], [0.72, 0.52, 0], [0.9, 0.5, 0], [0.42, 0.75, 0], [0.62, 0.78, 0], [0.84, 0.76, 0],
  [0.5, 0.36, 1], [0.7, 0.38, 1], [0.6, 0.64, 1], [0.8, 0.64, 1],
];
/** The pile's crate the claw goes for when it drops at (x, z): the nearest, a top one if one is near as the nearest. */
export function pickCrate(x: number, z: number): number {
  let best = 0;
  let bd = Infinity;
  PILE.forEach(([px, pz, layer], i) => {
    const d = Math.hypot(px - x, pz - z) - layer * 0.08;
    if (d < bd) ((bd = d), (best = i));
  });
  return best;
}
