import { useEffect, useState } from "preact/hooks";
import { TOWN_AFK } from "@chessroyale/core";

/**
 * "You were away": the small note on home after the town sent you out for being away (town/afk.ts; Eric, Nov 7). At the top, in
 * the invite toast's style; it stays for TOWN_AFK.awayNoteSec of the page being visible (a phone coming back from the background
 * sees it for that long), and a tap takes it away sooner. Shown once per time out.
 */

let pending = false;
const subs = new Set<() => void>();

/** The town sent you out for being away: home shows the note. */
export function showAwayNote() {
  pending = true;
  subs.forEach((f) => f());
}

export const AWAY_NOTE = "You were away";

export function AwayNote() {
  const [on, setOn] = useState(pending);
  useEffect(() => {
    const sync = () => setOn(pending);
    subs.add(sync);
    sync();
    return () => void subs.delete(sync);
  }, []);
  useEffect(() => {
    if (!on) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      pending = false;
      setOn(false);
    };
    // (Its time counts only while the page is visible: a phone that comes back later still sees it.)
    const arm = () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(done, TOWN_AFK.awayNoteSec * 1000);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [on]);
  if (!on) return null;
  return (
    <div
      class="fr-toast away-note"
      role="status"
      onClick={() => {
        pending = false;
        setOn(false);
      }}
    >
      <span class="fr-toast-text">{AWAY_NOTE}</span>
    </div>
  );
}
