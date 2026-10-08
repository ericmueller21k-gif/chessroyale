import type { ComponentChildren } from "preact";
import { useEffect, useReducer, useRef, useState } from "preact/hooks";
import { type MatchmakingType, CROWD_KNOCKOUTS, RAID_SETTINGS, raidBossElo, DEFAULT_SETTINGS, DRAW_RULES, PACE_SETTINGS, bestMoveOf, definedOnly, matchFeats, modeSettings, speedOption, type DrawRule, type FinalFormat, type ModeChoiceId, type Settings } from "@chessroyale/core";
import { bossInUrl, chosenBoss, chosenMode, chosenOpeningMoves } from "./screens/Home.tsx";
import { unlockAudio } from "./components/Countdown.tsx";
import { RaceTower } from "./components/RaceTower.tsx";
import { resetBoardsStrip } from "./components/TinyBoard.tsx";
import { enginePool } from "./engine.ts";
import { cutLabel, elimination, isCrowd, roundLive, towerView, type GameView } from "./game.ts";
import { NetMatch, forgetSeat, hasSeat, lobbyStatus, type LobbyGone, type LobbyResult } from "./net.ts";
import { SoloMatch } from "./solo.ts";
import { FinalScreen } from "./screens/Final.tsx";
import { HomeScreen } from "./screens/Home.tsx";
import { LobbyScreen } from "./screens/Lobby.tsx";
import { QueueLine, QueueScreen } from "./screens/Queue.tsx";
import { OpeningGrid } from "./screens/OpeningGrid.tsx";
import { PlayScreen } from "./screens/Play.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { RevealScreen } from "./screens/Reveal.tsx";
import { SoundLab } from "./screens/SoundLab.tsx";
import { PlayerProfileScreen } from "./screens/PlayerProfile.tsx";
import { showBanNotice } from "./components/FairPlay.tsx";
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
import { ChatBubble, useMedia } from "./components/QuickChat.tsx";
import { LobbyChat } from "./components/LobbyChat.tsx";

/**
 * Playtest overrides from the URL, e.g. ?rounds=4&clock=15&draw=weighted (handy for quick tests). `matchBoss`: a raid's
 * boss is matched to you (a Solo raid, like an online one), not the one last picked from the boss menu (Boss alone).
 */
