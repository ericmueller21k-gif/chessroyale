import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { isMuted, onMuteChange, setMuted, unlockAudio } from "../sound.ts";
import { MuteButton } from "./MuteButton.tsx";
import { openReport } from "./Problems.tsx";
import { useMedia } from "./QuickChat.tsx";

/**
 * Resigning and leaving a match, the way chess sites do it (Eric, Oct 13; DECISIONS.md, "Resign: leaving a match in
 * every mode"). In the top line of every match screen, at its right end:
 *   - a phone: a "⋯" button (where the sound button was) opening a small sheet at the foot of the screen: Sound, and
 *     Resign with its flag (Leave before move 1, or once you're out), and under them Report a bug (the feedback sheet:
 *     Problems.tsx). A home for later options.
 *   - a computer (the game's two-column layout): Report a bug, the sound button, then the flag, at the right end of
 *     the title line over the board's column; an admin's testing items sit just before them (Hud.tsx, .match-tools;
 *     Eric, Oct 13).
 * Either way, a second step that says what will happen ("Resign? You'll leave this match and it counts as a loss.")
 * with Cancel and Resign. Nothing dims or covers the board, its moves or the clock meanwhile: the phone's sheet sits
 * at the foot of the screen, the computer's beside the flag (out into the column next to the board). No undo, no draw offers (Eric: not now).
 */

/** What leaving means right now, for the control and its confirm (null: nothing to leave). */
export interface MatchExit {
  /** "resign": the match is on and you're in it (a loss). "leave": before move 1, or once you're out (nothing changes). */
  kind: "resign" | "leave";
  /** The confirm's line: what happens. */
  note: string;
  /** Leaves (after the confirm). */
  go: () => void;
}

/** The game's computer layout (styles.css, "Computer layout"): the flag shows instead of the "⋯". */
export const COMPUTER_LAYOUT = "(min-width: 900px) and (min-height: 600px)";

/** A flag (resign), drawn so it looks the same everywhere (an emoji flag doesn't). */
export function FlagIcon({ size = 18 }: { size?: number }) {
  return (
    <svg class="mm-flag-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5.5 21.5V3.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <path d="M6 4.6c2.4-1.4 4.7-1.3 6.9 0.1s4.4 1.5 6.6 0.2v8.8c-2.2 1.3-4.4 1.2-6.6-0.2S8.4 12 6 13.4z" fill="currentColor" />
    </svg>
  );
}

const title = (e: MatchExit) => (e.kind === "resign" ? "Resign?" : "Leave the match?");
const word = (e: MatchExit) => (e.kind === "resign" ? "Resign" : "Leave");

/** The second step: what happens, Cancel and Resign (or Leave). `place`: at the foot of the screen, or beside the flag. */
export function ConfirmExit({ exit, place, onCancel }: { exit: MatchExit; place: "sheet" | "pop"; onCancel: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  // (Focus on Cancel: Enter or a stray tap never resigns by itself.)
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div class={`mm-confirm mm-${place}`} role="alertdialog" aria-modal="true" aria-labelledby="mm-confirm-title" aria-describedby="mm-confirm-note" onClick={(e) => e.stopPropagation()}>
      {/* (A phone's: the question and what happens in one short paragraph, so it fits under the board and its clocks.) */}
      <p class="mm-confirm-text">
        <strong class="mm-confirm-title" id="mm-confirm-title">
          {exit.kind === "resign" && <FlagIcon size={15} />}
          {title(exit)}
        </strong>{" "}
        <span class="mm-confirm-note" id="mm-confirm-note">
          {exit.note}
        </span>
      </p>
      <div class="mm-confirm-actions">
        <button type="button" class="mm-btn" ref={cancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          class="mm-btn mm-go"
          onClick={() => {
            onCancel();
            exit.go();
          }}
        >
          {exit.kind === "resign" && <FlagIcon size={15} />}
          {word(exit)}
        </button>
      </div>
    </div>
  );
}

/** Sound on or off, as a row of the phone's sheet (the same switch as the sound button). */
function SoundRow() {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMuteChange(() => setM(isMuted())), []);
  return (
    <button
      type="button"
      class="mm-row"
      role="switch"
      aria-checked={!m}
      onClick={() => {
        unlockAudio();
        setMuted(!m);
      }}
    >
      <span class="mm-row-icon" aria-hidden="true">
        {m ? "🔇" : "🔊"}
      </span>
      <span class="mm-row-label">Sound</span>
      <span class={`mm-switch${m ? "" : " on"}`} aria-hidden="true">
        {m ? "Off" : "On"}
      </span>
    </button>
  );
}

