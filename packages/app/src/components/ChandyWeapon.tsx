/**
 * Chandy's weapon screen (Eric, Nov 18: "Make it so when you tap chandy a weapon screen comes up that shows his gun and which upgrade
 * he has (same themed container for what we use for his upgrades)"; docs/decisions/2026-11-18-chandy-weapon-screen.md).
 *
 * A tap on his figure (his phone bar, or beside the board on a computer) opens it, in his upgrade window's container (`.ch-upgrade`'s
 * look, still): his rifle as it is now (its stage's drawing), its part and "n/5", his five moves in one fixed order with the ones he
 * has lit and the rest greyed (nothing hidden), his move meter, and a line on how he upgrades. ✕, Escape or a tap outside it closes it.
 *
 * It's a look, not a pause: it never touches the match (the clock runs). It opens only on the crowd's turn, and closes itself as soon
 * as anything moves (a move lands, his turn begins: his upgrade window, his meter's moves, Dodge), so it never covers what he does; a
 * tap during his turn does nothing. One state for the whole app (`opened`), so a screen drawn again keeps it, and only the placement on
 * screen (the phone's bar, the computer's side) draws it.
 */
import { createPortal } from "preact/compat";
import { useEffect, useLayoutEffect, useReducer, useRef } from "preact/hooks";
import { BOSS_POWERS, CHANDY_MOVES, type ChandyMove } from "@chessroyale/core";
import type { ChandyView } from "@chessroyale/chess";
import { CHANDY_RIFLE, RIFLE_STAGES, type RifleStage } from "../characters/chandy.ts";
import { spriteCanvas } from "../characters/sprite-kit.ts";
import type { GameView } from "../game.ts";
import { CHANDY_MOVE_NAMES, chandyOf } from "./Chandy.tsx";
import { onComputer } from "./PowerParts.tsx";

export interface WeaponView {
  /** The rifle's stage as drawn (its upgrades, 0 to 5). */
  stage: RifleStage;
  /** "Big scope 2/5". */
  label: string;
  /** His five moves, always in the same order: `on` once unlocked. */
  moves: { id: ChandyMove; name: string; what: string; on: boolean }[];
  /** The move meter, 0 to 100; null before his first upgrade (greyed). */
  meter: number | null;
  note: string;
}

const S = BOSS_POWERS.chandy;
/** What each move does, in a few words (the FAQ has the rest). */
const MOVE_WHAT: Record<ChandyMove, string> = {
  scatter: `${S.scatterSquares} squares blocked`,
  beam: "A rank and a file held",
  shields: `${S.shieldCount} of his pieces shielded`,
  rapidfire: `${S.rapidCount} of yours can't move`,
  queenlock: "He fires down her file",
};

/** What the screen shows, from his view (pure). */
export function weaponView(c: Pick<ChandyView, "upgrades" | "unlocked" | "meter">, max = S.upgradesMax): WeaponView {
  const n = Math.max(0, Math.min(max, c.upgrades));
  const stage = Math.min(5, n) as RifleStage;
  return {
    stage,
    label: `${RIFLE_STAGES[stage]} ${n}/${max}`,
    moves: CHANDY_MOVES.map((id) => ({ id, name: CHANDY_MOVE_NAMES[id], what: MOVE_WHAT[id], on: c.unlocked.includes(id) })),
    meter: c.meter === null ? null : Math.round(Math.max(0, Math.min(1, c.meter)) * 100),
    note: n >= max ? "Fully upgraded." : "Each locked piece he takes upgrades his rifle and unlocks a move.",
  };
}

/**
 * When the screen may be open: the crowd's turn in a battle with him still on, no Dodge. The key changes with every move (and every new
 * battle), so an open screen closes itself as one lands; null: it can't open now.
 */
export function lookKey(match: Pick<GameView, "boss" | "phase">): string | null {
  const boss = match.boss;
  const c = chandyOf(boss);
  const k = match.phase.kind;
  if (!boss || !c || boss.result || c.dodge || (k !== "play" && k !== "scoring" && k !== "watching")) return null;
  return `${boss.startMove}:${boss.board.history.length}:${boss.crowdMoves}:${boss.powers?.turn ?? 0}`;
}

/** The key it was opened under (lookKey), or null: shut. */
let opened: string | null = null;
const listeners = new Set<() => void>();
const setOpened = (key: string | null) => {
  opened = key;
  for (const f of listeners) f();
};

/** The tap target over his figure (`place`: where it stands), and the screen when it's open there. */
export function ChandyLook({ match, place }: { match: GameView; place: "bar" | "side" }) {
  const [, redraw] = useReducer((n: number, _: unknown) => n + 1, 0);
  useEffect(() => {
    const f = () => redraw(undefined);
    listeners.add(f);
    const off = match.subscribe(f);
    return () => {
      listeners.delete(f);
      off();
    };
  }, [match]);
  const key = lookKey(match);
  // (Anything moved since it opened: shut, so a later key can't match an old one.)
  if (opened !== null && opened !== key) opened = null;
  const open = key !== null && opened === key;
  // (Both placements are drawn, one hidden by the layout: only the one on screen draws the screen.)
  const here = onComputer() ? place === "side" : place === "bar";
  const c = chandyOf(match.boss);
  return (
    <>
      <button type="button" class="ch-look-tap" aria-label="Chandy's rifle" aria-haspopup="dialog" aria-disabled={key === null} onClick={() => key !== null && setOpened(key)} />
      {open && here && c && typeof document !== "undefined" && createPortal(<ChandyWeapon view={weaponView(c)} onClose={() => setOpened(null)} />, document.body)}
    </>
  );
}

/** The screen itself, over a light dim: a tap on the dim, its ✕ or Escape closes it. */
export function ChandyWeapon({ view, onClose }: { view: WeaponView; onClose: () => void }) {
  const art = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const cv = art.current;
    if (!cv) return;
    const src = spriteCanvas(CHANDY_RIFLE, `stage${view.stage}`, 0);
    cv.width = src.width;
    cv.height = src.height;
    cv.getContext("2d")?.drawImage(src, 0, 0);
  }, [view.stage]);
  // (A layout effect: Escape closes it from its first frame.)
  useLayoutEffect(() => {
    box.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div class="ch-look-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="ch-weapon" role="dialog" aria-modal="true" aria-labelledby="ch-weapon-title" tabIndex={-1} ref={box} data-stage={view.stage}>
        <button type="button" class="ch-weapon-x" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="square" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div class="ch-up-title" id="ch-weapon-title">
          RIFLE
        </div>
        <div class="ch-up-art">
          <canvas ref={art} aria-hidden="true" />
        </div>
        <div class="ch-up-label">{view.label.toUpperCase()}</div>
        <ul class="ch-weapon-moves" aria-label="His moves">
          {view.moves.map((m) => (
            <li key={m.id} class={m.on ? "on" : ""} data-move={m.id}>
              <i aria-hidden="true" />
              <span class="ch-wm-name">{m.name}</span>
              <span class="ch-wm-what">{m.on ? m.what : "Locked"}</span>
            </li>
          ))}
        </ul>
        <div class={`ch-weapon-meter${view.meter === null ? " ch-off" : ""}`}>
          <span>{view.meter === null ? "Move meter: at his first upgrade" : `Move meter ${view.meter}%`}</span>
          <span class="ch-meter" role="meter" aria-label="Move meter" aria-valuenow={view.meter ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${view.meter ?? 0}%` }} />
          </span>
        </div>
        <div class="ch-up-note">{view.note}</div>
      </div>
    </div>
  );
}
