import type { ComponentChildren, RefObject } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { QuestView } from "@chessroyale/core";
import { bossKit, placeFacing } from "../characters/kits.ts";
import { drawnBox } from "../screens/TowerBar.tsx";
import { SpriteAnim } from "./BossEffect.tsx";
import { YourPawn } from "./BossDock.tsx";
import { QuestPicture } from "./QuestsOverlay.tsx";
import { RankEmblem } from "./RankEmblem.tsx";
import { play, questSound, warmSounds, xpPing } from "../sound.ts";
import "../end-screen.css";

/**
 * MOCKUP (Nov 20; Eric's brief of that day, notes in `.mockup`): the one end screen for every match. Not wired to a match yet: the
 * mockup page (dev/end-screen-mockup.tsx) feeds it made-up results. The build would feed these from the result screens.
 *
 *   - The headline: "Victory!" / "Defeat" in the God King's pixel type, and under it the match's line in the same type ("Floor 3
 *     cleared!" green with a soft blink; "Floor 4 lost · 1 life left" red and still).
 *   - The bosses of the floor, 1-2-1 (one in front, two behind, overlapped), facing your pawn: their defeat on a win, their victory on a
 *     loss (gloating), as ResultDuo's single boss.
 *   - "XP EARNED" (and on ranked, "RP EARNED" above it): the number counts from 0 on a smooth curve (`FX.countMs`), shrinks and lobs into
 *     its bar's slot; the bar then fills from where you were (the number under it counting with it), a rising ping with every step.
 *     A level (or division) reached: the bar flashes full, "Level 3!" pops, your pawn hops in a gold ring, and the bar goes on from 0.
 *   - The quests this match moved, each sliding to its new count after the bars (the overlay's tick and done sounds).
 *
 * Nothing shifts: every slot (the number, the bars, the quest box) has its size from the first frame; the animation only sets
 * transforms, opacity and texts. Reduced motion: everything at its end at once, no lob, one ding.
 */

/** The sequence's timing (ms). In the build: settings.ts, beside XP. */
export const FX = {
  /** After the screen shows, before the first count (a beat to take in the headline). */
  startMs: 450,
  /** The count-up from 0 (Eric: "should only be like 1.5 sec to reach total"). */
  countMs: 1500,
  /** The number holds at its total before it lobs. */
  holdMs: 280,
  /** The lob into the bar. */
  lobMs: 620,
  /** The bar's fill: by how much it gains, between these (core's XP.fillMs is 1,500 to 2,500). */
  fillMs: { min: 1300, max: 2200 },
  /** A level (division) reached: the pause at full while "Level 3!" pops. */
  levelMs: 650,
  /** Between the RP's bar and the XP's count (ranked). */
  gapMs: 300,
  /** Pings at most this often (a 150 XP count would otherwise ask for 90 a second). */
  pingGapMs: 42,
  /** Each quest's slide, and the gap before the next. */
  questMs: 650,
  questGapMs: 250,
} as const;

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
/** The count-up's curve: quick, then easing onto the total. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** The fill's: smooth at both ends. */
const smooth = (t: number) => t * t * (3 - 2 * t);

// ---- The headline ----

export type EndTone = "win" | "loss" | "draw";

/** `plain`: the line in body type, still (ranked's "You won by checkmate."). */
export function EndHeadline({ title, line, tone, plain = false }: { title: string; line: string; tone: EndTone; plain?: boolean }) {
  return (
    <div class={`es-head es-${tone}${plain ? " es-plain" : ""}`}>
      <h1 class="boss-title es-title">{title}</h1>
      {/* (One line, always there: an empty one keeps its height.) */}
      <p class="es-line" data-testid="es-line">
        {line || " "}
      </p>
    </div>
  );
}

// ---- The bosses, 1-2-1 ----

/** One boss's figure in his result beat, cut to his idle's drawn part, at `scale` screen px a sprite px; turned to face your pawn. */
function Figure({ name, result, scale }: { name: string; result: EndTone; scale: number }) {
  const kit = bossKit(name);
  const [since] = useState(() => Date.now());
  if (!kit) return null;
  const ch = kit.ch;
  const idle = kit.anims.idle ?? "idle";
  const beat = result === "win" ? kit.anims.defeat : result === "loss" ? kit.anims.victory : kit.anims.smug;
  const anim = beat && ch.anims[beat] ? beat : idle;
  const b = drawnBox(name, ch, idle);
  const { mirror } = placeFacing(kit, ch, "results");
  return (
    <span class={`es-fig${mirror ? " es-mirror" : ""}`} style={{ width: `${(b.right - b.left) * scale}px`, height: `${(b.bottom - b.top) * scale}px` }}>
      <SpriteAnim ch={ch} anim={anim} then={anim} since={since} class="es-fig-cv" style={{ width: `${ch.w * scale}px`, height: `${ch.h * scale}px`, left: `${-b.left * scale}px`, top: `${-b.top * scale}px` }} />
    </span>
  );
}

