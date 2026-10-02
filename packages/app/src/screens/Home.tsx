import { useState } from "preact/hooks";
import { DEFAULT_SETTINGS as S } from "@chessroyale/core";
import { InstallCard } from "../components/InstallCard.tsx";

function remember(name: string): string {
  const n = name.trim() || "Player";
  try {
    localStorage.setItem("brc.name", n);
  } catch {
    // Not important.
  }
  return n;
}

export function HomeScreen({
  onStart,
  onCreateLobby,
  onJoinLobby,
  loading,
  joinCode,
  error,
}: {
  onStart: (name: string, practice: boolean) => void;
  onCreateLobby: (name: string, practice: boolean) => void;
  onJoinLobby: (name: string, code: string, practice: boolean) => void;
  loading: boolean;
  joinCode?: string;
  error?: string | null;
}) {
  const [code, setCode] = useState(joinCode ?? "");
  const [practice, setPractice] = useState(() => {
    try {
      return localStorage.getItem("brc.practice") === "1";
    } catch {
      return false;
    }
  });
  const togglePractice = (on: boolean) => {
    setPractice(on);
    try {
      localStorage.setItem("brc.practice", on ? "1" : "0");
    } catch {
      // Not important.
    }
  };
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("brc.name") ?? "";
    } catch {
      return "";
    }
  });
  return (
    <div class="screen home">
      <h1 class="logo">
        <span class="logo-crown" aria-hidden="true">
          ♚
        </span>
        Battle Royale Chess
      </h1>
      {!joinCode && <InstallCard />}
      <ol class="rules">
        <li>
          <strong>{S.lobbySize} players, one move at a time.</strong> Every round you're dropped into a position you haven't seen.
          Make one move. You keep the same colour for a whole stage.
        </li>
        <li>
          <strong>Beat your group, not the board.</strong> Stockfish scores every move. You score by playing better than the other
          three players who got the same position.
        </li>
        <li>
          <strong>Watch your time bank.</strong> {S.timeBankSeconds / 60} minutes for the match, +{S.timeIncrementSeconds} s every
          move, {S.moveClockSeconds} s at most per move. Time counts: every minute you save (or burn) beyond the +
          {S.timeIncrementSeconds} s is worth ±{S.timeBonusPointsPerMinute} points.
        </li>
        <li>
          <strong>⚡ Power-ups</strong> show the engine's top 3 moves. You get {S.powerUpsAtStart}, plus {S.powerUpsPerStage} each
          stage you survive. Each one you use costs {S.powerUpCostPoints} points, so save them for the hard positions.
        </li>
        <li>
          <strong>The weakest go out.</strong> After every {S.roundsPerStage} rounds the bottom of the leaderboard is knocked out,
          until two players are left for a real {S.duelClockSeconds / 60}-minute game.
        </li>
      </ol>
      <label class="field">
        <span>Your name</span>
        <input value={name} maxLength={16} onInput={(e) => setName(e.currentTarget.value)} placeholder="You" />
      </label>
      <label class="check">
        <input type="checkbox" checked={practice} onChange={(e) => togglePractice(e.currentTarget.checked)} />
        <span>
          <strong>Practice mode:</strong> unlimited power-ups (the engine's top 3 moves, any time). You're marked 💡 on the
          leaderboard.
        </span>
      </label>
      {joinCode ? null : (
        <button type="button" class="btn btn-primary btn-wide" disabled={loading} onClick={() => onStart(remember(name), practice)}>
          {loading ? "Loading the engine…" : "Play solo vs 31 bots"}
        </button>
      )}
      <div class="lobby-actions">
        {!joinCode && (
          <button type="button" class="btn btn-secondary" disabled={loading} onClick={() => onCreateLobby(remember(name), practice)}>
            Create a lobby
          </button>
        )}
        <div class="join-row">
          <input
            class="code-input"
            value={code}
            maxLength={5}
            placeholder="CODE"
            aria-label="Lobby code"
            onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
          />
          <button type="button" class={`btn ${joinCode ? "btn-primary" : "btn-secondary"}`} disabled={loading || code.trim().length !== 5} onClick={() => onJoinLobby(remember(name), code.trim(), practice)}>
            Join lobby
          </button>
        </div>
      </div>
      {error && <p class="out-msg">{error}</p>}
      <p class="muted small">
        Engine: <a href="https://stockfishchess.org">Stockfish</a> (GPL-3.0,{" "}
        <a href="https://github.com/official-stockfish/Stockfish">source</a>), running in your browser.
      </p>
    </div>
  );
}
