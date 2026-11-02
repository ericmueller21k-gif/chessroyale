import { RIDES } from "@chessroyale/core";
import { account, type AccountState } from "./account.ts";

/**
 * The test switches in the address: playtest shortcuts such as `?debug`, `?win=1`, `?rounds=2` or `?pool=` (the full
 * list: docs/areas/ops.md, "Test switches"), which would make easy wins. They work only for an admin (ADMIN_EMAILS),
 * where the server has TEST_SWITCHES on (local, e2e, staging: /api/auth/config says so), and on the local dev server
 * (Vite's). For everyone else they're ignored, as if they weren't there. The server checks its own the same way (a
 * lobby's options, a queue's pool, a crate's forced roll).
 */
export function testSwitchesFor(dev: boolean, state: AccountState): boolean {
  return dev || !!state.config?.testSwitches || !!state.profile?.admin;
}

export const testSwitchesAllowed = () => testSwitchesFor(import.meta.env.DEV, account());

/** The address's query when the test switches are allowed, else an empty one. Read every test switch through this. */
export function testParams(): URLSearchParams {
  if (typeof location === "undefined" || !testSwitchesAllowed()) return new URLSearchParams();
  return new URLSearchParams(location.search);
}

/**
 * Two switches for trying lengths on a phone (Eric, Oct 24: "have a URL where I can change the URL and make it say 1/2 a
 * second longer or 1 second longer or 3/4 of a second longer, and then I can go test all three of them"), in seconds:
 * - `?bannerplus=0`, `0.5`, `0.75`, `1`: the extra time on every banner over the board (BANNER_PLUS_MS, 0.75 s, unless
 *   set), and everything after a banner that much later, for the games played on this device (Boss alone, a solo Crowd,
 *   any mode the device plays). Online the server's times rule, so an online game's screens keep the default.
 * - `?talkplus=0`, `0.5`, `1`: added to every speech line's read time (speech.tsx), everywhere.
 * Read from the address once, as the page opens (a link that drops the query later keeps them for the page); whether
 * they count, each time (testSwitchesAllowed). From 0 to 3 s; anything else is ignored.
 */
export function timingSeconds(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const s = Number(value);
  return Number.isFinite(s) && s >= 0 && s <= 3 ? Math.round(s * 1000) : null;
}
const TIMING_ASKED = (() => {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "");
    return { banner: timingSeconds(q.get("bannerplus")), talk: timingSeconds(q.get("talkplus")) };
  } catch {
    return { banner: null, talk: null };
  }
})();
/**
 * `?crowd=N`, `?fps` and `?gl=1` as the page opened (the town reads them once, so a later replaceState that drops the query
 * can't lose them). `gl`: the town drawn with WebGL 2 (Oct 30; anyone, not a test switch). A local e2e build can make it
 * the default (`VITE_TOWN_GL=1 npm run build`), to run the town's specs on it unchanged (docs/areas/town-square.md, "WebGL").
 */
export const TOWN_ASKED = (() => {
  let glBuild = false;
  try {
    glBuild = import.meta.env.VITE_TOWN_GL === "1";
  } catch {
    // (No import.meta.env outside Vite: Node's tests.)
  }
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "");
    return { crowd: Number(q.get("crowd")), fps: q.has("fps"), gl: q.get("gl") === "1" || glBuild };
  } catch {
    return { crowd: 0, fps: false, gl: glBuild };
  }
})();
let gameOnDevice = true;
/** The game now is played on this device (a solo game), or online (false: the server's times, the default extra). */
export function timingOnDevice(on: boolean): void {
  gameOnDevice = on;
}
/** A page's banner extra from its `?bannerplus=` (ms), if it counts now: allowed, and the game is on this device; else null. */
export const bannerPlusFor = (asked: number | null, allowed: () => boolean, onDevice: boolean): number | null => (asked !== null && onDevice && allowed() ? asked : null);
/** This page's banner extra (core's setBannerPlusSource takes it; null: BANNER_PLUS_MS). */
export const bannerPlusAsked = (): number | null => bannerPlusFor(TIMING_ASKED.banner, testSwitchesAllowed, gameOnDevice);
/** What `?talkplus=` adds to every speech line's read time now (ms; 0 without it, or where the switches don't count). */
export const talkPlusMs = (): number => (TIMING_ASKED.talk !== null && testSwitchesAllowed() ? TIMING_ASKED.talk : 0);

/**
 * `?rideScale=0.75` (Nov 1, Eric: "scale down the riders with just a button so to speak… I wanna see it at 75%"): every ride
 * drawn at that size on this page, over each ride's own (RIDES.scale), so sizes can be tried live. From 0.5 to 1.25
 * (RIDES.tryScale); anything else is ignored. Read from the address once, as the page opens; whether it counts, each time
 * it's asked (testSwitchesAllowed): a rider's frames are composed once, so it applies to the riders made from then on.
 */
export function rideScaleValue(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const k = Number(value);
  const [lo, hi] = RIDES.tryScale;
  return Number.isFinite(k) && k >= lo && k <= hi ? k : null;
}
const RIDE_SCALE_ASKED = (() => {
  try {
    return rideScaleValue(new URLSearchParams(globalThis.location?.search ?? "").get("rideScale"));
  } catch {
    return null;
  }
})();
/** The ride size this page's `?rideScale=` asks for, if it counts now (allowed); else null: each ride's own. */
export const rideScaleFor = (asked: number | null, allowed: () => boolean): number | null => (asked !== null && allowed() ? asked : null);
export const rideScaleAsked = (): number | null => rideScaleFor(RIDE_SCALE_ASKED, testSwitchesAllowed);
