import { HAPTICS, type HapticKind, type HapticPattern } from "@chessroyale/core";
import { vibrationOn } from "./prefs.ts";

/**
 * Haptics (Eric, Nov 9; docs/decisions/2026-11-09-haptics.md): `haptic(kind)` plays a kind's pattern (HAPTICS in
 * settings.ts) where the device can, and Settings → Sound, "Vibration" is on. Two ways, picked once:
 * - `vibrate`: the Vibration API (Android's browsers), on a touch screen.
 * - `ios`: an iPhone or iPad, which has no Vibration API: a hidden `<input type="checkbox" switch>` toggled through its
 *   label plays the system's switch tick (iOS 18 and later). It plays only inside a user gesture (a tap's handlers), so
 *   a moment that comes by itself (a boss power on his turn) likely plays nothing there. A pattern is one tick per pulse.
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

let way: HapticWay | undefined;
/** This device's way (read once). */
export function hapticWay(): HapticWay {
  if (way === undefined) way = pickWay(deviceHaptics());
  return way;
}

/** The pulses of a pattern (its "on" lengths). */
export const pulses = (p: HapticPattern): number => (typeof p === "number" ? 1 : Math.ceil(p.length / 2));

let label: HTMLLabelElement | null = null;
/** One iPhone tick: the hidden switch toggled through its label. */
function iosTick() {
  if (!label) {
    label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.append(input);
    // (Its clicks stay its own: nothing on the page hears them.)
    label.addEventListener("click", (e) => e.stopPropagation());
    document.body.append(label);
  }
  label.click();
}

/** Plays a kind's pattern, if Vibration is on and the device can. */
export function haptic(kind: HapticKind): void {
  try {
    if (!vibrationOn() || globalThis.document?.hidden) return;
    const w = hapticWay();
    if (!w) return;
    const p = HAPTICS.patterns[kind] as HapticPattern;
    if (w === "vibrate") {
      navigator.vibrate(typeof p === "number" ? p : [...p]);
      return;
    }
    const n = Math.min(pulses(p), HAPTICS.iosTicks);
    iosTick();
    for (let i = 1; i < n; i++) setTimeout(() => void tryTick(), i * HAPTICS.iosTickGapMs);
  } catch {
    // No vibration here.
  }
}

function tryTick() {
  try {
    iosTick();
  } catch {
    // No vibration here.
  }
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
