import type { ComponentChildren, RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { END_SCREEN as FX, QUESTS, RANKED_1V1, XP, XP_NONE_LINES, divisionTitle, levelOf, rankView, xpShownParts, type RankChange, type RankView, type XpGrant } from "@chessroyale/core";
import { account, playerName } from "../account.ts";
import { bossKit, placeFacing } from "../characters/kits.ts";
import { drawnBox } from "../screens/TowerBar.tsx";
import { pawnLook } from "../looks.ts";
import { questRowsBy, questsForYou, questsMovedBy, type QuestMoved } from "../quests.ts";
import { markXpFilled, xpFilled } from "../xp.ts";
import { SpriteAnim } from "./BossEffect.tsx";
import { YourPawn } from "./BossDock.tsx";
import { BossPortrait } from "./BossPortrait.tsx";
import { CoinStrip, type CoinStripApi } from "./CoinStrip.tsx";
import { QuestPicture } from "./QuestsOverlay.tsx";
import { RankEmblem } from "./RankEmblem.tsx";
import { RewardBox } from "./RewardBox.tsx";
import { play, questSound, warmSounds, xpPing } from "../sound.ts";
import "../end-screen.css";

/**
 * The end screen of every match (Eric, Nov 20; docs/decisions/2026-11-20-end-screen.md; the approved mockup, branch
 * `claude/end-screen-mockup`):
 *
 *   - The headline (EndHeadline): "Victory!" / "Defeat" in the God King's pixel type, and under it the match's line in the same type
 *     ("Floor 3 cleared!" green with a soft blink; "Floor 4 lost · 1 life left" red and still).
 *   - "XP EARNED" (and on ranked, "RP EARNED" / "RP LOST" above it): the number counts from 0, shrinks and lobs into its bar's slot;
 *     the bar fills from where you were (the number under it counting with it), a rising ping with every step. A level (a division)
 *     reached: the bar flashes full, "Level 3!" pops, your pawn hops in a gold ring, and the bar goes on from 0.
 *   - Each screen's middle between the number and the bar: the floor's bosses 1-2-1 (EndDuo), the podium, the squads.
 *   - The coin strip under the XP bar (CoinStrip, Nov 25): when the fill ends, coins drop into a pile and the count rolls up.
 *   - The quests this match moved, each sliding to its new count after the bars.
 *
 * Nothing shifts: every box (the number's slot, the bars) has its size from the first frame, the game's XP still coming included; the
 * quests alone take their rows as they come (Eric's exception, Nov 26: no empty rows kept, the buttons under them may move once); the sequence only sets transforms, opacity and texts. Buttons work all the time; a tap anywhere else skips to the end (its
 * sounds stop). Reduced motion: the end at once, one ding. Timings: END_SCREEN in settings.ts.
 */

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
/** The count-up's curve: quick, then easing onto the total. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** The fill's: smooth at both ends. */
const smooth = (t: number) => t * t * (3 - 2 * t);
const unit = (kind: "xp" | "rp") => kind.toUpperCase();
/** "+150", "−14". */
const signed = (n: number) => `${n < 0 ? "−" : "+"}${fmt(Math.abs(n))}`;

// ---- The headline ----

export type EndTone = "win" | "loss" | "draw";

/** `plain`: the line in body type, still. A long line (over 22 characters) a size smaller, so it stays on one line on a phone. */
export function EndHeadline({ title, line, tone, plain = false }: { title: ComponentChildren; line: string; tone: EndTone; plain?: boolean }) {
  return (
    <div class={`es-head es-${tone}${plain ? " es-plain" : ""}`}>
      <h1 class={`boss-title es-title${typeof title === "string" && title.length > 12 ? " es-title-long" : ""}`} data-testid="es-title">
        {title}
      </h1>
      {/* (The match's line when it has one. A screen whose headline has none (you resigned, out in the crowd) never gets one later, so
          no blank line is kept: it was a gap three times the one under the title, Nov 25.) */}
      {line && (
        <p class={`es-line${line.length > 22 ? " es-line-long" : ""}`} data-testid="es-line">
          {line}
        </p>
      )}
    </div>
  );
}

// ---- The bosses, 1-2-1 ----

/** One boss's figure in his result beat, cut to his idle's drawn part, at `scale` screen px a sprite px; turned to face your pawn. */
function Figure({ name, result, scale }: { name: string; result: EndTone; scale: number }) {
  const kit = bossKit(name);
  const [since] = useState(() => Date.now());
  if (!kit) return <BossPortrait boss={{ name, icon: "" }} class="es-portrait" label={name} />;
  const ch = kit.ch;
  const idle = kit.anims.idle ?? "idle";
  // (A win: their defeat; a loss: their victory, gloating; a draw: smug, or standing.)
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

/** The scale that fits a boss's drawn part in `box` (at most END_SCREEN.bossMaxScale, as the result's single boss). */
function fit(name: string, box: { w: number; h: number }): number {
  const kit = bossKit(name);
  if (!kit) return 1;
  const b = drawnBox(name, kit.ch, kit.anims.idle ?? "idle");
  return Math.min(FX.bossMaxScale, box.w / (b.right - b.left), box.h / (b.bottom - b.top));
}

/**
 * The floor's bosses (1 to 3): the first in front, in the middle; the others behind him, one each side, a little smaller and darker
 * (Eric: "overlapped in a 121 style, 1 in front 2 behind"). Its box is the same size for 1, 2 or 3.
 */
export function BossLineup({ names, result }: { names: readonly string[]; result: EndTone }) {
  const [front, ...back] = names;
  return (
    <div class={`es-lineup es-n${names.length}`} aria-label={`The bosses: ${names.join(", ")}`} data-testid="es-lineup">
      {back.slice(0, 2).map((n, i) => (
        <span key={n} class={`es-back es-back-${i}`}>
          <Figure name={n} result={result} scale={fit(n, FX.backBoss)} />
        </span>
      ))}
      {front && (
        <span class="es-front">
          <Figure name={front} result={result} scale={fit(front, FX.frontBoss)} />
        </span>
      )}
    </div>
  );
}

/** The bosses and your pawn in one row, the pawn facing them. `hopAt`: when a level was reached (its hop and ring). */
export function EndDuo({ names, result, hopAt, side = "w" }: { names: readonly string[]; result: EndTone; hopAt: number; side?: "w" | "b" }) {
  return (
    <div class={`es-duo es-is-${result}`}>
      <BossLineup names={names} result={result} />
      <EndPawn hopAt={hopAt} side={side} />
    </div>
  );
}

/** Your pawn, as on the board; a level reached: a gold ring bursts from it as it hops (drawn again for each level: its key). */
export function EndPawn({ hopAt, side = "w" }: { hopAt: number; side?: "w" | "b" }) {
  return (
    <div class={`es-pawn${hopAt ? " es-lvl-on" : ""}`} key={hopAt}>
      <span class="es-ring" aria-hidden="true" />
      <YourPawn look={pawnLook({ id: "", isYou: true, isBot: false }).look} side={side} hopAt={hopAt} />
    </div>
  );
}

// ---- The earned numbers and their bars ----

/**
 * "XP EARNED" (or "RP EARNED" / "RP LOST") and its number, in a box of fixed height: the number counts up here, then lobs into its
 * bar. `why`: in place of the number, why there's none ("No XP: test game."). `parts`: what made it, small, under it ("Win +50").
 */
function EarnedSlot({ kind, slot, down, why, parts, games = false }: { kind: "xp" | "rp"; slot: RefObject<HTMLSpanElement>; down: boolean; why: string | null; parts: string; games?: boolean }) {
  return (
    <div class={`es-earned es-earned-${kind}${down ? " es-down" : ""}${why ? " es-why" : ""}`} data-testid={`es-earned-${kind}`}>
      {/* (Placement games earn no RP, Eric, Nov 25: their slot says what they are.) */}
      <span class="es-earned-label">{kind === "xp" ? "XP EARNED" : games ? "PLACEMENT" : down ? "RP LOST" : "RP EARNED"}</span>
      {/* (Keyed: a skip tap before the XP came writes the number's text by hand; the line that comes after must be a new element, or it
          kept that "+0", Nov 25.) */}
      {why ? (
        <span class="es-earned-why" key="why">
          {why}
        </span>
      ) : (
        <span class="es-earned-num" key="num" ref={slot}>
          {down ? "0" : "+0"}
        </span>
      )}
      {/* (What made it, when there's something to say: no blank line kept, Nov 25: one gap between containers.) */}
      {parts && <span class="es-parts">{parts}</span>}
    </div>
  );
}

export interface TrackPlan {
  kind: "xp" | "rp";
  /** Where you were and what you earned, as one running count (XP: your total; RP: your ladder points). */
  before: number;
  earned: number;
  /** A level's (a division's) size: XP.perLevel, or RANKED_1V1.pointsPerDivision. */
  per: number;
  /** The label of the level or division a count is in ("Level 2", "Gold 2"). */
  label: (at: number) => string;
  /** RP: the emblem's id for a count (the division's). */
  emblem?: (at: number) => string | null;
  /** A plan that only shows where you are (placements, a top tier): no count, no fill. */
  still?: boolean;
  /** Placements: the bar counts games ("1 of 5 games"), not RP (Eric, Nov 25). */
  games?: boolean;
}

interface TrackRefs {
  box: RefObject<HTMLDivElement>;
  gain: RefObject<HTMLSpanElement>;
  who: RefObject<HTMLSpanElement>;
  level: RefObject<HTMLSpanElement>;
  fill: RefObject<HTMLDivElement>;
  pop: RefObject<HTMLSpanElement>;
  now: RefObject<HTMLSpanElement>;
  emblem: RefObject<HTMLSpanElement>;
}
function useTrackRefs(): TrackRefs {
  return { box: useRef(null), gain: useRef(null), who: useRef(null), level: useRef(null), fill: useRef(null), pop: useRef(null), now: useRef(null), emblem: useRef(null) };
}

/** An amount counted so far as XP, for its ping's pitch (xpPingHz): XP as it is; RP by its bar's share (a full bar as a level). */
const asXp = (plan: { per: number }, counted: number) => (Math.abs(counted) * XP.perLevel) / plan.per;
const within = (at: number, per: number) => ((at % per) + per) % per;

/**
 * The bar: on top the landing slot ("+150 XP"), your name (RP: your division), your level; the bar; under it 0, where you are, and the
 * level's end (Eric: "under the bar 0 on left then 400 on right"). One fixed box.
 */
function Track({ plan, refs, emblem }: { plan: TrackPlan; refs: TrackRefs; emblem?: string | null }) {
  const w = plan.still ? plan.before : within(plan.before, plan.per);
  const lvl = plan.label(plan.before);
  return (
    <div class={`es-track es-track-${plan.kind}${plan.earned < 0 ? " es-down" : ""}`} ref={refs.box} data-testid={`es-track-${plan.kind}`}>
      <div class="es-track-top">
        <span class="es-gain" ref={refs.gain} />
        <span class="es-who">
          {plan.kind === "rp" && (
            <span ref={refs.emblem} class="es-emblem-box">
              <RankEmblem id={emblem !== undefined ? emblem : (plan.emblem?.(plan.before) ?? null)} class="es-emblem" />
            </span>
          )}
          <span ref={refs.who} data-testid={`es-who-${plan.kind}`}>
            {plan.games ? "Placement games" : plan.kind === "rp" ? lvl : playerName()}
          </span>
        </span>
        <span class="es-level" ref={refs.level} data-testid={`es-level-${plan.kind}`}>
          {plan.kind === "rp" ? "" : lvl}
        </span>
      </div>
      <div class="es-bar" role="progressbar" aria-valuemin={0} aria-valuemax={plan.per} aria-valuenow={w}>
        <div class="es-fill" ref={refs.fill} style={{ transform: `scaleX(${Math.min(1, w / plan.per)})` }} />
        <span class="es-shine" aria-hidden="true" />
        <span class="es-pop" ref={refs.pop} aria-hidden="true" />
      </div>
      <div class="es-ends">
        <span>0</span>
        <span class="es-now" ref={refs.now} data-testid={`es-now-${plan.kind}`}>
          {fmt(w)}
          <small>{plan.games ? ` of ${fmt(plan.per)} placement games` : ` ${unit(plan.kind)}`}</small>
        </span>
        <span>{fmt(plan.per)}</span>
      </div>
    </div>
  );
}

// ---- The quests ----

/**
 * The quests this match moved (every end screen; Eric: "show if your current match impacted any of your current quests"): exactly as
 * many rows as it moved (at most END_SCREEN.questRows), no empty row kept (Eric, Nov 26: "if there's 3 quests that you checked off, then
 * there's 3 quests, and then it starts after that"; the buttons under them may move once as they come). Each row: its picture, name and
 * goal, a bar at the old count, the count, its reward. None moved (or still asking): one centered line.
 *
 * `day` (ranked 1 v 1's end page, Eric, Nov 25: never "No quests moved this game"): every quest you have, the dailies then the weekly
 * (a box of QUESTS.maxDailies + 1 rows, always), each at its count; the ones this game moved lit (`es-q-lit`) and sliding to theirs.
 */
function QuestRows({ moves, box, line, day = false }: { moves: readonly (QuestMoved & { moved?: boolean })[] | null; box: RefObject<HTMLDivElement>; line: string; day?: boolean }) {
  const one = !moves || moves.length === 0;
  return (
    <div class={`es-quests${one ? " es-quests-one" : ""}`} ref={box} data-testid="es-quests">
      {/* (None, or still asking: one line, "QUESTS" and why beside it, Eric, Nov 25: "we don't need 800 feet of empty space". Rows: as many
          as there are, no empty ones kept.) */}
      {!moves || moves.length === 0 ? (
        <p class="es-quests-none">
          <strong class="es-quests-head">{day ? "Your quests" : "Quests"}</strong> {line}
        </p>
      ) : (
        <span class="es-quests-head">{day ? "Your quests" : "Quests"}</span>
      )}
      {!moves || moves.length === 0 ? null : (
        moves.slice(0, day ? DAY_ROWS : FX.questRows).map((m) => {
          // (A quest this game didn't move stands at its count; one already done shows done, still.)
          const lit = m.moved !== false;
          const done = !lit && m.quest.progress >= m.quest.target;
          return (
          <div class={`es-q${day && lit ? " es-q-lit" : ""}${done ? " es-q-done es-q-still" : ""}`} key={m.quest.id} data-from={m.from} data-to={m.quest.progress} data-target={m.quest.target} data-moved={lit ? "1" : "0"} data-testid="es-q">
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
              {done ? " ✓" : ""}
            </span>
            <span class="es-q-reward">+{fmt(m.quest.reward.xp)} XP</span>
          </div>
          );
        })
      )}
    </div>
  );
}

/** The day's quest box: up to QUESTS.maxDailies dailies and the weekly. */
const DAY_ROWS = QUESTS.maxDailies + 1;

// ---- The plans ----

/** Your XP while the game's is still coming (or none came): your profile's, read once, so the bar stands still meanwhile. */
const levelLabel = (at: number) => `Level ${levelOf(at)}`;
function xpPlan(xp: XpGrant | null | undefined, waited: number): TrackPlan {
  const ok = xp && !xp.none;
  return { kind: "xp", before: ok ? xp.before : (xp?.before ?? waited), earned: ok ? xp.after - xp.before : 0, per: XP.perLevel, label: levelLabel };
}

/** A ladder count's division ("Gold III", as the pill names it) and emblem. */
const ladderView = (at: number): RankView => rankView({ games: RANKED_1V1.placements.games, ladder: Math.max(0, at) });

/**
 * A ranked game's plan: its points counted along the ladder, division by division (RANKED_1V1.pointsPerDivision each). Placements, the
 * game that places you, and the top tiers (whose RP count on past a division) show where you are, still.
 */
export function rpPlan(c: RankChange | null, now: RankView | null): TrackPlan {
  const per = RANKED_1V1.pointsPerDivision;
  const b = c?.before;
  const a = c?.after ?? now;
  const counts = !!c && c.points !== null && !c.placed && b!.ladder !== null && a!.ladder !== null && b!.division !== null && a!.division !== null && b!.points < per && a!.points < per;
  if (counts) return { kind: "rp", before: b!.ladder!, earned: c!.points!, per, label: (at) => divisionTitle(ladderView(at)), emblem: (at) => ladderView(at).emblem };
  // (Still: placements fill by games played; a placed or top-tier rank shows its points.)
  const v = a ?? rankView(null);
  const p = v.placement;
  return { kind: "rp", before: p ? p.played : Math.min(per, v.points), earned: 0, per: p ? p.of : per, label: () => v.label, emblem: () => v.emblem, still: true, games: !!p };
}

// ---- The sequence ----

interface Step {
  plan: TrackPlan;
  slot: RefObject<HTMLSpanElement>;
  refs: TrackRefs;
}

/**
 * Runs the end screen's sequence once `ready`: for each step (RP then XP on ranked; XP alone elsewhere) the count, the lob and the
 * fill; then the quests (`quests`: their rows drawn). Only transforms, opacity and texts change. A tap anywhere but a button or a field
 * skips to the end, the same as a remount after it ran (`already`). `onLevel`: a level reached (the pawn's hop).
 */
function useEndSequence(o: { ready: boolean; already: boolean; steps: readonly Step[]; coins: RefObject<CoinStripApi>; quests: RefObject<HTMLDivElement>; questsIn: () => Promise<void>; root: RefObject<HTMLElement>; onLevel: () => void; onEmblem: (id: string | null) => void; onStart: () => void; onDone: () => void }) {
  const opts = useRef(o);
  opts.current = o;
  // (The skip, from the first frame: a tap before the game's XP has come skips too.)
  const skipped = useRef(false);
  const skip = useRef<() => void>(() => void (skipped.current = true));
  useLayoutEffect(() => {
    const tap = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.("button, a, input, select, textarea, label, [role='button'], [role='dialog'], .mm-corner")) return;
      skip.current();
    };
    document.addEventListener("pointerdown", tap, true);
    return () => document.removeEventListener("pointerdown", tap, true);
  }, []);

  useLayoutEffect(() => {
    if (!o.ready) return;
    const { steps, quests, questsIn, root } = opts.current;
    const set = (s: "run" | "done") => {
      root.current?.setAttribute("data-es", s);
      if (s === "done") opts.current.onDone();
    };
    const timers: number[] = [];
    const frames: number[] = [];
    let anim: Animation | null = null;
    let stopped = false;
    const sound = (name: "xpPing" | "xpLand" | "xpDing" | "acLevel" | "questTick" | "questDone", xp?: number, count?: boolean) => {
      if (stopped) return;
      if (name === "xpPing") xpPing(xp ?? 0, count);
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

    const label = (st: Step, at: number) => {
      const { plan, refs } = st;
      if (plan.kind === "rp") {
        if (refs.who.current) refs.who.current.textContent = plan.label(at);
        // (The emblem: the division's, drawn again by its own state.)
        if (plan.emblem) opts.current.onEmblem(plan.emblem(at));
      } else if (refs.level.current) refs.level.current.textContent = plan.label(at);
    };
    const setNow = (st: Step, w: number) => {
      const t = st.refs.now.current?.firstChild;
      if (t) t.textContent = fmt(w);
    };
    const shownNum = (st: Step, v: number) => (st.plan.kind === "rp" && st.plan.earned < 0 ? fmt(Math.abs(v)) : signed(v));
    const endState = (st: Step) => {
      const { plan, refs, slot } = st;
      if (plan.still) return;
      const after = plan.before + plan.earned;
      const w = within(after, plan.per);
      if (slot.current) {
        slot.current.getAnimations?.().forEach((a) => a.cancel());
        slot.current.textContent = shownNum(st, plan.earned);
        slot.current.classList.add("es-settled");
      }
      if (refs.gain.current && plan.earned !== 0) {
        refs.gain.current.textContent = `${signed(plan.earned)} ${unit(plan.kind)}`;
        refs.gain.current.classList.add("on");
      }
      if (refs.fill.current) refs.fill.current.style.transform = `scaleX(${w / plan.per})`;
      setNow(st, w);
      label(st, after);
    };
    let questsShown = false;
    const questsEnd = () => {
      if (questsShown) return;
      questsShown = true;
      for (const row of quests.current?.querySelectorAll<HTMLElement>(".es-q") ?? []) {
        const to = Number(row.dataset.to);
        const target = Number(row.dataset.target);
        row.querySelector<HTMLElement>(".es-q-fill")!.style.transform = `scaleX(${Math.min(1, to / target)})`;
        row.querySelector<HTMLElement>(".es-q-count")!.textContent = to >= target ? `${to}/${target} ✓` : `${to}/${target}`;
        row.classList.toggle("es-q-done", to >= target);
      }
    };
    // (Skipped, reduced motion, or already run: every number at its end; the quests at theirs once they're drawn.)
    const finish = (ding: boolean) => {
      stopped = true;
      timers.forEach(clearTimeout);
      frames.forEach(cancelAnimationFrame);
      anim?.cancel();
      for (const st of steps) endState(st);
      if (ding) play("xpDing");
      // (The coins at their end too; reduced motion: one clink.)
      opts.current.coins.current?.end(ding);
      void questsIn().then(() => {
        questsEnd();
        set("done");
      });
    };
    skip.current = () => finish(false);
    if (skipped.current || o.already) {
      finish(false);
      return () => void (stopped = true);
    }
    opts.current.onStart();
    if (reduced()) {
      finish(true);
      return () => void (stopped = true);
    }
    set("run");
    warmSounds(["acLevel", "questDone"]);

    const count = async (st: Step) => {
      const { plan, slot } = st;
      const el = slot.current;
      if (!el || plan.still || plan.earned === 0) return;
      el.parentElement?.classList.add("es-live");
      let last = -1;
      let lastPing = 0;
      await run(FX.countMs, (k) => {
        const v = Math.round(plan.earned * easeOut(k));
        if (v === last) return;
        last = v;
        el.textContent = shownNum(st, v);
        const now = performance.now();
        if (v !== 0 && now - lastPing >= FX.pingGapMs) {
          lastPing = now;
          sound("xpPing", asXp(plan, v), true);
        }
      });
    };

    const lob = async (st: Step) => {
      const el = st.slot.current;
      const to = st.refs.gain.current;
      if (!el || !to || st.plan.still || st.plan.earned === 0) return;
      const a = el.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      // (Up and over: the arc's top is above both ends.)
      const lift = FX.lobLift;
      anim = el.animate(
        [
          { transform: "translate(0, 0) scale(1)", offset: 0 },
          { transform: `translate(${dx * 0.12}px, ${-lift * 0.55}px) scale(0.86)`, offset: 0.2, easing: "ease-out" },
          { transform: `translate(${dx * 0.5}px, ${Math.min(0, dy) - lift}px) scale(0.6)`, offset: 0.52, easing: "ease-in" },
          { transform: `translate(${dx}px, ${dy}px) scale(${FX.lobEndScale})`, offset: 1 },
        ],
        { duration: FX.lobMs, fill: "forwards" },
      );
      await anim.finished.catch(() => undefined);
      if (stopped) return;
      sound("xpLand");
      anim.cancel();
      anim = null;
      // (The slot keeps its record: the total, quieter, faded back in.)
      el.textContent = shownNum(st, st.plan.earned);
      el.classList.add("es-settled");
      to.textContent = `${signed(st.plan.earned)} ${unit(st.plan.kind)}`;
      to.classList.add("on");
      st.refs.box.current?.classList.add("es-landed");
    };

    const fill = async (st: Step) => {
      const { plan, refs } = st;
      if (plan.still || plan.earned === 0) return;
      const gain = Math.abs(plan.earned);
      const ms = Math.round(FX.fillMs.min + (FX.fillMs.max - FX.fillMs.min) * Math.min(1, gain / plan.per));
      const dir = Math.sign(plan.earned);
      let level = Math.floor(plan.before / plan.per);
      let lastPing = 0;
      let lastShown = -1;
      const to = plan.before + plan.earned;
      let start = plan.before;
      // (A level crossed pauses the fill at full: the run split at each crossing.)
      while (!stopped) {
        const edge = dir > 0 ? (level + 1) * plan.per : level * plan.per;
        const stop = dir > 0 ? Math.min(to, edge) : Math.max(to, edge);
        const a = start;
        // (Where in this stretch's level: its full end shown full, never as the next level's 0, either way.)
        const base = level * plan.per;
        await run(Math.max(FX.stretchMinMs, (ms * Math.abs(stop - a)) / gain), (k) => {
          const shown = Math.round(a + (stop - a) * smooth(k));
          const w = Math.max(0, Math.min(plan.per, shown - base));
          if (refs.fill.current) refs.fill.current.style.transform = `scaleX(${w / plan.per})`;
          if (shown === lastShown) return;
          lastShown = shown;
          setNow(st, w);
          const now = performance.now();
          if (now - lastPing >= FX.pingGapMs) {
            lastPing = now;
            sound("xpPing", asXp(plan, shown - plan.before));
          }
        });
        if (stopped || stop === to) break;
        // A level (or a division) reached, or a division lost (RP down): the flash and the pop going up; the label; then on from the
        // bar's other end.
        level += dir;
        const at = dir > 0 ? level * plan.per : level * plan.per + plan.per - 1;
        if (dir > 0) {
          refs.box.current?.classList.remove("es-lvl");
          void refs.box.current?.offsetWidth;
          refs.box.current?.classList.add("es-lvl");
          if (refs.pop.current) refs.pop.current.textContent = `${plan.label(at)}!`;
          sound("acLevel");
          if (plan.kind === "xp") opts.current.onLevel();
        }
        label(st, at);
        await wait(FX.levelMs);
        start = dir > 0 ? level * plan.per : level * plan.per + plan.per;
        if (refs.fill.current) refs.fill.current.style.transform = `scaleX(${dir > 0 ? 0 : 1})`;
      }
      if (stopped) return;
      sound("xpDing");
    };

    const questRun = async () => {
      await questsIn();
      if (stopped) return;
      questsShown = true;
      // (Only the rows this game moved: a day's box shows the others still.)
      const rows = [...(quests.current?.querySelectorAll<HTMLElement>(".es-q") ?? [])].filter((r) => Number(r.dataset.from) < Number(r.dataset.to));
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
          f.style.transform = `scaleX(${Math.min(1, v / target)})`;
          const n = Math.floor(v + 1e-6);
          if (n === shown) return;
          shown = n;
          c.textContent = `${n}/${target}`;
          if (n < target) sound("questTick");
        });
        if (stopped) return;
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
      await wait(FX.startMs);
      for (const [i, st] of steps.entries()) {
        if (stopped) return;
        if (i > 0) await wait(FX.gapMs);
        await count(st);
        if (stopped) return;
        if (!st.plan.still && st.plan.earned !== 0) await wait(FX.holdMs);
        await lob(st);
        await fill(st);
      }
      if (stopped) return;
      // (The coins when the XP fill ends: the eye goes XP, then coins.)
      await opts.current.coins.current?.play();
      if (stopped) return;
      await wait(FX.gapMs);
      await questRun();
      if (stopped) return;
      stopped = true;
      set("done");
    })();
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      frames.forEach(cancelAnimationFrame);
      anim?.cancel();
      opts.current.coins.current?.end(false);
    };
  }, [o.ready]);
}

