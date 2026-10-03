import { useEffect, useReducer, useState } from "preact/hooks";
import { DEFAULT_SETTINGS, DRAW_RULES, PACE_SETTINGS, type DrawRule, type Settings } from "@chessroyale/core";
import { chosenOpeningMoves } from "./screens/Home.tsx";
import { unlockAudio } from "./components/Countdown.tsx";
import { RaceTower } from "./components/RaceTower.tsx";
import { resetBoardsStrip } from "./components/TinyBoard.tsx";
import { enginePool } from "./engine.ts";
import { cutLabel, roundLive, type GameView } from "./game.ts";
import { NetMatch } from "./net.ts";
import { SoloMatch } from "./solo.ts";
import { FinalScreen } from "./screens/Final.tsx";
import { HomeScreen } from "./screens/Home.tsx";
import { LobbyScreen } from "./screens/Lobby.tsx";
import { OpeningGrid } from "./screens/OpeningGrid.tsx";
import { PlayScreen } from "./screens/Play.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { RevealScreen } from "./screens/Reveal.tsx";
import { SoundLab } from "./screens/SoundLab.tsx";
import { SpectateScreen } from "./screens/Spectate.tsx";
import { StageBreakScreen } from "./screens/StageBreak.tsx";

/** Playtest overrides from the URL, e.g. ?rounds=4&clock=15&draw=weighted (handy for quick tests). */
function overridesFromUrl(): Partial<Settings> {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const draw = q.get("draw") as DrawRule | null;
  return JSON.parse(
    JSON.stringify({
      ...(quickPace() ? PACE_SETTINGS.quick : {}),
      roundsPerStage: n("rounds"),
      firstStageRounds: n("rounds"),
      moveClockSeconds: n("clock"),
      drawRuleByStage: draw && DRAW_RULES.includes(draw) ? [draw] : undefined,
      openingMoves: chosenOpeningMoves(),
    }),
  );
}

/** Quick pace: off by default (relaxed), set by the first screen's toggle or ?pace=quick. */
function quickPace(): boolean {
  if (new URLSearchParams(location.search).get("pace") === "quick") return true;
  try {
    return localStorage.getItem("brc.pace") === "quick";
  } catch {
    return false;
  }
}

/** An invite link (/lobby/ABCDE) opens the join form with the code filled in. */
const linkCode = location.pathname.match(/^\/lobby\/([A-Za-z2-9]{5})\/?$/)?.[1]?.toUpperCase();

type AnyMatch = GameView & { dispose(): void };

