import { useEffect, useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { bossBeat, type Beat, type BeatResult, type Stage } from "../characters/boss-beats.ts";
import { BOSS_KITS, artOf, bossKit, bossKitOf, poweredKit, type BossKit } from "../characters/kits.ts";
import { growingRun, resetGrowing } from "./RecluseChild.ts";
import { SELECT_FRAMING } from "../characters/boss-select.ts";
import { stanceAt } from "../characters/stance.ts";
import { resetMoo } from "../characters/moo-state.ts";
import { renderFrame, type Anim, type Character, type Frame } from "../characters/sprite.ts";
import { drawnFacing } from "../characters/sprite-kit.ts";
import type { BossView, GameView, Phase } from "../game.ts";
import { play, warmSounds } from "../sound.ts";
import { cueHaptic } from "../haptics.ts";
import { EFFECTS, POWER_MOMENTS } from "../characters/power-art.ts";
import { prewarmAnims } from "./BossEffect.tsx";
import { prewarmBigBoy } from "./BigBoy.tsx";
import { prewarmGinger } from "./Ginger.tsx";
import { prewarmGrex } from "./Grex.tsx";
import { prewarmSawyer } from "./Sawyer.tsx";
import { prewarmPig } from "./Pig.tsx";
import { prewarmAlfil } from "./Alfil.tsx";
import { prewarmHopper } from "./Hopper.tsx";
import { prewarmSmudgy } from "./Smudgy.tsx";
import { prewarmMoo } from "./Moo.tsx";
import { prewarmGardener, resetGarden } from "./Gardener.tsx";
import { prewarmTiger } from "./Tiger.tsx";
import { resetTiger } from "../tiger-show.ts";
import { prewarmFolio } from "./Folio.tsx";
import { EngineOverlay, placeEngine, prewarmRecluse } from "./Recluse.tsx";
import { CRITICAL, LOW, NORMAL, VoiceBubble, bossVoice, holdMs, type Priority } from "../speech.tsx";
import { mateAttack, prewarmKingAttack } from "./KingAttack.tsx";
import { lightsId, syncLights } from "../characters/lights.ts";
import { seenFen } from "../camo.ts";
import { KING_REACH, SIDE_FEEL, SIDE_REACH, sideSizes } from "../characters/side-size.ts";
import { GOD_KING } from "../characters/god-king.ts";

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
  resetGarden();
  resetTiger();
  resetGrowing();
}

/**
 * What the boss's figure shows instead of its beat, for as long as it's set (the Hidden Boss's phase 2): `before` (a loop)
 * until `since`, then `anims` in turn (a loop given with `ms` plays that long; a one-shot given with `ms` plays once and
 * holds its last frame for the rest), then `loop` for good. Its beat's lines and
 * fall lines are quiet meanwhile (his phase 2 says its own). Runs in place (playInPlace) still play over it. Cleared by a
 * new battle (resetBeats). `talks`: its beat's lines are said as usual meanwhile (the Hidden Boss's child growing up).
 */
export type FigureRun = { since: number; anims: readonly (string | { readonly anim: string; readonly ms: number })[]; loop: string; before?: string; talks?: boolean };
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
/**
 * Where a run in place moves the figure in a phone's boss bar, `t` ms into it (Babur's hop along the bar to his pump and back): across
 * by `x` and up by `y` px, and facing the other way (`flip`, mirrored about his feet). A computer's figure stays where it is.
 */
