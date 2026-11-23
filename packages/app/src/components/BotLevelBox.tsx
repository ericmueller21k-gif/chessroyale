import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { BOT_LEVELS, BOT_LOBBY, botLevelMean, botRatingOf, type BotLevelId } from "@chessroyale/core";
import { BOT_NAMES } from "@chessroyale/chess";

const LEVEL_KEY = "hunchess.botLevel";

/** The Bot level last picked on this device (null: none yet, so OK waits for a pick). */
export function chosenBotLevel(): BotLevelId | null {
  try {
    const v = localStorage.getItem(LEVEL_KEY);
    return BOT_LEVELS.some((l) => l.id === v) ? (v as BotLevelId) : null;
  } catch {
    return null;
  }
}

function rememberBotLevel(id: BotLevelId) {
  try {
    localStorage.setItem(LEVEL_KEY, id);
  } catch {
    // Not important.
  }
}

/** A level's real average over the bot names (every bot a solo game can seat), to the nearest 50: what its row says. */
function averageOf(level: number): number {
  const sum = BOT_NAMES.reduce((a, n) => a + botRatingOf(n, BOT_LOBBY, level), 0);
  return Math.round(sum / BOT_NAMES.length / 50) * 50;
}

/**
 * The Bot level box (Eric, Nov 9: "select the average bot MMR … my level … very easy … random … a little kind of okay button that
 * lights up"): over home's dim, in the Quests overlay's shell (its classes). One row per level with its average; OK greyed until a
 * row is picked; OK starts (`onStart` with the bots' level: Settings.botLevel); ✕, Escape or a tap on the dim cancels. The pick is
 * remembered on this device and preselected next time. docs/decisions/2026-11-09-home-modes-bot-level.md.
 */
export function BotLevelBox({ rating, onStart, onClose }: { rating: number | null; onStart: (level: number | "random") => void; onClose: () => void }) {
  const [pick, setPick] = useState<BotLevelId | null>(chosenBotLevel);
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    box.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const rows = useMemo(
    () =>
      BOT_LEVELS.map((l) => {
        const mean = botLevelMean(l.id, rating);
        // (A plain number: "~700" read as minus 700 on a phone, Eric, Nov 9. Random: every bot's level is its own.)
        const about = mean === "random" ? "Mixed" : String(averageOf(mean));
        return { id: l.id, label: l.label, about };
      }),
    [rating],
  );
  const ok = () => {
    if (!pick) return;
    rememberBotLevel(pick);
    onStart(botLevelMean(pick, rating));
  };
  return (
    <div class="qo-back bl-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="qo-card bl-card" role="dialog" aria-modal="true" aria-labelledby="bl-title" tabIndex={-1} ref={box}>
        <button type="button" class="qo-x" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <header class="qo-head">
          <h2 id="bl-title" class="qo-title bl-title">
            Bot level
          </h2>
          <span class="qo-when">Pick the bots' average rating</span>
        </header>
        <div class="bl-rows" role="radiogroup" aria-labelledby="bl-title">
          {rows.map((r) => (
            <button type="button" role="radio" key={r.id} class={`bl-row${pick === r.id ? " on" : ""}`} aria-checked={pick === r.id} data-level={r.id} onClick={() => setPick(r.id)}>
              <strong>{r.label}</strong>
              <span>{r.about}</span>
            </button>
          ))}
        </div>
        <button type="button" class="fd-btn primary qo-ok bl-ok" disabled={!pick} onClick={ok}>
          OK
        </button>
      </div>
    </div>
  );
}
