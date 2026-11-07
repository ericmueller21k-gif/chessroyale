import { useEffect, useState } from "preact/hooks";
import { FdButton } from "./FrontDoor.tsx";

/**
 * "You've been dropped from the town": the pop-up on home after the town sent you out for being away (town/afk.ts; Eric, on #542:
 * "it just sends you a pop-up and just says like, you've been dropped out of the town… we don't want AFK players sitting in there").
 * The app's sheet (`fd-sheet`: from the foot on a phone, in the middle on a wide screen), one OK. Shown once per time out.
 */

let pending = false;
const subs = new Set<() => void>();

/** The town sent you out for being away: home shows the pop-up. */
export function showAwayNote() {
  pending = true;
  subs.forEach((f) => f());
}

export const DROPPED_TITLE = "You've been dropped from the town";
export const DROPPED_TEXT = "You were away for a while. Come back any time.";

export function AwayNote() {
  const [on, setOn] = useState(pending);
  useEffect(() => {
    const sync = () => setOn(pending);
    subs.add(sync);
    sync();
    return () => void subs.delete(sync);
  }, []);
  if (!on) return null;
  const ok = () => {
    pending = false;
    setOn(false);
  };
  return (
    <div class="fd-sheet-scrim away-scrim" onClick={(e) => e.target === e.currentTarget && ok()}>
      <div class="fd-sheet away-note" role="alertdialog" aria-modal="true" aria-labelledby="away-title" aria-describedby="away-text">
        <div class="fd-sheet-head">
          <h2 id="away-title">{DROPPED_TITLE}</h2>
        </div>
        <p class="fd-sub" id="away-text">
          {DROPPED_TEXT}
        </p>
        <FdButton primary onClick={ok}>
          OK
        </FdButton>
      </div>
    </div>
  );
}