function overridesFromUrl(modeId?: ModeChoiceId, matchBoss = false): Partial<Settings> {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const draw = q.get("draw") as DrawRule | null;
  const mode = { ...chosenMode(), ...(modeId ? { mode: modeId } : {}) };
  const raid = mode.mode === "raid";
  const crowd = mode.mode === "crowd" || raid;
  // ?format=team|boss|duel: skip the pre-game votes and play that ending (for testing).
  const format = q.get("format") as FinalFormat | null;
  const forced = crowd && format && format in CROWD_KNOCKOUTS ? { finalFormat: format, knockoutsPerStage: CROWD_KNOCKOUTS[format], augments: false } : {};
  // ?speed=normal|variable|bullet: that speed (for testing, with ?format=; a stale "slow" is Normal).
  const speed = crowd ? (speedOption(q.get("speed"))?.patch ?? {}) : {};
  return {
    // The mode's own rules and pace first, then pace and playtest overrides on top (only the ones that are set).
    // The boss raid: its own settings, and (solo) a boss a step above your rating.
    ...(raid
      ? { ...RAID_SETTINGS, bossFixedElo: (matchBoss && !bossInUrl() ? 0 : chosenBoss()) || raidBossElo([account().profile?.rating ?? null]) }
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
    ...speed,
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

/** An invite link (/lobby/ABCDE) opens the join form with the code filled in (once we know the lobby is still open). */
const linkCode = location.pathname.match(/^\/lobby\/([A-Za-z2-9]{5})\/?$/)?.[1]?.toUpperCase();

/**
 * The online match this device is seated in (its lobby code), so opening the app from scratch puts you back in it, as
 * chess sites do. Forgotten when you leave on purpose (Leave, Cancel, Home), when it ends, or when it's gone.
 */
const CURRENT_KEY = "brc.current";
function currentMatch(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}
function setCurrentMatch(code: string | null) {
  try {
    if (code) localStorage.setItem(CURRENT_KEY, code);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    // No storage: no rejoining from a fresh start.
  }
}
/** Opened from scratch at home (not a link) with a seat in a match: check it's still on, and go back in. */
const rejoinCode = (() => {
  if (linkCode || location.pathname !== "/") return null;
  const code = currentMatch();
  return code && /^[A-Z2-9]{5}$/.test(code) && hasSeat(code) ? code : null;
})();

/** A lobby that has closed (a stale tab, an old link, or the match on screen): the note on the home screen. */
interface EndedNote {
  code: string;
  why: LobbyGone;
  /** Your result in it, if you played it (the server keeps it on your profile). */
  result: LobbyResult | null;
}

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
  const [showShop, setShowShop] = useState<false | "shop" | "locker" | "chat">(() => (location.pathname === "/shop" ? "shop" : false));
  const [showSettings, setShowSettings] = useState(() => location.pathname === "/settings");
  /** The computer's side menu: open the home screen's boss menu or Play with friends. */
  const [homeIntent, setHomeIntent] = useState<{ kind: "boss" | "friends"; n: number } | null>(null);
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(() =>
    location.pathname === "/privacy" ? "privacy" : location.pathname === "/terms" ? "terms" : null,
  );
  // Chose "play vs bots as a guest" on the landing page (this device remembers).
  const [guest, setGuest] = useState(storedGuest);
  const [inviteSkipped, setInviteSkipped] = useState(false);
  /**
   * An invite link's lobby: being checked (a moment's splash), still open (the join form opens with its code), or
   * gone (null: home with the note instead). A device with a seat in it rejoins straight away.
   */
  const [invite, setInvite] = useState<"checking" | "open" | null>(() => (!linkCode ? null : hasSeat(linkCode) ? "open" : "checking"));
  const [ended, setEnded] = useState<EndedNote | null>(null);
  /** Opened from scratch with a seat in a match: a moment's splash while we check it's still on. */
  const [rejoining, setRejoining] = useState(!!rejoinCode);
  /**
   * The lobby has closed: home (the address too, so reopening the app lands there) with a note, and your result if
   * you played (from the server, asked before this so the note shows whole, never growing a button a moment later).
   */
  const showEnded = (code: string, why: LobbyGone, result: LobbyResult | null) => {
    forgetSeat(code);
    if (currentMatch() === code) setCurrentMatch(null);
    setInvite(null);
    if (location.pathname !== "/") history.replaceState(null, "", "/");
    setEnded({ code, why, result });
  };
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
  /** A computer (the front door's frame): the queue fills in place, with the lobby's chat beside it. */
  const computer = useMedia("(min-width: 1024px)");

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

  // Back on a lobby link this device already has a seat in (a reload, the app reopened, a dropped connection):
  // rejoin straight away (if the lobby has closed since, the connection is refused and the note shows). Otherwise
  // (an invite) ask first: a match that's over, or a lobby that's gone, is a note on the home screen, not a join form.
  useEffect(() => {
    if (!linkCode) return;
    if (hasSeat(linkCode)) return joinLobby(linkCode);
    void lobbyStatus(linkCode).then((s) => {
      if (s && (!s.open || s.phase === "over")) {
        setInvite(null);
        showEnded(linkCode, s.open ? "ended" : "unknown", s.result ?? null);
      } else setInvite("open");
    });
  }, []);
  // Opened from scratch with a seat in a match that's still on (waiting or playing): back in. Not if it's over.
  useEffect(() => {
    if (!rejoinCode) return;
    void lobbyStatus(rejoinCode).then((s) => {
      if (s?.open && s.phase !== "over") joinLobby(rejoinCode, { resume: s.phase === "playing" });
      else if (s) setCurrentMatch(null);
      setRejoining(false);
    });
  }, []);
  // A match that has ended isn't one to come back to.
  useEffect(() => {
    if (match instanceof NetMatch && match.phase.kind === "results" && currentMatch() === match.code) setCurrentMatch(null);
  });
  // The lobby on screen has closed (or the server has no such lobby): home, with the note (your result first, if the
  // server hasn't been asked yet; the screen stays as it is meanwhile).
  const goingHome = useRef<AnyMatch | null>(null);
  const onScreen = useRef<AnyMatch | null>(null);
  onScreen.current = match;
  useEffect(() => {
    if (!(match instanceof NetMatch) || !match.gone || goingHome.current === match) return;
    goingHome.current = match;
    const m = match;
    const go = (result: LobbyResult | null) => {
      // (Already left it meanwhile: nothing to do.)
      if (onScreen.current !== m) return;
      m.dispose();
      setMatch(null);
      showEnded(m.code, m.gone!, result);
    };
    if (m.goneResult !== undefined) go(m.goneResult);
    else void lobbyStatus(m.code, 3000).then((s) => go(s?.result ?? null));
  });

  const debug = new URLSearchParams(location.search).has("debug");
  const use = (m: AnyMatch) => {
    match?.dispose();
    setEnded(null);
    // (An invite link is used up once you're in: back home, its join form doesn't open again.)
    setInvite(null);
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

  /**
   * Against bots in your browser, in the mode given or the one picked. Solo (`fill`): the queue screen fills with your
   * bots first, and a raid has 49 of them in the crowd with a boss matched to you. Boss alone: you against the boss
   * picked from the menu, at once.
   */
  const startSolo = async (mode?: ModeChoiceId, opts: { fill?: boolean } = {}) => {
    unlockAudio();
    setLoading(true);
    const engines = await enginePool();
    setLoading(false);
    const fill = !!opts.fill;
    const m = new SoloMatch(engines, playerName(), { ...DEFAULT_SETTINGS, ...overridesFromUrl(mode, fill) }, practiceOn(), fill);
    use(m);
    if (fill) m.fill();
    else m.start();
  };

  /**
   * Into a lobby by code. A queue lobby (PLAY) brings the queue's own settings (the server's, remembered with the
   * code for a reload); a lobby you made, the mode you made it in.
   */
  const joinLobby = (code: string, opts: { queue?: "crowd" | "raid"; mode?: ModeChoiceId; typed?: boolean; resume?: boolean } = {}) => {
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
    // A code typed into Join that leads nowhere is "Can't join", not the note.
    m.typed = !!opts.typed;
    // Back into a match already being played: no queue screen on the way.
    if (opts.resume) {
      m.resuming = true;
      m.auto = false;
    }
    use(m);
    // Seated here: opening the app from scratch comes back to it (until you leave on purpose or it ends).
    setCurrentMatch(m.code);
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
      const body = (await res.json()) as { code?: string; message?: string; banned?: boolean };
      if (body.banned) return showBanNotice();
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
  const playNowMode = useRef<{ mode: "crowd" | "raid"; type: Exclude<MatchmakingType, "solo"> }>({ mode: "crowd", type: "default" });
  const retriedFor = useRef<AnyMatch | null>(null);
  /** Servers busy: in line for a seat (the queue screen says so, with about how long). */
  const [inLine, setInLine] = useState<{ mode: "crowd" | "raid"; waitSeconds: number } | null>(null);
  const lineRun = useRef(0);
  const playNow = async (mode: "crowd" | "raid", type: Exclude<MatchmakingType, "solo"> = "default", retry = false, ticket?: string) => {
    playNowTries.current = retry ? playNowTries.current + 1 : 1;
    playNowMode.current = { mode, type };
    const run = ++lineRun.current;
    unlockAudio();
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (mode === "raid") q.set("mode", "raid");
      if (type === "botsoff") q.set("type", "botsoff");
      // (?pool=NAME: a queue of its own, for tests.)
      const pool = new URLSearchParams(location.search).get("pool");
      if (pool) q.set("pool", pool);
      // (Already in line: from "let bots fill" when the servers were busy.)
      if (ticket) q.set("ticket", ticket);
      for (;;) {
        const res = await fetch(`/api/play${q.size ? `?${q}` : ""}`, { method: "POST" });
        const body = (await res.json()) as { code?: string; message?: string; busy?: boolean; ticket?: string; waitSeconds?: number; retryMs?: number; banned?: boolean };
        if (run !== lineRun.current) return; // Cancelled while asking.
        // Banned for fair play: the ban notice, with its appeal (solo stays open).
        if (body.banned) {
          setInLine(null);
          return showBanNotice();
        }
        if (body.code) {
          setInLine(null);
          joinLobby(body.code, { queue: mode });
          return;
        }
        // "Servers are busy, you're in line: about N s": wait as told, then ask again with the ticket (same place).
        // A 429 while in line just means ask a little later.
        if ((body.busy && body.ticket) || (res.status === 429 && inLineNow(run))) {
          if (body.ticket) q.set("ticket", body.ticket);
          setInLine((cur) => ({ mode, waitSeconds: body.waitSeconds ?? cur?.waitSeconds ?? 30 }));
          setLoading(false);
          await new Promise((r) => setTimeout(r, Math.max(1000, body.retryMs ?? 3000)));
          if (run !== lineRun.current) return;
          continue;
        }
        throw new Error(body.message ?? "Couldn't find a match.");
      }
    } catch (e) {
      if (run !== lineRun.current) return;
      setInLine(null);
      setError((e as Error).message);
    } finally {
      if (run === lineRun.current) setLoading(false);
    }
  };
  /** Whether PLAY run `run` is already waiting in line (a 429 then means "ask later", not an error). */
  const lineState = useRef(inLine);
  lineState.current = inLine;
  const inLineNow = (run: number) => run === lineRun.current && !!lineState.current;
  const leaveLine = () => {
    lineRun.current++;
    setInLine(null);
    setLoading(false);
  };

  /**
   * Bots off → Default, from the queue: this seat is handed back and you're in Default's queue at once, your wait so
   * far counting (bots fill a minute after you first joined). If the lobby filled meanwhile, you just stay in it.
   */
  const letBotsFill = async () => {
    if (!(match instanceof NetMatch) || !match.botsOff) return;
    const from = match;
    const q = new URLSearchParams({ type: "default", from: from.code });
    if (from.settings.raid) q.set("mode", "raid");
    const pool = new URLSearchParams(location.search).get("pool");
    if (pool) q.set("pool", pool);
    try {
      const res = await fetch(`/api/play?${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seat: from.seat }) });
      const body = (await res.json()) as { code?: string; busy?: boolean; ticket?: string };
      if (!res.ok || onScreen.current !== from) return;
      // Servers busy: the seat is already handed back, so wait in Default's line (your wait still counts).
      if (body.busy && body.ticket) {
        forgetSeat(from.code);
        setCurrentMatch(null);
        from.dispose();
        setMatch(null);
        void playNow(from.settings.raid ? "raid" : "crowd", "default", false, body.ticket);
        history.replaceState(null, "", `/${location.search}`);
        return;
      }
      if (!body.code) return;
      forgetSeat(from.code);
      joinLobby(body.code, { queue: from.settings.raid ? "raid" : "crowd" });
    } catch {
      // Offline: stay where you are.
    }
  };

  const leave = () => {
    // On purpose: opening the app again doesn't bring you back to this match.
    setCurrentMatch(null);
    // Leaving a lobby before it starts (Cancel in the queue) frees the seat.
    if (match instanceof NetMatch && (match.phase.kind === "lobby" || match.phase.kind === "loading")) match.leave();
    else match?.dispose();
    // Done with a match that's over: this device forgets its seat (its old link then says it has ended).
    if (match instanceof NetMatch && match.phase.kind === "results") forgetSeat(match.code);
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

  /**
   * The side menu while you're in the queue (it stays on a computer): Play is where you are, and your profile opens over
   * the queue (as a name tapped in it does). Anything else leaves the queue first, as leaving the page does on the
   * chess sites, then goes there.
   */
  const queueNav: FrontNav = {
    ...nav,
    home: () => undefined,
    profile: () => openProfile({ you: true, name: account().profile?.user.name ?? "" }),
    ...Object.fromEntries(
      (["bossAlone", "friends", "shop", "settings"] as const).map((k) => [
        k,
        () => {
          if (match) leave();
          else leaveLine();
          nav[k]();
        },
      ]),
    ),
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
          onShop={() => {
            closeProfile();
            setShowShop("chat");
          }}
        />
      </FrontFrame>
    );
  }
  if (!match && showShop) {
    return (
      <FrontFrame page="shop" nav={nav}>
      <ShopScreen
        initial={showShop === "locker" || showShop === "chat" ? showShop : undefined}
        onBack={() => {
          setShowShop(false);
          if (location.pathname === "/shop") history.replaceState(null, "", "/");
        }}
      />
      </FrontFrame>
    );
  }
  // Still finding out who you are (or whether an invite's lobby is still open): a plain splash rather than a flash of
  // the wrong screen.
  if (!match && (config === null || (config.accounts && !profile) || invite === "checking" || rejoining)) {
    return (
      <div class="fd-splash">
        <Logo />
      </div>
    );
  }
  // Not signed in, where online play needs it: the landing page (an invite link shows it even to guests).
  const noLanding = new URLSearchParams(location.search).has("nolanding");
  const inviteCode = invite === "open" ? linkCode : undefined;
  const notice = ended ? (ended.why === "idle" ? "That lobby has closed." : "That match has ended.") : undefined;
  if (!match && !noLanding && config?.onlineNeedsSignIn && profile && !profile.user.signedIn && (!guest || (inviteCode && !inviteSkipped))) {
    return (
      <LandingScreen
        google={config.google}
        email={config.email}
        joinCode={inviteCode}
        notice={notice}
        failed={signinParam === "failed"}
        onGuest={() => {
          chooseGuest(true);
          setInviteSkipped(true);
          if (inviteCode) history.replaceState(null, "", "/");
        }}
      />
    );
  }
  /**
   * Home, or home in the queue (`queue`: you pressed PLAY). The same frame and screen either way, so on a computer the
   * side menu, the live panel and your pawn stay put while the play column turns into the queue (and back on Cancel).
   */
  const home = (queue?: ComponentChildren, chat?: ComponentChildren, side = computer) => (
    // (A phone's queue is the whole screen: no hidden menu or panel to draw again with every arrival.)
    <FrontFrame page={queue ? "queue" : "home"} nav={!queue ? nav : computer ? queueNav : undefined}>
      <HomeScreen
        queue={queue}
        chat={chat}
        side={side}
        intent={homeIntent}
        loading={loading}
        error={error}
        joinCode={mustSignInToPlayOnline() ? undefined : inviteCode}
        notice={
          ended && notice
            ? {
                text: notice,
                onDismiss: () => setEnded(null),
                onSeeResult: ended.result
                  ? () => {
                      const playedAt = ended.result!.playedAt;
                      setEnded(null);
                      openProfile({ you: true, name: account().profile?.user.name ?? "", match: playedAt });
                    }
                  : undefined,
              }
            : undefined
        }
        onlineLocked={mustSignInToPlayOnline()}
        onPlay={(mode, type) => void playNow(mode, type)}
        onSolo={(mode, opts) => void startSolo(mode, opts)}
        onCreateLobby={(mode) => void createLobby(mode)}
        onJoinLobby={(code) => joinLobby(code, { typed: code !== inviteCode })}
        onSignIn={() => chooseGuest(false)}
        onProfile={() => openProfile({ you: true, name: account().profile?.user.name ?? "" })}
        onShop={() => setShowShop("shop")}
      />
    </FrontFrame>
  );
  // (Always a fragment with the frame first, in the queue or not, so the frame is kept from one to the other.)
  if (!match && inLine) return <>{home(<QueueLine raid={inLine.mode === "raid"} waitSeconds={inLine.waitSeconds} onCancel={leaveLine} />)}</>;
  if (!match) return <>{home()}</>;

  // Play now: the lobby started a moment before we got in, so get the next one.
  if (match instanceof NetMatch && match.error && /already started|full/.test(match.error) && playNowTries.current > 0 && playNowTries.current < 3 && retriedFor.current !== match) {
    retriedFor.current = match;
    queueMicrotask(() => void playNow(playNowMode.current.mode, playNowMode.current.type, true));
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

  // A name tapped during the match: their profile over the game (which goes on underneath).
  const overlay = profileOpen && (
    <div class="fd-overlay">
      <FrontFrame>
        <PlayerProfileScreen target={profileOpen} onBack={closeProfile} match={match instanceof NetMatch ? match.code : undefined} />
      </FrontFrame>
    </div>
  );
  // Quick chat's bubble: the newest message for a moment while no chat is on screen (it lets every tap through).
  const bubble = <ChatBubble match={match} />;
  // Waiting for the match to fill (PLAY, or Solo's bots taking their seats): the home screen, in the queue.
  if (inQueue(match)) {
    const q = match as NetMatch | SoloMatch;
    const letBots = match instanceof NetMatch ? () => void letBotsFill() : undefined;
    // (The lobby's chat: a phone's is in the queue screen, under Cancel; a computer's under your card, beside the lobby.)
    return (
      <>
        {home(<QueueScreen match={q} onCancel={leave} onLetBotsFill={letBots} chat={!computer} />, computer ? <LobbyChat match={q} /> : undefined, computer)}
        {bubble}
        {overlay}
      </>
    );
  }

  const screen = renderPhase(match, {
    leave,
    // (Solo again as it was: through the queue screen, or Boss alone straight in.)
    again: () => (match instanceof SoloMatch ? void startSolo(match.settings.raid ? "raid" : match.settings.mode, { fill: match.players.length > 0 }) : leave()),
  });
  // Computers get the leaderboard as a permanent sidebar during the knockout stages (and the pre-game votes, so the
  // board is in the same place when the game begins).
  const tower = ["vote", "play", "scoring", "reveal", "spectating", "final", "watching", "boss"].includes(match.phase.kind) && match.standings().length > 0;
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

/** Going back into a match already being played: the splash until its screen comes (not the queue it started in). */
const resumingSplash = (match: AnyMatch) =>
  match instanceof NetMatch && match.resuming && (match.phase.kind === "loading" || (match.phase.kind === "lobby" && match.started));

/**
 * Waiting for a match to fill: a queue you joined with PLAY (from the tap, while connecting, and in its lobby), or
 * Solo's bots taking their seats. Private lobbies with a code have their own screen.
 */
function inQueue(match: AnyMatch): boolean {
  if (resumingSplash(match)) return false;
  const k = match.phase.kind;
  if (match instanceof SoloMatch) return k === "lobby";
  return match instanceof NetMatch && match.auto && (k === "loading" || k === "lobby");
}

function renderPhase(match: AnyMatch, actions: { leave: () => void; again: () => void }) {
  const p = match.phase;
  if (resumingSplash(match))
    return (
      <div class="fd-splash">
        <Logo />
      </div>
    );
  // (The queue, inQueue above, is the home screen's: see App.)
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
      return <PlayScreen key={boardKey(p.board)} match={match} board={p.board} startsAt={p.startsAt} deadline={p.deadline} allowedMs={p.allowedMs} clock={p.clock} strike={p.strike} />;
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
function ProfilePage({ target, onLocker, onSettings, onShop }: { target: ProfileTarget; onLocker: () => void; onSettings: () => void; onShop: () => void }) {
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
      onShop={onShop}
    />
  );
}
