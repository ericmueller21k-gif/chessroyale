import { useEffect, useReducer, useState } from "preact/hooks";
import { unlockAudio } from "./components/Countdown.tsx";
import { enginePool } from "./engine.ts";
import { SoloMatch } from "./solo.ts";
import { DEFAULT_SETTINGS, type Settings } from "@chessroyale/core";

/** Playtest overrides from the URL, e.g. ?rounds=4&clock=15 (handy for quick tests). */
function settingsFromUrl(): Settings {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  return {
    ...DEFAULT_SETTINGS,
    roundsPerStage: n("rounds") ?? DEFAULT_SETTINGS.roundsPerStage,
    moveClockSeconds: n("clock") ?? DEFAULT_SETTINGS.moveClockSeconds,
    duelClockSeconds: n("duel") ?? DEFAULT_SETTINGS.duelClockSeconds,
  };
}
import { DuelColourScreen, DuelScreen } from "./screens/Duel.tsx";
import { HomeScreen } from "./screens/Home.tsx";
import { OpeningGrid } from "./screens/OpeningGrid.tsx";
import { PlayScreen } from "./screens/Play.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { RevealScreen } from "./screens/Reveal.tsx";
import { StageBreakScreen } from "./screens/StageBreak.tsx";

export function App() {
  const [match, setMatch] = useState<SoloMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [, rerender] = useReducer((n: number, _: unknown) => n + 1, 0);

  useEffect(() => {
    if (!match) return;
    const off = match.subscribe(() => rerender(undefined));
    return () => {
      off();
    };
  }, [match]);

  // Warm the engine up in the background so Play starts instantly.
  useEffect(() => {
    void enginePool();
  }, []);

  const start = async (name: string) => {
    unlockAudio();
    setLoading(true);
    const engines = await enginePool();
    setLoading(false);
    match?.dispose();
    const m = new SoloMatch(engines, name, settingsFromUrl());
    if (new URLSearchParams(location.search).has("debug")) (window as unknown as { match: SoloMatch }).match = m;
    setMatch(m);
    m.start();
  };

  if (!match) return <HomeScreen onStart={start} loading={loading} />;

  const p = match.phase;
  switch (p.kind) {
    case "loading":
    case "lobby":
      return null;
    case "opening":
      return <OpeningGrid boards={p.boards} title="Today's openings" />;
    case "spectating":
      return <OpeningGrid boards={p.boards} title="Watching" />;
    case "play":
      return <PlayScreen match={match} board={p.board} deadline={p.deadline} />;
    case "scoring":
      return <PlayScreen match={match} board={p.board} deadline={0} picked={p.move} />;
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
          onAgain={() => start(match.playerName)}
          onHome={() => {
            match.dispose();
            setMatch(null);
          }}
        />
      );
  }
}