export function App() {
  const [match, setMatch] = useState<AnyMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundLab, setSoundLab] = useState(() => new URLSearchParams(location.search).has("soundlab"));
  const [, rerender] = useReducer((n: number, _: unknown) => n + 1, 0);

  useEffect(() => {
    if (!match) return;
    const off = match.subscribe(() => rerender(undefined));
    return () => {
      off();
    };
  }, [match]);

  // Warm the engine up in the background so play starts instantly.
  useEffect(() => {
    void enginePool();
  }, []);

  // Back on a lobby link this device already has a seat in (a reload or a dropped connection): rejoin straight away.
  useEffect(() => {
    if (!linkCode) return;
    try {
      if (localStorage.getItem(`brc.lobby.${linkCode}`)) {
        joinLobby(localStorage.getItem("brc.name") ?? "Player", linkCode, localStorage.getItem("brc.practice") === "1");
      }
    } catch {
      // No storage: show the join form.
    }
  }, []);

  const debug = new URLSearchParams(location.search).has("debug");
  const use = (m: AnyMatch) => {
    match?.dispose();
    resetBoardsStrip();
    setMatch(m);
    if (debug) (window as unknown as { match: GameView }).match = m;
  };

  const startSolo = async (name: string, practice: boolean) => {
    unlockAudio();
    setLoading(true);
    const engines = await enginePool();
    setLoading(false);
    const m = new SoloMatch(engines, name, { ...DEFAULT_SETTINGS, ...overridesFromUrl() }, practice);
    use(m);
    m.start();
  };

  const joinLobby = (name: string, code: string, practice: boolean) => {
    unlockAudio();
    setError(null);
    const m = new NetMatch(code.toUpperCase(), name, enginePool, practice);
    m.settings = { ...DEFAULT_SETTINGS, ...overridesFromUrl() };
    use(m);
    history.replaceState(null, "", `/lobby/${m.code}${location.search}`);
    m.connect();
  };

  const createLobby = async (name: string, practice: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(location.search);
      params.delete("debug");
      if (quickPace()) params.set("pace", "quick");
      params.set("moves", String(chosenOpeningMoves()));
      const res = await fetch(`/api/lobby?${params}`, { method: "POST" });
      const body = (await res.json()) as { code?: string; message?: string };
      if (!body.code) throw new Error(body.message ?? "Couldn't create a lobby.");
      joinLobby(name, body.code, practice);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const leave = () => {
    match?.dispose();
    setMatch(null);
    history.replaceState(null, "", "/");
  };

  if (!match && soundLab) return <SoundLab onBack={() => setSoundLab(false)} />;
  if (!match) {
    return (
      <HomeScreen
        onStart={(n, p) => void startSolo(n, p)}
        onCreateLobby={(n, p) => void createLobby(n, p)}
        onJoinLobby={joinLobby}
        loading={loading}
        joinCode={linkCode}
        error={error}
        onSoundLab={() => setSoundLab(true)}
      />
    );
  }

  if (match instanceof NetMatch && match.error) {
    return (
      <div class="screen center">
        <h1>Can't join</h1>
        <p class="muted">{match.error}</p>
        <button type="button" class="btn btn-primary" onClick={leave}>
          Home
        </button>
      </div>
    );
  }

  const screen = renderPhase(match, {
    leave,
    again: () => (match instanceof SoloMatch ? void startSolo(match.playerName, match.practice) : leave()),
  });
  // Computers get the leaderboard as a permanent sidebar during the knockout stages.
  const tower = ["play", "scoring", "reveal", "spectating", "final"].includes(match.phase.kind) && match.standings().length > 0;
  if (!tower) return screen;
  return (
    <div class="arena">
      <aside class="tower-side">
        <RaceTower standings={match.standings()} cutoff={match.cutoff} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} />
      </aside>
      {screen}
    </div>
  );
}

const boardKey = (b: { id: number; generation: number; ply: number }) => `${b.id}:${b.generation}:${b.ply}`;

function renderPhase(match: AnyMatch, actions: { leave: () => void; again: () => void }) {
  const p = match.phase;
  switch (p.kind) {
    case "loading":
      return (
        <div class="screen center">
          <p class="muted">Connecting…</p>
        </div>
      );
    case "lobby":
      return match instanceof NetMatch ? <LobbyScreen match={match} onLeave={actions.leave} /> : null;
    case "opening":
      return <OpeningGrid boards={p.boards} title="Today's openings" />;
    case "spectating":
      return (
        <SpectateScreen
          match={match}
          boards={p.boards}
        />
      );
    case "play":
      return <PlayScreen key={boardKey(p.board)} match={match} board={p.board} startsAt={p.startsAt} deadline={p.deadline} allowedMs={p.allowedMs} />;
    case "scoring":
      return <PlayScreen key={boardKey(p.board)} match={match} board={p.board} deadline={0} picked={p.move} />;
    case "reveal":
      return <RevealScreen key={`${p.board.id}:${p.board.ply}`} match={match} mine={p.mine} board={p.board} until={p.until} />;
    case "stageBreak":
      return <StageBreakScreen match={match} {...p} />;
    case "simulating":
      return (
        <div class="screen center">
          <h1>Playing out the match…</h1>
          <p class="muted">
            Stage {p.stage + 1}, round {p.round + 1}
          </p>
        </div>
      );
    case "final":
      return <FinalScreen match={match} final={p.final} />;
    case "results":
      return (
        <ResultsScreen
          match={match}
          placement={p.placement}
          winner={p.winner}
          onAgain={actions.again}
          onHome={actions.leave}
        />
      );
  }
}
