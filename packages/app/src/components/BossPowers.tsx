import type { ComponentChildren } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";
import { BoardTurn, type QuarterTurn } from "../board-view.ts";
import { BOSS_BANNER, BOSS_POWERS, type PowerEventKind } from "@chessroyale/core";
import { powerFxMs, powerMomentMs } from "@chessroyale/chess";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { cueAt } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { BossMoment } from "./BossEffect.tsx";
import { BOINGO_UI, angleView } from "./Boingo.tsx";
import { BIGBOY_UI } from "./BigBoy.tsx";
import { GINGER_UI } from "./Ginger.tsx";
import { GREX_UI } from "./Grex.tsx";
import { HOLLOW_UI } from "./Hollow.tsx";
import { SAWYER_UI } from "./Sawyer.tsx";
import { PIG_UI } from "./Pig.tsx";
import { RECLUSE_UI } from "./Recluse.tsx";
import { ALFIL_UI } from "./Alfil.tsx";
import { HOPPER_UI } from "./Hopper.tsx";
import { PowerBanner, kitLine, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";
import { CRITICAL, NORMAL, bossVoice, type Priority } from "../speech.tsx";
import { useFrameNow } from "./Countdown.tsx";

/**
 * Boss powers on screen: what every player sees, from the battle's shared state (NetBoss.powers), so online everyone
 * sees the same ice, the same pie and the same moment at the same time. Each boss's own beats, moments and board layer
 * are in its file (Ginger.tsx, Boingo.tsx, Grex.tsx, Hollow.tsx, BigBoy.tsx, Sawyer.tsx, Pig.tsx, on the shapes in PowerParts.tsx); this
 * puts them together:
 *
 * - The board layer (PowerBoard): the boss's own layer (ice, the pie, fire, the dark, a toy block), drawn over the
 *   pieces, never taking a tap.
 * - The moments (momentsOf / PowerMoment): as the turn passes to the crowd, after the boss's move shows, each power
 *   that came with it plays in turn, in the God King's banner style (the boss on the left, the moment in the middle,
 *   the God King on the right), with its board effect. The crowd's clock starts after them.
 * - The rage meter (RageMeter) in the boss bar: it fills over the battle (faster as the boss loses material or the
 *   crowd gets ahead), glows as it nears full, flashes for the one-turn warning, and is gone once the ultimate is spent.
 */

// Each boss's file, for the screens.
export { FREEZE, BLIZZARD, THAW, MELT_MS, prewarmGinger, thawLine, thawOver } from "./Ginger.tsx";
export { PIE, FUNHOUSE, FUNHOUSE_LINES, SPIN, angleView, funhouseFlipAt, funhouseLine, funhouseView, spinOf } from "./Boingo.tsx";
export { BURN, CANDLE, CandlePips, FIREBALL, FireBurn, SPARK, candleShotPath, candleShotTimes, fireCountdown, fireballLandAt, shadowItems, shadowsAt } from "./Grex.tsx";
export { DARK, DarkCost, HOLLOW_CASTER, hollowCastFrom } from "./Hollow.tsx";
export { PowerBanner, type Moment } from "./PowerParts.tsx";

/** Every boss with powers on screen, by its BOSS_ROSTER id. */
const BOSS_UI: ReadonlyMap<string, BossUi> = new Map(([GINGER_UI, BOINGO_UI, GREX_UI, HOLLOW_UI, BIGBOY_UI, SAWYER_UI, PIG_UI, RECLUSE_UI, ALFIL_UI, HOPPER_UI] as BossUi[]).map((u) => [u.id, u]));
const bossUi = (boss: Pick<BossView, "id"> | null | undefined): BossUi | null => (boss?.id ? (BOSS_UI.get(boss.id) ?? null) : null);

/** The rage warning, the same for every boss: the meter full, its ultimate coming. */
export const WARN: MomentUi = {
  order: 1,
  kit: "ultimateWarn",
  view: ({ boss, t, banner, cast }: MomentProps) => {
    const ui = bossUi(boss);
    const when = ui?.ultimate.when ?? "Next turn";
    return (
      <div class="power-moment pm-warn">
        {banner("RAGE!", `${when}: ${ui?.ultimate.name ?? "its ultimate"}`, "rage")}
        {cast("", 0)}
      </div>
    );
  },
};

/** Every kind of power moment, from the bosses' files: a power without one doesn't compile. */
const MOMENT_UI: Record<PowerEventKind, MomentUi> = {
  warn: WARN,
  ...GINGER_UI.moments,
  ...BOINGO_UI.moments,
  ...GREX_UI.moments,
  ...HOLLOW_UI.moments,
  ...BIGBOY_UI.moments,
  ...SAWYER_UI.moments,
  ...PIG_UI.moments,
  ...RECLUSE_UI.moments,
  ...ALFIL_UI.moments,
  ...HOPPER_UI.moments,
};

/** The moments that play on a screen of their own, in the order they're looked for. */
const OWN = (Object.keys(MOMENT_UI) as PowerEventKind[]).filter((k) => MOMENT_UI[k].own);

/**
 * The moments a boss screen plays, ending at `until` (the screen's end: the crowd's clock starts then), one after
 * another. The funhouse has a screen of its own (after the move he plays for the crowd); so do Hollow's extra move and
 * Big Boy's Big Bounce; the rest come after the boss's move, as the turn passes to the crowd.
 */
export function momentsOf(boss: BossView, until: number): Moment[] {
  const p = boss.powers;
  if (!p || !until || !p.events.length) return [];
  const only = OWN.find((k) => MOMENT_UI[k].own!(boss)) ?? null;
  // (A moment this app doesn't know, from a newer server, is passed over rather than read: Oct 17, Alfil's.)
  const list = p.events.filter((e) => MOMENT_UI[e.kind] && (only ? e.kind === only : !MOMENT_UI[e.kind].own)).sort((a, b) => MOMENT_UI[a.kind].order - MOMENT_UI[b.kind].order);
  let t = until - powerMomentMs(list);
  return list.map((e) => {
    const m: Moment = { kind: e.kind, key: `${boss.id}:${e.kind}:${e.turn}`, at: t, ms: powerFxMs(e), ...(e.square ? { square: e.square } : {}), ...(e.squares ? { squares: e.squares } : {}), ...(e.fizzled ? { fizzled: e.fizzled } : {}), ...(e.first ? { first: true as const } : {}), ...(e.pick !== undefined ? { pick: e.pick } : {}), ...(e.ult ? { ult: true as const } : {}) };
    t += m.ms;
    return m;
  });
}

/** The dock's line for the boss's turn when it brought no move to show (BossUi.noMove: Alfil's fusion); null otherwise. */
export const noMoveLine = (boss: BossView): string | null => bossUi(boss)?.noMove?.(boss) ?? null;

/** The moment playing at `now`, if any. */
export const momentAt = (moments: readonly Moment[], now: number) => moments.find((m) => now >= m.at && now < m.at + m.ms) ?? null;

/**
 * The board as the crowd sees it: from its own side, or (in Boingo's funhouse) turned: upside down (the other side's
 * orientation), or a quarter turn either way (Board's `turn`). Older servers send only `flipped`.
 */
export function crowdView(boss: Pick<BossView, "powers"> | null | undefined, side: "w" | "b"): { orientation: "white" | "black"; turn: QuarterTurn } {
  const p = boss?.powers;
  return angleView(p?.angle ?? (p?.flipped ? 180 : 0), side);
}


// ---------------- The board layer ----------------

/** When a square's ice, pie or fire appears during a moment (ms, wall clock); 0: it's simply there. */
function appearAt(square: string, moments: readonly Moment[], orientation: "white" | "black"): number {
  for (const m of moments) {
    const t = MOMENT_UI[m.kind].appearAt?.(m, square, orientation);
    if (t !== undefined) return t;
  }
  return 0;
}

/** The boss's powers over the board (its own layer: BossUi.board), under any banner; never takes a tap. */
export function PowerBoard({ boss, orientation, moments = [], now = Date.now(), fen }: { boss: BossView; orientation: "white" | "black"; moments?: readonly Moment[]; now?: number; fen?: string }) {
  const p = boss.powers;
  if (!p) return null;
  const board = fen ?? boss.board.fen;
  const turn = useContext(BoardTurn);
  const layer = bossUi(boss)?.board?.({ boss, p, board, orientation, turn, moments, now, appearAt: (square) => appearAt(square, moments, orientation) }) ?? null;
  return (
    <>
      {layer?.under}
      <div class="power-board" aria-hidden="true">
        {layer?.over}
      </div>
    </>
  );
}

/**
 * The boss's own piece by the boss bar's rage meter (Hollow's bulbs), from the boss screen's moments ending at `until`.
 * Through the boss's turn on its screen it draws itself every frame (the strip relights as his darkness lands): the
 * header around it draws only now and then (useStillKey).
 */
export function BossBarExtra({ boss, until = 0 }: { boss: BossView; until?: number }) {
  const bar = bossUi(boss)?.bar;
  useFrameNow(!!bar && !!until);
  return bar?.({ boss, moments: () => momentsOf(boss, until) }) ?? null;
}

// ---------------- The moments ----------------

/** The boss's line for a power's moment (its kit's), the same on every screen; null without one. */
export function powerLine(kit: BossKit | null, m: Pick<Moment, "kind" | "key" | "first" | "pick" | "ult">): string | null {
  const ui = MOMENT_UI[m.kind];
  return ui.line ? ui.line(kit, m) : kitLine(kit, ui.kit, m.key);
}

/**
 * What a power's moment means for you, for the dock, where no banner says it; null otherwise (the dock keeps the turn's
 * own line). The banner names the power; the boss's bubble is his character.
 */
export function dockLine(m: Pick<Moment, "kind" | "squares" | "fizzled">): string | null {
  return MOMENT_UI[m.kind].dock?.(m) ?? null;
}

/** When the boss says a moment's line (ms into it). */
export const momentLineAt = (m: Pick<Moment, "kind">): number => MOMENT_UI[m.kind].lineAt ?? 0;

/** How much a moment's line matters: an ultimate's cuts in on another line; a passive's or the warning's waits its turn. */
export function momentPriority(m: Pick<Moment, "kind" | "first">): Priority {
  const ui = MOMENT_UI[m.kind];
  return ui.priority?.(m) ?? (ui.kit === "ultimate" ? CRITICAL : NORMAL);
}

/**
 * Every power moment's line, said into the boss's voice as the moment reaches it (each kind's `lineAt`): its text box
 * shows it for its time and in turn (speech.tsx), through the rest of the boss's turn and into the crowd's, on every
 * screen. The one place a boss's power lines are said, so a new boss's are too.
 */
export function useMomentSpeech(boss: BossView, moments: readonly Moment[], now: number) {
  const due = moments.filter((m) => now >= m.at + momentLineAt(m));
  const last = due.at(-1)?.key;
  useLayoutEffect(() => {
    // (Each moment's line once: the voice ignores a moment said again.)
    // (Its time runs from when this device says it, as a boss's animations do: a busy frame never eats into it.)
    for (const m of due) bossVoice.say(powerLine(bossKit(boss.name), m), `${boss.id}:${boss.startMove}:${m.key}`, momentPriority(m));
  }, [last]);
}

/** The boss's animation for a power's moment, from its kit (e.g. freezeCast, pieThrow, check, blizzard, funhouse). */
const kitAnim = (kit: BossKit | null, kind: PowerEventKind) => {
  const name = kit?.anims[MOMENT_UI[kind].kit];
  return name && kit!.ch.anims[name] ? name : null;
};

/**
 * The moment playing now, over the board: its banner (boss left, moment middle, God King right), the boss stepping up
 * to the board's corner to cast (its kit's moment, timed so its hit lands on the effect), and its effect (each kind's
 * view, from its boss's file). The ice and the pie themselves are the board layer's (PowerBoard), timed to land with
 * the effect.
 */
export function PowerMoment({ boss, moment, now, orientation, side }: { boss: BossView; moment: Moment | null; now: number; orientation: "white" | "black"; side: "w" | "b" }) {
  if (!moment) return null;
  const t = now - moment.at;
  const kit = bossKit(boss.name);
  const banner = (text: string, sub?: string, tone = "", until = Infinity, from = 0) => {
    const ms = Math.min(BOSS_BANNER.ms, until - from);
    return t >= from && t < from + ms ? <PowerBanner key={moment.key} boss={boss} side={side} text={text} sub={sub} tone={tone} ms={ms} /> : null;
  };
  /** The boss casting by the board's top-left corner, its animation's `hit` cue landing at `hitAt` (ms into the moment). */
  const cast = (hit: string, hitAt: number) => {
    const anim = kitAnim(kit, moment.kind);
    if (!anim) return null;
    const a = kit!.ch.anims[anim]!;
    const since = moment.at + hitAt - (cueAt(a, hit) ?? 0);
    if (now < since) return null;
    return (
      <span class={`pm-caster pm-by-${kit!.ch.id}`}>
        <BossMoment boss={boss.name} anim={anim} since={since} then="idle" />
      </span>
    );
  };
  return MOMENT_UI[moment.kind].view({ boss, moment, now, t, orientation, side, kit, banner, cast, anim: () => kitAnim(kit, moment.kind) });
}

// ---------------- The rage meter ----------------

/**
 * The boss bar's rage meter: it fills over the battle (faster as the boss loses material, the crowd gets ahead on the
 * judged eval or the God King strikes the boss), glows as it nears full, flashes for the one-turn warning, is full on
 * the ultimate's turn, then empties and stays empty (dimmed, paused) while the ultimate's effect runs, and fills again
 * for the next one (Eric, Oct 11: several a battle).
 */
export function RageMeter({ boss }: { boss: BossView }): ComponentChildren {
  const p = boss.powers;
  const bar = useRef<HTMLElement>(null);
  const show = !!p && p.rage !== null && !boss.result;
  // (Warned, it's full: the test switch can bring the ultimate before the meter is. Older servers: null once spent.)
  const paused = !!p?.paused;
  const now = !!p && p.ultAt !== null && !paused;
  const pct = !p || !show ? 0 : p.warned || now ? 100 : Math.round((p.rage ?? 0) * 100);
  // The meter only drops when an ultimate empties it: from what this device last showed, it holds a moment (the screen
  // it drops on is a busy first frame: a slide would be half over before it's seen), then slides down on the page's
  // own clock, carried on by whichever screen draws it next, however soon the next turn comes (a screen change or a
  // slow first frame mustn't make it jump).
  const key = `${boss.id}:${boss.startMove}`;
  const t = performance.now();
  const last = show ? meterShown.get(key) : undefined;
  let drain = last?.drain && t - last.drain.start < RAGE_DRAIN.ms ? last.drain : null;
  if (!drain && last && pct < last.pct - 1) drain = { from: last.pct, start: t + RAGE_DRAIN.holdMs };
  if (show) {
    meterShown.set(key, { pct, drain });
    if (meterShown.size > 20) meterShown.delete(meterShown.keys().next().value!);
  }
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || !drain || typeof el.animate !== "function") return;
    const a = el.animate([{ width: `${drain.from}%` }, { width: `${pct}%` }], { duration: RAGE_DRAIN.ms, easing: "ease-in-out", fill: "both" });
    a.startTime = drain.start;
    return () => a.cancel();
  }, [drain?.start, pct, show]);
  if (!show) return null;
  const glow = pct >= BOSS_POWERS.rageGlowFrom * 100;
  return (
    <span
      class={`rage-meter${glow ? " glow" : ""}${p!.warned ? " warned" : ""}${now ? " now" : ""}${paused ? " paused" : ""}`}
      role="meter"
      aria-label={paused ? "Rage: empty while the ultimate lasts" : `Rage ${pct}%`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      title={paused ? "Rage: empty until the boss's ultimate is over" : "Rage: when it's full, the boss's ultimate is coming"}
    >
      {/* (No width transition while it slides down: a transition would override the slide.) */}
      <i ref={bar} style={drain ? { width: `${pct}%`, transition: "none" } : { width: `${pct}%` }} />
    </span>
  );
}

/** As an ultimate comes, the meter stays where it was for `holdMs` from its first showing, then empties over `ms`. */
export const RAGE_DRAIN = { holdMs: 400, ms: 900 } as const;
/** What each battle's meter last showed on this device, and its slide down while one runs (from `start`, page time). */
const meterShown = new Map<string, { pct: number; drain: { from: number; start: number } | null }>();