/** The scale that fits a boss's drawn part in `w` × `h` px (at most 2, as the result's single boss). */
function fit(name: string, w: number, h: number): number {
  const kit = bossKit(name);
  if (!kit) return 1;
  const b = drawnBox(name, kit.ch, kit.anims.idle ?? "idle");
  return Math.min(2, w / (b.right - b.left), h / (b.bottom - b.top));
}

/**
 * The floor's bosses (1 to 3): the first in front, in the middle; the others behind him, one each side, a little smaller and darker
 * (Eric: "overlapped in a 121 style, 1 in front 2 behind"). Its box is the same size for 1, 2 or 3.
 */
export function BossLineup({ names, result }: { names: readonly string[]; result: EndTone }) {
  const [front, ...back] = names;
  return (
    <div class={`es-lineup es-n${names.length}`} aria-label={`The bosses: ${names.join(", ")}`}>
      {back.map((n, i) => (
        <span key={n} class={`es-back es-back-${i}`}>
          <Figure name={n} result={result} scale={fit(n, 80, 66)} />
        </span>
      ))}
      {front && (
        <span class="es-front">
          <Figure name={front} result={result} scale={fit(front, 130, 98)} />
        </span>
      )}
    </div>
  );
}

/** The bosses and your pawn in one row, the pawn facing them. `lvlAt`: when a level was reached (its hop and ring). */
export function EndDuo({ names, result, lvlAt, pawnRef }: { names: readonly string[]; result: EndTone; lvlAt: number; pawnRef?: RefObject<HTMLDivElement> }) {
  return (
    <div class={`es-duo es-is-${result}`}>
      <BossLineup names={names} result={result} />
      <div class="es-pawn" ref={pawnRef}>
        <span class="es-ring" aria-hidden="true" />
        <YourPawn look={undefined} side="w" hopAt={lvlAt} />
      </div>
    </div>
  );
}

// ---- The earned numbers and their bars ----

/** "XP EARNED" and its number, in a box of fixed height: the number counts up here, then lobs into its bar. */
export function EarnedSlot({ kind, slot, children }: { kind: "xp" | "rp"; slot: RefObject<HTMLSpanElement>; children?: ComponentChildren }) {
  return (
    <div class={`es-earned es-earned-${kind}`}>
      <span class="es-earned-label">{kind === "xp" ? "XP EARNED" : "RP EARNED"}</span>
      <span class="es-earned-num" ref={slot}>
        +0
      </span>
      {children}
    </div>
  );
}

export interface TrackPlan {
  kind: "xp" | "rp";
  /** Where you were and what you earned, as one running count (XP: your total; RP: your points up the ladder). */
  before: number;
  earned: number;
  /** A level's (a division's) size: XP.perLevel (1,000), or RANKED_1V1.pointsPerDivision (80). */
  per: number;
  /** The label of the level or division a count is in ("Level 2", "Gold 2"). */
  label: (at: number) => string;
  /** RP: the emblem's id for a count (the division's). */
  emblem?: (at: number) => string | null;
  /** Shown centered on the top row ("Eric"): whose bar it is. */
  who: string;
}

/**
 * The bar: on top the landing slot ("+150 XP"), your name, your level; the bar; under it 0, where you are, and the level's end
 * (Eric: "under the bar 0 on left then 400 on right"). One fixed box.
 */
