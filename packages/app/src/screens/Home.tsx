import { useState } from "preact/hooks";
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
  onStart: (name: string) => void;
  onCreateLobby: (name: string) => void;
  onJoinLobby: (name: string, code: string) => void;
  loading: boolean;
  joinCode?: string;
  error?: string | null;
}) {
  const [code, setCode] = useState(joinCode ?? "");
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
          <strong>32 players, 10 seconds a move.</strong> Every round you're dropped into a position you haven't seen. Make one
          move.
        </li>
        <li>
          <strong>Beat your group, not the board.</strong> Stockfish scores every move. You score by playing better than the other
          three players who got the same position.
        </li>
        <li>
          <strong>The weakest go out.</strong> After every 8 rounds the bottom of the table is knocked out, until two players are left
          for a real 3-minute game.
        </li>
      </ol>
      <label class="field">
        <span>Your name</span>
        <input value={name} maxLength={16} onInput={(e) => setName(e.currentTarget.value)} placeholder="You" />
      </label>
      {joinCode ? null : (
        <button type="button" class="btn btn-primary btn-wide" disabled={loading} onClick={() => onStart(remember(name))}>
          {loading ? "Loading the engine…" : "Play solo vs 31 bots"}
        </button>
      )}
      <div class="lobby-actions">
        {!joinCode && (
          <button type="button" class="btn btn-secondary" disabled={loading} onClick={() => onCreateLobby(remember(name))}>
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
          <button type="button" class={`btn ${joinCode ? "btn-primary" : "btn-secondary"}`} disabled={loading || code.trim().length !== 5} onClick={() => onJoinLobby(remember(name), code.trim())}>
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
