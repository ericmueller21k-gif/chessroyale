import { useLayoutEffect, useRef } from "preact/hooks";
import { bossKit } from "../characters/kits.ts";
import { SQUARE } from "../characters/effects.ts";
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
 *
 * Kept cheap however many play at once (.claude/LESSONS.md, "Lag that grows with the match"): every sprite on the page
 * shares one animation-frame loop, each frame's pixels are made once, and a canvas is only redrawn when its frame
 * changes. For many square effects at once (a dozen burning tiles), <BoardEffects> draws them all on one canvas.
 */

/** One animation-frame loop for every sprite on the page (a dozen effects cost one callback a frame, not a dozen). */
const ticks = new Set<() => void>();
let loopId = 0;
function tick() {
  loopId = 0;
  for (const t of ticks) t();
  if (ticks.size) loopId = requestAnimationFrame(tick);
}
function onEachFrame(fn: () => void): () => void {
  ticks.add(fn);
  if (!loopId) loopId = requestAnimationFrame(tick);
  return () => {
    ticks.delete(fn);
    if (!ticks.size && loopId) {
      cancelAnimationFrame(loopId);
      loopId = 0;
    }
  };
}

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
/** Frames in a look (Hollow's bulbs out), made once each. */
const lookImages = new WeakMap<Frame, Map<string, ImageData>>();
function frameImage(ch: Character, frame: Frame, look?: string): ImageData {
  if (look) {
    let byLook = lookImages.get(frame);
    if (!byLook) lookImages.set(frame, (byLook = new Map()));
    let li = byLook.get(look);
    if (!li) {
      const r = renderFrame(ch, frame, { look });
      byLook.set(look, (li = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h)));
    }
    return li;
  }
  let img = images.get(frame);
  if (!img) {
    const r = renderFrame(ch, frame);
    img = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h);
    images.set(frame, img);
  }
  return img;
}
/** A frame as a little canvas of its own (made once), for drawing onto a shared canvas with drawImage. */
const canvases = new WeakMap<Frame, HTMLCanvasElement>();
function frameCanvas(ch: Character, frame: Frame): HTMLCanvasElement {
  let c = canvases.get(frame);
  if (!c) {
    c = document.createElement("canvas");
    c.width = ch.w;
    c.height = ch.h;
    c.getContext("2d")?.putImageData(frameImage(ch, frame), 0, 0);
    canvases.set(frame, c);
  }
  return c;
}
/**
 * Draws an effect's frames ahead of time, a slice each animation frame on the shared loop (about 4 ms of work a frame),
 * so a big effect's first showing doesn't stall: Hollow's night has 256 tiles, and its last smash would otherwise draw
 * 32 of them in one frame. `frames` in the order they'll be needed ([animation, frame index]). Returns a cancel.
 */
export function prewarm(name: EffectName, frames: readonly (readonly [string, number])[]): () => void {
  const ch = EFFECTS[name].ch;
  let i = 0;
  let stop = () => {};
  stop = onEachFrame(() => {
    const t0 = performance.now();
    do {
      const f = frames[i] && ch.anims[frames[i]![0]]?.frames[frames[i]![1]];
      if (f) frameCanvas(ch, f);
      i++;
    } while (i < frames.length && performance.now() - t0 < 4);
    if (i >= frames.length) stop();
  });
  return () => stop();
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
  /** One of the character's looks (Hollow's bulbs: `bulbs0` to `bulbs3`). */
  look?: string;
}

export function SpriteAnim({ ch, anim, since, then, sounds = {}, id = "", class: cls = "", style, look }: SpriteAnimProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  // Drawn before the paint (no empty first frame), then on every animation frame that changes the picture.
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    let last = "";
    const draw = () => {
      const s = spriteFrameAt(ch, anim, then, Date.now(), since);
      const key = `${s.anim}:${s.frame}`;
      if (key !== last) {
        last = key;
        const frame = ch.anims[s.anim]!.frames[s.frame]!;
        g.clearRect(0, 0, ch.w, ch.h);
        g.putImageData(frameImage(ch, frame, look), 0, 0);
        cv.current?.setAttribute("data-frame", key);
        const sound = frame.cue ? sounds[frame.cue] : undefined;
        const tag = `${ch.id}:${id}:${s.tag}:${s.frame}`;
        if (sound && !played.has(tag)) {
          played.add(tag);
          play(sound);
        }
      }
    };
    draw();
    return onEachFrame(draw);
  }, [ch, anim, then, since, id, look]);
  return <canvas ref={cv} class={`fx-sprite ${cls}`} width={ch.w} height={ch.h} aria-hidden="true" style={style} data-fx={ch.id} />;
}