export type FigureMove = (t: number) => { x: number; y: number; flip: boolean };
const inPlace: { run: { key: string; since: number; anims: readonly string[]; move?: FigureMove } | null } = { run: null };
export function playInPlace(key: string, anims: readonly string[], since = Date.now(), move?: FigureMove) {
  if (inPlace.run?.key !== key) inPlace.run = { key, since, anims, move };
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

/** When the beat the figure is in ends, if it is a one-shot animation still to play (0: it rests in a loop). Both placements note the same. */
const beatEnds = { at: 0 };

/**
 * Whether the figure is in the middle of something now: a one-shot animation of its beat still playing, a run in place, or a power
 * moment (which hides it while the boss casts at the board's corner). The hippo's 30 s toss (components/Gardener.tsx) plays only when
 * it isn't: it never cuts another animation off.
 */
export function figureBusy(ch: Character, now = Date.now()): boolean {
  if (now < beatEnds.at || inPlaceShowing(ch, now) || figure.run) return true;
  return typeof document !== "undefined" && !!document.querySelector(".power-moment:not(.pm-stay)");
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
  return boss && bossKitOf(boss) ? <Character boss={boss} stage={bossStage(match.phase, boss)} place={place} /> : null;
}

function Character({ boss, stage, place }: { boss: BossView; stage: Stage; place: "bar" | "side" | "results" }) {
  // (A form of its own: the Hidden Boss's child, his growing figure; his age followed by a figure run, RecluseChild.ts.)
  const full = bossKitOf(boss);
  useLayoutEffect(() => {
    const run = growingRun(boss);
    if (run) setFigureRun(run);
  }, [boss.form, boss.formStep, boss.result]);
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
  // (When this beat's one-shot ends, for figureBusy.)
  const shot = kit && beat ? kit.ch.anims[kit.anims[beat.anim] ?? beat.anim] : undefined;
  beatEnds.at = shot && !shot.loop ? since + length(shot) : 0;
  // His sounds and his powers' made ahead, in idle moments, so a first play never stalls a slow phone.
  useEffect(() => {
    if (!kit) return;
    const m = POWER_MOMENTS[kit.ch.name];
    const fx = m ? [m.power, m.ultimate, m.powerHit, m.ultimateHit, ...Object.values(m.more ?? {})].flatMap((x) => x?.effects ?? []) : [];
    warmSounds([...Object.values(kit.sounds), ...fx.flatMap((e) => Object.values(EFFECTS[e].sounds))]);
    // His moves and his powers' effects are made when first read (sprite.ts lazyAnim): made here first, in quiet slices, so
    // what follows draws ahead from them without building a boss in one stall.
    const chs = [kit.ch, ...(full && full.ch !== kit.ch ? [full.ch] : []), ...new Set(fx.map((e) => EFFECTS[e].ch))];
    return prewarmAnims(chs.flatMap((ch) => Object.values(ch.anims)), () => {
      // (Big Boy's snack, toss and bounce drawn ahead too: his bounce is big, and his snack plays seconds in.)
      if (kit.ch.id === "bigboy") prewarmBigBoy(kit.ch.name, boss.crowdSide === "b" ? "blackPawn" : undefined);
      // (Sawyer's split, cuts and board saw too: the split plays seconds in, after his first move.)
      if (kit.ch.id === "sawyer") prewarmSawyer(kit.ch.name);
      // (Wrangler's leap and lasso too: his long pull comes a move in; then his wind-up and haul.)
      if (kit.ch.id === "pig") prewarmPig(kit.ch.name);
      // (Ginger's ice: its crack, thin ice and thaw; Boingo's freeze, a piece his pie splatted twice, shows it too.)
      if (kit.ch.id === "gingerbread" || kit.ch.id === "clown") prewarmGinger();
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
      // (Puddles' tosses, watering and reactions, and the seeds, sweep and plants on the board.)
      if (kit.ch.id === "gardener") prewarmGardener(kit.ch.name);
      // (Babur's trip to the pump, his place, reactions and hoops, and the balloons and rings on the board.)
      if (kit.ch.id === "tiger") prewarmTiger(kit.ch.name);
      // (Folio's ink, its paper, the crease and Revision's strokes on the board.)
      if (kit.ch.id === "folio") prewarmFolio();
      // (The Hidden Boss's phase change: his rage, his leap onto the board, the book thrown down, the chant.)
      if (kit.ch.id === "recluse") prewarmRecluse(boss.crowdSide);
      // (Its attack on a king too: the God King's Last Stand, or its mate.)
      prewarmKingAttack(kit.ch.name);
    });
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
    let moved = "";
    let lit: boolean | null = null;
    // (A figure whose height changes with what's drawn, the Hidden Boss's child growing up: his words stand on the top of the drawing
    // shown now, set as its animation changes (BossKit.heads); the tallest of them for one not listed.)
    let head = -1;
    const tallest = kit.heads ? Math.max(...Object.values(kit.heads)) : 0;
    const draw = () => {
      const now = Date.now();
      // (A run of its own animations in place, over its beat, while one lasts: the Hidden Boss's spellbook, his slam.)
      // (Moo's Full Moon: every animation of his is its powered-up twin while it lasts.)
      const live = kit.powered?.on(nowRef.current.boss, now, nowRef.current.stage) ? poweredKit(kit) : kit;
      const own = inPlaceShowing(kit.ch, now);
      let s = own ?? figureShowing(kit.ch, now) ?? showing(live, beat, now, since);
      // (A run that moves the figure along a phone's bar: Babur's hop to his pump.)
      const mv = own && place === "bar" && inPlace.run?.move ? inPlace.run.move(now - inPlace.run.since) : null;
      const moveId = mv ? `${Math.round(mv.x)},${Math.round(mv.y)},${mv.flip}` : "";
      if (moveId !== moved && box.current) {
        moved = moveId;
        box.current.style.translate = mv && (mv.x || mv.y) ? `${Math.round(mv.x)}px ${Math.round(mv.y)}px` : "";
        box.current.classList.toggle("bc-flip", !!mv?.flip);
      }
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
      if (kit.heads) {
        const h = kit.heads[s.anim] ?? tallest;
        if (h !== head && box.current) {
          head = h;
          box.current.style.setProperty("--bc-head", String(h));
        }
      }
      if (id !== last) {
        last = id;
        const frame = kit.ch.anims[s.anim]!.frames[s.frame]!;
        g?.putImageData(frameImage(kit.ch, frame, look), 0, 0);
        placeEngine(eng.current, frame);
        box.current?.setAttribute("data-anim", s.anim);
        // (Each frame's number and cue, so a test counts a clock smack by its own click, not by timing.)
        box.current?.setAttribute("data-frame", String(s.frame));
        box.current?.setAttribute("data-cue", frame.cue ?? "");
        box.current?.setAttribute("data-look", look);
        const sound = frame.cue ? kit.sounds[frame.cue] : undefined;
        if (sound && !played.has(s.tag)) {
          played.add(s.tag);
          play(sound);
          cueHaptic(kit.ch.id, s.anim, frame.cue!);
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
    // (The result's line is his alone since Nov 9: the God King no longer answers it there, so no hold for him.)
    if (said && !quiet && (!figure.run || figure.run.talks)) bossVoice.say(said, `${boss.id}:${boss.startMove}:${beat!.key}`, BEAT_PRIORITY[beat!.anim] ?? LOW);
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
  // (A phone's bar: his size and his drawing's shift in the box (kits.ts barScale, barShift; styles.css). Full size and no shift otherwise.)
  const barSize = place === "bar" ? { "--bc-scale": kit.barScale ?? 1, "--bc-shift": kit.barShift ?? 0 } : {};
  return (
    <div ref={box} class={`boss-char place-${place} ch-${ch.id}${kit.tall ? " tall" : ""}${kit.wide ? " wide" : ""}${kit.heads ? " bc-heads" : ""}${place === "results" && kit.artFacesLeft ? " art-left" : ""}`} data-anim={beat.anim} data-faces={kit.sprite ? drawnFacing(kit.sprite, ch) : undefined} aria-hidden="true" style={{ "--bc-w": ch.w, "--bc-h": ch.h, "--bc-fx": ch.foot[0], "--bc-fy": ch.foot[1], ...barSize }}>
      <canvas ref={cv} class="boss-char-sprite" width={ch.w} height={ch.h} />
      {kit.engine && <EngineOverlay ch={ch} elRef={eng} />}
      {/* Its words: a pixel text box beside it that types itself out and fades at the end (like the God King's). In the
          boss bar, the bar holds them instead, in its name's room (BossBar): never over its status or the board. */}
      {place !== "bar" && <VoiceBubble voice={bossVoice} class="bc-bubble" />}
    </div>
  );
}

/** A boss's portrait (head and shoulders, from its drawing), for banners and its entrance card; else its emoji. */
/**
 * A boss's name with his small portrait, where a line used to put his emoji (Eric, Nov 5: "it should say Wrangler there or a
 * small picture of him or both"): "[portrait] Wrangler plays d4". `The ` is left off the name, as the banners do.
 */
export function BossTag({ boss }: { boss: Pick<BossView, "name" | "icon"> }) {
  return (
    <span class="boss-tag">
      <BossFace boss={boss} class="boss-tag-face" label="" />
      {boss.name.replace(/^The /, "")}
    </span>
  );
}

export function BossFace({ boss, class: cls = "", label }: { boss: Pick<BossView, "name" | "icon"> & { form?: BossView["form"] }; class?: string; /** Its name for a screen reader (the boss's own unless given; "": none, its button names it). */ label?: string }) {
  // (In a form of its own, that form's face: the Hidden Boss's child.)
  const kit = bossKitOf(boss);
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!kit || !cv.current) return;
    const p = kit.portrait;
    const art = artOf(kit);
    cv.current.getContext("2d")?.putImageData(frameImage(art, art.anims[p.anim]!.frames[p.frame]!), -p.x, -p.y, p.x, p.y, p.w, p.h);
  }, [kit]);
  // (A boss with no drawing shows nothing here: no emoji stands in for a boss, Eric, Nov 5; BossTag says his name.)
  if (!kit) return null;
  return <canvas ref={cv} class={`boss-portrait ${cls}`} width={kit.portrait.w} height={kit.portrait.h} {...(label === "" ? { "aria-hidden": "true" } : { role: "img", "aria-label": label ?? boss.name })} />;
}

/**
 * What to make ahead of a screen of bosses (their art is made the first time it's read: sprite.ts lazyAnim; prewarmAnims
 * makes it in quiet slices): every boss's portrait animation (the select tiles, the stage, the faces), and one boss's
 * whole figure and his phone's bar.
 */
export const portraitAnims = (): Anim[] => Object.values(BOSS_KITS).flatMap((k) => artOf(k).anims[k.portrait.anim] ?? []);
export const bossAnims = (name: string | undefined): Anim[] => {
  const kit = bossKit(name);
  return kit ? [kit.ch, ...(kit.bar ? [kit.bar] : [])].flatMap((ch) => Object.values(ch.anims)) : [];
};

/** A boss's portrait as an image address, made once per boss (the move list's rows: one small image each, not a canvas each). */
const portraitUrls = new Map<string, string | null>();
export function bossPortraitUrl(name: string): string | null {
  let url = portraitUrls.get(name);
  if (url !== undefined) return url;
  url = null;
  const kit = bossKit(name);
  if (kit && typeof document !== "undefined") {
    const p = kit.portrait;
    const cv = document.createElement("canvas");
    cv.width = p.w;
    cv.height = p.h;
    const g = cv.getContext("2d");
    if (g) {
      const art = artOf(kit);
      g.putImageData(frameImage(art, art.anims[p.anim]!.frames[p.frame]!), -p.x, -p.y, p.x, p.y, p.w, p.h);
      url = cv.toDataURL();
    }
  }
  portraitUrls.set(name, url);
  return url;
}

/**
 * A boss's whole figure for a select tile (docs/decisions/2026-10-23-boss-select-sf.md): its portrait's frame, full size, on a
 * canvas of its own. The stylesheet (`.bs-art`) scales it and puts its neck where `SELECT_FRAMING` says; the tile's slanted
 * shape cuts off what doesn't fit. A boss without a character keeps its emoji.
 */
export function BossArt({ boss, class: cls = "" }: { boss: { id: string; name: string; icon: string }; class?: string }) {
  const kit = bossKit(boss.name);
  const fit = SELECT_FRAMING[boss.id];
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!kit || !cv.current) return;
    const p = kit.portrait;
    const art = artOf(kit);
    cv.current.getContext("2d")?.putImageData(frameImage(art, art.anims[p.anim]!.frames[p.frame]!), 0, 0);
  }, [kit]);
  if (!kit || !fit) return <>{boss.icon}</>;
  const art = artOf(kit);
  const style = { "--ax": fit.neck[0], "--ay": fit.neck[1], "--aw": art.w, "--ah": art.h, "--span": fit.span, "--at": fit.at };
  return <canvas ref={cv} class={`bs-art ${cls}`} width={art.w} height={art.h} aria-hidden="true" style={style} />;
}

