import type { NetSquadsLobby } from "@chessroyale/chess/squads";
import type { MatchExit } from "../components/MatchMenu.tsx";
import type { SquadsClient } from "../squads.ts";
import { squadName } from "../squads-view.ts";

// (Off Squads' screens, Squads.tsx, which load on entry: the app asks these on home. Nov 10, phone load.)

export interface SquadsActions {
  /** Leave this lobby and go home. */
  onHome: () => void;
  /** Resign (mid-bracket, your squad still in): a loss, a bot in your seat, then the resign screen. */
  onResign: () => void;
  /** Leave and queue again (solo), or back to your party. */
  onAgain: () => void;
  /** You came with a party: "Back to your party" instead of the solo queue. */
  party: boolean;
}

/**
 * What leaving means in a Squads lobby right now (MatchMenu, the standings' Leave): before the bracket, Leave (a bot
 * takes your seat, nothing recorded); with your squad still in it, Resign (a loss at the worst place it can still
 * finish, a bot in your seat for good); your squad out, Leave (its result stands). Null: nothing to leave.
 */
export function squadsExit(client: SquadsClient, actions: SquadsActions): MatchExit | null {
  const lobby = client.lobby;
  if (!lobby || client.left || client.resigning || client.resigned || lobby.phase === "results" || lobby.phase === "waiting") return null;
  const sq = client.mySquad;
  if (lobby.phase !== "bracket") return { kind: "leave", note: "You'll go home, and a bot takes your seat.", go: actions.onHome };
  if (!sq || client.placed) return { kind: "leave", note: "Your squad's result stands. You'll go home.", go: actions.onHome };
  return { kind: "resign", note: `You'll leave the lobby and it counts as a loss. A bot plays your seat for the ${squadName(sq.id)}.`, go: actions.onResign };
}

/** For the queue frame: whether the lobby is still gathering (the waiting room shows). */
export const squadsWaiting = (lobby: NetSquadsLobby | null) => !lobby || lobby.phase === "waiting" || lobby.phase === "filled";
