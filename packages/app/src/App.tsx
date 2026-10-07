import { useEffect, useReducer, useRef, useState } from "preact/hooks";
import { CROWD_KNOCKOUTS, RAID_SETTINGS, raidBossElo, DEFAULT_SETTINGS, DRAW_RULES, PACE_SETTINGS, bestMoveOf, definedOnly, matchFeats, modeSettings, type DrawRule, type FinalFormat, type ModeChoiceId, type Settings } from "@chessroyale/core";
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
import { QueueScreen } from "./screens/Queue.tsx";
import { OpeningGrid } from "./screens/OpeningGrid.tsx";
import { PlayScreen } from "./screens/Play.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { RevealScreen } from "./screens/Reveal.tsx";
import { SoundLab } from "./screens/SoundLab.tsx";
import { PlayerProfileScreen } from "./screens/PlayerProfile.tsx";
import { closeProfile, openProfile, useProfileTarget, type ProfileTarget } from "./profile-nav.ts";
import { ShopScreen } from "./screens/Shop.tsx";
import { account, loadAccount, mustSignInToPlayOnline, playerName, recordSoloResult } from "./account.ts";
import { startLive } from "./live.ts";
import { SettingsScreen } from "./screens/Settings.tsx";
import { Logo } from "./components/FrontDoor.tsx";
import { FrontFrame, type FrontNav } from "./components/FrontMenu.tsx";
import { useAccount } from "./screens/Profile.tsx";
import { LandingScreen } from "./screens/Landing.tsx";
import { LegalScreen } from "./screens/Legal.tsx";
import { CrowdCut, CrowdReveal, WatchScreen } from "./screens/Crowd.tsx";
import { VoteScreen } from "./screens/Vote.tsx";
import { BossScreen } from "./screens/Boss.tsx";
import { SpectateScreen } from "./screens/Spectate.tsx";
import { StageBreakScreen } from "./screens/StageBreak.tsx";
import { ChatBubble } from "./components/QuickChat.tsx";

