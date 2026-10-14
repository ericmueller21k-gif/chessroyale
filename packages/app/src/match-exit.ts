import type { ExitKind, GameView } from "./game.ts";
import type { MatchExit } from "./components/MatchMenu.tsx";

/**
 * Leaving the match on screen (Resign, or Leave): the app's own handler (App.tsx registers it: it knows where to go
 * next), so the control in any screen's top line can call it.
 */
let handler: (() => void) | null = null;

export function onExitMatch(fn: () => void): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

export function exitMatch() {
  handler?.();
}

/** What the top line's control offers for this match right now (null: nothing to leave), with the confirm's words. */
export function exitFor(m: GameView): MatchExit | null {
  const kind = m.exit;
  return kind ? { kind, note: exitNote(m, kind), go: exitMatch } : null;
}

/** The confirm's line: what happens if you go now. */
export function exitNote(m: Pick<GameView, "serverPaced" | "seatToBot" | "boss" | "totalPlayers" | "standings" | "simul">, kind: ExitKind): string {
  const online = !!m.serverPaced;
  // (The Hidden Boss's phase 2: resigning is your board's; leaving once it's decided ends the battle.)
  if (m.simul?.playing) return kind === "resign" ? "Your board is lost. The other boards play on, but all four must be won." : "The battle ends here, and the boss wins it.";
  const out = !!m.standings().find((s) => s.isYou)?.out;
  if (kind === "leave") {
    if (out) return online ? "You're already out, so your result stands. You'll go home." : "You're already out, so your result stands. You'll see it now.";
    if (!online) return "You'll go home. Nothing goes on your record.";
    return m.seatToBot ? "You'll go home, and a bot takes your seat." : "You'll go home, and your seat is freed.";
  }
  if (!online) return m.boss && m.totalPlayers === 1 ? "The game ends here and counts as a loss." : "The match ends here for you and counts as a loss.";
  return m.seatToBot ? "You'll leave this match and it counts as a loss. A bot takes your seat." : "You'll leave this match and it counts as a loss. It goes on without you.";
}