export function Track({ plan, refs }: { plan: TrackPlan; refs: TrackRefs }) {
  const within = plan.before % plan.per;
  const lvl = plan.label(plan.before);
  const em = plan.emblem?.(plan.before);
  return (
    <div class={`es-track es-track-${plan.kind}`} ref={refs.box} data-testid={`es-track-${plan.kind}`}>
      <div class="es-track-top">
        <span class="es-gain" ref={refs.gain} />
        <span class="es-who">
          {plan.kind === "rp" && <RankEmblem id={em ?? null} class="es-emblem" />}
          <span ref={refs.who}>{plan.kind === "rp" ? lvl : plan.who}</span>
        </span>
        <span class="es-level" ref={refs.level}>
          {plan.kind === "rp" ? "" : lvl}
        </span>
      </div>
      <div class="es-bar" role="progressbar" aria-valuemin={0} aria-valuemax={plan.per} aria-valuenow={within}>
        <div class="es-fill" ref={refs.fill} style={{ transform: `scaleX(${within / plan.per})` }} />
        <span class="es-shine" ref={refs.shine} aria-hidden="true" />
        <span class="es-pop" ref={refs.pop} aria-hidden="true" />
      </div>
      <div class="es-ends">
        <span>0</span>
        <span class="es-now" ref={refs.now}>
          {fmt(within)}
          <small> {plan.kind.toUpperCase()}</small>
        </span>
        <span>{fmt(plan.per)}</span>
      </div>
    </div>
  );
}

export interface TrackRefs {
  box: RefObject<HTMLDivElement>;
  gain: RefObject<HTMLSpanElement>;
  who: RefObject<HTMLSpanElement>;
  level: RefObject<HTMLSpanElement>;
  fill: RefObject<HTMLDivElement>;
  shine: RefObject<HTMLSpanElement>;
  pop: RefObject<HTMLSpanElement>;
  now: RefObject<HTMLSpanElement>;
}
export function useTrackRefs(): TrackRefs {
  return {
    box: useRef(null),
    gain: useRef(null),
    who: useRef(null),
    level: useRef(null),
    fill: useRef(null),
    shine: useRef(null),
    pop: useRef(null),
    now: useRef(null),
  };
}

// ---- The quests ----

export interface QuestMove {
  quest: QuestView;
  /** Its count before this match (its `progress` is after). */
  from: number;
}

/**
 * The quests this match moved (every end screen): a fixed box of two rows (Eric: "show if your current match impacted any of your
 * current quests"). Each row: its picture, name and goal, a bar at the old count, the count, its reward. None moved: one centered line.
 */
export function QuestRows({ moves, box }: { moves: readonly QuestMove[]; box: RefObject<HTMLDivElement> }) {
  return (
    <div class="es-quests" ref={box} data-testid="es-quests">
      <span class="es-quests-head">Quests</span>
      {moves.length === 0 ? (
        <p class="es-quests-none">No quests moved this game.</p>
      ) : (
        moves.slice(0, 2).map((m) => (
          <div class="es-q" key={m.quest.id} data-from={m.from} data-to={m.quest.progress} data-target={m.quest.target}>
            <span class="es-q-pic">
              <QuestPicture icon={m.quest.icon} />
            </span>
            <span class="es-q-text">
              <strong>{m.quest.name}</strong>
              <span class="es-q-goal">{m.quest.goal}</span>
            </span>
            <span class="es-q-bar">
              <span class="es-q-fill" style={{ transform: `scaleX(${m.from / m.quest.target})` }} />
            </span>
            <span class="es-q-count">
              {m.from}/{m.quest.target}
            </span>
            <span class="es-q-reward">+{fmt(m.quest.reward.xp)} XP</span>
          </div>
        ))
      )}
    </div>
  );
}

// ---- The sequence ----

export interface EndPlanStep {
  plan: TrackPlan;
  slot: RefObject<HTMLSpanElement>;
  refs: TrackRefs;
}

/** What the sequence did, for the mockup's video (its sounds, by wall-clock time in ms). */
export type EndLog = { at: number; name: "xpPing" | "xpLand" | "xpDing" | "acLevel" | "questTick" | "questDone"; k?: number; low?: boolean }[];

/**
 * Runs the end screen's sequence once: for each step (RP then XP on ranked; XP alone elsewhere) the count, the lob and the fill; then
 * the quests. Only transforms, opacity and texts change. Returns its cancel. `onLevel`: a level reached (the pawn's hop). `go`: wait
 * for it (the mockup's video starts it); otherwise it starts with the screen.
 */
