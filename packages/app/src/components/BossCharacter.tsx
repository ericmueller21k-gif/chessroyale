import { useEffect, useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { bossBeat, type Beat, type BeatResult, type Stage } from "../characters/boss-beats.ts";
import { bossKit, poweredKit, type BossKit } from "../characters/kits.ts";
import { stanceAt } from "../characters/stance.ts";
import { resetMoo } from "../characters/moo-state.ts";
import { renderFrame, type Anim, type Character, type Frame } from "../characters/sprite.ts";
import type { BossView, GameView, Phase } from "../game.ts";
import { play, warmSounds } from "../sound.ts";
import { EFFECTS, POWER_MOMENTS } from "../characters/power-art.ts";
import { prewarmBigBoy } from "./BigBoy.tsx";
import { prewarmGinger } from "./Ginger.tsx";
import { prewarmGrex } from "./Grex.tsx";
import { prewarmSawyer } from "./Sawyer.tsx";
import { prewarmPig } from "./Pig.tsx";
import { prewarmAlfil } from "./Alfil.tsx";
import { prewarmHopper } from "./Hopper.tsx";
import { prewarmSmudgy } from "./Smudgy.tsx";
import { prewarmMoo } from "./Moo.tsx";
import { EngineOverlay, placeEngine, prewarmRecluse } from "./Recluse.tsx";
import { CRITICAL, LOW, NORMAL, VoiceBubble, bossVoice, holdMs, type Priority } from "../speech.tsx";
import { mateAttack, prewarmKingAttack } from "./KingAttack.tsx";
import { lightsId, syncLights } from "../characters/lights.ts";
import { seenFen } from "../camo.ts";

/**
 * A raid boss as a character (if it has one: see characters/kits.ts), standing across the board from the God King: on a
 * phone at the left of the boss bar above the board (he's under the board on the right), on a computer by the board's
 * bottom-left corner (he's by its bottom-right, facing him: Eric, Oct 11). It never takes a tap and never covers a
 * piece.
 *
 * What it does comes from the shared match state (characters/boss-beats.ts): every player sees the same animation
 * and the same line. An animation plays once per moment, from when this device first saw the moment, so a new
 * screen mid-animation carries on rather than starting again; the loops run by the clock.
 *
 * Its text box beside it shows the boss's voice (speech.tsx): its reactions from here, its powers' lines from the boss
 * screen, each for its time and in turn, on every screen of the battle (and through its powers' moments, while it
 * stands at the board's corner).
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

/**
 * A new boss battle (its intro, with the voices' reset): the moments seen and sounds played in the last one are
 * forgotten, so its entrance, and its defeat or victory, play again (their keys repeat from battle to battle).
 */
export function resetBeats() {
  started.clear();
  played.clear();
  inPlace.run = null;
  figure.run = null;
  engine.at = null;
  resetMoo();
}

/**
 * What the boss's figure shows instead of its beat, for as long as it's set (the Hidden Boss's phase 2): `before` (a loop)
 * until `since`, then `anims` in turn (a loop given with `ms` plays that long; a one-shot given with `ms` plays once and
 * holds its last frame for the rest), then `loop` for good. Its beat's lines and
 * fall lines are quiet meanwhile (his phase 2 says its own). Runs in place (playInPlace) still play over it. Cleared by a
 * new battle (resetBeats).
 */
export type FigureRun = { since: number; anims: readonly (string | { readonly anim: string; readonly ms: number })[]; loop: string; before?: string };
const figure: { run: FigureRun | null } = { run: null };
export function setFigureRun(run: FigureRun | null) {
  figure.run = run;
}

/**
 * The Hidden Boss's half-engine look (Eric, Oct 14: an overlay, never his frames): from `at` (his phase change, as the God
 * King's power lands in him) to the end of the battle, on every drawing of him (Recluse.tsx, EngineOverlay). Cleared by a
 * new battle (resetBeats).
 */
const engine: { at: number | null } = { at: null };
export function setEngineAt(at: number | null) {
  engine.at = at;
}
/** The loop the figure rests in now, when a figure run is set (phase 2's `idle2`), else null. */
export const figureLoop = (): string | null => figure.run?.loop ?? null;
/** What a figure run shows at `now`, or null: none is set. */
function figureShowing(ch: Character, now: number): { anim: string; frame: number; tag: string } | null {
  const run = figure.run;
  if (!run) return null;
  const loopAt = (name: string, from: number) => {
    const a = ch.anims[name] ?? ch.anims.idle!;
    const total = length(a);
    const cycle = Math.floor(Math.max(0, now - from) / total);
    const frame = frameAt(a, now - from - cycle * total);
    return { anim: ch.anims[name] ? name : "idle", frame, tag: `fig:${name}:${cycle}:${frame}` };
  };
  if (now < run.since) return loopAt(run.before ?? run.loop, 0);
  let t = now - run.since;
  for (let i = 0; i < run.anims.length; i++) {
    const step = run.anims[i]!;
    const name = typeof step === "string" ? step : step.anim;
    const a = ch.anims[name];
    if (!a) continue;
    // (A loop for a set time: its frames by the time into it. A one-shot for a set time: played once, then held on its
    // last frame, its cues once.)
    const ms = typeof step === "string" ? length(a) : step.ms;
    if (t < ms) {
      const loops = typeof step !== "string" && a.loop;
      const frame = frameAt(a, loops ? t % length(a) : t);
      return { anim: name, frame, tag: `fig:${run.since}:${i}:${loops ? Math.floor(t / length(a)) : 0}:${frame}` };
    }
    t -= ms;
  }
  return loopAt(run.loop, 0);
}

/**
 * A run of the boss's own animations played where it stands, over its beat (the Hidden Boss: his spellbook as his
 * ultimate comes, the book slammed shut as he mocks the God King's help): from `since`, each in turn, then its beat
 * again. Set by what plays it (a moment's view, the dock); read by its figure every frame, both placements alike.
 */
const inPlace: { run: { key: string; since: number; anims: readonly string[] } | null } = { run: null };
export function playInPlace(key: string, anims: readonly string[], since = Date.now()) {
  if (inPlace.run?.key !== key) inPlace.run = { key, since, anims };
}
/** What a run in place shows at `now`, or null once it's over (or before it starts). */
function inPlaceShowing(ch: Character, now: number): { anim: string; frame: number; tag: string } | null {
  const run = inPlace.run;
  if (!run || now < run.since) return null;
  let t = now - run.since;
  for (let i = 0; i < run.anims.length; i++) {
    const a = ch.anims[run.anims[i]!];
    if (!a) continue;
    if (t < length(a)) {
      const frame = frameAt(a, t);
      return { anim: run.anims[i]!, frame, tag: `${run.key}:${i}:${frame}` };
    }
    t -= length(a);
  }
  return null;
}

/**
 * Each frame's pixels, made once per look ("" its own colors; Big Boy's `blackPawn`) and per recolor
 * from the battle (Hollow's lights: `ch.swap`).
 */
const images = new WeakMap<Frame, Map<string, ImageData>>();
function frameImage(ch: Character, frame: Frame, look = ""): ImageData {
  const swap = ch.swap?.() ?? null;
  let byLook = images.get(frame);
  if (!byLook) images.set(frame, (byLook = new Map()));
  const key = `${swap?.id ?? ""}|${look}`;
  let img = byLook.get(key);
  if (!img) {
    const r = renderFrame(ch, frame, { look: look || undefined, swap });
    img = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h);
    // (A new battle's lights replace the last one's: its frames go.)
    if (swap) for (const k of [...byLook.keys()]) if (!k.startsWith("|") && !k.startsWith(`${swap.id}|`)) byLook.delete(k);
    byLook.set(key, img);
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
  // (A loop by another name in its kit: the Hidden Boss beaten slumps in his collapseLoop.)
  const loopName = kit.loops?.[beat.loop] ?? beat.loop;
  const loop = kit.ch.anims[loopName] ?? kit.ch.anims.idle!;
  const total = length(loop);
  const cycle = Math.floor(now / total);
  const frame = frameAt(loop, now - cycle * total);
  return { anim: kit.ch.anims[loopName] ? loopName : "idle", frame, tag: `${loopName}:${cycle}:${frame}` };
}

/** How much a reaction's line matters (speech.tsx): the battle's start and end over the rest, which wait their turn. */
// (Wrangler's "I've got you in my sights.": his only tell before his showdown, so it doesn't lapse behind a moment's line.)
const BEAT_PRIORITY: Partial<Record<Beat, Priority>> = { entrance: NORMAL, ready: NORMAL, defeat: CRITICAL, victory: CRITICAL };

/** Where the battle is, from the screen's phase. */
export function bossStage(phase: Phase, boss: BossView): Stage {
  if (boss.result || phase.kind === "results") return "over";
  // (The loading step before the intro: the boss at rest, saying nothing; its entrance is the intro's.)
  if (phase.kind === "boss") return phase.loading ? "loading" : phase.intro ? "intro" : boss.justKilled ? "strike" : phase.thinking || phase.lights ? "thinking" : "bossMove";
  return "crowd";
}

/** Whether this battle's boss has a character (else the screens keep its emoji). */
export const hasCharacter = (match: GameView) => !!bossKit(match.boss?.name);

export function BossCharacter({ match, place }: { match: GameView; place: "bar" | "side" | "results" }) {
  const boss = match.boss;
  return boss && bossKit(boss.name) ? <Character boss={boss} stage={bossStage(match.phase, boss)} place={place} /> : null;
}

function Character({ boss, stage, place }: { boss: BossView; stage: Stage; place: "bar" | "side" | "results" }) {
  const full = bossKit(boss.name);
  // (A phone's boss bar may have a drawing of its own: the Hidden Boss's bust, with the same animations.)
  const kit = useMemo(() => (full && place === "bar" && full.bar ? { ...full, ch: full.bar } : full), [full, place]);
  // This battle's lights (Hollow's bulbs), for everything of his drawn from now on.
  syncLights(boss);
  const beat = useMemo(
    () =>
      kit &&
      bossBeat(kit, {
        stage,
        fen: boss.board.fen,
        seen: seenFen,
        history: boss.board.history,
        bases: boss.board.bases,
        crowdSide: boss.crowdSide,
        lastMove: boss.lastMove,
        result: boss.result,
        victim: boss.justKilled,
        // (Wrangler's meter full: his line once, then his ready loop until he fires.)
        ready: boss.powers?.ready ?? null,
      }),
    [kit, stage, boss.board.fen, boss.board.history.length, boss.result, boss.justKilled, boss.powers?.ready],
  );
  const since = beat ? startOf(beat.key) : 0;
  // His sounds and his powers' made ahead, in idle moments, so a first play never stalls a slow phone.
  useEffect(() => {
    if (!kit) return;
    const m = POWER_MOMENTS[kit.ch.name];
    const fx = m ? [m.power, m.ultimate, m.powerHit, m.ultimateHit, ...Object.values(m.more ?? {})].flatMap((x) => x?.effects ?? []) : [];
    warmSounds([...Object.values(kit.sounds), ...fx.flatMap((e) => Object.values(EFFECTS[e].sounds))]);
    // (Big Boy's snack, toss and bounce drawn ahead too: his bounce is big, and his snack plays seconds in.)
    if (kit.ch.id === "bigboy") prewarmBigBoy(kit.ch.name, boss.crowdSide === "b" ? "blackPawn" : undefined);
    // (Sawyer's split, cuts and board saw too: the split plays seconds in, after his first move.)
    if (kit.ch.id === "sawyer") prewarmSawyer(kit.ch.name);
    // (Wrangler's leap and lasso too: his long pull comes a move in; then his wind-up and haul.)
    if (kit.ch.id === "pig") prewarmPig(kit.ch.name);
    // (Ginger's ice: its crack, thin ice and thaw.)
    if (kit.ch.id === "gingerbread") prewarmGinger();
    // (Jefferson's Roman candle: him, its shots and fireballs.)
    if (kit.ch.id === "grex") prewarmGrex(kit.ch.name);
    // (Alfil's cast, fusion and Slam, and the shadows his pieces cast while they're up.)
    if (kit.ch.id === "alfil") prewarmAlfil(kit.ch.name);
    // (Chub & Chirp's hop, cast and race, and the carrots.)
    if (kit.ch.id === "hopper") prewarmHopper(kit.ch.name);
    // (Smudgy's splash, reveal and Repaint, and the paint.)
    if (kit.ch.id === "smudgy") prewarmSmudgy(kit.ch.name);
    // (Moo's moonbeam, flurry and daze, his powered-up twins, his sit, and the beams on the board.)
    if (kit.ch.id === "moo") prewarmMoo(kit.ch.name);
    // (The Hidden Boss's phase change: his rage, his leap onto the board, the book thrown down, the chant.)
    if (kit.ch.id === "recluse") prewarmRecluse(boss.crowdSide);
    // (Its attack on a king too: the God King's Last Stand, or its mate.)
    prewarmKingAttack(kit.ch.name);
  }, [kit]);
  // A recolor from the battle's state (Big Boy's black pawn), read as it's drawn.
  const lookRef = useRef<() => string>(() => "");
  lookRef.current = () => (kit?.lookOf ? kit.lookOf(boss) : undefined) ?? "";
  // What the figure is drawn from each frame: the boss's state and the stage (Moo's Full Moon: powered up; read as it's drawn).
  const nowRef = useRef({ boss, stage });
  nowRef.current = { boss, stage };
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  // (The Hidden Boss's half-engine look over his drawing, placed on his head frame by frame: Recluse.tsx.)
  const eng = useRef<HTMLSpanElement>(null);
  // Drawn before the paint (no empty first frame), then on every animation frame that changes the picture.
  useLayoutEffect(() => {
    if (!kit || !beat || !cv.current) return;
    const g = cv.current.getContext("2d");
    let raf = 0;
    let last = "";
    let lit: boolean | null = null;
    const draw = () => {
      const now = Date.now();
      // (A run of its own animations in place, over its beat, while one lasts: the Hidden Boss's spellbook, his slam.)
      // (Moo's Full Moon: every animation of his is its powered-up twin while it lasts.)
      const live = kit.powered?.on(nowRef.current.boss, now, nowRef.current.stage) ? poweredKit(kit) : kit;
      let s = inPlaceShowing(kit.ch, now) ?? figureShowing(kit.ch, now) ?? showing(live, beat, now, since);
      // (Moo at rest: his idle, then now and then the sit and back: stance.ts. Never over a moment, which has settled into its
      // idle first, and never powered up.)
      if (kit.rest && live === kit && !figure.run && s.anim === (kit.loops?.idle ?? "idle")) {
        const shot = kit.ch.anims[kit.anims[beat.anim] ?? beat.anim];
        const rest = stanceAt(kit.ch, kit.rest, now - since - (shot && !shot.loop ? length(shot) : 0));
        if (rest) s = rest;
      }
      const look = lookRef.current();
      const id = `${s.anim}:${s.frame}:${look}:${lightsId()}`;
      if (eng.current) {
        const on = engine.at !== null && now >= engine.at;
        if (on !== lit) {
          lit = on;
          eng.current.classList.toggle("on", on);
          // (It ignites only as it comes; a screen drawn later shows it already on.)
          eng.current.classList.toggle("fresh", on && now - engine.at! < 400);
        }
      }
      if (id !== last) {
        last = id;
        const frame = kit.ch.anims[s.anim]!.frames[s.frame]!;
        g?.putImageData(frameImage(kit.ch, frame, look), 0, 0);
        placeEngine(eng.current, frame);
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
  // Its line for this moment goes into its voice: it waits its turn and stays up its time, whatever the screen does
  // next (the boss's turn ends, a power's moment begins). A move that brings a power's moment says nothing of its
  // own: the moment's line is what the boss says that turn.
  // (Nor does its mate when it attacks the crowd's king: the attack's line is its word then.)
  const quiet = stage === "bossMove" && (!!boss.powers?.events.length || mateAttack(boss));
  useLayoutEffect(() => {
    // (A line of its own for the moment, from the battle, over its kit's: the Hidden Boss's "Best by test.")
    const said = beat ? (kit?.lineOf?.(beat.anim, boss) ?? beat.line) : null;
    if (said && !quiet && !figure.run) bossVoice.say(said, `${boss.id}:${boss.startMove}:${beat!.key}`, BEAT_PRIORITY[beat!.anim] ?? LOW);
  }, [beat?.key]);
  // Beaten: its fall lines (the Hidden Boss's mumbling), one after another once its defeat's animation is over, each
  // as the last one goes; carried on by whichever screen draws it next (the result screen), from the same moment.
  const fallAt = useMemo(() => {
    if (!kit?.fall?.length || beat?.anim !== "defeat" || figure.run) return null;
    const shot = kit.ch.anims[kit.anims.defeat ?? "defeat"];
    let t = since + (shot && !shot.loop ? length(shot) : 0);
    return kit.fall.map((text) => {
      const at = t;
      t += holdMs(text) + 150;
      return { text, at };
    });
  }, [kit, beat?.key, since]);
  useEffect(() => {
    if (!fallAt) return;
    const timers = fallAt.map(({ text, at }, i) => setTimeout(() => bossVoice.say(text, `${boss.id}:${boss.startMove}:fall:${i}`, NORMAL), Math.max(0, at - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, [fallAt]);
  if (!kit || !beat) return null;
  const { ch } = kit;
  return (
    <div ref={box} class={`boss-char place-${place} ch-${ch.id}${kit.tall ? " tall" : ""}${kit.wide ? " wide" : ""}`} data-anim={beat.anim} aria-hidden="true" style={{ "--bc-w": ch.w, "--bc-h": ch.h, "--bc-fx": ch.foot[0], "--bc-fy": ch.foot[1] }}>
      <canvas ref={cv} class="boss-char-sprite" width={ch.w} height={ch.h} />
      {kit.engine && <EngineOverlay ch={ch} elRef={eng} />}
      {/* Its words: a pixel text box beside it that types itself out and fades at the end (like the God King's). In the
          boss bar, the bar holds them instead, in its name's room (BossBar): never over its status or the board. */}
      {place !== "bar" && <VoiceBubble voice={bossVoice} class="bc-bubble" />}
    </div>
  );
}

/** A boss's portrait (head and shoulders, from its drawing), for banners and its entrance card; else its emoji. */
export function BossFace({ boss, class: cls = "", label }: { boss: Pick<BossView, "name" | "icon">; class?: string; /** Its name for a screen reader (the boss's own unless given; "": none, its button names it). */ label?: string }) {
  const kit = bossKit(boss.name);
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!kit || !cv.current) return;
    const p = kit.portrait;
    const frame = kit.ch.anims[p.anim]!.frames[p.frame]!;
    cv.current.getContext("2d")?.putImageData(frameImage(kit.ch, frame), -p.x, -p.y, p.x, p.y, p.w, p.h);
  }, [kit]);
  if (!kit) return <>{boss.icon}</>;
  return <canvas ref={cv} class={`boss-portrait ${cls}`} width={kit.portrait.w} height={kit.portrait.h} {...(label === "" ? { "aria-hidden": "true" } : { role: "img", "aria-label": label ?? boss.name })} />;
}

/**
 * A boss with a character, on a computer: standing by the board's bottom-left corner, facing the God King across the
 * board (by its bottom-right). Goes first in a screen's `.board-row`; on a phone it's hidden (the boss bar has him).
 */
export function BossSide({ match }: { match: GameView }) {
  if (!hasCharacter(match)) return null;
  return (
    <div class="boss-side">
      <BossCharacter match={match} place="side" />
    </div>
  );
}
