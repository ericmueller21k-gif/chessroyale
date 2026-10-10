import type { ComponentChildren } from "preact";
import { BOSS_POWERS, type PowerEventKind } from "@chessroyale/core";
import { powerFxMs, powerMomentMs } from "@chessroyale/chess";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { cueAt } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { BossMoment } from "./BossEffect.tsx";
import { BOINGO_UI } from "./Boingo.tsx";
import { BIGBOY_UI } from "./BigBoy.tsx";
import { GINGER_UI } from "./Ginger.tsx";
import { GREX_UI } from "./Grex.tsx";
import { HOLLOW_UI } from "./Hollow.tsx";
import { PowerBanner, kitLine, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Boss powers on screen: what every player sees, from the battle's shared state (NetBoss.powers), so online everyone
 * sees the same ice, the same pie and the same moment at the same time. Each boss's own beats, moments and board layer
 * are in its file (Ginger.tsx, Boingo.tsx, Grex.tsx, Hollow.tsx, BigBoy.tsx, on the shapes in PowerParts.tsx); this
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
export { FREEZE, BLIZZARD } from "./Ginger.tsx";
export { PIE, FUNHOUSE, FUNHOUSE_LINES, funhouseBeat, funhouseFlipAt, funhouseLine } from "./Boingo.tsx";
export { BURN, CANDLE, CandlePips, FIREBALL, FireBurn, SPARK, candleShotPath, candleShotTimes, fireCountdown, fireballLandAt, shadowItems, shadowsAt } from "./Grex.tsx";
export { DARK, DarkCost, HOLLOW_CASTER, hollowCastFrom } from "./Hollow.tsx";
export { PowerBanner, type Moment } from "./PowerParts.tsx";

/** Every boss with powers on screen, by its BOSS_ROSTER id. */
const BOSS_UI: ReadonlyMap<string, BossUi> = new Map(([GINGER_UI, BOINGO_UI, GREX_UI, HOLLOW_UI, BIGBOY_UI] as BossUi[]).map((u) => [u.id, u]));
const bossUi = (boss: Pick<BossView, "id"> | null | undefined): BossUi | null => (boss?.id ? (BOSS_UI.get(boss.id) ?? null) : null);

/** The rage warning, the same for every boss: the meter full, its ultimate coming. */
const WARN: MomentUi = {
  order: 1,
  kit: "ultimateWarn",
  dock: "Rage!",
  view: ({ boss, t, banner, cast }: MomentProps) => {
    const ui = bossUi(boss);
    const when = ui?.ultimate.when ?? "Next turn";
    return (
      <div class="power-moment pm-warn">
        {t < 1600 && banner("RAGE!", `${when}: ${ui?.ultimate.name ?? "its ultimate"}`, "rage")}
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
  const list = p.events.filter((e) => (only ? e.kind === only : !MOMENT_UI[e.kind].own)).sort((a, b) => MOMENT_UI[a.kind].order - MOMENT_UI[b.kind].order);
  let t = until - powerMomentMs(list);
  return list.map((e) => {
    const m: Moment = { kind: e.kind, key: `${boss.id}:${e.kind}:${e.turn}`, at: t, ms: powerFxMs(e), ...(e.square ? { square: e.square } : {}), ...(e.squares ? { squares: e.squares } : {}), ...(e.fizzled ? { fizzled: e.fizzled } : {}), ...(e.first ? { first: true as const } : {}) };
    t += m.ms;
    return m;
  });
}

/** The moment playing at `now`, if any. */
export const momentAt = (moments: readonly Moment[], now: number) => moments.find((m) => now >= m.at && now < m.at + m.ms) ?? null;

/** The board as the crowd sees it: from its own side, or (after Boingo's funhouse) flipped for a couple of turns. */
export function crowdOrientation(boss: Pick<BossView, "powers"> | null | undefined, side: "w" | "b"): "white" | "black" {
  const s = boss?.powers?.flipped ? (side === "w" ? "b" : "w") : side;
  return s === "w" ? "white" : "black";
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
  const layer = bossUi(boss)?.board?.({ boss, p, board, orientation, moments, now, appearAt: (square) => appearAt(square, moments, orientation) }) ?? null;
  return (
    <>
      {layer?.under}
      <div class="power-board" aria-hidden="true">
        {layer?.over}
      </div>
    </>
  );
}

/** The boss's own piece by the boss bar's rage meter (Hollow's bulbs), from the boss screen's moments ending at `until`. */
export function BossBarExtra({ boss, until = 0 }: { boss: BossView; until?: number }) {
  return bossUi(boss)?.bar?.({ boss, moments: () => momentsOf(boss, until) }) ?? null;
}

// ---------------- The moments ----------------

/** The boss's line for a power's moment (its kit's), the same on every screen; null without one. */
export function powerLine(kit: BossKit | null, m: Pick<Moment, "kind" | "key" | "first">): string | null {
  const ui = MOMENT_UI[m.kind];
  return ui.line ? ui.line(kit, m) : kitLine(kit, ui.kit, m.key);
}

/** The dock's line for a power's moment: the boss's line for it, or its word ("Freeze!"). */
export function dockLine(kit: BossKit | null, m: Pick<Moment, "kind" | "key" | "first">): string {
  const ui = MOMENT_UI[m.kind];
  return (!ui.dockWordOnly && powerLine(kit, m)) || ui.dock;
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
  const banner = (text: string, sub?: string, tone = "") => <PowerBanner key={moment.key} boss={boss} side={side} text={text} sub={sub} tone={tone} />;
  /** The boss casting by the board's top-left corner, its animation's `hit` cue landing at `hitAt` (ms into the moment). */
  const cast = (hit: string, hitAt: number) => {
    const anim = kitAnim(kit, moment.kind);
    if (!anim) return null;
    const a = kit!.ch.anims[anim]!;
    const since = moment.at + hitAt - (cueAt(a, hit) ?? 0);
    if (now < since) return null;
    return (
      <span class="pm-caster">
        <BossMoment boss={boss.name} anim={anim} since={since} then="idle" />
      </span>
    );
  };
  return MOMENT_UI[moment.kind].view({ boss, moment, now, t, orientation, side, kit, banner, cast, line: () => powerLine(kit, moment), anim: () => kitAnim(kit, moment.kind) });
}

// ---------------- The rage meter ----------------

/**
 * The boss bar's rage meter: it fills over the battle (faster as the boss loses material or the crowd gets ahead on
 * the judged eval), glows as it nears full, flashes for the one-turn warning, and is gone once the ultimate is spent.
 */
export function RageMeter({ boss }: { boss: BossView }): ComponentChildren {
  const p = boss.powers;
  if (!p || p.rage === null || boss.result) return null;
  // (Warned or unleashed, it's full: the test switch can bring the ultimate before the meter is.)
  const pct = p.warned || p.ultAt !== null ? 100 : Math.round(p.rage * 100);
  const glow = pct >= BOSS_POWERS.rageGlowFrom * 100;
  return (
    <span class={`rage-meter${glow ? " glow" : ""}${p.warned ? " warned" : ""}${p.ultAt !== null ? " now" : ""}`} role="meter" aria-label={`Rage ${pct}%`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} title="Rage: when it's full, the boss's ultimate is coming">
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}
