import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { GameView, StrikeState } from "../game.ts";
import { Chevrons, type useHistoryView } from "./HistoryNav.tsx";

/**
 * Boss battle: everything below the board, the same on every screen (your move,
 * the reveal, the boss's turn) so nothing moves from one to the next. Two rows
 * of fixed height:
 *
 * 1. The God King's buttons and charges, always there; they're only greyed out
 *    when he can't be called. "Are you sure?" swaps them for Yes and No.
 * 2. One status line (two at most): what's happening right now.
 *
 * Calling him to play the move is your whole turn; a strike comes during the
 * move, the clock standing still while he strikes.
 */
export function BossDock({
  match,
  nav,
  canCall = false,
  strike,
  status,
  idle = false,
}: {
  match: GameView;
  /** Your move: step back through the game (the arrows are greyed out elsewhere). */
  nav?: { view: ReturnType<typeof useHistoryView>; total: number };
  canCall?: boolean;
  strike?: StrikeState;
  status: ComponentChildren;
  /** The boss's turn: the buttons show as plain and greyed out (nothing from the last move carries over). */
  idle?: boolean;
}) {
  const boss = match.boss;
  const charges = boss?.kingCharges ?? 0;
  const called = !idle && match.kingCalled;
  const struck = !idle && !!boss?.staggerNext;
  const [confirm, setConfirm] = useState<"play" | "strike" | null>(null);
  const asking = confirm !== null && canCall && !called;
  const view = nav?.view;
  const moveNo = (p: number) => `${Math.ceil(p / 2)}${p % 2 === 1 ? "" : "…"}`;
  if (idle) strike = undefined;
  const strikeLabel = struck ? "Boss struck" : strike?.mine ? `Strike ${strike.calls}/${strike.needed}` : "Strike the boss";
  return (
    <div class="boss-dock">
      <div class={`history-nav boss-dock-controls${view?.browsing ? " browsing" : ""}`}>
        <button type="button" class="nav-btn" aria-label="Previous move" disabled={!view || view.ply === 0} onClick={() => view?.go(view.ply - 1)}>
          <Chevrons back />
        </button>
        <div class="nav-middle king-calls">
          {view?.browsing ? (
            <button type="button" class="history-label" onClick={() => view.live()} aria-label="Back to the live position">
              Move {moveNo(view.ply)} · {view.ply}/{nav!.total} · back to live
            </button>
          ) : asking ? (
            <>
              <button
                type="button"
                class="king-call yes"
                onClick={() => {
                  setConfirm(null);
                  match.callKing(confirm === "strike");
                }}
              >
                <strong>Yes, summon him</strong>
              </button>
              <button type="button" class="king-call" onClick={() => setConfirm(null)}>
                <strong>No</strong>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                class={`king-call${called ? " on" : ""}`}
                disabled={!canCall || called || charges <= 0}
                onClick={() => setConfirm("play")}
                title="He plays this move at full engine strength if more than half the crowd calls him"
              >
                <strong>{called ? "King called" : "Call the King"}</strong>
              </button>
              <button
                type="button"
                class={`king-call strike${strike?.mine || struck ? " on" : ""}`}
                disabled={!canCall || called || struck || !!strike?.mine || charges <= 0}
                onClick={() => setConfirm("strike")}
                title="He strikes now if more than half the crowd calls for it: the boss's next move will be a weaker one"
              >
                <strong>{strikeLabel}</strong>
              </button>
              <span class="king-charges" aria-label={`${charges} God King charges left`}>
                {charges > 0 ? "👑".repeat(charges) : "spent"}
              </span>
            </>
          )}
        </div>
        <button type="button" class="nav-btn" aria-label="Next move" disabled={!view?.browsing} onClick={() => view?.go(view.ply + 1)}>
          <Chevrons />
        </button>
      </div>
      <div class="boss-dock-status" role="status" aria-live="polite">
        {asking ? (
          <span>
            <strong>{confirm === "play" ? "Summon the God King to play this move?" : "Summon the God King to strike the boss?"}</strong>{" "}
            <span class="muted">{confirm === "play" ? "You won't pick a move." : "The clock stops while he strikes, then you pick your move."}</span>
          </span>
        ) : (
          status
        )}
      </div>
    </div>
  );
}

/** The three waiting dots, for a status line. */
export function Dots() {
  return (
    <span class="waiting-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
