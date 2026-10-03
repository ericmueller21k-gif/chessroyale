import { useState } from "preact/hooks";
import { DEFAULT_SETTINGS as S, MAX_OPENING_MOVES } from "@chessroyale/core";
import { InstallCard } from "../components/InstallCard.tsx";
import { MuteButton } from "../components/MuteButton.tsx";

const OPENING_KEY = "brc.openingMoves";

/** Opening moves per side for solo games and lobbies you create: ?moves=N, else this device's choice, else the default. */
export function chosenOpeningMoves(): number {
  const clamp = (n: number) => Math.max(0, Math.min(MAX_OPENING_MOVES, Math.round(n)));
  const q = new URLSearchParams(location.search).get("moves");
  if (q !== null && Number.isFinite(Number(q))) return clamp(Number(q));
  try {
    const v = localStorage.getItem(OPENING_KEY);
    if (v !== null && Number.isFinite(Number(v))) return clamp(Number(v));
  } catch {
    // No storage.
  }
  return S.openingMoves;
}

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
  const [relaxed, setRelaxed] = useState(() => {
    try {
      return localStorage.getItem("brc.pace") !== "quick";
    } catch {
      return true;
    }
  });
  const toggleRelaxed = (on: boolean) => {
    setRelaxed(on);
    try {
      localStorage.setItem("brc.pace", on ? "relaxed" : "quick");
    } catch {
      // Not important.
    }
  };
  const [openingMoves, setOpeningMoves] = useState(chosenOpeningMoves);
  const changeOpeningMoves = (n: number) => {
    const v = Math.max(0, Math.min(MAX_OPENING_MOVES, n));
    setOpeningMoves(v);
    try {
      localStorage.setItem(OPENING_KEY, String(v));
    } catch {
      // Not important.
    }
  };
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
        <MuteButton />
      </h1>
      {!joinCode && <InstallCard />}
      <ol class="rules">
        <li>
          <strong>{S.lobbySize} players, 8 boards, one move at a time.</strong> Every round you're dropped onto one of the boards
          with {S.groupSize - 1} others. Make one move. You keep the same colour for a whole stage.
        </li>
        <li>
          <strong>Beat your group, not the board.</strong> Stockfish scores every move. You score by playing better than the others
          who got the same position.
        </li>
        <li>
          <strong>Watch your time bank.</strong> {S.timeBankSeconds / 60} minutes for the match, +{S.timeIncrementSeconds} s every
          move, {S.moveClockSeconds} s at most per move. Time never costs points: spend it on the hard positions.
        </li>
        <li>
          <strong>⚡ Power-ups</strong> show the engine's top 3 moves, free to use. You get {S.powerUpsAtStart}, plus{" "}
          {S.powerUpsPerStage} each stage you survive, and unused ones carry over (up to {S.powerUpsMax}). Pick your moment.
        </li>
        <li>
          <strong>The weakest go out.</strong> After the first {S.firstStageRounds} rounds, then every {S.roundsPerStage}, the bottom {S.knockoutsPerStage[0]} are knocked
          out and the most lopsided board is closed, until 4 are left on the last board.
        </li>
        <li>
          <strong>The 2v2 final.</strong> The last 4 play on the last board: seeds 1 & 4 against 2 & 3, teammates taking turns.
          The best average move quality wins the match.
        </li>
        <li>
          <strong>Engine rating.</strong> Every move also feeds a rating estimate on Stockfish's Elo scale, so you can see the
          scariest player in the lobby.
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
      <label class="check">
        <input type="checkbox" checked={relaxed} onChange={(e) => toggleRelaxed(e.currentTarget.checked)} />
        <span>
          <strong>Relaxed pace:</strong> a few seconds to settle on each new board and to watch the chosen move. Untick for
          quick games (also applies to lobbies you create).
        </span>
      </label>
      {joinCode ? null : (
        <div class="stepper-field">
          <span>
            <strong>Opening moves:</strong> how many moves each side has already played on every board when the match
            starts. Fewer is simpler; more gives sharper positions (also applies to lobbies you create).
          </span>
          <div class="stepper" role="group" aria-label="Opening moves per side">
            <button type="button" aria-label="Fewer opening moves" disabled={openingMoves <= 0} onClick={() => changeOpeningMoves(openingMoves - 1)}>
              −
            </button>
            <output aria-live="polite">{openingMoves}</output>
            <button type="button" aria-label="More opening moves" disabled={openingMoves >= MAX_OPENING_MOVES} onClick={() => changeOpeningMoves(openingMoves + 1)}>
              +
            </button>
          </div>
        </div>
      )}
      {joinCode ? null : (
        <button type="button" class="btn btn-primary btn-wide" disabled={loading} onClick={() => onStart(remember(name), practice)}>
          {loading ? "Loading the engine…" : `Play solo vs ${S.lobbySize - 1} bots`}
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
