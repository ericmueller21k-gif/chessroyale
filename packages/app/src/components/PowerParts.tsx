import type { ComponentChildren, JSX } from "preact";
import type { PowerEventKind } from "@chessroyale/core";
import type { BossKit } from "../characters/kits.ts";
import type { BossView } from "../game.ts";
import { BossFace } from "./BossCharacter.tsx";
import { BossEffect, type BoardItem } from "./BossEffect.tsx";
import { GodKingPortrait, squareXY } from "./GodKing.tsx";

/**
 * The pieces every boss's powers on screen are built from, and the shape each boss's screen file fills in (BossUi):
 * its moments (a banner, the boss casting, the effect) and its layer over the board. Each boss's file
 * (components/<Boss>.tsx) uses these; BossPowers.tsx puts them together (and is what the screens import).
 */

/** One power's moment on screen: when it starts (ms, wall clock) and how long it takes. */
export interface Moment {
  kind: PowerEventKind;
  key: string;
  at: number;
  ms: number;
  square?: string;
  /** A wave of fireballs: their squares, in the order they land; those that fizzled (the crowd's king stood there). */
  squares?: string[];
  fizzled?: string[];
  /** Hollow's first cover of the dark. */
  first?: true;
}

/** Which of a boss kit's moments a power's moment is (its animation and lines: characters/power-art.ts). */
export type KitMoment = "power" | "ultimateWarn" | "ultimate" | "ultimateHit";

/** What a moment's view gets: the moment, the clock, and the helpers every moment uses. */
export interface MomentProps {
  boss: BossView;
  moment: Moment;
  now: number;
  /** ms into the moment. */
  t: number;
  orientation: "white" | "black";
  side: "w" | "b";
  kit: BossKit | null;
  /** The power's banner (the God King's cut-in style). */
  banner: (text: string, sub?: string, tone?: string) => JSX.Element;
  /** The boss casting by the board's top-left corner, its animation's `hit` cue landing at `hitAt` (ms into the moment). */
  cast: (hit: string, hitAt: number) => JSX.Element | null;
  /** The boss's line for this moment (its kit's), the same on every screen; null without one. */
  line: () => string | null;
  /** The boss's animation for this moment, from its kit (e.g. freezeCast, pieThrow, check, blizzard, funhouse); null without one. */
  anim: () => string | null;
}

/** One kind of power moment on screen (a freeze, the warning, a wave of fireballs…). */
export interface MomentUi {
  /** Its place when several play in one turn (passives first, then the warning, then ultimates). */
  order: number;
  /** Which of the kit's moments it is. */
  kit: KitMoment;
  /** The dock's word for it when the boss has no line for it ("Freeze!"). */
  dock: string;
  /** The dock keeps to its word even when the boss has a line (Hollow's cover: his words are in his text box). */
  dockWordOnly?: boolean;
  /** When what it puts on a square appears there (ms, wall clock); undefined: it puts nothing on that square. */
  appearAt?: (m: Moment, square: string, orientation: "white" | "black") => number | undefined;
  /** It plays on a screen of its own (the funhouse, his extra move, the Big Bounce) when this says so. */
  own?: (boss: BossView) => boolean;
  /** Its line, when the kit's lines for its moment aren't the whole story (Hollow's first cover of the dark). */
  line?: (kit: BossKit | null, m: Pick<Moment, "kind" | "key" | "first">) => string | null;
  /** What it shows over the board (called as a function by PowerMoment, so the board's elements stay as they were). */
  view: (p: MomentProps) => ComponentChildren;
}

/** What a boss's layer over the board gets. */
export interface BoardLayerProps {
  boss: BossView;
  p: NonNullable<BossView["powers"]>;
  /** The position the board shows. */
  board: string;
  orientation: "white" | "black";
  moments: readonly Moment[];
  now: number;
  /** When a square's ice, pie, fire… appears during a moment (ms, wall clock); 0: it's simply there. */
  appearAt: (square: string) => number;
}

/** A boss's powers on screen: its moments by kind, its ultimate's name, and its layer over the board. */
export interface BossUi {
  /** Its BOSS_ROSTER id. */
  id: string;
  moments: Partial<Record<PowerEventKind, MomentUi>>;
  /** Its ultimate, as the rage warning names it, and when the warning says it comes ("Next turn" unless given). */
  ultimate: { name: string; when?: string };
  /** Its own piece by the boss bar's rage meter (Hollow's bulbs); `moments`: the boss screen's moments now. */
  bar?: (p: { boss: BossView; moments: () => Moment[] }) => ComponentChildren;
  /** Its layer over the board (PowerBoard): `under` goes beneath the board's power layer, `over` inside it. */
  board?: (p: BoardLayerProps) => { under?: ComponentChildren; over: ComponentChildren };
}

