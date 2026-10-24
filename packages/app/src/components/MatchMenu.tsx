import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { isMuted, onMuteChange, setMuted, unlockAudio } from "../sound.ts";
import { crowdAnimations, crowdTrail, onPrefsChange, setCrowdAnimations, setCrowdTrail } from "../prefs.ts";
import { MuteButton } from "./MuteButton.tsx";
import { openReport } from "./Problems.tsx";
import { useMedia } from "./QuickChat.tsx";

/**
 * Resigning and leaving a match, the way chess sites do it (Eric, Oct 13; DECISIONS.md, "Resign: leaving a match in
 * every mode"), and the match's options (Eric, Oct 24; docs/decisions/2026-10-24-match-menu.md). In the top line of every
 * match screen, at its right end:
 *   - a phone: a gear button (where the sound button was) opening a list in the middle of the screen, over the match,
 *     which is blurred and faded: Sound, Animations and Motion trail (a crowd match only), Resign or Leave, and Report a
 *     bug. A tap outside the list, its X or Escape closes it. Each of Resign and Report a bug asks once more in a
 *     centered confirm.
 *   - a computer (the game's two-column layout): Report a bug, the sound button, then the flag, at the right end of
 *     the title line over the board's column; an admin's testing items sit just before them (Hud.tsx, .match-tools;
 *     Eric, Oct 13).
 * Either way, the second step says what will happen, with Cancel and the go button. On a computer nothing dims or
 * covers the board, its moves or the clock meanwhile: the confirm sits beside the flag (out into the column next to the
 * board). On a phone the list and its confirms do cover the board, dimmed and blurred, by Eric's choice (Oct 24).
 * No undo, no draw offers (Eric: not now).
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

/** The game's computer layout (styles.css, "Computer layout"): the flag shows instead of the gear. */
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

/** The options' gear (a phone's match menu), drawn like the flag: a ring with eight teeth, in currentColor. */
export function GearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg class="mm-gear-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <circle cx="12" cy="12" r="6.5" />
        <circle cx="12" cy="12" r="2.4" stroke-width="2.2" />
        <path d="M18.5 12h3M12 18.5v3M5.5 12h-3M12 5.5v-3M16.6 16.6l2.1 2.1M7.4 16.6l-2.1 2.1M7.4 7.4l-2.1-2.1M16.6 7.4l2.1-2.1" />
      </g>
    </svg>
  );
}

const title = (e: MatchExit) => (e.kind === "resign" ? "Resign?" : "Leave the match?");
const word = (e: MatchExit) => (e.kind === "resign" ? "Resign" : "Leave");

/**
 * A confirm: what happens, Cancel and the go button. `place`: beside the flag on a computer ("pop"), or centered over
 * the blurred match on a phone ("center"). Focus starts on Cancel: Enter or a stray tap never goes through by itself.
 */
function Confirm({ place, heading, note, icon, go, onCancel, onGo }: { place: "pop" | "center"; heading: string; note: string; icon?: ComponentChildren; go: string; onCancel: () => void; onGo: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div class={`mm-confirm mm-${place}`} role="alertdialog" aria-modal="true" aria-labelledby="mm-confirm-title" aria-describedby="mm-confirm-note" onClick={(e) => e.stopPropagation()}>
      {/* (The question and what happens in one short paragraph, so it fits under the board and its clocks.) */}
      <p class="mm-confirm-text">
        <strong class="mm-confirm-title" id="mm-confirm-title">
          {icon}
          {heading}
        </strong>{" "}
        <span class="mm-confirm-note" id="mm-confirm-note">
          {note}
        </span>
      </p>
      <div class="mm-confirm-actions">
        <button type="button" class="mm-btn" ref={cancel} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" class="mm-btn mm-go" onClick={onGo}>
          {icon}
          {go}
        </button>
      </div>
    </div>
  );
}

/** The leave confirm (Resign, or Leave): leaves at once after the second tap. */
export function ConfirmExit({ exit, place, onCancel }: { exit: MatchExit; place: "pop" | "center"; onCancel: () => void }) {
  return (
    <Confirm
      place={place}
      heading={title(exit)}
      note={exit.note}
      icon={exit.kind === "resign" ? <FlagIcon size={15} /> : undefined}
      go={word(exit)}
      onCancel={onCancel}
      onGo={() => {
        onCancel();
        exit.go();
      }}
    />
  );
}

