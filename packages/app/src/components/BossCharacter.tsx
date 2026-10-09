import { useEffect, useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { bossBeat, type BeatResult, type Stage } from "../characters/boss-beats.ts";
import { bossKit, wipLook, type BossKit } from "../characters/kits.ts";
import { renderFrame, type Anim, type Character, type Frame } from "../characters/sprite.ts";
import type { BossView, GameView, Phase } from "../game.ts";
import { play, warmSounds } from "../sound.ts";
import { EFFECTS, POWER_MOMENTS } from "../characters/power-art.ts";
import { useFrameNow } from "./Countdown.tsx";

/**
 * A raid boss as a character (if it has one: see characters/kits.ts), standing kitty-corner across the board from
 * the God King: on a phone at the left of the boss bar above the board (he's under the board on the right), on a
 * computer by the board's bottom-left corner (he's by its top-right). It never takes a tap and never covers a piece.
 *
 * What it does comes from the shared match state (characters/boss-beats.ts): every player sees the same animation
 * and the same line. An animation plays once per moment, from when this device first saw the moment, so a new
 * screen mid-animation carries on rather than starting again; the loops run by the clock.
 */

/** When each moment was first seen here. */
const started = new Map<string, number>();
const startOf = (key: string, now = Date.now()) => {
  let t = started.get(key);
  if (t === undefined) started.set(key, (t = now));
  return t;
};
/** Sounds already played: the phone and computer placements, or a new screen, never play one twice. */
const played = new Set<string>();

/** Each frame's pixels, made once per look ("" its own colours; Hollow's `bulbs2` puts a bulb out). */
const images = new WeakMap<Frame, Map<string, ImageData>>();
function frameImage(ch: Character, frame: Frame, look = ""): ImageData {
  let byLook = images.get(frame);
  if (!byLook) images.set(frame, (byLook = new Map()));
  let img = byLook.get(look);
  if (!img) {
    const r = renderFrame(ch, frame, { look: look || undefined });
    img = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h);
    byLook.set(look, img);
  }
  return img;
}

const length = (a: Anim) => a.frames.reduce((s, f) => s + f.ms, 0);
function frameAt(a: Anim, t: number): number {
  let acc = 0;
  for (let i = 0; i < a.frames.length; i++) if (t < (acc += a.frames[i]!.ms)) return i;
  return a.frames.length - 1;
}

/** What shows at `now`: the moment's animation once (from `since`), then its loop (by the clock), or its last frame held. */
export function showing(kit: BossKit, beat: Pick<BeatResult, "anim" | "loop" | "key">, now: number, since: number): { anim: string; frame: number; tag: string } {
  const shotName = kit.anims[beat.anim] ?? beat.anim;
  const shot = kit.ch.anims[shotName];
  if (shot && !shot.loop && (now - since < length(shot) || shotName === beat.loop)) {
    const frame = frameAt(shot, now - since);
    return { anim: shotName, frame, tag: `${beat.key}:${frame}` };
  }
  const loop = kit.ch.anims[beat.loop] ?? kit.ch.anims.idle!;
  const total = length(loop);
  const cycle = Math.floor(now / total);
  const frame = frameAt(loop, now - cycle * total);
  return { anim: kit.ch.anims[beat.loop] ? beat.loop : "idle", frame, tag: `${beat.loop}:${cycle}:${frame}` };
}

const SPEECH_MS = 3400;

/** Where the battle is, from the screen's phase. */
export function bossStage(phase: Phase, boss: BossView): Stage {
  if (boss.result || phase.kind === "results") return "over";
  if (phase.kind === "boss") return phase.intro ? "intro" : boss.justKilled ? "strike" : phase.thinking || phase.lights ? "thinking" : "bossMove";
  return "crowd";
}

/** Whether this battle's boss has a character (else the screens keep its emoji). */
export const hasCharacter = (match: GameView) => !!bossKit(match.boss?.name);

export function BossCharacter({ match, place }: { match: GameView; place: "bar" | "side" | "results" }) {
  const boss = match.boss;
  return boss && bossKit(boss.name) ? <Character boss={boss} stage={bossStage(match.phase, boss)} place={place} /> : null;
}