export const at = (square: string, orientation: "white" | "black") => {
  const { x, y } = squareXY(square, orientation);
  return { left: `${(x - 50) / 8}%`, top: `${(y - 50) / 8}%` };
};
/** A square's column and row on chessground's own board (eighths of --cg-size: exactly on it at any size). */
export const onSquare = (square: string, orientation: "white" | "black") => {
  const { x, y } = squareXY(square, orientation);
  return { "--sq-x": String((x - 50) / 100), "--sq-y": String((y - 50) / 100) };
};

/**
 * When each fire tile's current stage began on this device (the first time it was seen at it): the step up (spread2,
 * spread3) plays from then. A screen drawn again carries on; it doesn't start over.
 */
const stageSeen = new Map<string, number>();
export function stageSince(key: string, now: number): number {
  let t = stageSeen.get(key);
  if (t === undefined) {
    t = now;
    stageSeen.set(key, t);
    if (stageSeen.size > 200) stageSeen.delete(stageSeen.keys().next().value!);
  }
  return t;
}

export const PIECE_WORD: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** A small, stable hash, for picking a line the same everywhere. */
export const hash = (s: string) => [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** A line from a boss kit's lines for one of its moments, picked by the moment's key (the same everywhere); null without one. */
export function kitLine(kit: BossKit | null, moment: KitMoment, key: string): string | null {
  const lines = (kit?.lines as Partial<Record<string, readonly string[]>> | undefined)?.[moment];
  return lines?.length ? lines[hash(key) % lines.length]! : null;
}

/**
 * Something flying from the boss's corner of the board (its top-left) to a square: the ice bolt (pointed at its
 * target) or the pie (tumbling), over `ms`.
 */
export function Flight({ name, anim, square, orientation, since, ms, aim = false, from: fromPct }: { name: "iceBolt" | "pieFly" | "sparkFly" | "darkPour" | "blockFly"; anim?: string; square: string; orientation: "white" | "black"; since: number; ms: number; aim?: boolean; from?: { x: number; y: number } }) {
  const { x, y } = squareXY(square, orientation);
  // (From the boss's corner of the board; Hollow's darkness from the void in his chest, given in % of the board.)
  const from = fromPct ? { x: fromPct.x * 8, y: fromPct.y * 8 } : { x: 60, y: 30 };
  const angle = (Math.atan2(y - from.y, x - from.x) * 180) / Math.PI;
  const style: Record<string, string> = {
    left: `${(from.x - 50) / 8}%`,
    top: `${(from.y - 50) / 8}%`,
    "--fx": `${(x - 50) / 8}%`,
    "--fy": `${(y - 50) / 8}%`,
    animationDuration: `${ms}ms`,
    animationDelay: `${since - Date.now()}ms`,
    ...(aim ? { rotate: `${angle}deg` } : {}),
  };
  return (
    <span class={`pw-flight ${name}`} style={style}>
      <BossEffect name={name} anim={anim} since={since} />
    </span>
  );
}

/** The power's banner: the God King's cut-in style, the boss on the left and the God King on the right. */
export function PowerBanner({ boss, side, text, sub, tone = "" }: { boss: BossView; side: "w" | "b"; text: string; sub?: string; tone?: string }) {
  return (
    <div class={`fight-banner king-cut power-cut ${tone}`} role="alert" aria-label={sub ? `${boss.name}: ${text} ${sub}` : `${boss.name}: ${text}`}>
      <div class="fb-flash" />
      <div class="fb-band">
        <div class="fb-lines" />
        <span class="kc-portrait pc-boss">
          <BossFace boss={boss} />
        </span>
        <span class="fb-words kc-words">
          <span class="kc-label">{boss.name.replace(/^The /, "")}</span>
          <span class="fb-text kc-text">{text}</span>
          {sub && <span class="fb-sub">{sub}</span>}
        </span>
        <span class="kc-target pc-king">
          <GodKingPortrait side={side} />
        </span>
      </div>
    </div>
  );
}

export type { BoardItem };
