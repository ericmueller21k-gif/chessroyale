import { useEffect, useReducer, useRef, useState } from "preact/hooks";
import { CROWD_KNOCKOUTS, RAID_SETTINGS, raidBossElo, DEFAULT_SETTINGS, DRAW_RULES, PACE_SETTINGS, definedOnly, modeSettings, type DrawRule, type FinalFormat, type Settings } from "@chessroyale/core";
import { chosenBoss, chosenMode, chosenOpeningMoves } from "./screens/Home.tsx";
import { unlockAudio } from "./components/Countdown.tsx";
import { RaceTower } from "./components/RaceTower.tsx";
import { resetBoardsStrip } from "./components/TinyBoard.tsx";
import { enginePool } from "./engine.ts";
import { cutLabel, elimination, isCrowd, roundLive, towerView, type GameView } from "./game.ts";
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
import { ProfileScreen } from "./screens/Profile.tsx";
import { ShopScreen } from "./screens/Shop.tsx";
import { account, loadAccount, mustSignInToPlayOnline, recordSoloResult } from "./account.ts";
import { useAccount } from "./screens/Profile.tsx";
import { LandingScreen } from "./screens/Landing.tsx";
import { LegalScreen } from "./screens/Legal.tsx";
import { CrowdCut, CrowdReveal, WatchScreen } from "./screens/Crowd.tsx";
import { VoteScreen } from "./screens/Vote.tsx";
import { BossScreen } from "./screens/Boss.tsx";
import { SpectateScreen } from "./screens/Spectate.tsx";
import { StageBreakScreen } from "./screens/StageBreak.tsx";

