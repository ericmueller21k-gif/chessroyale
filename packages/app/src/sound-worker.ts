/**
 * The sound worker: makes the bosses' synthesized sounds ahead of their battle (warmSounds in sound.ts) off the page's
 * thread, so making one (150 ms on a computer for Hollow's smash; 50 to 180 ms each for Big Boy's on a 4x-slowed phone) never
 * holds up a frame of the intro.
 */
import { makeBossSound, type BossSound } from "./characters/boss-sounds.ts";

const scope = self as unknown as { onmessage: ((e: MessageEvent<{ sound: BossSound; rate: number }>) => void) | null; postMessage: (m: unknown) => void };
scope.onmessage = (e) => {
  const { sound, rate } = e.data;
  let data: Float32Array | null = null;
  try {
    data = makeBossSound(sound, rate);
  } catch {
    // (The page makes it when it plays.)
  }
  scope.postMessage({ sound, rate, data });
};