/** Report a bug, asked first on a phone (the report form covers the game; the match keeps going under it). */
function ConfirmReport({ onCancel, onReport }: { onCancel: () => void; onReport: () => void }) {
  return <Confirm place="center" heading="Report a bug?" note="The report form covers the game. Your match keeps going." go="Report" onCancel={onCancel} onGo={onReport} />;
}

/** One row of the phone's list (48 px, a divider above it): an icon slot, the label, and its control on the right. */
function ListRow(props: { icon?: ComponentChildren; label: string; control?: ComponentChildren; className?: string; role?: "switch"; "aria-checked"?: boolean; disabled?: boolean; onClick: () => void }) {
  const { icon, label, control, className, ...rest } = props;
  return (
    <button type="button" class={`mm-item${className ? ` ${className}` : ""}`} {...rest}>
      <span class="mm-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span class="mm-item-label">{label}</span>
      {control}
    </button>
  );
}

/** An on/off row (the same switch as Settings): the state shows as On or Off on the right. */
function SwitchRow({ icon, label, on, disabled, onClick }: { icon?: ComponentChildren; label: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <ListRow
      icon={icon}
      label={label}
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      control={
        <span class={`mm-switch${on ? " on" : ""}`} aria-hidden="true">
          {on ? "On" : "Off"}
        </span>
      }
    />
  );
}

/** Sound on or off (the same switch as the sound button). */
function SoundRow() {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMuteChange(() => setM(isMuted())), []);
  return (
    <SwitchRow
      icon={m ? "🔇" : "🔊"}
      label="Sound"
      on={!m}
      onClick={() => {
        unlockAudio();
        setMuted(!m);
      }}
    />
  );
}

/**
 * Animations and Motion trail (Settings → Board, the same prefs, the same rule: the trail is off, and can't be
 * switched, while the animations are off). Shown in a crowd match only (the picks these show). Kept in step with
 * Settings through onPrefsChange.
 */
function MotionRows() {
  const [, rerender] = useState(0);
  useEffect(() => onPrefsChange(() => rerender((n) => n + 1)), []);
  const anim = crowdAnimations();
  const trail = crowdTrail();
  return (
    <>
      <SwitchRow label="Animations" on={anim} onClick={() => setCrowdAnimations(!anim)} />
      <SwitchRow label="Motion trail" on={anim && trail} disabled={!anim} onClick={() => setCrowdTrail(!trail)} />
    </>
  );
}

/**
 * What's open: the phone's list ("menu"), its Resign confirm, or its Report confirm. Kept outside the control: a match
 * screen is drawn afresh when the phase changes (a move's reveal, the next move, a stage break), with a new control in
 * its top line, and a list or confirm someone just opened stays open through that rather than vanishing under their
 * thumb.
 */
type Open = null | "menu" | "confirm" | "report";
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
 * The control at the right end of a match screen's top line: on a phone a gear and its list, on a computer Report a bug,
 * the sound button and the flag (in that order, the flag last). `exit` null: nothing to leave right now. `crowd`: the
 * match is a crowd match (Crowd, a raid), which adds the Animations and Motion trail rows to a phone's list.
 */
export function MatchMenu({ exit, crowd = false }: { exit: MatchExit | null; crowd?: boolean }) {
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
        <span aria-hidden="true">
          <GearIcon />
        </span>
      </button>
      {open && (
        // (The layer over the match: a tap on it, outside the list or the confirm, closes it. Blurred and faded.)
        <div class="mm-scrim mm-full" onClick={() => setOpen(null)}>
          {open === "menu" ? (
            <div class="mm-panel" role="dialog" aria-label="Match options" onClick={(e) => e.stopPropagation()}>
              <div class="mm-head">
                <h2 class="mm-title">Options</h2>
                <button type="button" class="mm-x" aria-label="Close" onClick={() => setOpen(null)}>
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <div class="mm-list">
                <SoundRow />
                {crowd && <MotionRows />}
                {exit && <ListRow className="mm-exit" icon={<FlagIcon />} label={exit.kind === "resign" ? "Resign" : "Leave the match"} onClick={() => setOpen("confirm")} />}
                <ListRow icon="🐞" label="Report a bug" onClick={() => setOpen("report")} />
              </div>
            </div>
          ) : open === "confirm" ? (
            exit && <ConfirmExit exit={exit} place="center" onCancel={() => setOpen(null)} />
          ) : (
            <ConfirmReport
              onCancel={() => setOpen("menu")}
              onReport={() => {
                setOpen(null);
                openReport("bug");
              }}
            />
          )}
        </div>
      )}
    </span>
  );
}