export function useEndSequence(steps: readonly EndPlanStep[], quests: RefObject<HTMLDivElement>, opts: { onLevel?: () => void; log?: EndLog; onDone?: () => void; start?: Promise<void> } = {}) {
  useLayoutEffect(() => {
    warmSounds(["acLevel", "questDone"]);
    const timers: number[] = [];
    const frames: number[] = [];
    let stopped = false;
    const sound = (name: EndLog[number]["name"], k?: number, low?: boolean) => {
      opts.log?.push({ at: performance.timeOrigin + performance.now(), name, k, low });
      if (name === "xpPing") xpPing(k ?? 0, low);
      else if (name === "questTick" || name === "questDone") questSound(name === "questTick" ? "tick" : "done");
      else play(name);
    };
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));
    const run = (ms: number, draw: (k: number) => void) =>
      new Promise<void>((r) => {
        const s = performance.now();
        const f = (now: number) => {
          if (stopped) return;
          const k = Math.min(1, (now - s) / ms);
          draw(k);
          if (k < 1) frames.push(requestAnimationFrame(f));
          else r();
        };
        frames.push(requestAnimationFrame(f));
      });

    const sign = (n: number) => (n < 0 ? "−" : "+");
    const endState = (st: EndPlanStep) => {
      const { plan, refs, slot } = st;
      const after = plan.before + plan.earned;
      const within = ((after % plan.per) + plan.per) % plan.per;
      if (slot.current) {
        slot.current.textContent = `${sign(plan.earned)}${fmt(Math.abs(plan.earned))}`;
        slot.current.classList.add("es-settled");
      }
      if (refs.gain.current) {
        refs.gain.current.textContent = `${sign(plan.earned)}${fmt(Math.abs(plan.earned))} ${plan.kind.toUpperCase()}`;
        refs.gain.current.classList.add("on");
      }
      if (refs.fill.current) refs.fill.current.style.transform = `scaleX(${within / plan.per})`;
      setNow(refs, within, plan.per);
      if (plan.kind === "rp" && refs.who.current) refs.who.current.textContent = plan.label(after);
      else if (refs.level.current) refs.level.current.textContent = plan.label(after);
    };
    const questsEnd = () => {
      for (const row of quests.current?.querySelectorAll<HTMLElement>(".es-q") ?? []) {
        const to = Number(row.dataset.to);
        const target = Number(row.dataset.target);
        row.querySelector<HTMLElement>(".es-q-fill")!.style.transform = `scaleX(${to / target})`;
        row.querySelector<HTMLElement>(".es-q-count")!.textContent = to >= target ? `${to}/${target} ✓` : `${to}/${target}`;
        row.classList.toggle("es-q-done", to >= target);
      }
    };

    if (reduced()) {
      for (const st of steps) endState(st);
      questsEnd();
      sound("xpDing");
      opts.onDone?.();
      return;
    }

    const count = async (st: EndPlanStep) => {
      const { plan, slot } = st;
      const el = slot.current;
      if (!el) return;
      el.parentElement?.classList.add("es-live");
      let last = -1;
      let lastPing = 0;
      await run(FX.countMs, (k) => {
        const v = Math.round(plan.earned * easeOut(k));
        if (v !== last) {
          last = v;
          el.textContent = `${sign(v === 0 ? plan.earned : v)}${fmt(Math.abs(v))}`;
          const now = performance.now();
          if (v !== 0 && now - lastPing >= FX.pingGapMs) {
            lastPing = now;
            sound("xpPing", Math.abs(v / plan.earned), true);
          }
        }
      });
    };

    const lob = async (st: EndPlanStep) => {
      const el = st.slot.current;
      const to = st.refs.gain.current;
      if (!el || !to) return;
      const a = el.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      // (Up and over: the arc's top is above both ends.)
      const lift = 18;
      const end = 0.38;
      const anim = el.animate(
        [
          { transform: "translate(0, 0) scale(1)", offset: 0 },
          { transform: `translate(${dx * 0.12}px, ${-lift * 0.55}px) scale(0.86)`, offset: 0.2, easing: "ease-out" },
          { transform: `translate(${dx * 0.5}px, ${Math.min(0, dy) - lift}px) scale(0.6)`, offset: 0.52, easing: "ease-in" },
          { transform: `translate(${dx}px, ${dy}px) scale(${end})`, offset: 1 },
        ],
        { duration: FX.lobMs, fill: "forwards" },
      );
      await anim.finished.catch(() => undefined);
      if (stopped) return;
      sound("xpLand");
      anim.cancel();
      // (The slot keeps its record: the total, quieter, faded back in.)
      el.textContent = `${sign(st.plan.earned)}${fmt(Math.abs(st.plan.earned))}`;
      el.classList.add("es-settled");
      to.textContent = `${sign(st.plan.earned)}${fmt(Math.abs(st.plan.earned))} ${st.plan.kind.toUpperCase()}`;
      to.classList.add("on");
      st.refs.box.current?.classList.add("es-landed");
    };

    const fill = async (st: EndPlanStep) => {
      const { plan, refs } = st;
      const gain = Math.abs(plan.earned);
      const ms = Math.round(FX.fillMs.min + (FX.fillMs.max - FX.fillMs.min) * Math.min(1, gain / plan.per));
      let level = Math.floor(plan.before / plan.per);
      let lastPing = 0;
      let lastShown = -1;
      // (A level crossed pauses the fill at full: split the run at each crossing.)
      const from = plan.before;
      const to = plan.before + plan.earned;
      let start = from;
      while (!stopped) {
        const dir = Math.sign(plan.earned) || 1;
        const edge = dir > 0 ? (level + 1) * plan.per : level * plan.per;
        const stop = dir > 0 ? Math.min(to, edge) : Math.max(to, edge);
        const share = Math.abs(stop - start) / Math.max(1, gain);
        const a = start;
        await run(Math.max(120, ms * share), (k) => {
          const v = a + (stop - a) * smooth(k);
          const shown = Math.round(v);
          const within = shown === edge && dir > 0 ? plan.per : ((shown % plan.per) + plan.per) % plan.per;
          if (refs.fill.current) refs.fill.current.style.transform = `scaleX(${within / plan.per})`;
          if (shown !== lastShown) {
            lastShown = shown;
            setNow(refs, within, plan.per);
            const now = performance.now();
            if (now - lastPing >= FX.pingGapMs) {
              lastPing = now;
              sound("xpPing", within / plan.per);
            }
          }
        });
        if (stop === to) break;
        // A level (or a division) reached, or lost (RP down): the flash, the pop, the label; then on from the other end.
        level += dir;
        const lbl = plan.label(level * plan.per + (dir > 0 ? 0 : plan.per - 1));
        if (dir > 0) {
          refs.box.current?.classList.remove("es-lvl");
          void refs.box.current?.offsetWidth;
          refs.box.current?.classList.add("es-lvl");
          if (refs.pop.current) refs.pop.current.textContent = `${lbl}!`;
          sound("acLevel");
          opts.onLevel?.();
        }
        if (plan.kind === "rp" && refs.who.current) refs.who.current.textContent = lbl;
        else if (refs.level.current) refs.level.current.textContent = lbl;
        await wait(FX.levelMs);
        start = dir > 0 ? level * plan.per : level * plan.per + plan.per;
        if (refs.fill.current) refs.fill.current.style.transform = `scaleX(${dir > 0 ? 0 : 1})`;
      }
      if (stopped) return;
      sound("xpDing");
      refs.box.current?.classList.add("es-full");
    };

    const questRun = async () => {
      const rows = [...(quests.current?.querySelectorAll<HTMLElement>(".es-q") ?? [])];
      for (const row of rows) {
        const from = Number(row.dataset.from);
        const to = Number(row.dataset.to);
        const target = Number(row.dataset.target);
        const f = row.querySelector<HTMLElement>(".es-q-fill")!;
        const c = row.querySelector<HTMLElement>(".es-q-count")!;
        row.classList.add("es-q-moving");
        let shown = from;
        await run(FX.questMs, (k) => {
          const v = from + (to - from) * smooth(k);
          f.style.transform = `scaleX(${v / target})`;
          const n = Math.floor(v + 1e-6);
          if (n !== shown) {
            shown = n;
            c.textContent = `${n}/${target}`;
            if (n < target) sound("questTick");
          }
        });
        row.classList.remove("es-q-moving");
        if (to >= target) {
          c.textContent = `${to}/${target} ✓`;
          row.classList.add("es-q-done");
          sound("questDone");
        }
        await wait(FX.questGapMs);
      }
    };

    void (async () => {
      if (opts.start) await opts.start;
      await wait(FX.startMs);
      for (const [i, st] of steps.entries()) {
        if (stopped) return;
        if (i > 0) await wait(FX.gapMs);
        await count(st);
        await wait(FX.holdMs);
        await lob(st);
        await fill(st);
      }
      if (stopped) return;
      await wait(FX.gapMs);
      await questRun();
      opts.onDone?.();
    })();
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      frames.forEach(cancelAnimationFrame);
    };
  }, []);
}

function setNow(refs: TrackRefs, within: number, per: number) {
  if (refs.now.current) refs.now.current.firstChild!.textContent = fmt(within);
  void per;
}
