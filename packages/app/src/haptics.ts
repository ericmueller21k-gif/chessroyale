import { HAPTICS, type HapticKind, type HapticPattern } from "@chessroyale/core";
import { vibrationOn } from "./prefs.ts";

/**
 * Haptics (Eric, Nov 9; docs/decisions/2026-11-09-haptics.md): `haptic(kind)` plays a kind's pattern (HAPTICS in
 * settings.ts) where the device can, and Settings → Sound, "Vibration" is on. Two ways, picked once:
 * - `vibrate`: the Vibration API (Android's browsers), on a touch screen.
 * - `ios`: an iPhone or iPad, which has no Vibration API: a hidden `<input type="checkbox" switch>` toggled through its
 *   label plays the system's switch tick (iOS 18 and later). It plays only inside a user gesture (a tap's handlers), so
 *   a moment that comes by itself (a boss power on his turn) likely plays nothing there. A pattern is one tick per pulse.
 *   A touch's press going down isn't a gesture (only its lift is), so a tick from a press-down waits for that finger's
 *   lift there (`hapticAtPress` / `hapticAtLift`; docs/decisions/2026-11-11-ios-move-tick.md).
 * - none (a computer, an old phone): nothing, and Settings shows the switch greyed.
 * Never throws and never waits: a move is never held up by it.
 */

export type HapticWay = "vibrate" | "ios" | null;

/** What a device offers (read from the browser by `deviceHaptics`). */
export interface HapticDevice {
  vibrate: boolean;
  touch: boolean;
  ios: boolean;
  switchInput: boolean;
}

/** Which way a device vibrates: the Vibration API on a touch screen, else an iPhone's switch, else none. */
export function pickWay(d: HapticDevice): HapticWay {
  if (d.vibrate && d.touch) return "vibrate";
  if (d.ios && d.switchInput) return "ios";
  return null;
}

export function deviceHaptics(): HapticDevice {
  try {
    const nav = globalThis.navigator;
    const touches = nav?.maxTouchPoints ?? 0;
    const ua = nav?.userAgent ?? "";
    return {
      vibrate: typeof nav?.vibrate === "function",
      touch: touches > 0,
      // (An iPad says it's a Mac: one with a touch screen is an iPad.)
      ios: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touches > 1),
      switchInput: typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype,
    };
  } catch {
    return { vibrate: false, touch: false, ios: false, switchInput: false };
  }
}

/**
 * Why Settings → Sound's "Vibration" is greyed on a device that has this way, or null where it works. An iPhone or iPad: greyed
 * (Eric, Nov 11: iOS 27's Safari gives web pages no tick; docs/decisions/2026-11-11-mate-effects-iphone-vibration.md). Its switch path stays,
 * so `?haptics=debug` still shows what a later iOS does.
 */
export function vibrationGreyed(w: HapticWay): string | null {
  if (w === "ios") return "Not available on iPhone.";
  return w ? null : "Not available on this device.";
}

let way: HapticWay | undefined;
/** This device's way (read once). */
export function hapticWay(): HapticWay {
  if (way === undefined) way = pickWay(deviceHaptics());
  return way;
}

/** The pulses of a pattern (its "on" lengths). */
export const pulses = (p: HapticPattern): number => (typeof p === "number" ? 1 : Math.ceil(p.length / 2));

let label: HTMLLabelElement | null = null;
let input: HTMLInputElement | null = null;
/**
 * The hidden switch, made once: a label wrapping an `<input type="checkbox" switch>`. It stays rendered but invisible
 * (opacity 0, 1 px, no taps), not display:none: a switch with no box may play nothing (Nov 11).
 */
function switchLabel(): HTMLLabelElement {
  if (!label) {
    label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    Object.assign(label.style, { position: "fixed", left: "0", top: "0", width: "1px", height: "1px", overflow: "hidden", opacity: "0", pointerEvents: "none" });
    input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.append(input);
    // (Its clicks stay its own: nothing on the page hears them.)
    label.addEventListener("click", (e) => e.stopPropagation());
    document.body.append(label);
  }
  return label;
}

/** One iPhone tick: the hidden switch toggled through its label. */
function iosTick() {
  switchLabel().click();
  debugLog(`tick: label clicked in ${eventType()}, switch now ${input?.checked ? "on" : "off"}`);
}

/** The event being handled now (window.event), if any. */
function eventType(): string {
  try {
    return (globalThis as { event?: Event }).event?.type ?? "no event";
  } catch {
    return "no event";
  }
}

/**
 * The events WebKit surely counts as a tap (a gesture): an iPhone's tick plays inside them. In a pointer event (a
 * board's press or lift) it waits for the touch's own `touchend` (or the `click`), which follows within the same tap.
 */
const GESTURES = new Set(["touchend", "click", "mouseup", "keydown", "keyup"]);
const WAIT_MS = 600;
let waiting: { n: number; at: number } | null = null;
let listening = false;
function flush() {
  const w = waiting;
  waiting = null;
  if (!w || Date.now() - w.at > WAIT_MS) return;
  debugLog(`flush ${w.n} in ${eventType()}`);
  iosTicks(w.n);
}
function listen() {
  if (listening) return;
  listening = true;
  for (const t of ["touchend", "click"]) document.addEventListener(t, flush, { capture: true, passive: true } as AddEventListenerOptions);
}

