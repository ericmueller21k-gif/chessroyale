/**
 * Smudgy's transition into the match (Nov 6; Eric: "a bunch of paint splatters that start filling the screen until once it gets full,
 * and then they wipe away. And then the game starts."). A canvas over the whole page, outside the town's tree (as the storm's and the
 * wipe's: it stays as the town closes and the battle opens under it), taking every tap while it shows:
 * - "in": splats of the room's deep paints land, faster and faster (`splatTimes`), each drawn once onto the canvas, never cleared;
 * - "covered" (`coverMs` in, by the clock): the screen filled under them with the deepest blue, however many landed; held at least
 *   `holdMinMs` and while the match loads;
 * - "out": a brush stroke sweeps across, left to right, over `wipeMs`, wiping the paint away onto the match, then it's gone.
 * Every phase goes by the clock (setTimeout), not by frames: a hidden tab, a lost context or no canvas at all still gets to the match.
 * Its phase is on the element (`data-phase`; `data-covered="1"` once covered) for tests. CHALLENGE_FEEL.smudgy.splat has its numbers.
 */
import { CHALLENGE_FEEL } from "../../../../packages/app/src/town/shops/challenge.ts";
import { INTRO_SMUDGY_GROUND, INTRO_SMUDGY_SPLATS, INTRO_SMUDGY_STROKE } from "./house-intro-smudgy.ts";
import { playCue, type LoadedIntro, type Storm } from "../../../../packages/app/src/town/shops/intro.ts";

type SplatFeel = (typeof CHALLENGE_FEEL)["smudgy"]["splat"];

/** When each splat lands (ms from the start): the gaps shrink evenly (geometrically) from `firstGapMs` to `lastGapMs` by `coverMs`. */
export function splatTimes(f: SplatFeel = CHALLENGE_FEEL.smudgy.splat): number[] {
  const out: number[] = [];
  let t = 0;
  // (A gap's share of the way, from the first gap to the last: the time so far over the whole cover.)
  while (t < f.coverMs) {
    out.push(t);
    const u = Math.min(1, t / f.coverMs);
    t += f.firstGapMs * (f.lastGapMs / f.firstGapMs) ** u;
  }
  return out;
}
/** A small seeded random in [0, 1). */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** One splat: its middle (0 to 1 of the screen), radius (of the shorter side), color, lobes and droplets, seeded by `i`. */
export function splatOf(i: number, f: SplatFeel = CHALLENGE_FEEL.smudgy.splat) {
  return {
    x: rnd(i, 1),
    y: rnd(i, 2),
    r: f.minR + (f.maxR - f.minR) * rnd(i, 3) * (0.5 + 0.5 * Math.min(1, i / 30)),
    color: INTRO_SMUDGY_SPLATS[Math.floor(rnd(i, 4) * INTRO_SMUDGY_SPLATS.length)]!,
    lobes: 5 + Math.floor(rnd(i, 5) * 5),
    turn: rnd(i, 6) * Math.PI * 2,
  };
}
/** Where the brush stroke's leading edge is (0 to 1 across the screen) `t` ms into the wipe: eased in and out. */
export const strokeAt = (t: number, f: SplatFeel = CHALLENGE_FEEL.smudgy.splat): number => {
  const u = Math.min(1, Math.max(0, t / f.wipeMs));
  return u * u * (3 - 2 * u);
};

function drawSplat(g: CanvasRenderingContext2D, i: number, W: number, H: number) {
  const s = splatOf(i);
  const R = s.r * Math.min(W, H);
  const cx = s.x * W;
  const cy = s.y * H;
  g.fillStyle = s.color;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  // Lobes round its edge, and droplets flung further out.
  for (let k = 0; k < s.lobes; k++) {
    const a = s.turn + (k / s.lobes) * Math.PI * 2;
    const d = R * (0.85 + 0.3 * rnd(i, 10 + k));
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.25 + 0.2 * rnd(i, 20 + k)), 0, Math.PI * 2);
    g.fill();
    const e = R * (1.4 + 0.8 * rnd(i, 30 + k));
    g.beginPath();
    g.arc(cx + Math.cos(a + 0.3) * e, cy + Math.sin(a + 0.3) * e, R * 0.08 + 1, 0, Math.PI * 2);
    g.fill();
  }
}