/** An effect sprite (power-art.ts EFFECTS) playing `anim` (default: its start, else its loop), then `then`. */
export function BossEffect({ name, anim, since, then, id, class: cls, style }: { name: EffectName; anim?: string; since: number; then?: string; id?: string; class?: string; style?: Record<string, string | number> }) {
  const fx = EFFECTS[name];
  const a = anim ?? fx.start ?? fx.loop!;
  return <SpriteAnim ch={fx.ch} anim={a} since={since} then={then ?? (a === fx.start ? fx.loop : undefined)} sounds={fx.sounds} id={id} class={cls} style={style} />;
}

/** A boss's own animation (a power moment) somewhere other than his usual spot: Boingo's funhouse on the board. */
export function BossMoment({ boss, anim, since, then, class: cls, style, look }: { boss: string; anim: string; since: number; then?: string; class?: string; style?: Record<string, string | number>; look?: string }) {
  const kit = bossKit(boss);
  if (!kit) return null;
  return <SpriteAnim ch={kit.ch} anim={anim} since={since} then={then} sounds={kit.sounds} id="moment" class={cls} style={style} look={look} />;
}

/** One effect on a square of the board, for <BoardEffects>. */
export interface BoardItem {
  /** The square, "e4". */
  square: string;
  name: EffectName;
  /** Default: its start, else its loop. */
  anim?: string;
  /** Default: its loop, after its start. */
  then?: string;
  since: number;
  /** No sounds (a dozen tiles catching at once: one sound is enough). */
  quiet?: boolean;
}

/**
 * Many square effects at once on one canvas over the whole board (a dozen fire tiles, a piece burning on one, a
 * fireball landing): one canvas, one shared loop, and only the squares whose frame changed are redrawn. Size its box
 * to the board. Items on the same square draw in order (a piece's burn over its tile). Sounds from the frames' cues,
 * once each, through the mute switch.
 */
export function BoardEffects({ items, orientation, class: cls = "", style }: { items: readonly BoardItem[]; orientation: "white" | "black"; class?: string; style?: Record<string, string | number> }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef(items);
  live.current = items;
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 8 * SQUARE, 8 * SQUARE);
    // What each square shows now (the frames drawn there), so an unchanged square is left alone.
    const shown = new Map<string, string>();
    const draw = () => {
      const now = Date.now();
      const want = new Map<string, { key: string; frames: { ch: Character; frame: Frame; sound?: SoundName; tag: string }[] }>();
      for (const it of live.current) {
        const fx = EFFECTS[it.name];
        const a = it.anim ?? fx.start ?? fx.loop!;
        const s = spriteFrameAt(fx.ch, a, it.then ?? (a === fx.start ? fx.loop : undefined), now, it.since);
        const frame = fx.ch.anims[s.anim]!.frames[s.frame]!;
        const w = want.get(it.square) ?? { key: "", frames: [] };
        w.key += `${it.name}:${s.anim}:${s.frame};`;
        w.frames.push({ ch: fx.ch, frame, sound: frame.cue && !it.quiet ? fx.sounds[frame.cue] : undefined, tag: `${fx.ch.id}:${it.square}:${s.tag}:${s.frame}` });
        want.set(it.square, w);
      }
      for (const sq of new Set([...shown.keys(), ...want.keys()])) {
        const w = want.get(sq);
        if ((w?.key ?? "") === (shown.get(sq) ?? "")) continue;
        const f = sq.charCodeAt(0) - 97;
        const r = Number(sq[1]) - 1;
        const x = (orientation === "white" ? f : 7 - f) * SQUARE;
        const y = (orientation === "white" ? 7 - r : r) * SQUARE;
        g.clearRect(x, y, SQUARE, SQUARE);
        for (const fr of w?.frames ?? []) {
          g.drawImage(frameCanvas(fr.ch, fr.frame), x, y);
          if (fr.sound && !played.has(fr.tag)) {
            played.add(fr.tag);
            play(fr.sound);
          }
        }
        if (w) shown.set(sq, w.key);
        else shown.delete(sq);
      }
    };
    draw();
    return onEachFrame(draw);
  }, [orientation]);
  return <canvas ref={cv} class={`fx-sprite fx-board ${cls}`} width={8 * SQUARE} height={8 * SQUARE} aria-hidden="true" style={style} data-fx="board" />;
}