function Character({ boss, stage, place }: { boss: BossView; stage: Stage; place: "bar" | "side" | "results" }) {
  const kit = bossKit(boss.name);
  const beat = useMemo(
    () =>
      kit &&
      bossBeat(kit, {
        stage,
        fen: boss.board.fen,
        history: boss.board.history,
        bases: boss.board.bases,
        crowdSide: boss.crowdSide,
        lastMove: boss.lastMove,
        result: boss.result,
        victim: boss.justKilled,
      }),
    [kit, stage, boss.board.fen, boss.board.history.length, boss.result, boss.justKilled],
  );
  const since = beat ? startOf(beat.key) : 0;
  // His sounds and his powers' made ahead, in idle moments, so a first play never stalls a slow phone.
  useEffect(() => {
    if (!kit) return;
    const m = POWER_MOMENTS[kit.ch.name];
    const fx = m ? [m.power, m.ultimate, m.powerHit, m.ultimateHit, ...Object.values(m.more ?? {})].flatMap((x) => x?.effects ?? []) : [];
    warmSounds([...Object.values(kit.sounds), ...fx.flatMap((e) => Object.values(EFFECTS[e].sounds))]);
  }, [kit]);
  // A recolour from the battle's state (Hollow's bulbs still lit), read as it's drawn.
  const lookRef = useRef<() => string>(() => "");
  lookRef.current = () => (wipLook.now?.() ?? (kit?.lookOf ? kit.lookOf(boss) : undefined)) ?? "";
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  // Drawn before the paint (no empty first frame), then on every animation frame that changes the picture.
  useLayoutEffect(() => {
    if (!kit || !beat || !cv.current) return;
    const g = cv.current.getContext("2d");
    let raf = 0;
    let last = "";
    const draw = () => {
      const now = Date.now();
      const s = showing(kit, beat, now, since);
      const look = lookRef.current();
      const id = `${s.anim}:${s.frame}:${look}`;
      if (id !== last) {
        last = id;
        const frame = kit.ch.anims[s.anim]!.frames[s.frame]!;
        g?.putImageData(frameImage(kit.ch, frame, look), 0, 0);
        box.current?.setAttribute("data-anim", s.anim);
        box.current?.setAttribute("data-look", look);
        const sound = frame.cue ? kit.sounds[frame.cue] : undefined;
        if (sound && !played.has(s.tag)) {
          played.add(s.tag);
          play(sound);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [kit, beat?.key, beat?.anim, beat?.loop, since]);
  const speaking = !!beat?.line && Date.now() - since < SPEECH_MS;
  const now = useFrameNow(speaking);
  if (!kit || !beat) return null;
  const { ch } = kit;
  const line = beat.line && now - since < SPEECH_MS ? beat.line : null;
  return (
    <div ref={box} class={`boss-char place-${place}${kit.tall ? " tall" : ""}`} data-anim={beat.anim} aria-hidden="true" style={{ "--bc-w": ch.w, "--bc-h": ch.h, "--bc-fx": ch.foot[0], "--bc-fy": ch.foot[1] }}>
      <canvas ref={cv} class="boss-char-sprite" width={ch.w} height={ch.h} />
      {line && <CharBubble key={beat.key} text={line} at={since} now={now} />}
    </div>
  );
}

/** His words: a pixel text box beside him that types itself out and fades at the end (like the God King's). */
function CharBubble({ text, at, now }: { text: string; at: number; now: number }) {
  const shown = Math.min(text.length, Math.floor((now - at) / 28) + 1);
  return (
    <div class={`bc-bubble${now - at < 200 ? " fresh" : ""}${SPEECH_MS - (now - at) < 260 ? " leaving" : ""}`} role="status" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <span class="bc-bubble-rest" aria-hidden="true">
        {text.slice(shown)}
      </span>
    </div>
  );
}

/** A boss's portrait (head and shoulders, from its drawing), for banners and its entrance card; else its emoji. */
export function BossFace({ boss, class: cls = "" }: { boss: Pick<BossView, "name" | "icon">; class?: string }) {
  const kit = bossKit(boss.name);
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!kit || !cv.current) return;
    const p = kit.portrait;
    const frame = kit.ch.anims[p.anim]!.frames[p.frame]!;
    cv.current.getContext("2d")?.putImageData(frameImage(kit.ch, frame), -p.x, -p.y, p.x, p.y, p.w, p.h);
  }, [kit]);
  if (!kit) return <>{boss.icon}</>;
  return <canvas ref={cv} class={`boss-portrait ${cls}`} width={kit.portrait.w} height={kit.portrait.h} role="img" aria-label={boss.name} />;
}

/**
 * A boss with a character, on a computer: standing by the board's bottom-left corner, kitty-corner across the board
 * from the God King (by its top-right). Goes first in a screen's `.board-row`; on a phone it's hidden (the boss bar
 * has him).
 */
export function BossSide({ match }: { match: GameView }) {
  if (!hasCharacter(match)) return null;
  return (
    <div class="boss-side">
      <BossCharacter match={match} place="side" />
    </div>
  );
}
