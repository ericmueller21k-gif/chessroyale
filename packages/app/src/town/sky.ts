/**
 * The town square's sky by the time of day (pure: no drawing). Four looks in order, dawn, day, dusk and night, each a
 * weight that blends smoothly into the next over the hours in feel.ts (`skyHours`, `skyBlendMinutes`); the looks' colors
 * are there too (`skyLooks`): the sky's gradient, the horizon (which the far ground and the haze dissolve into, so the
 * edge is one soft line), the tint over the world, the sun or moon, the clouds and dawn's mist.
 * `?sky=dawn|day|dusk|night` on /town picks one look whatever the clock says (Town.tsx reads it; nothing else does).
 */
import { TOWN_FEEL, type SkyLook } from "./feel.ts";

export type Look = "dawn" | "day" | "dusk" | "night";
export const LOOKS: readonly Look[] = ["dawn", "day", "dusk", "night"];
/** How much of each look shows (they add up to 1). */
export type SkyWeights = Record<Look, number>;
export type RGB = readonly [number, number, number];

/** Where the sky's gradient stops, from the top of the box (0) to the horizon (1): the same for every look, so they blend. */
export const SKY_STOPS = [0, 0.3, 0.6, 0.85, 1] as const;

export const look = (l: Look): SkyLook => TOWN_FEEL.skyLooks[l];

const ramp = (t: number, at: number, blend: number) => Math.max(0, Math.min(1, (t - (at - blend / 2)) / blend));

/** The looks' weights at `minutes` past local midnight (0 to 1440). */
export function skyWeights(minutes: number): SkyWeights {
  const { dawn, day, dusk, night } = TOWN_FEEL.skyHours;
  const b = TOWN_FEEL.skyBlendMinutes;
  const t = ((minutes % 1440) + 1440) % 1440;
  const toDawn = ramp(t, dawn, b);
  const toDay = ramp(t, day, b);
  const toDusk = ramp(t, dusk, b);
  const toNight = ramp(t, night, b);
  return { dawn: toDawn - toDay, day: toDay - toDusk, dusk: toDusk - toNight, night: 1 - toDawn + toNight };
}

/** `?sky=` on /town: one look whatever the clock says. Null for anything else. */
export function skyOverride(value: string | null): SkyWeights | null {
  if (value !== "dawn" && value !== "day" && value !== "dusk" && value !== "night") return null;
  const w: SkyWeights = { dawn: 0, day: 0, dusk: 0, night: 0 };
  w[value] = 1;
  return w;
}

/** Mixes one color of every look by the weights. */
export function mixRGB(w: SkyWeights, pick: (c: SkyLook) => RGB): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (const l of LOOKS) {
    const c = pick(look(l));
    for (let i = 0; i < 3; i++) out[i]! += c[i]! * w[l];
  }
  return out;
}

/** The tint over the world for these weights: [r, g, b, alpha], its color weighted by each look's strength. */
export function mixTint(w: SkyWeights): [number, number, number, number] {
  let a = 0;
  const c = [0, 0, 0];
  for (const l of LOOKS) {
    const t = look(l).tint;
    const k = w[l] * t[3];
    a += k;
    for (let i = 0; i < 3; i++) c[i]! += t[i]! * k;
  }
  return a > 0 ? [c[0]! / a, c[1]! / a, c[2]! / a, a] : [0, 0, 0, 0];
}

/** How much of dawn's low mist shows. */
export const mixMist = (w: SkyWeights): number => LOOKS.reduce((m, l) => m + w[l] * look(l).mist, 0);

export const sameWeights = (a: SkyWeights, b: SkyWeights): boolean => LOOKS.every((l) => Math.abs(a[l] - b[l]) < 1e-3);
