import { useEffect, useReducer, useState } from "preact/hooks";
import { DEFAULT_SETTINGS, type Settings } from "@chessroyale/core";
import { unlockAudio } from "./components/Countdown.tsx";
import { RaceTower } from "./components/RaceTower.tsx";
import { enginePool } from "./engine.ts";
import { cutLabel, roundLive, type GameView } from "./game.ts";
import { NetMatch } from "./net.ts";
import { SoloMatch } from "./solo.ts";
import { DuelColourScreen, DuelScreen } from "./screens/Duel.tsx";
import { HomeScreen } from "./screens/Home.tsx";
import { LobbyScreen } from "./screens/Lobby.tsx";
import { OpeningGrid } from "./screens/OpeningGrid.tsx";
import { PlayScreen } from "./screens/Play.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { RevealScreen } from "./screens/Reveal.tsx";
import { SpectateScreen } from "./screens/Spectate.tsx";
import { StageBreakScreen } from "./screens/StageBreak.tsx";

/** Playtest overrides from the URL, e.g. ?rounds=4&clock=15 (handy for quick tests). */
function overridesFromUrl(): Partial<Settings> {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  return JSON.parse(JSON.stringify({ roundsPerStage: n("rounds"), moveClockSeconds: n("clock"), duelClockSeconds: n("duel") }));
}

/** An invite link (/lobby/ABCDE) opens the join form with the code filled in. */
const linkCode = location.pathname.match(/^\/lobby\/([A-Za-z2-9]{5})\/?$/)?.[1]?.toUpperCase();

type AnyMatch = GameView & { dispose(): void };

export function App() {
  const [match, setMatch] = useState<AnyMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  if (!match) {
    return (
      <HomeScreen
        onStart={(n, p) => void startSolo(n, p)}
        onCreateLobby={(n, p) => void createLobby(n, p)}
        onJoinLobby={joinLobby}
        loading={loading}
        joinCode={linkCode}
        error={error}
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
  const tower = ["play", "scoring", "reveal", "spectating"].includes(match.phase.kind) && match.standings().length > 0;
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
          note={match instanceof NetMatch && match.waitingFor ? `${match.waitingFor} is choosing a colour for the duel…` : undefined}
        />
      );
    case "play":
      return <PlayScreen key={boardKey(p.board)} match={match} board={p.board} deadline={p.deadline} allowedMs={p.allowedMs} />;
    case "scoring":
      return <PlayScreen key={boardKey(p.board)} match={match} board={p.board} deadline={0} picked={p.move} />;
    case "reveal":
      return <RevealScreen match={match} mine={p.mine} board={p.board} />;
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
    case "duelColour":
      return <DuelColourScreen match={match} opponentName={p.opponentName} />;
    case "duel":
      return <DuelScreen match={match} duel={p.duel} />;
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
