import { useLayoutEffect, useRef } from "preact/hooks";
import { bossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, type EffectName } from "../characters/power-art.ts";
import { renderFrame, type Character, type Frame } from "../characters/sprite.ts";
import { play, type SoundName } from "../sound.ts";

/**
 * A boss power's pixel art on screen: an effect sprite on the board (the ice over a frozen piece, a pie, the
 * blizzard; characters/effects.ts) or a boss's power moment played somewhere other than his usual spot (Boingo's
 * funhouse, on the board). The canvas fills its box (size the box to the square, or the board), never takes a tap,
 * and plays the art's sounds from its frames' cues, once each, through the mute switch.
 *
 * `since` is when the animation started (Date.now() time; online, from the shared state, so everyone is on the same
 * frame). A one-shot plays once and then hands over to `then` (a loop, run by the clock), or holds its last frame.
 */

/** What shows at `now`: `anim` once from `since`, then `then` by the clock (or `anim`'s last frame held). */
export function spriteFrameAt(ch: Character, anim: string, then: string | undefined, now: number, since: number): { anim: string; frame: number; tag: string } {
  const a = ch.anims[anim];
  if (!a) throw new Error(`${ch.id}: no animation "${anim}"`);
  const at = (frames: readonly Frame[], t: number) => {
    let acc = 0;
    for (let i = 0; i < frames.length; i++) if (t < (acc += frames[i]!.ms)) return i;
    return frames.length - 1;
  };
  const len = animLength(a);
  if (a.loop) {
    const cycle = Math.floor(Math.max(0, now - since) / len);
    return { anim, frame: at(a.frames, now - since - cycle * len), tag: `${anim}:${since}:${cycle}` };
  }
  const loop = then ? ch.anims[then] : undefined;
  if (now - since < len || !loop) return { anim, frame: at(a.frames, Math.max(0, now - since)), tag: `${anim}:${since}` };
  const total = animLength(loop);
  const cycle = Math.floor(now / total);
  return { anim: then!, frame: at(loop.frames, now - cycle * total), tag: `${then}:${cycle}` };
}

const images = new WeakMap<Frame, ImageData>();
function frameImage(ch: Character, frame: Frame): ImageData {
  let img = images.get(frame);
  if (!img) {
    const r = renderFrame(ch, frame);
    img = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h);
    images.set(frame, img);
  }
  return img;
}
/** Sounds already played (a frame shown twice, or a new screen, never plays one twice). */
const played = new Set<string>();

export interface SpriteAnimProps {
  ch: Character;
  anim: string;
  since: number;
  then?: string;
  /** Frame cues to sounds. */
  sounds?: Record<string, SoundName>;
  /** Tells apart two of the same effect at once (two frozen pieces): the square, say. */
  id?: string;
  class?: string;
  style?: Record<string, string | number>;
}

export function SpriteAnim({ ch, anim, since, then, sounds = {}, id = "", class: cls = "", style }: SpriteAnimProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  // Drawn before the paint (no empty first frame), then on every animation frame that changes the picture.
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    let raf = 0;
    let last = "";
    const draw = () => {
      const s = spriteFrameAt(ch, anim, then, Date.now(), since);
      const key = `${s.anim}:${s.frame}`;
      if (key !== last) {
        last = key;
        const frame = ch.anims[s.anim]!.frames[s.frame]!;
        g.clearRect(0, 0, ch.w, ch.h);
        g.putImageData(frameImage(ch, frame), 0, 0);
        cv.current?.setAttribute("data-frame", key);
        const sound = frame.cue ? sounds[frame.cue] : undefined;
        const tag = `${ch.id}:${id}:${s.tag}:${s.frame}`;
        if (sound && !played.has(tag)) {
          played.add(tag);
          play(sound);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [ch, anim, then, since, id]);
  return <canvas ref={cv} class={`fx-sprite ${cls}`} width={ch.w} height={ch.h} aria-hidden="true" style={style} data-fx={ch.id} />;
}

/** An effect sprite (power-art.ts EFFECTS) playing `anim` (default: its start, else its loop), then `then`. */
export function BossEffect({ name, anim, since, then, id, class: cls, style }: { name: EffectName; anim?: string; since: number; then?: string; id?: string; class?: string; style?: Record<string, string | number> }) {
  const fx = EFFECTS[name];
  const a = anim ?? fx.start ?? fx.loop!;
  return <SpriteAnim ch={fx.ch} anim={a} since={since} then={then ?? (a === fx.start ? fx.loop : undefined)} sounds={fx.sounds} id={id} class={cls} style={style} />;
}

/** A boss's own animation (a power moment) somewhere other than his usual spot: Boingo's funhouse on the board. */
export function BossMoment({ boss, anim, since, then, class: cls, style }: { boss: string; anim: string; since: number; then?: string; class?: string; style?: Record<string, string | number> }) {
  const kit = bossKit(boss);
  if (!kit) return null;
  return <SpriteAnim ch={kit.ch} anim={anim} since={since} then={then} sounds={kit.sounds} id="moment" class={cls} style={style} />;
}