// ---- The rewards block: the numbers, the middle, the bars and the quests ----

export interface EndRp {
  /** The game's rank change: undefined while it's coming, null for none (fair play holding your rank). */
  change: RankChange | null | undefined;
  /** Your rank now, for a game with no change. */
  now: RankView | null;
}

/**
 * The rewards of every end screen, in order: (ranked: "RP EARNED" and its bar), "XP EARNED", the screen's own `middle` (given the
 * time a level was reached: the pawn's hop), the XP bar, the coin strip (the game's coins, from the same grant), the quests. `xp`: the game's grant (undefined: still coming; null: none came,
 * for `none`'s reason). The toast for what the bars and rows don't show (crates, keys) once it has run.
 */
export function EndRewards({ xp, none = "No XP for this game.", rp, middle, day = false }: { xp: XpGrant | null | undefined; none?: string; rp?: EndRp; middle?: (hopAt: number) => ComponentChildren; day?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const qBox = useRef<HTMLDivElement>(null);
  const xpSlot = useRef<HTMLSpanElement>(null);
  const rpSlotRef = useRef<HTMLSpanElement>(null);
  const xpRefs = useTrackRefs();
  const coins = useRef<CoinStripApi>(null);
  const rpRefs = useTrackRefs();
  const [hopAt, setHopAt] = useState(0);
  const [emblem, setEmblem] = useState<string | null | undefined>(undefined);
  // (Your XP as your profile had it when the screen appeared, read once: a profile refreshed while waiting never moves the bar.)
  const [waited] = useState(() => account().profile?.xp ?? 0);
  // (Whether this grant already ran on an earlier screen (Squads' card, then its results): decided once, as it first comes.)
  const already = useRef<boolean | null>(null);
  if (xp !== undefined && already.current === null) already.current = !!xp && xpFilled(xp);
  const counted = !!xp && !xp.none;
  // The quests this game moved: asked once its XP has come (the server counted them in the same batch).
  const [moves, setMoves] = useState<(QuestMoved & { moved?: boolean })[] | null>(null);
  const yours = questsForYou();
  const drawn = useRef<{ p: Promise<void>; done: () => void } | null>(null);
  if (!drawn.current) {
    let done!: () => void;
    drawn.current = { p: new Promise<void>((r) => (done = r)), done };
  }
  useEffect(() => {
    if (xp === undefined) return;
    if (yours === false || (!counted && !day)) {
      setMoves([]);
      return;
    }
    let live = true;
    const give = (m: (QuestMoved & { moved?: boolean })[]) => live && setMoves((was) => was ?? m);
    // (A day's box: every quest, a game with no XP too, none of them moved then.)
    void (day ? questRowsBy(counted ? xp : null) : questsMovedBy(xp!)).then(give);
    const t = setTimeout(() => give([]), FX.questWaitMs);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [xp]);
  // (The rows are drawn: the sequence's quests can go.)
  useLayoutEffect(() => {
    if (moves) drawn.current!.done();
  }, [moves]);
  // (Ready once the quests' answer is in too (at most FX.questWaitMs): their rows are the one box that takes its size late (Eric, Nov 26:
  // no empty rows kept), so the stack settles before anything counts, never while a bar fills.)
  const ready = xp !== undefined && moves !== null && (!rp || rp.change !== undefined);
  const xpP = xpPlan(xp, waited);
  const rpP = rp ? rpPlan(rp.change ?? null, rp.now) : null;
  const steps: Step[] = [...(rpP ? [{ plan: rpP, slot: rpSlotRef, refs: rpRefs }] : []), { plan: xpP, slot: xpSlot, refs: xpRefs }];
  const [ended, setEnded] = useState(false);
  useEndSequence({
    ready,
    already: !!already.current,
    steps,
    coins,
    quests: qBox,
    questsIn: () => drawn.current!.p,
    root,
    onLevel: () => setHopAt(Date.now()),
    onEmblem: setEmblem,
    onStart: () => {
      if (xp) markXpFilled(xp);
    },
    onDone: () => setEnded(true),
  });
  const why = xp === undefined ? null : xp === null ? none : xp.none ? XP_NONE_LINES[xp.none] : null;
  const parts = xp === undefined ? "Counting your XP…" : counted ? xpShownParts(xp.parts).map((p) => (p.xp === null ? p.label : `${p.label} +${fmt(p.xp)}`)).join(" · ") : "";
  const rpWhy = rp && rp.change === undefined ? null : rpP?.still ? (rp!.change?.placed ? "Placed!" : rpP.label(0)) : null;
  // (The RP slot only for a rank that counts RP: decided as the screen first draws, from the change if it's here, else your rank now. A
  // placement game or a top tier has only its card, which says where you are (Nov 25: no "Placement 1/5" line over the same card).)
  const [rpSlot] = useState(() => !!rp && !(rp.change === undefined ? !rp.now || !!rp.now.placement || rp.now.division === null : rpPlan(rp.change, rp.now).still));
  const questLine = yours === false ? "Sign in to do quests." : xp === undefined || ((counted || day) && !moves) ? "Checking your quests…" : day ? "No quests right now." : "No quests this game.";
  return (
    <div class="es-rewards" ref={root} data-es="wait" data-testid="es-rewards">
      {rpP && (
        <>
          {rpSlot && <EarnedSlot kind="rp" slot={rpSlotRef} down={rpP.earned < 0} why={rpWhy} parts={rp!.change === undefined ? "Updating your rank…" : ""} games={!!rpP.games} />}
          <Track plan={rpP} refs={rpRefs} emblem={emblem} />
        </>
      )}
      <EarnedSlot kind="xp" slot={xpSlot} down={false} why={why} parts={parts} />
      {middle?.(hopAt)}
      <Track plan={xpP} refs={xpRefs} />
      <CoinStrip xp={xp} none={none} api={coins} />
      <QuestRows moves={moves} box={qBox} line={questLine} day={day} />
      {/* (What the bars and rows don't show, once the sequence has ended: a level's or the daily reward's crates and keys.) */}
      {ended && counted && xp!.rewards && <RewardBox xp={xp!} endScreen />}
    </div>
  );
}