/**
 * A boss with a character, on a computer: standing by the board's bottom-left corner, facing the God King across the
 * board (by its bottom-right). Goes first in a screen's `.board-row`; on a phone it's hidden (the boss bar has him).
 */
export function BossSide({ match }: { match: GameView }) {
  const el = useRef<HTMLDivElement>(null);
  const name = match.boss?.name;
  // Its size and the God King's by the room beside the board (characters/side-size.ts): measured as it's first drawn and as the window
  // changes, never per frame.
  useLayoutEffect(() => {
    if (!name) return;
    const fit = () => fitSides(el.current, name);
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [name]);
  if (!hasCharacter(match)) return null;
  return (
    <div ref={el} class="boss-side">
      <BossCharacter match={match} place="side" />
    </div>
  );
}

/** Where the figures beside the board are sized (styles.css reads `--side-s` and `--king-k` there): a computer from 1100 px wide. */
const SIDES = "(min-width: 1100px) and (min-height: 600px)";
/**
 * The figures' sizes and places on this screen for the room beside its board (sideSizes), set on the screen: `--side-s` (the boss's size),
 * `--side-d` (his box's middle, px left of his anchor), `--king-k` (the God King's and your pawn's size) and `--first-d` (the middle of the
 * first figure right of the board, px right of the dock's edge). Removed where they don't apply (a phone, 900 to 1099 px).
 */
function fitSides(side: HTMLElement | null, name: string) {
  const screen = side?.closest<HTMLElement>(".screen");
  if (!side || !screen) return;
  const vars = ["--side-s", "--side-d", "--side-lift", "--king-k", "--first-d", "--king-room"];
  if (!matchMedia(SIDES).matches) {
    for (const v of vars) screen.style.removeProperty(v);
    return;
  }
  const rect = (e: Element | null | undefined) => {
    const b = e?.getBoundingClientRect();
    return b?.width ? b : null;
  };
  const wrap = rect(screen.querySelector(".board-row .board-wrap"));
  // (How far his drawing reaches, at rest and where each beat ends (SIDE_REACH), from his feet in his frame's box as it stands now,
  // whichever frame is showing: his entrance may be mid-drop.)
  const kit = bossKit(name);
  const box = rect(side.querySelector(".boss-char"));
  const cv = rect(side.querySelector(".boss-char-sprite"));
  const reach = kit ? SIDE_REACH[kit.ch.id] : undefined;
  if (!wrap || !box || !cv || !kit || !reach) return;
  const sx = cv.width / kit.ch.w;
  const now = (v: string, d: number) => parseFloat(screen.style.getPropertyValue(v)) || d;
  const s = now("--side-s", 2);
  const k = now("--king-k", 1);
  const anchor = side.getBoundingClientRect().left;
  // (The board's edge on his side: the eval bar's, where it shows.)
  const left = rect(screen.querySelector(".board-row > .eval-bar"))?.left ?? wrap.left;
  // Right of the board: your pawn (Boss alone), else the God King; the drawings of both (his frame is wider than his drawing).
  const dock = screen.querySelector(":scope > .boss-dock");
  const unit = dock?.querySelector(":scope > .gk-unit");
  const pawn = rect(dock?.querySelector(":scope > .you-pawn"));
  const art = rect(dock?.querySelector(":scope > .you-pawn .you-pawn-bob"));
  const king = rect(unit?.querySelector(".gk-canvas"));
  const kx = king ? king.width / GOD_KING.w : 0;
  let right: { mid: number; inner: number; outer: number; over: boolean } | null = null;
  if (unit && king) {
    const kingRight = king.left + (GOD_KING.foot[0] + KING_REACH[2]) * kx;
    const first = pawn ?? unit.getBoundingClientRect();
    const mid = first.left + first.width / 2;
    // (Your pawn's box is its inner edge, a hair wider than its drawing; the God King alone keeps his box off the board.)
    right = pawn && art ? { mid, inner: pawn.left, outer: Math.max(kingRight, art.left + art.width * (0.5 + SIDE_FEEL.pawnHalf)), over: true } : { mid, inner: first.left, outer: kingRight, over: false };
  }
  const space = rect(document.querySelector(".tower-space"));
  // (Right of the board the room ends at the window's edge, or at a chat beside the board's corner.)
  const chat = rect(screen.querySelector(":scope > .under-board"));
  const place = sideSizes(
    {
      board: wrap.width,
      boardLeft: left,
      boardRight: wrap.right,
      boardBottom: wrap.bottom,
      leftLimit: space?.left ?? screen.getBoundingClientRect().left,
      rightLimit: Math.min(document.documentElement.clientWidth, chat && chat.left > wrap.right ? chat.left : Infinity),
      s,
      bossLeft: cv.left + (kit.ch.foot[0] - reach[0]) * sx,
      bossRight: cv.left + (kit.ch.foot[0] + reach[2]) * sx,
      bossTop: cv.top + (kit.ch.foot[1] - reach[1]) * sx,
      bossMid: box.left + box.width / 2,
      k,
      right,
      fixed: !!dock?.classList.contains("dk-party"),
      // (A raid's boss stands over its scoreboard's edge, where he was: no empty column beside the board for him to grow into.)
      bossFixed: !space,
    },
    undefined,
    kit.ch.id,
  );
  screen.style.setProperty("--side-s", String(place.s));
  screen.style.setProperty("--king-k", String(place.k));
  if (place.bossMid === null) {
    screen.style.removeProperty("--side-d");
    screen.style.removeProperty("--side-lift");
  } else {
    screen.style.setProperty("--side-d", `${Math.round((anchor - place.bossMid) * 10) / 10}px`);
    // Over the board's edge, the few pixels his drawing has under his feet (SIDE_REACH's down) would lie over the dock's row under the
    // board: he stands that much higher there.
    const row = rect(dock?.querySelector(":scope > .boss-dock-main"));
    const overRow = place.bossMid + (cv.left + (kit.ch.foot[0] + reach[2]) * sx - (box.left + box.width / 2)) * (place.s / s) > (row?.left ?? Infinity);
    const under = reach[3] * place.s;
    const lift = row && overRow ? Math.max(0, Math.ceil(wrap.bottom + under - row.top + 1)) : 0;
    screen.style.setProperty("--side-lift", `${lift}px`);
  }
  const edge = dock?.getBoundingClientRect().right;
  if (place.firstMid === null || edge === undefined) {
    screen.style.removeProperty("--first-d");
    screen.style.removeProperty("--king-room");
    return;
  }
  screen.style.setProperty("--first-d", `${Math.round((place.firstMid - edge) * 10) / 10}px`);
  // (The room his words and his menu open into: from his box's left edge (and their 4 px in) to the window's, less the margin.)
  const kingLeft = place.firstMid + (pawn ? 60 : -60) * place.k;
  screen.style.setProperty("--king-room", `${Math.floor(screen.getBoundingClientRect().right - SIDE_FEEL.margin - kingLeft - 4)}px`);
}