export function startSplatter(intro: LoadedIntro): Storm {
  const F = CHALLENGE_FEEL.smudgy.splat;
  const cv = document.createElement("canvas");
  cv.className = "boss-splatter";
  cv.setAttribute("aria-hidden", "true");
  cv.dataset.boss = intro.home;
  cv.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483000;touch-action:none;pointer-events:auto";
  document.body.append(cv);
  const g = cv.getContext("2d");
  // (One canvas pixel a CSS pixel: flat paint, nothing to keep crisp. Its size fixed at the start: the paint stays where it landed.)
  const W = Math.max(1, Math.round(innerWidth));
  const H = Math.max(1, Math.round(innerHeight));
  cv.width = W;
  cv.height = H;
  const times = splatTimes(F);
  const t0 = performance.now();
  let drawn = 0;
  let phase: "in" | "covered" | "out" = "in";
  let outAt = 0;
  let snap: HTMLCanvasElement | null = null;
  let raf = 0;
  const setPhase = (p: typeof phase) => {
    phase = p;
    cv.dataset.phase = p;
  };
  const frame = (now: number) => {
    if (g) {
      if (phase === "in") {
        // The splats due by now, each drawn once, `perSplat` at a time.
        const t = now - t0;
        while (drawn < times.length && times[drawn]! <= t) {
          for (let k = 0; k < F.perSplat; k++) drawSplat(g, drawn * F.perSplat + k, W, H);
          drawn++;
        }
      } else if (phase === "out" && snap) {
        // The stroke: the paint wiped off left of its edge; its band of fresh paint at the edge, bristle streaks trailing it.
        const e = strokeAt(now - outAt, F) * (W * (1 + F.strokeW * 2));
        const bw = W * F.strokeW;
        g.clearRect(0, 0, W, H);
        g.drawImage(snap, 0, 0);
        g.clearRect(0, 0, Math.max(0, e - bw), H);
        g.fillStyle = INTRO_SMUDGY_STROKE.paint;
        g.fillRect(e - bw, 0, bw, H);
        for (let y = 0; y < H; y += 6) {
          const len = bw * (0.3 + rnd(y, 7) * 1.4);
          g.fillStyle = y % 12 ? INTRO_SMUDGY_STROKE.streak : INTRO_SMUDGY_STROKE.edge;
          g.fillRect(e - bw - len, y, len, 2);
          g.fillRect(e, y + 2, bw * 0.25 * rnd(y, 9), 3);
        }
      }
    }
    raf = requestAnimationFrame(frame);
  };
  setPhase("in");
  raf = requestAnimationFrame(frame);
  // (A wet splat for the first few, as they land; not one for every splat once they come thick and fast.)
  for (let i = 0; i < Math.min(F.splatSounds, times.length); i++) {
    const at = times[Math.min(times.length - 1, Math.round(i * i * 1.6))]!;
    setTimeout(() => playCue(intro, "splat"), at);
  }
  let coveredAt = 0;
  const covered = new Promise<void>((ok) =>
    setTimeout(() => {
      coveredAt = performance.now();
      if (g) {
        // Filled under the splats, however many landed; kept as it is for the stroke to wipe.
        g.globalCompositeOperation = "destination-over";
        g.fillStyle = INTRO_SMUDGY_GROUND;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "source-over";
        try {
          snap = document.createElement("canvas");
          snap.width = W;
          snap.height = H;
          snap.getContext("2d")?.drawImage(cv, 0, 0);
        } catch {
          snap = null;
        }
      }
      setPhase("covered");
      cv.dataset.covered = "1";
      ok();
    }, F.coverMs),
  );
  const out = async () => {
    await covered;
    const wait = coveredAt + F.holdMinMs - performance.now();
    if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
    outAt = performance.now();
    setPhase("out");
    playCue(intro, "swipe");
    await new Promise((ok) => setTimeout(ok, F.wipeMs));
    cancelAnimationFrame(raf);
    cv.remove();
  };
  return { covered, out };
}
