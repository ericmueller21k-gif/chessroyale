import { SQUADS_LOBBY } from "@chessroyale/core";
import { testSwitchesAllowed } from "./test-switches.ts";

/** Small per-device preferences. */

const ANIM_KEY = "brc.crowdAnim";
const listeners = new Set<() => void>();

/**
 * Settings → Board, "Animations": every pick as a ghost piece on its square (on), or just name tags and only the chosen
 * piece moves (off). Wherever picks show: Crowd, raids, Classic's and Squads' reveals.
 */
export function crowdAnimations(): boolean {
  const q = new URLSearchParams(location.search).get("anim");
  if (q !== null) return q !== "0";
  try {
    return localStorage.getItem(ANIM_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setCrowdAnimations(on: boolean) {
  try {
    localStorage.setItem(ANIM_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

export function onPrefsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const JUMP_NEXT_KEY = "brc.squads.jumpNext";

/**
 * Squads, Relay: "Jump to my next board" (Eric, Oct 14). On: once you've moved, the big board goes to the board you
 * play next turn, to study it while you wait. Off: you stay on your board until the game moves you. Remembered on the
 * device; a device that hasn't set it gets SQUADS_LOBBY.watching.jumpToNext (on).
 */
export function squadsJumpNext(): boolean {
  try {
    const v = localStorage.getItem(JUMP_NEXT_KEY);
    return v === null ? SQUADS_LOBBY.watching.jumpToNext : v === "1";
  } catch {
    return SQUADS_LOBBY.watching.jumpToNext;
  }
}

export function setSquadsJumpNext(on: boolean) {
  try {
    localStorage.setItem(JUMP_NEXT_KEY, on ? "1" : "0");
  } catch {
    // Not important: it lasts until a reload.
  }
  listeners.forEach((l) => l());
}

const TRAIL_KEY = "brc.crowdTrail";

/**
 * Settings → Board, "Motion trail" (with animations on): every new pick flies from its piece's square to where it lands
 * (in Crowd and raids with a short trail), then hands over to the one fixed ghost on that square. Off: picks just pop
 * in place.
 */
export function crowdTrail(): boolean {
  const q = new URLSearchParams(location.search).get("trail");
  if (q !== null) return q !== "0";
  try {
    return localStorage.getItem(TRAIL_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setCrowdTrail(on: boolean) {
  try {
    localStorage.setItem(TRAIL_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

/**
 * Settings → Board, "Board colors" (Eric, Oct 18): the dark squares of every board this device draws. Only this device:
 * it's never sent anywhere, and other players see their own. Remembered in localStorage; the page carries it as
 * `<html data-board-colors>`, and the stylesheet's colors hang off that (styles.css, "Board colors"), so a pick shows at
 * once on every board with nothing redrawn.
 */
export const BOARD_COLORS = ["classic", "green", "gold"] as const;
export type BoardColors = (typeof BOARD_COLORS)[number];

const BOARD_COLORS_KEY = "brc.boardColors";

/** What a stored value means: one of the three; anything else (nothing, junk, a newer build's name) is Classic. */
export function parseBoardColors(stored: unknown): BoardColors {
  return BOARD_COLORS.find((c) => c === stored) ?? "classic";
}

/** (Without storage, a pick lasts as long as the page.) */
let boardColorsMemory: BoardColors | null = null;

export function boardColors(): BoardColors {
  if (boardColorsMemory) return boardColorsMemory;
  try {
    return parseBoardColors(localStorage.getItem(BOARD_COLORS_KEY));
  } catch {
    return "classic";
  }
}

/** Puts the pick on the page (`<html data-board-colors>`). Called once at start-up (main.tsx) and by every pick. */
export function applyBoardColors() {
  if (typeof document === "undefined") return;
  const c = boardColors();
  if (document.documentElement.getAttribute("data-board-colors") !== c) document.documentElement.setAttribute("data-board-colors", c);
}

export function setBoardColors(c: BoardColors) {
  const pick = parseBoardColors(c);
  try {
    localStorage.setItem(BOARD_COLORS_KEY, pick);
    boardColorsMemory = null;
  } catch {
    boardColorsMemory = pick;
  }
  applyBoardColors();
  listeners.forEach((l) => l());
}

const PREMOVES_KEY = "brc.premoves";
const BOARD_MARKS_KEY = "brc.boardMarks";

/**
 * Settings → Board, "Premoves" (chess.com's; on unless switched off): moving ahead while it's the other side's turn
 * (docs/areas/board.md, "Arrows, highlights and premoves"). Per device.
 */
export function premovesOn(): boolean {
  try {
    return localStorage.getItem(PREMOVES_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setPremovesOn(on: boolean) {
  try {
    localStorage.setItem(PREMOVES_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

/**
 * Settings → Board, "Arrows and highlights" (chess.com's right-click arrows and squares, with a mouse; on unless switched
 * off). Per device; what you draw is never sent anywhere.
 */
export function boardMarksOn(): boolean {
  try {
    return localStorage.getItem(BOARD_MARKS_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setBoardMarksOn(on: boolean) {
  try {
    localStorage.setItem(BOARD_MARKS_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

const EVAL_BAR_KEY = "brc.evalBar";
const PRACTICE_KEY = "brc.practice";

/*
 * The testers' options (Settings → Testing, shown to admins; Eric, Oct 15: "The engine moves and eval settings will be
 * phased to an admin only menu for testers"). They count only where the test switches do (an admin, a test server, the
 * dev server: test-switches.ts). For players the eval bar is off and practice mode is off, whatever a device stored.
 */

/**
 * The eval bar (the engine's winning chances, left of the board): for testers, on unless switched off in Settings →
 * Testing (remembered on the device). Every screen that shows it reads this; off, the board takes its room.
 */
export function evalBarOn(): boolean {
  if (!testSwitchesAllowed()) return false;
  try {
    return localStorage.getItem(EVAL_BAR_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setEvalBarOn(on: boolean) {
  try {
    localStorage.setItem(EVAL_BAR_KEY, on ? "1" : "0");
  } catch {
    // Not important: it lasts until a reload.
  }
  listeners.forEach((l) => l());
}

/** Practice mode (unlimited power-ups, the engine's top 3 at any time): for testers, off unless switched on. */
export function practiceOn(): boolean {
  if (!testSwitchesAllowed()) return false;
  try {
    return localStorage.getItem(PRACTICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPracticeOn(on: boolean) {
  try {
    localStorage.setItem(PRACTICE_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

const CHAT_OFF_KEY = "brc.chatOff";
const CHAT_BUBBLES_KEY = "brc.chatBubbles";

/** Quick chat off: nothing shows and nothing can be sent (remembered on the device). */
export function chatOff(): boolean {
  try {
    return localStorage.getItem(CHAT_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setChatOff(off: boolean) {
  try {
    localStorage.setItem(CHAT_OFF_KEY, off ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

/** Phone: the newest message's bubble under the top bar while chat is hidden (on unless switched off). */
export function chatBubbles(): boolean {
  try {
    return localStorage.getItem(CHAT_BUBBLES_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setChatBubbles(on: boolean) {
  try {
    localStorage.setItem(CHAT_BUBBLES_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

/**
 * Phone: the space under the board. One view, remembered on the device, so its buttons can never disagree:
 * - `layout`: the scoreboard and chat side by side (split), or one of them full width (board, chat);
 * - `open`: false folds it to just its header bar (the board takes the room).
 * Showing a layout (a panel full width, or side by side again) always opens it; folding keeps the layout.
 * Without chat (solo, Classic, or chat off) the scoreboard is alone, full width, whatever the layout says.
 */
export type UnderBoardLayout = "split" | "board" | "chat";
export interface UnderBoardView {
  layout: UnderBoardLayout;
  open: boolean;
}

const UNDER_BOARD_VIEW_KEY = "brc.underBoardView";
/** An older build's two settings, one per button (Oct 7, 2026): the layout, and the fold ("0": folded). */
const LEGACY_LAYOUT_KEY = "brc.underBoard";
const LEGACY_OPEN_KEY = "brc.miniTower";

const layoutOf = (v: unknown): UnderBoardLayout => (v === "board" || v === "chat" ? v : "split");
let view: UnderBoardView | null = null;

export function underBoardView(): UnderBoardView {
  if (view) return view;
  view = { layout: "split", open: true };
  try {
    const saved = localStorage.getItem(UNDER_BOARD_VIEW_KEY);
    if (saved) {
      const v = JSON.parse(saved) as Partial<UnderBoardView> | null;
      view = { layout: layoutOf(v?.layout), open: v?.open !== false };
    } else {
      // From an older build: its layout, and its fold, except that a full-width panel opens (folded, it could be
      // a full-height empty box, and in this view a full-width panel is always shown open).
      const layout = layoutOf(localStorage.getItem(LEGACY_LAYOUT_KEY));
      view = { layout, open: layout !== "split" || localStorage.getItem(LEGACY_OPEN_KEY) !== "0" };
      localStorage.setItem(UNDER_BOARD_VIEW_KEY, JSON.stringify(view));
      localStorage.removeItem(LEGACY_LAYOUT_KEY);
      localStorage.removeItem(LEGACY_OPEN_KEY);
    }
  } catch {
    // No storage: the default, kept in memory.
  }
  return view;
}

function saveUnderBoardView(next: UnderBoardView) {
  view = next;
  try {
    localStorage.setItem(UNDER_BOARD_VIEW_KEY, JSON.stringify(next));
  } catch {
    // Not important: it lasts until a reload.
  }
  listeners.forEach((l) => l());
}

/** A panel full width, or both side by side: always shown open (bigger means you see what's in it). */
export const showUnderBoard = (layout: UnderBoardLayout) => saveUnderBoardView({ layout, open: true });

/** Folds the space under the board to its header bar, or opens it again, keeping the layout. */
export const foldUnderBoard = (open: boolean) => saveUnderBoardView({ ...underBoardView(), open });