/**
 * What's open: the phone's sheet ("menu"), or the confirm. Kept outside the control: a match screen is drawn afresh
 * when the phase changes (a move's reveal, the next move, a stage break), with a new control in its top line, and a
 * sheet or confirm someone just opened stays open through that rather than vanishing under their thumb.
 */
type Open = null | "menu" | "confirm";
let openNow: Open = null;
const openSeen = new Set<(o: Open) => void>();

function setOpenNow(o: Open) {
  openNow = o;
  for (const f of openSeen) f(o);
}

function useOpen(): [Open, (o: Open) => void] {
  const [open, set] = useState<Open>(openNow);
  useLayoutEffect(() => {
    openSeen.add(set);
    set(openNow);
    return () => {
      openSeen.delete(set);
      // (Gone for good, not drawn again in the next phase: the next match's control starts closed.)
      setTimeout(() => {
        if (!openSeen.size) openNow = null;
      }, 0);
    };
  }, []);
  return [open, setOpenNow];
}

/**
 * The control at the right end of a match screen's top line: on a phone "⋯" and its sheet, on a computer Report a bug,
 * the sound button and the flag (in that order, the flag last). `exit` null: nothing to leave right now.
 */
export function MatchMenu({ exit }: { exit: MatchExit | null }) {
  const computer = useMedia(COMPUTER_LAYOUT);
  const [open, setOpen] = useOpen();
  // (Nothing to leave any more, the sheet asking about it goes; Escape closes it.)
  useEffect(() => {
    if (!exit && open === "confirm") setOpen(null);
  }, [!exit]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [open]);
  if (computer)
    return (
      <span class="mm mm-computer">
        <button
          type="button"
          class="mm-flag mm-report"
          aria-label="Report a bug"
          title="Report a bug"
          aria-haspopup="dialog"
          onClick={() => {
            setOpen(null);
            openReport("bug");
          }}
        >
          <span aria-hidden="true">🐞</span>
        </button>
        <MuteButton />
        {exit && (
          <button
            type="button"
            class={`mm-flag${open ? " on" : ""}`}
            aria-label={exit.kind === "resign" ? "Resign" : "Leave the match"}
            title={exit.kind === "resign" ? "Resign" : "Leave the match"}
            aria-haspopup="dialog"
            aria-expanded={open === "confirm"}
            onClick={() => setOpen(open ? null : "confirm")}
          >
            <FlagIcon />
          </button>
        )}
        {open === "confirm" && exit && (
          <>
            <div class="mm-scrim" onClick={() => setOpen(null)} />
            <ConfirmExit exit={exit} place="pop" onCancel={() => setOpen(null)} />
          </>
        )}
      </span>
    );
  return (
    <span class="mm mm-phone">
      <button type="button" class={`mm-more${open ? " on" : ""}`} aria-label="Match options" aria-haspopup="dialog" aria-expanded={!!open} onClick={() => setOpen(open ? null : "menu")}>
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div class="mm-scrim" onClick={() => setOpen(null)}>
          {open === "menu" ? (
            // (Sound and Resign side by side, Report a bug under them, so it stays short at the foot of the screen;
            // a tap anywhere else, or "⋯" again, closes it.)
            <div class={`mm-sheet${exit ? "" : " one"}`} role="dialog" aria-label="Match options" onClick={(e) => e.stopPropagation()}>
              <SoundRow />
              {exit && (
                <button type="button" class="mm-row mm-exit" onClick={() => setOpen("confirm")}>
                  <span class="mm-row-icon" aria-hidden="true">
                    <FlagIcon />
                  </span>
                  <span class="mm-row-label">{exit.kind === "resign" ? "Resign" : "Leave the match"}</span>
                </button>
              )}
              <button
                type="button"
                class="mm-row mm-wide"
                onClick={() => {
                  setOpen(null);
                  openReport("bug");
                }}
              >
                <span class="mm-row-icon" aria-hidden="true">
                  🐞
                </span>
                <span class="mm-row-label">Report a bug</span>
              </button>
            </div>
          ) : (
            exit && <ConfirmExit exit={exit} place="sheet" onCancel={() => setOpen(null)} />
          )}
        </div>
      )}
    </span>
  );
}
