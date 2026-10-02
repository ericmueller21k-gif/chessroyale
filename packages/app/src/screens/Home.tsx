import { useState } from "preact/hooks";

export function HomeScreen({ onStart, loading }: { onStart: (name: string) => void; loading: boolean }) {
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
      <button
        type="button"
        class="btn btn-primary btn-wide"
        disabled={loading}
        onClick={() => {
          const n = name.trim() || "You";
          try {
            localStorage.setItem("brc.name", n);
          } catch {
            // Not important.
          }
          onStart(n);
        }}
      >
        {loading ? "Loading the engine…" : "Play solo vs 31 bots"}
      </button>
      <p class="muted small">
        Engine: <a href="https://stockfishchess.org">Stockfish</a> (GPL-3.0,{" "}
        <a href="https://github.com/official-stockfish/Stockfish">source</a>), running in your browser.
      </p>
    </div>
  );
}