/** Playtest overrides from the URL, e.g. ?rounds=4&clock=15&draw=weighted (handy for quick tests). */
function overridesFromUrl(modeId?: ModeChoiceId): Partial<Settings> {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const draw = q.get("draw") as DrawRule | null;
  const mode = { ...chosenMode(), ...(modeId ? { mode: modeId } : {}) };
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
  // A profile from the address: /profile is yours, /profile/ID someone's.
  useState(() => {
    const m = location.pathname.match(/^\/profile(?:\/([A-Za-z0-9_-]{1,64}))?\/?$/);
    if (m) openProfile(m[1] ? { uid: m[1], name: "" } : { you: true, name: "" });
  });
  const profileOpen = useProfileTarget();
  const [showShop, setShowShop] = useState<false | "shop" | "locker">(() => (location.pathname === "/shop" ? "shop" : false));
  const [showSettings, setShowSettings] = useState(() => location.pathname === "/settings");
  /** The computer's side menu: open the home screen's boss menu or Play with friends. */
  const [homeIntent, setHomeIntent] = useState<{ kind: "boss" | "friends"; n: number } | null>(null);
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
  // The live line's heartbeat (and "online"), once you have an account here.
  useEffect(() => {
    if (config?.accounts && profile) startLive();
  }, [config?.accounts, !!profile]);
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
    const runner = match.runner;
    const raid = !!match.settings.raid;
    // A boss battle shares its result among those still standing (as online); otherwise the team's game.
    const feats = me ? matchFeats(runner.player(me.id), match.settings.knockoutsPerStage.length, runner.boss, raid) : null;
    const bossResult = match.phase.bossResult;
    void recordSoloResult({
      mode: raid ? "boss" : match.settings.mode,
      placement: match.phase.placement,
      players: match.totalPlayers,
      team: me?.team ?? null,
      teamWon: bossResult
        ? feats?.survived && bossResult !== "draw"
          ? bossResult === "crowd"
          : null
        : match.phase.gameWinner === undefined || !me?.team
          ? null
          : match.phase.gameWinner === me.team,
      avgScore: me?.avg ?? null,
      rating: me?.rating ?? null,
      brilliant: match.moves.filter((m) => m.brilliant).length,
      bestMove: bestMoveOf(match.moves),
      ...feats,
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
      if (localStorage.getItem(`brc.lobby.${linkCode}`)) joinLobby(linkCode);
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

  const practiceOn = () => {
    try {
      return localStorage.getItem("brc.practice") === "1";
    } catch {
      return false;
    }
  };

  /** Solo against bots (or a boss, for a raid), in the mode given or the one picked. */
  const startSolo = async (mode?: ModeChoiceId) => {
    unlockAudio();
    setLoading(true);
    const engines = await enginePool();
    setLoading(false);
    const m = new SoloMatch(engines, playerName(), { ...DEFAULT_SETTINGS, ...overridesFromUrl(mode) }, practiceOn());
    use(m);
    m.start();
  };

  /**
   * Into a lobby by code. A queue lobby (PLAY) brings the queue's own settings (the server's, remembered with the
   * code for a reload); a lobby you made, the mode you made it in.
   */
  const joinLobby = (code: string, opts: { queue?: "crowd" | "raid"; mode?: ModeChoiceId } = {}) => {
    const key = `brc.queue.${code.toUpperCase()}`;
    let queue = opts.queue;
    try {
      if (queue) localStorage.setItem(key, queue);
      else queue = (localStorage.getItem(key) as "crowd" | "raid" | null) ?? undefined;
    } catch {
      // No storage.
    }
    if (!opts.queue) playNowTries.current = 0;
    unlockAudio();
    setError(null);
    const m = new NetMatch(code.toUpperCase(), playerName(), enginePool, queue ? false : practiceOn());
    m.settings = queue
      ? { ...DEFAULT_SETTINGS, ...(queue === "raid" ? RAID_SETTINGS : modeSettings("crowd", { crowdTeams: true, augments: true })) }
      : { ...DEFAULT_SETTINGS, ...overridesFromUrl(opts.mode) };
    // The queue shows at once (not "Connecting…"); the lobby confirms it.
    if (queue) m.auto = true;
    use(m);
    history.replaceState(null, "", `/lobby/${m.code}${location.search}`);
    m.connect();
  };

  const createLobby = async (modeId?: ModeChoiceId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(location.search);
      params.delete("debug");
      if (quickPace()) params.set("pace", "quick");
      const mode = { ...chosenMode(), ...(modeId ? { mode: modeId } : {}) };
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
      joinLobby(body.code, { mode: mode.mode });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /** PLAY: the queue for a mode (the 50 v 50 lobby that's filling up, or a raid's). */
  const playNowTries = useRef(0);
  const playNowMode = useRef<"crowd" | "raid">("crowd");
  const retriedFor = useRef<AnyMatch | null>(null);
  const playNow = async (mode: "crowd" | "raid", retry = false) => {
    playNowTries.current = retry ? playNowTries.current + 1 : 1;
    playNowMode.current = mode;
    unlockAudio();
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (mode === "raid") q.set("mode", "raid");
      // (?pool=NAME: a queue of its own, for tests.)
      const pool = new URLSearchParams(location.search).get("pool");
      if (pool) q.set("pool", pool);
      const res = await fetch(`/api/play${q.size ? `?${q}` : ""}`, { method: "POST" });
      const body = (await res.json()) as { code?: string; message?: string };
      if (!body.code) throw new Error(body.message ?? "Couldn't find a match.");
      joinLobby(body.code, { queue: mode });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const leave = () => {
    // Leaving a lobby before it starts (Cancel in the queue) frees the seat.
    if (match instanceof NetMatch && (match.phase.kind === "lobby" || match.phase.kind === "loading")) match.leave();
    else match?.dispose();
    setMatch(null);
    history.replaceState(null, "", "/");
  };

  /** Where the computer's side menu goes (front-door pages only, outside a match). */
  const goHome = () => {
    closeProfile();
    setShowSettings(false);
    setShowShop(false);
    if (location.pathname !== "/") history.replaceState(null, "", "/");
  };
  const nav: FrontNav = {
    home: () => {
      goHome();
      setHomeIntent(null);
    },
    bossAlone: () => {
      goHome();
      setHomeIntent({ kind: "boss", n: Date.now() });
    },
    friends: () => {
      goHome();
      setHomeIntent({ kind: "friends", n: Date.now() });
    },
    shop: () => {
      goHome();
      setShowShop("shop");
    },
    profile: () => {
      goHome();
      openProfile({ you: true, name: account().profile?.user.name ?? "" });
    },
    settings: () => {
      goHome();
      setShowSettings(true);
    },
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
  if (!match && showSettings) {
    return (
      <FrontFrame page="settings" nav={nav}>
        <SettingsScreen
          onBack={() => {
            setShowSettings(false);
            if (location.pathname === "/settings") history.replaceState(null, "", "/");
          }}
          onSoundLab={() => setSoundLab(true)}
        />
      </FrontFrame>
    );
  }
  if (!match && profileOpen) {
    return (
      <FrontFrame page={profileOpen.you || profileOpen.uid === account().profile?.user.id ? "profile" : undefined} nav={nav}>
        <ProfilePage
          target={profileOpen}
          onLocker={() => {
            closeProfile();
            setShowShop("locker");
          }}
          onSettings={() => {
            closeProfile();
            setShowSettings(true);
          }}
        />
      </FrontFrame>
    );
  }
  if (!match && showShop) {
    return (
      <FrontFrame page="shop" nav={nav}>
      <ShopScreen
        initial={showShop === "locker" ? "locker" : undefined}
        onBack={() => {
          setShowShop(false);
          if (location.pathname === "/shop") history.replaceState(null, "", "/");
        }}
      />
      </FrontFrame>
    );
  }
  // Still finding out who you are: a plain splash rather than a flash of the wrong screen.
  if (!match && (config === null || (config.accounts && !profile))) {
    return (
      <div class="fd-splash">
        <Logo />
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
      <FrontFrame page="home" nav={nav}>
      <HomeScreen
        intent={homeIntent}
        loading={loading}
        error={error}
        joinCode={mustSignInToPlayOnline() ? undefined : linkCode}
        onlineLocked={mustSignInToPlayOnline()}
        onPlay={(mode) => void playNow(mode)}
        onSolo={(mode) => void startSolo(mode)}
        onCreateLobby={(mode) => void createLobby(mode)}
        onJoinLobby={(code) => joinLobby(code)}
        onSignIn={() => chooseGuest(false)}
        onProfile={() => openProfile({ you: true, name: account().profile?.user.name ?? "" })}
        onShop={() => setShowShop("shop")}
      />
      </FrontFrame>
    );
  }

  // Play now: the lobby started a moment before we got in, so get the next one.
  if (match instanceof NetMatch && match.error && /already started|full/.test(match.error) && playNowTries.current > 0 && playNowTries.current < 3 && retriedFor.current !== match) {
    retriedFor.current = match;
    queueMicrotask(() => void playNow(playNowMode.current, true));
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
    again: () => (match instanceof SoloMatch ? void startSolo(match.settings.raid ? "raid" : match.settings.mode) : leave()),
  });
  // A name tapped during the match: their profile over the game (which goes on underneath).
  const overlay = profileOpen && (
    <div class="fd-overlay">
      <FrontFrame>
        <PlayerProfileScreen target={profileOpen} onBack={closeProfile} />
      </FrontFrame>
    </div>
  );
  // Computers get the leaderboard as a permanent sidebar during the knockout stages.
  const tower = ["play", "scoring", "reveal", "spectating", "final", "watching", "boss"].includes(match.phase.kind) && match.standings().length > 0;
  // Quick chat's bubble: the newest message for a moment while no chat is on screen (it lets every tap through).
  const bubble = <ChatBubble match={match} />;
  if (!tower)
    return (
      <>
        {screen}
        {bubble}
        {overlay}
      </>
    );
  return (
    <div class="arena">
      {overlay}
      <aside class="tower-side">
        {(() => {
          const v = towerView(match);
          return (
            <>
              {v.teamLabel && <div class="tower-team">{v.teamLabel}</div>}
              <RaceTower standings={v.standings} cutoff={v.cutoff} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} floats={match.chat?.floats()} />
            </>
          );
        })()}
      </aside>
      {screen}
      {bubble}
    </div>
  );
}

const boardKey = (b: { id: number; generation: number; ply: number }) => `${b.id}:${b.generation}:${b.ply}`;

function renderPhase(match: AnyMatch, actions: { leave: () => void; again: () => void }) {
  const p = match.phase;
  switch (p.kind) {
    case "loading":
      if (match instanceof NetMatch && match.auto)
        return (
          <FrontFrame wide>
            <QueueScreen match={match} onCancel={actions.leave} />
          </FrontFrame>
        );
      return (
        <div class="screen center">
          <p class="muted">Connecting…</p>
        </div>
      );
    case "lobby":
      if (!(match instanceof NetMatch)) return null;
      return match.auto ? (
        <FrontFrame wide>
          <LobbyScreen match={match} onLeave={actions.leave} />
        </FrontFrame>
      ) : (
        <LobbyScreen match={match} onLeave={actions.leave} />
      );
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
      // (Keyed by the cut: once out, online, you stay on this screen, and each later cut is a judgement of its own.)
      if (isCrowd(match)) return <CrowdCut key={p.stage} match={match} {...p} />;
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

/** A profile as a page (outside a match): its address, and back to where you were. */
function ProfilePage({ target, onLocker, onSettings }: { target: ProfileTarget; onLocker: () => void; onSettings: () => void }) {
  useEffect(() => {
    const path = target.you ? "/profile" : target.uid ? `/profile/${target.uid}` : null;
    if (path && location.pathname !== path) history.replaceState(null, "", path);
  }, [target]);
  return (
    <PlayerProfileScreen
      target={target}
      onBack={() => {
        closeProfile();
        if (location.pathname.startsWith("/profile")) history.replaceState(null, "", "/");
      }}
      onLocker={onLocker}
      onSettings={onSettings}
    />
  );
}