/** n ticks: now, then the rest by timers (a tap's gesture carries into short timers). */
function iosTicks(n: number) {
  iosTick();
  for (let i = 1; i < n; i++) setTimeout(() => void tryTick(), i * HAPTICS.iosTickGapMs);
}

/** Plays a kind's pattern, if Vibration is on and the device can. */
export function haptic(kind: HapticKind): void {
  try {
    const w = hapticWay();
    if (!vibrationOn() || globalThis.document?.hidden) return void debugLog(`${kind}: off (Vibration ${vibrationOn() ? "on" : "off"}, way ${w})`);
    if (!w) return void debugLog(`${kind}: no way on this device`);
    const p = HAPTICS.patterns[kind] as HapticPattern;
    if (w === "vibrate") {
      navigator.vibrate(typeof p === "number" ? p : [...p]);
      return void debugLog(`${kind}: vibrate`);
    }
    const n = Math.min(pulses(p), HAPTICS.iosTicks);
    const ev = eventType();
    if (ev.startsWith("pointer") || ev.startsWith("touchstart")) {
      // (Not a gesture yet: the tap's touchend or click plays it.)
      listen();
      waiting = { n: Math.max(n, waiting?.n ?? 0), at: Date.now() };
      return void debugLog(`${kind}: waits for touchend (in ${ev})`);
    }
    debugLog(`${kind}: ios now (in ${ev})`);
    iosTicks(n);
  } catch (err) {
    debugLog(`${kind}: error ${String(err)}`);
  }
}

function tryTick() {
  try {
    iosTick();
  } catch {
    // No vibration here.
  }
}

/** A tick a press-down made, kept on an iPhone for that finger's lift. */
export interface LiftTick {
  pointer: number;
  square: string;
  at: number;
  kind: HapticKind;
}

/**
 * A tick from a press going down (a tap-tap move made on the second press, a premove placed, a try into Hollow's dark).
 * With the Vibration API it plays at once. On an iPhone a touch's press-down isn't a gesture, so the tick would play
 * nothing there: it's returned instead, for `hapticAtLift` to play as that finger lifts.
 */
export function hapticAtPress(kind: HapticKind, pointer: number, square: string, at: number = Date.now()): LiftTick | null {
  if (hapticWay() !== "ios") {
    haptic(kind);
    return null;
  }
  return { pointer, square, at, kind };
}

/** A finger lifted (pointerup): a tick kept for it plays if it's the same finger, on the same square, within HAPTICS.holdMs. */
export function hapticAtLift(t: LiftTick | null, pointer: number, square: string | null, at: number = Date.now()): void {
  if (t && t.pointer === pointer && t.square === square && at - t.at < HAPTICS.holdMs) haptic(t.kind);
}

/**
 * `?haptics=debug` (kept on this device until `?haptics=off`): a small on-screen log of every tick tried (the way,
 * the event it came in, whether the label was clicked), for Eric's iPhone to tell us what it does.
 */
let debugEl: HTMLElement | null | undefined;
function debugOn(): HTMLElement | null {
  if (debugEl !== undefined) return debugEl;
  debugEl = null;
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "").get("haptics");
    if (q === "debug") localStorage.setItem("brc.hapticsDebug", "1");
    if (q === "off") localStorage.removeItem("brc.hapticsDebug");
    if (localStorage.getItem("brc.hapticsDebug") !== "1" || !document.body) return null;
    const el = document.createElement("div");
    Object.assign(el.style, { position: "fixed", left: "4px", bottom: "4px", zIndex: "2147483647", maxWidth: "70vw", maxHeight: "30vh", overflow: "hidden", font: "11px/1.3 monospace", background: "rgba(0,0,0,.75)", color: "#fff", padding: "4px 6px", borderRadius: "6px", pointerEvents: "none", whiteSpace: "pre-wrap" });
    document.body.append(el);
    debugEl = el;
    const d = deviceHaptics();
    debugLog(`way ${hapticWay()} · vibrate ${d.vibrate} touch ${d.touch} ios ${d.ios} switch ${d.switchInput} · Vibration ${vibrationOn() ? "on" : "off"}`);
  } catch {
    debugEl = null;
  }
  return debugEl;
}
const debugLines: string[] = [];
function debugLog(line: string) {
  const el = debugOn();
  if (!el) return;
  debugLines.push(`${new Date().toISOString().slice(17, 23)} ${line}`);
  if (debugLines.length > 12) debugLines.shift();
  el.textContent = debugLines.join("\n");
}
/** Shows the debug log at once (main.tsx), if it's on. */
export function hapticsDebug(): void {
  debugOn();
}

const done = new Set<string>();
/** A moment's pattern, once for its key on this page (a screen drawn again, or a later one, doesn't play it twice). */
export function hapticOnce(key: string, kind: HapticKind): void {
  if (done.has(key)) return;
  done.add(key);
  haptic(kind);
}

/** The haptic of an art's cue as its frame plays (HAPTICS.cues: "<id> <anim> <cue>", else "<id> <cue>"), if it has one. */
export function cueHaptic(id: string, anim: string, cue: string): void {
  const cues = HAPTICS.cues as Record<string, HapticKind | undefined>;
  const kind = cues[`${id} ${anim} ${cue}`] ?? cues[`${id} ${cue}`];
  if (kind) haptic(kind);
}
