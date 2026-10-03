import { useState } from "preact/hooks";
import { CROWD_SETTINGS as C, DEFAULT_SETTINGS as S, MAX_OPENING_MOVES, type GameMode } from "@chessroyale/core";
import { InstallCard } from "../components/InstallCard.tsx";
import { crowdAnimations, setCrowdAnimations } from "../prefs.ts";
import { MuteButton } from "../components/MuteButton.tsx";

const OPENING_KEY = "brc.openingMoves";
const MODE_KEY = "brc.mode";
const TURNS_KEY = "brc.crowdTurns";
const AUGMENTS_KEY = "brc.augments";

export interface ModeChoice {
  mode: GameMode;
  /** Crowd: 50 v 50 teams (true) or everyone moves (false). */
  crowdTeams: boolean;
  augments: boolean;
}

/** The mode for solo games and lobbies you create: ?mode=crowd&turns=all&augments=0, else this device's choice. */
export function chosenMode(): ModeChoice {
  const q = new URLSearchParams(location.search);
  const get = (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const mode = (q.get("mode") ?? get(MODE_KEY)) === "crowd" ? "crowd" : "classic";
  return {
    mode,
    crowdTeams: (q.get("turns") ?? get(TURNS_KEY)) !== "all",
    augments: (q.get("augments") ?? get(AUGMENTS_KEY)) !== "0",
  };
}

function saveMode(c: ModeChoice) {
  try {
    localStorage.setItem(MODE_KEY, c.mode);
    localStorage.setItem(TURNS_KEY, c.crowdTeams ? "teams" : "all");
    localStorage.setItem(AUGMENTS_KEY, c.augments ? "1" : "0");
  } catch {
    // Not important.
  }
}

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
  onSoundLab,
}: {
  onStart: (name: string, practice: boolean) => void;
  onCreateLobby: (name: string, practice: boolean) => void;
  onJoinLobby: (name: string, code: string, practice: boolean) => void;
  loading: boolean;
  joinCode?: string;
  error?: string | null;
  onSoundLab?: () => void;
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
  const [modeChoice, setModeChoice] = useState(chosenMode);
  const changeMode = (patch: Partial<ModeChoice>) => {
    const next = { ...modeChoice, ...patch };
    setModeChoice(next);
    saveMode(next);
  };
  const crowd = modeChoice.mode === "crowd";
  const [anim, setAnim] = useState(crowdAnimations);
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
      {!joinCode && (
        <div class="mode-pick" role="radiogroup" aria-label="Game mode">
          <button type="button" role="radio" aria-checked={!crowd} class={!crowd ? "on" : ""} onClick={() => changeMode({ mode: "classic" })}>
            <strong>Classic</strong>
            <span>{S.lobbySize} players · 8 boards</span>
          </button>
          <button type="button" role="radio" aria-checked={crowd} class={crowd ? "on" : ""} onClick={() => changeMode({ mode: "crowd" })}>
            <strong>Crowd</strong>
            <span>{C.lobbySize} players · 1 board</span>
          </button>
        </div>
      )}
      {crowd && !joinCode ? (
        <ol class="rules">
          <li>
            <strong>{C.lobbySize} players, one game, from the first move.</strong>{" "}
            {modeChoice.crowdTeams
              ? "Two teams of 50: you play White or Black all game. Your team picks a move together, the other team answers."
              : "Everyone picks a move for whichever side is to move, every turn."}
          </li>
          <li>
            <strong>The most popular move is played.</strong> Stockfish scores every pick, and you score by picking better than
            the others who picked with you.
          </li>
          <li>
            <strong>No cuts for the first {(C.firstStageRounds ?? 20) / 2} moves.</strong> Then after every move the lowest scorers
            go out ({modeChoice.crowdTeams ? "the same number from each team" : "by overall score"}), until 4 are left.
          </li>
          <li>
            <strong>⚡ {C.powerUpsAtStart} power-ups</strong> show the engine's top 3 moves. That's all you get, so pick your moments.
          </li>
          {modeChoice.augments && (
            <li>
              <strong>Augments.</strong> After every cut, vote: more time, the same, or less time on the clock for the next round.
            </li>
          )}
          <li>
            <strong>The 2v2 final.</strong> The last 4 play on, teammates taking turns; the best average move quality wins. Winning
            the game goes on your record, but it's move quality that places you.
          </li>
        </ol>
      ) : (
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
      )}
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
      {crowd && !joinCode && (
        <>
          <div class="mode-pick small-pick" role="radiogroup" aria-label="Turns">
            <button type="button" role="radio" aria-checked={modeChoice.crowdTeams} class={modeChoice.crowdTeams ? "on" : ""} onClick={() => changeMode({ crowdTeams: true })}>
              <strong>50 v 50</strong>
              <span>You play one side</span>
            </button>
            <button type="button" role="radio" aria-checked={!modeChoice.crowdTeams} class={!modeChoice.crowdTeams ? "on" : ""} onClick={() => changeMode({ crowdTeams: false })}>
              <strong>Everyone moves</strong>
              <span>You pick every turn</span>
            </button>
          </div>
          <label class="check">
            <input
              type="checkbox"
              checked={anim}
              onChange={(e) => {
                setAnim(e.currentTarget.checked);
                setCrowdAnimations(e.currentTarget.checked);
              }}
            />
            <span>
              <strong>Animations:</strong> every pick flies onto the board as its own ghost piece (busy, on purpose). Off: just
              the names over each picked square, and only the chosen piece moves.
            </span>
          </label>
          <label class="check">
            <input type="checkbox" checked={modeChoice.augments} onChange={(e) => changeMode({ augments: e.currentTarget.checked })} />
            <span>
              <strong>Augments:</strong> vote on the clock after every cut (more time, same, less time).
            </span>
          </label>
        </>
      )}
      {joinCode || crowd ? null : (
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
          {loading ? "Loading the engine…" : `Play solo vs ${(crowd ? C.lobbySize! : S.lobbySize) - 1} bots`}
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
      {onSoundLab && (
        <button type="button" class="link-btn" onClick={onSoundLab}>
          🔊 Sound lab: choose the reveal's roulette sound
        </button>
      )}
      <p class="muted small">
        Engine: <a href="https://stockfishchess.org">Stockfish</a> (GPL-3.0,{" "}
        <a href="https://github.com/official-stockfish/Stockfish">source</a>), running in your browser.
      </p>
    </div>
  );
}
