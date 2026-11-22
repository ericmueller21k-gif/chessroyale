import type { ExitKind, GameView } from "./game.ts";
import type { MatchExit } from "./components/MatchMenu.tsx";
import { livesLeftWords } from "./tower.ts";

/**
 * Leaving the match on screen (Resign, or Leave): the app's own handler (App.tsx registers it: it knows where to go
 * next), so the control in any screen's top line can call it.
 */
let handler: (() => void) | null = null;
/** Where leaving goes: home, or back to the town square (a boss's battle from the town's challenge: the app sets it). */
let exitTo: "home" | "town" = "home";
export function setExitTo(to: "home" | "town") {
  exitTo = to;
}

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
export function exitNote(m: Pick<GameView, "serverPaced" | "seatToBot" | "boss" | "totalPlayers" | "standings" | "simul" | "tower" | "towerParty">, kind: ExitKind): string {
  const online = !!m.serverPaced;
  // (A Battle Tower floor: free before your 2nd move, core's leaveFloor; a loss after: a life spent and the climb on, or with none left the
  // run's end (Nov 20).)
  if (m.tower) {
    if (kind === "leave") return "Leaving is free before your 2nd move: back to the Battle Tower, and this floor waits for you.";
    return m.tower.lives > 0 ? `Leaving now counts as a loss: it costs a life (${livesLeftWords(m.tower.lives - 1)} after).` : "Your run ends here: leaving now counts as a loss.";
  }
  // (The Hidden Boss's phase 2: resigning is your board's; leaving once it's decided ends the battle. Online (Nov 13) a bot plays
  // your board on, from the phase change on.)
  if (online && m.simul && kind === "resign") return "You'll leave this match and it counts as a loss. A bot plays your board on.";
  if (!online && m.simul?.playing) return kind === "resign" ? "Your board is lost. The other boards play on, but all four must be won." : "The battle ends here, and the boss wins it.";
  // (Online, every phase 2 board decided: everyone's result stands, the results on their way. The scoreboard shows its board
  // players still in until then: phase2Standings.)
  const out = !!m.standings().find((s) => s.isYou)?.out || (online && !!m.simul?.decided);
  if (kind === "leave") {
    if (out) return online ? "You're already out, so your result stands. You'll go home." : "You're already out, so your result stands. You'll see it now.";
    if (!online) return exitTo === "town" ? "You'll go back to the town square. Nothing goes on your record." : "You'll go home. Nothing goes on your record.";
    // (A party's tower floor goes back to the Battle Tower's floor room, never home: Eric, Nov 22.)
    const to = m.towerParty ? "go back to the Battle Tower" : "go home";
    return m.seatToBot ? `You'll ${to}, and a bot takes your seat.` : `You'll ${to}, and your seat is freed.`;
  }
  if (!online) return m.boss && m.totalPlayers === 1 ? "The game ends here and counts as a loss." : "The match ends here for you and counts as a loss.";
  return m.seatToBot ? "You'll leave this match and it counts as a loss. A bot takes your seat." : "You'll leave this match and it counts as a loss. It goes on without you.";
}
