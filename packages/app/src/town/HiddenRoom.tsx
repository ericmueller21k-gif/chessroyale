import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { HIDDEN_ROOM } from "@chessroyale/core";
import { countText, type HiddenRoomClient } from "./hidden-net.ts";

/**
 * The Hidden Boss's room challenge on screen (Eric, Nov 12 and 13; hidden-net.ts, server/src/hidden-room.ts): his card's own buttons in
 * his top-floor room (Challenge, Cancel, and an admin's "Fill with 3 bots"), the count every one in the room sees ("2 of 4"), and the
 * room's small notes ("The door is locked.", "Sorry, not enough players.", each with OK). Nothing hidden behind a tap: Challenge and
 * Cancel are both always there, each greyed while it doesn't apply, and the count's line keeps its row.
 */

/** The client's answers redraw whoever shows them. */
function useClient(client: HiddenRoomClient) {
  const [, tick] = useState(0);
  useLayoutEffect(() => client.subscribe(() => tick((n) => n + 1)), [client]);
}

/** His card's challenge, in place of a boss's Challenge alone (ShopRoom's `challengeCard`). */
export function HiddenCard({ client }: { client: HiddenRoomClient }) {
  useClient(client);
  const info = client.info;
  const waiting = !!info?.yours;
  const count = info?.count ?? 0;
  // (A refusal's words while they're news: a rest's kill switch, "The room is full." Gone with the next answer.)
  // (The admin's bots only join a challenge someone has made: filled with no challenge yet, the line says so. Eric, Nov 14: he tapped
  // Fill alone and waited 10 minutes for nothing.)
  const idle = info?.bots && !waiting ? "The bots are ready. Tap Challenge to start." : `Up to ${HIDDEN_ROOM.players} fight him together.`;
  const line = client.refused ?? info?.message ?? (count ? `${countText(count)}${info?.names.length ? `: ${info.names.join(", ")}` : ""}` : idle);
  return (
    <>
      <p class="town-card-text hb-card-line" aria-live="polite">
        {line}
      </p>
      <button type="button" class="town-btn primary" disabled={!!client.refused || waiting || client.busy} onClick={client.challenge}>
        Challenge
      </button>
      <button type="button" class="town-btn" disabled={!waiting || client.busy} onClick={client.cancel}>
        Cancel
      </button>
      {/* (Eric's test kit, Nov 13: admins only, as the server says, and the server checks again. Greyed once the bots are in.) */}
      {info?.admin && (
        <button type="button" class="town-btn hb-bots" disabled={info.bots || client.busy || info.people + HIDDEN_ROOM.bots > info.max} onClick={client.fill}>
          Fill with 3 bots
        </button>
      )}
    </>
  );
}

/**
 * The count over his room ("2 of 4"), for everyone in it from the start ("0 of 4"), so it never appears from nothing (review n2).
 * Greyed for someone not in the count (a guest, a device too young, a banned account: the server tells them nothing).
 */
export function HiddenCount({ client }: { client: HiddenRoomClient }) {
  useClient(client);
  const n = client.info?.count ?? 0;
  return (
    <div class={`hb-count${client.refused ? " off" : ""}`} role="status" aria-label={`Challengers: ${countText(n)}`}>
      <span class="hb-count-label">Challengers</span> {countText(n)}
    </div>
  );
}

/** A small note with OK ("The door is locked.", "Sorry, not enough players."): Escape or OK closes it. */
export function RoomNote({ text, onOk }: { text: string; onOk: () => void }) {
  const ok = useRef<HTMLButtonElement>(null);
  const okRef = useRef(onOk);
  okRef.current = onOk;
  // (Layout effects, as every pop-up's: LESSONS.md, Nov 11.)
  useLayoutEffect(() => ok.current?.focus({ preventScroll: true }), []);
  useLayoutEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") okRef.current();
      if (!(e.target instanceof Element && e.target.closest(".hb-note"))) e.stopImmediatePropagation();
    };
    addEventListener("keydown", keys, true);
    return () => removeEventListener("keydown", keys, true);
  }, []);
  return (
    <div class="fd-sheet-scrim hb-note-scrim" onClick={(e) => e.target === e.currentTarget && onOk()}>
      <div class="fd-sheet hb-note" role="alertdialog" aria-modal="true" aria-label={text}>
        <p class="fd-sub hb-note-text">{text}</p>
        <button type="button" class="fd-btn primary" ref={ok} onClick={onOk}>
          OK
        </button>
      </div>
    </div>
  );
}