/** Playtest overrides from the URL, e.g. ?rounds=4&clock=15&draw=weighted (handy for quick tests). */
function overridesFromUrl(): Partial<Settings> {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const draw = q.get("draw") as DrawRule | null;
  const mode = chosenMode();
  const raid = mode.mode === "raid";
  const crowd = mode.mode === "crowd" || raid;
  // ?format=team|boss|duel: skip the pre-game votes and play that ending (for testing).
  const format = q.get("format") as FinalFormat | null;
  const forced = crowd && format && format in CROWD_KNOCKOUTS ? { finalFormat: format, knockoutsPerStage: CROWD_KNOCKOUTS[format], augments: false } : {};
  return {
    // The mode's own rules and pace first, then pace and playtest overrides on top (only the ones that are set).
    // The boss raid: its own settings, and (solo) a boss a step above your rating.
    ...(raid
      ? { ...RAID_SETTINGS, bossFixedElo: chosenBoss() || raidBossElo([account().profile?.rating ?? null]) }
      : modeSettings(mode.mode === "classic" ? "classic" : "crowd", { crowdTeams: mode.crowdTeams, augments: mode.augments })),
    ...(quickPace() ? (crowd ? { revealSeconds: 2, drawnMoveSeconds: 1.2, stageBreakSeconds: 4 } : PACE_SETTINGS.quick) : {}),
    ...definedOnly({
      roundsPerStage: n("rounds"),
      firstStageRounds: n("rounds"),
      moveClockSeconds: n("clock"),
      finalMaxTurns: n("finalTurns"),
      bossMaxMoves: n("bossMoves"),
      drawRuleByStage: draw && DRAW_RULES.includes(draw) ? [draw] : undefined,
      // (Crowd always starts from move 0: its own openingMoves stays.)
      openingMoves: crowd ? undefined : chosenOpeningMoves(),
    }),
    ...forced,
  };
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

/** Back from Google: ?signin=google (or failed). Read once, then tidied out of the address bar. */
const signinParam = new URLSearchParams(location.search).get("signin");

const GUEST_KEY = "brc.guest";
const storedGuest = () => {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
};

type AnyMatch = GameView & { dispose(): void };

export function App() {
  const [match, setMatch] = useState<AnyMatch | null>(null);
  const savedResult = useRef<AnyMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundLab, setSoundLab] = useState(() => new URLSearchParams(location.search).has("soundlab"));
  const [showProfile, setShowProfile] = useState(() => location.pathname === "/profile");
  const [showShop, setShowShop] = useState(() => location.pathname === "/shop");
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(() =>
    location.pathname === "/privacy" ? "privacy" : location.pathname === "/terms" ? "terms" : null,
  );
  // Chose "play vs bots as a guest" on the landing page (this device remembers).
  const [guest, setGuest] = useState(storedGuest);
  const [inviteSkipped, setInviteSkipped] = useState(false);
  const chooseGuest = (on: boolean) => {
    setGuest(on);
    try {
      localStorage.setItem(GUEST_KEY, on ? "1" : "0");
    } catch {
      // Not important.
    }
  };
  const { config, profile } = useAccount();
  useEffect(() => {
    if (!signinParam) return;
    const q = new URLSearchParams(location.search);
    q.delete("signin");
    history.replaceState(null, "", `${location.pathname}${q.size ? `?${q}` : ""}`);
  }, []);
  // Your account (a guest one the first time).
  useEffect(() => {
    let name: string | undefined;
    try {
      name = localStorage.getItem("brc.name") ?? undefined;
    } catch {
      // No storage.
    }
    void loadAccount(name);
  }, []);
  // A solo match's result goes on your profile (online results are saved by the server).
  useEffect(() => {
    if (!(match instanceof SoloMatch) || match.phase.kind !== "results" || savedResult.current === match) return;
    savedResult.current = match;
    const me = match.standings().find((s) => s.isYou);
    void recordSoloResult({
      mode: match.settings.raid ? "boss" : match.settings.mode,
      placement: match.phase.placement,
      players: match.totalPlayers,
      team: me?.team ?? null,
      teamWon: match.phase.gameWinner === undefined || !me?.team ? null : match.phase.gameWinner === me.team,
      avgScore: me?.avg ?? null,
      rating: me?.rating ?? null,
    });
  });
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
    elimination.current = null;
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

  const joinLobby = (name: string, code: string, practice: boolean, fromPlayNow = false) => {
    if (!fromPlayNow) playNowTries.current = 0;
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
      const mode = chosenMode();
      params.set("mode", mode.mode);
      if (mode.mode === "raid") {
        // (The server sets up the raid: the boss picked, else one a step above the group.)
        if (chosenBoss()) params.set("boss", String(chosenBoss()));
      } else if (mode.mode === "crowd") {
        params.set("turns", mode.crowdTeams ? "teams" : "all");
        params.set("augments", mode.augments ? "1" : "0");
      } else params.set("moves", String(chosenOpeningMoves()));
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

  /** "Play now": into the 50 v 50 lobby that's filling up. */
  const playNowTries = useRef(0);
  const retriedFor = useRef<AnyMatch | null>(null);
  const playNow = async (name: string, retry = false) => {
    playNowTries.current = retry ? playNowTries.current + 1 : 1;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/play", { method: "POST" });
      const body = (await res.json()) as { code?: string; message?: string };
      if (!body.code) throw new Error(body.message ?? "Couldn't find a match.");
      joinLobby(name, body.code, false, true);
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
  if (!match && legal) {
    return (
      <LegalScreen
        page={legal}
        onBack={() => {
          setLegal(null);
          history.replaceState(null, "", "/");
        }}
      />
    );
  }
  if (!match && showShop) {
    return (
      <ShopScreen
        onBack={() => {
          setShowShop(false);
          if (location.pathname === "/shop") history.replaceState(null, "", "/");
        }}
      />
    );
  }
  if (!match && showProfile) {
    return (
      <ProfileScreen
        onBack={() => {
          setShowProfile(false);
          if (location.pathname === "/profile") history.replaceState(null, "", "/");
        }}
      />
    );
  }
  // Still finding out who you are: a plain splash rather than a flash of the wrong screen.
  if (!match && (config === null || (config.accounts && !profile))) {
    return (
      <div class="screen center">
        <h1 class="logo splash-logo">
          <span class="logo-crown" aria-hidden="true">
            ♚
          </span>
          HunChess
        </h1>
      </div>
    );
  }
  // Not signed in, where online play needs it: the landing page (an invite link shows it even to guests).
  const noLanding = new URLSearchParams(location.search).has("nolanding");
  if (!match && !noLanding && config?.onlineNeedsSignIn && profile && !profile.user.signedIn && (!guest || (linkCode && !inviteSkipped))) {
    return (
      <LandingScreen
        google={config.google}
        email={config.email}
        joinCode={linkCode}
        failed={signinParam === "failed"}
        onGuest={() => {
          chooseGuest(true);
          setInviteSkipped(true);
          if (linkCode) history.replaceState(null, "", "/");
        }}
      />
    );
  }
  if (!match) {
    return (
      <HomeScreen
        onStart={(n, p) => void startSolo(n, p)}
        onCreateLobby={(n, p) => void createLobby(n, p)}
        onPlayNow={(n) => void playNow(n)}
        onJoinLobby={joinLobby}
        loading={loading}
        joinCode={mustSignInToPlayOnline() ? undefined : linkCode}
        error={error}
        onlineLocked={mustSignInToPlayOnline()}
        onSignIn={() => chooseGuest(false)}
        onSoundLab={() => setSoundLab(true)}
        onProfile={() => setShowProfile(true)}
        onShop={() => setShowShop(true)}
      />
    );
  }

  // Play now: the lobby started a moment before we got in, so get the next one.
  if (match instanceof NetMatch && match.error && /already started|full/.test(match.error) && playNowTries.current > 0 && playNowTries.current < 3 && retriedFor.current !== match) {
    retriedFor.current = match;
    const name = match.playerName;
    queueMicrotask(() => void playNow(name, true));
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
  const tower = ["play", "scoring", "reveal", "spectating", "final", "watching", "boss"].includes(match.phase.kind) && match.standings().length > 0;
  if (!tower) return screen;
  return (
    <div class="arena">
      <aside class="tower-side">
        {(() => {
          const v = towerView(match);
          return (
            <>
              {v.teamLabel && <div class="tower-team">{v.teamLabel}</div>}
              <RaceTower standings={v.standings} cutoff={v.cutoff} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} />
            </>
          );
        })()}
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
      return <PlayScreen key={boardKey(p.board)} match={match} board={p.board} startsAt={p.startsAt} deadline={p.deadline} allowedMs={p.allowedMs} strike={p.strike} />;
    case "scoring":
      if (p.watched) return <WatchScreen key={boardKey(p.board)} match={match} board={p.board} startsAt={0} deadline={0} counting />;
      return <PlayScreen key={boardKey(p.board)} match={match} board={p.board} deadline={0} picked={p.move} strike={p.strike} />;
    case "watching":
      return <WatchScreen key={boardKey(p.board)} match={match} board={p.board} startsAt={p.startsAt} deadline={p.deadline} />;
    case "reveal":
      if (isCrowd(match)) return <CrowdReveal key={`${p.board.id}:${p.board.ply}`} match={match} mine={p.mine} board={p.board} until={p.until} />;
      return <RevealScreen key={`${p.board.id}:${p.board.ply}`} match={match} mine={p.mine} board={p.board} until={p.until} />;
    case "stageBreak":
      if (isCrowd(match)) return <CrowdCut match={match} {...p} />;
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
    case "vote":
      return <VoteScreen match={match} vote={p.vote} />;
    case "boss":
      return <BossScreen match={match} boss={p.boss} until={p.until} thinking={p.thinking} intro={p.intro} />;
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
