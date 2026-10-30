import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "preact/hooks";
import { type MatchmakingType, POWER_IDS, WEAK_BOTS, bossDef, bossIdFromLink, CROWD_KNOCKOUTS, RAID_SETTINGS, raidBossElo, DEFAULT_SETTINGS, DRAW_RULES, QUICK_PACE, bestMoveOf, definedOnly, matchFeats, modeSettings, pausedLine, speedOption, startOption, type DrawRule, type FinalFormat, type ModeChoiceId, type Settings } from "@chessroyale/core";
import { bossInUrl, bossTierFromUrl, chosenBoss, chosenHomeMode, chosenMode, lobbyModeOf, raidInUrl, rememberBossPick } from "./screens/Home.tsx";
import { lastBoss } from "./boss-history.ts";
import { unlockAudio } from "./components/Countdown.tsx";
import { RaceTower } from "./components/RaceTower.tsx";
import { resetBoardsStrip } from "./components/TinyBoard.tsx";
import { enginePool } from "./engine.ts";
import { bossAlone, cutLabel, elimination, isCrowd, roundLive, scoreDp, towerView, type GameView } from "./game.ts";
import { NetMatch, forgetSeat, hasSeat, lobbyStatus, type LobbyGone, type LobbyResult } from "./net.ts";
import { exitFor, exitMatch, onExitMatch } from "./match-exit.ts";
import { useRecluseTalk } from "./recluse-talk.ts";
import { MatchMenu } from "./components/MatchMenu.tsx";
import type { LeftHow } from "@chessroyale/chess";
import { SoloMatch } from "./solo.ts";
import { FinalScreen } from "./screens/Final.tsx";
import { HomeScreen } from "./screens/Home.tsx";
import { LobbyScreen } from "./screens/Lobby.tsx";
import { QueueLine, QueueScreen } from "./screens/Queue.tsx";
import { OpeningGrid } from "./screens/OpeningGrid.tsx";
import { PlayScreen } from "./screens/Play.tsx";
import { PhaseChangeScreen, SimulScreen } from "./screens/Recluse2.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { RevealScreen } from "./screens/Reveal.tsx";
import { PlayerProfileScreen } from "./screens/PlayerProfile.tsx";
import { showBanNotice } from "./components/FairPlay.tsx";
import { closeProfile, openProfile, useProfileTarget, type ProfileTarget } from "./profile-nav.ts";
import { ShopScreen } from "./screens/Shop.tsx";
import { account, askAgeAgain, loadAccount, mustSignInToPlayOnline, playerName, recordSoloResult } from "./account.ts";
import { isAdmin } from "./boss-brain.ts";
import { difficultyElo, difficultyMaia } from "./boss-difficulty.ts";
import { setLiveBusy, startLive } from "./live.ts";
import { setInviteHost } from "./friends.ts";
import { FriendsScreen } from "./screens/Friends.tsx";
import { SettingsScreen } from "./screens/Settings.tsx";
import { AutoChessScreen } from "./screens/AutoChess.tsx";
import { TownPage, type BotGameAsk } from "./town/TownPage.tsx";
import { FaqScreen } from "./screens/Faq.tsx";
import { Logo } from "./components/FrontDoor.tsx";
import { FrontFrame, type FrontNav } from "./components/FrontMenu.tsx";
import { useAccount } from "./screens/Profile.tsx";
import { LandingScreen } from "./screens/Landing.tsx";
import { LegalScreen, leaveLegal, legalPageOf, type LegalPage } from "./screens/Legal.tsx";
import { CrowdCut, CrowdReveal, WatchScreen } from "./screens/Crowd.tsx";
import { VoteScreen } from "./screens/Vote.tsx";
import { BossScreen } from "./screens/Boss.tsx";
import { SpectateScreen } from "./screens/Spectate.tsx";
import { StageBreakScreen } from "./screens/StageBreak.tsx";
import { ChatBubble, useMedia } from "./components/QuickChat.tsx";
import { LobbyChat } from "./components/LobbyChat.tsx";
import { PartyClient, SquadsClient, createParty, currentParty, currentSquads, forgetSquads, partyStatus, squadsQueue, squadsSeat, squadsStatus, squadsTestLobby } from "./squads.ts";
import { SquadsQueue, SquadsScreen, squadsWaiting } from "./screens/Squads.tsx";
import { PartySheet } from "./screens/SquadsParty.tsx";
import { BotDuel, DuelQueue, NetDuel, savedDuelQueue, setRanked1v1Starter, startRanked1v1, type DuelSession } from "./duel.ts";
import { confirmLeaveDuelQueue, duelFoundAlert, setAwaySearch } from "./components/DuelQueueBar.tsx";
import { DuelFront } from "./screens/Duel.tsx";
import { measureSound } from "./sound.ts";
import { noteWhere } from "./problems.ts";
import { testParams } from "./test-switches.ts";
import { evalBarOn, practiceOn } from "./prefs.ts";
import { isPaused, pausedBosses } from "./status.ts";

/**
 * A match's settings: the mode and the choices made on the home screen, plus playtest overrides from the URL, e.g.
 * ?rounds=4&clock=15&draw=weighted (test switches: only for those allowed them, test-switches.ts; else ignored).
 * `matchBoss`: a Solo raid (you and bots): its strength is matched to you, with no difficulty on top; its boss is the
 * Boss raid screen's pick, as Boss alone's is.
 */
function overridesFromUrl(modeId?: ModeChoiceId, matchBoss = false): Partial<Settings> {
  const q = testParams();
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const draw = q.get("draw") as DrawRule | null;
  const mode = modeId ?? chosenMode();
  const raid = mode === "raid";
  const crowd = mode === "crowd" || raid;
  // Testing, admins: Boss alone (a raid alone, the boss picked) may meet a boss hidden from players (the Hidden Boss).
  const hidden = raid && !matchBoss && isAdmin();
  // ?format=team|boss|duel: skip the pre-game votes and play that ending (for testing).
  const format = q.get("format") as FinalFormat | null;
  const forced = crowd && format && format in CROWD_KNOCKOUTS ? { finalFormat: format, knockoutsPerStage: CROWD_KNOCKOUTS[format], augments: false } : {};
  // ?speed=bullet|blitz|rapid: that time control (for testing, with ?format=; old ids map over, unknown ones are Blitz).
  const speed = crowd ? (speedOption(q.get("speed"))?.patch ?? {}) : {};
  // ?start=normal|random|freestyle: that start (for testing, with ?format=, like ?speed=; an unknown id is Normal).
  const start = crowd && !raid ? (startOption(q.get("start"))?.patch ?? {}) : {};
  return {
    // The mode's own rules and pace first, then playtest overrides on top (only the ones that are set).
    // The boss raid: its own settings, and (solo) a boss a step above your rating.
    ...(raid
      ? {
          ...RAID_SETTINGS,
          // A step above your rating (a test link's ?boss=<tier> fixes it), plus the boss's own offset.
          bossFixedElo: bossTierFromUrl() || raidBossElo([account().profile?.rating ?? null]),
          // Boss alone and a Solo raid: the boss picked on the Boss raid screen ("" random). Random avoids your last.
          bossId: chosenBoss(hidden),
          ...(hidden ? { bossHidden: true } : {}),
          // Boss alone: the difficulty chosen next to the boss picker (Very easy to Very hard) on top of that strength.
          bossDifficulty: matchBoss || bossTierFromUrl() ? 0 : difficultyElo(),
          // Boss alone: the difficulty's Maia rating, the boss's moves picked at it (BOSS_DIFFICULTY's `maia`).
          bossAloneMaia: matchBoss || bossTierFromUrl() ? 0 : difficultyMaia(),
        }
      : // Testing: ?augments=0, no pre-game votes (a team final at the default clock).
        modeSettings(mode === "classic" ? "classic" : "crowd", { augments: q.get("augments") !== "0" })),
    // Testing: ?pace=quick, a shorter reveal and less settling in.
    ...(q.get("pace") === "quick" ? QUICK_PACE[crowd ? "crowd" : "classic"] : {}),
    ...definedOnly({
      roundsPerStage: n("rounds"),
      firstStageRounds: n("rounds"),
      moveClockSeconds: n("clock"),
      finalMaxTurns: n("finalTurns"),
      bossMaxMoves: n("bossMoves"),
      drawRuleByStage: draw && DRAW_RULES.includes(draw) ? [draw] : undefined,
    }),
    // (A test link's ?clock= gives Boss alone that clock too: the tests of the clock and of a missed move use it.)
    ...(n("clock") ? { bossAloneUntimed: false } : {}),
    ...forced,
    ...speed,
    ...start,
    // Any boss battle: not the boss you met last (when it's random); ?power= brings a boss power at once (tests).
    bossAvoid: lastBoss() ?? "",
    // Never a boss that's resting (a kill switch, status.ts): a solo game skips them as the server's lobbies do.
    ...(pausedBosses().length ? { bossesOff: pausedBosses() } : {}),
    ...((POWER_IDS as readonly string[]).includes(q.get("power") ?? "") ? { bossPowerTest: q.get("power")! } : {}),
    ...(raid ? {} : chosenBoss() && bossInUrl() ? { bossId: chosenBoss() } : {}),
    // Testing, solo: ?mate=1, the boss mates you at once (1.f3 e5 2.g4, its move): its attack on your king, then the result.
    ...(q.get("mate") === "1" ? { bossMateTest: true } : {}),
    // Testing, solo: ?paint=1 or 2 (with ?boss=smudgy), his rook already hidden where your king can step into its line: a move the
    // board you see offers and the real board refuses ("A painted piece stops that move."). His moves are scripted: 1, the
    // rook steps like a pawn, then strikes; 2, it steps twice like a pawn (for your rook to take).
    ...(q.get("paint") === "1" ? { bossPaintTest: 1 as const } : q.get("paint") === "2" ? { bossPaintTest: 2 as const } : {}),
    // Testing, solo: ?win=1, you mate the boss at once (1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6, your move: Qxf7): a boss beaten.
    ...(q.get("win") === "1" ? { bossWinTest: true } : {}),
    // Testing, solo: ?carrots=N (0 to 5, with ?boss=hopper&power=carrotpatch), N of Chub & Chirp's carrots a step from
    // one of his pieces and out of your reach, the rest a step from yours and out of his: his spin on N (5: he wins).
    ...(/^[0-5]$/.test(q.get("carrots") ?? "") ? { bossCarrotTest: Number(q.get("carrots")) } : {}),
    // Testing, solo: ?seeds=N (0 to 10, with ?boss=gardener), N seeds at every watering of the hippo gardener's, whatever
    // the clock says (his meter shows N).
    ...(/^(?:[0-9]|10)$/.test(q.get("seeds") ?? "") ? { bossSeedTest: Number(q.get("seeds")) } : {}),
    // Testing, solo (with ?boss=tiger): ?balloon=<pawn|knight|bishop|rook|queen|fakequeen>, every balloon of the circus
    // tiger's that shape (never a dud but the fake queen, which always pops); ?stage=N (1 to 4), every balloon goes on N
    // stages blown (4: ready at once, so it lands or pops at the end of that same turn).
    ...(/^(?:pawn|knight|bishop|rook|queen|fakequeen)$/.test(q.get("balloon") ?? "") ? { bossBalloonTest: q.get("balloon") as NonNullable<Settings["bossBalloonTest"]> } : {}),
    ...(/^[1-4]$/.test(q.get("stage") ?? "") ? { bossStageTest: Number(q.get("stage")) } : {}),
    // Testing: ?weakbots=1, every bot plays loosely and people rank above bots (WEAK_BOTS), so a test's player surely
    // survives the cuts.
    ...(q.get("weakbots") === "1" ? WEAK_BOTS : {}),
    // Testing: ?laststand=0, the God King never makes his Last Stand (a test that leaves a piece to burn on purpose).
    ...(q.get("laststand") === "0" ? { lastStandFrom: 999 } : {}),
    // Testing, solo: ?boss=<id>&wip=1 meets a boss whose powers are built before its art is (placeholders show).
    ...(q.get("wip") === "1" && bossDef(bossIdFromLink(q.get("boss")))?.powers ? { bossId: bossIdFromLink(q.get("boss"))!, bossUnfinished: true } : {}),
  };
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

/**
 * Squads' links: a party's invite (/squads/party/CODE), a lobby to rejoin (/squads/CODE), a test lobby (/squads/test/pairs;
 * /squads/test or /squads/test/start: the whole tournament from the first vote, bots in every other seat at once).
 */
const partyLinkCode = location.pathname.match(/^\/squads\/party\/([A-Za-z2-9]{5})\/?$/)?.[1]?.toUpperCase();
const squadsLinkCode = location.pathname.match(/^\/squads\/([A-Za-z2-9]{5})\/?$/)?.[1]?.toUpperCase();
const squadsTestStart = ((m) => (m ? (m[1] === undefined || m[1] === "start" ? "votes" : m[1]) : undefined))(location.pathname.match(/^\/squads\/test(?:\/(start|relay|pairs|final))?\/?$/)) as
  | "votes"
  | "relay"
  | "pairs"
  | "final"
  | undefined;
/** Opened from scratch at home with a seat in a Squads lobby (or its link): check it's still on, and go back in. */
const squadsRejoin = (() => {
  if (squadsLinkCode) return squadsSeat(squadsLinkCode) ? squadsLinkCode : null;
  if (linkCode || location.pathname !== "/") return null;
  return currentSquads();
})();

/** This address's query without a town game's seat (`at=`), as it was written ("?debug", not "?debug="), or "". */
const searchWithoutSeat = () => location.search.replace(/([?&])at=[^&]*(&|$)/, "$1").replace(/[?&]$/, "");

/**
 * Ranked 1 v 1's links: /1v1 queues at once (the home screen's 1 v 1 button does the same: startRanked1v1, duel.ts),
 * /1v1/CODE is a game you're in (a reload goes back to it).
 */
const duelLinkCode = location.pathname.match(/^\/1v1\/([A-Za-z2-9]{5})\/?$/)?.[1]?.toUpperCase();
const duelQueueLink = /^\/1v1\/?$/.test(location.pathname);

/** A lobby that has closed (a stale tab, an old link, or the match on screen): the note on the home screen. */
interface EndedNote {
  code: string;
  why: LobbyGone;
  /** Your result in it, if you played it (the server keeps it on your profile). */
  result: LobbyResult | null;
  /** You left its match (`why` "left"): how. */
  how?: LeftHow | null;
}

/** The home screen's note after coming back to a match you'd left (resigned, or gone too long). */
function leftNote(how: LeftHow | null | undefined): string {
  if (how === "away") return "You were away from that match too long: a bot took your seat, and it counted as a loss.";
  if (how === "early") return "You left that match before it began.";
  if (how === "out") return "You left that match after you were out.";
  return "You resigned that match.";
}

/**
 * Back from Google: ?signin=google (or failed; or age: the server wanted the age question answered again first). Read
 * once, then tidied out of the address bar.
 */
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

/** What's on screen, for error reports (problems.ts): a match's phase (a boss battle's moment too), else the page. */
function screenOf(match: AnyMatch | null, page: string): string {
  if (!match) return page;
  const p = match.phase;
  if (p.kind !== "boss") return p.kind;
  const moment = p.loading ? "loading" : p.intro ? "intro" : p.lights ? "lights out" : p.fall ? "fall" : (p.boss.powers?.events ?? []).map((e) => e.kind).join(" ");
  return moment ? `boss ${moment}` : "boss";
}

export function App() {
  const [match, setMatch] = useState<AnyMatch | null>(null);
  const savedResult = useRef<AnyMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A profile from the address: /profile is yours, /profile/ID someone's.
  useState(() => {
    const m = location.pathname.match(/^\/profile(?:\/([A-Za-z0-9_-]{1,64}))?\/?$/);
    if (m) openProfile(m[1] ? { uid: m[1], name: "" } : { you: true, name: "" });
  });
  const profileOpen = useProfileTarget();
  const [showShop, setShowShop] = useState<false | "shop" | "locker" | "chat">(() => (location.pathname === "/shop" ? "shop" : false));
  const [showSettings, setShowSettings] = useState(() => location.pathname === "/settings");
  /** The FAQ ("How HunChess works"), opened from Settings; back goes to Settings. */
  const [showFaq, setShowFaq] = useState(() => location.pathname === "/faq");
  /** Your friends list (/friends: screens/Friends.tsx). */
  const [showFriends, setShowFriends] = useState(() => location.pathname === "/friends");
  /**
   * Open the home screen's boss menu or Play with friends: the computer's side menu, or the hidden /bosses (Eric's way
   * straight to the solo boss picker, unlisted, not admin-gated; Oct 16). Used once: a match started clears it.
   */
  const [homeIntent, setHomeIntent] = useState<{ kind: "boss" | "friends"; n: number } | null>(() => (location.pathname === "/bosses" ? { kind: "boss", n: 0 } : null));
  /** The Boss raid screen (the Solo Boss Mode card on home, the side menu's Solo Boss Mode, ?mode=raid). */
  const [raidOpen, setRaidOpen] = useState(raidInUrl);
  /** That screen is the full one (?mode=raid, the test link: every raid choice), not the Solo Boss Mode form (Eric, Oct 26). */
  const [raidFull, setRaidFull] = useState(raidInUrl);
  const [legal, setLegal] = useState<LegalPage | null>(() => legalPageOf(location.pathname));
  /**
   * Auto chess, the demo (/autochess; client-only, no account needed). Home's card opens it (Eric, Oct 24; shelved on Oct
   * 19 until then), and Settings' Testing row does too.
   */
  const [showAutoChess, setShowAutoChess] = useState(() => location.pathname === "/autochess");
  /** The town square (/town; hidden, nothing links to it yet: slice 1 of Boss raid's town square, docs/areas/town-square.md). */
  const [showTown, setShowTown] = useState(() => location.pathname === "/town");
  /**
   * Where the town opens you, back from a game with a town bot: its seat ("6.0.3": the table, your stool, the bot; the
   * town reads it). A reload during that game lands there too: its address carries it (`/town?at=6.0.3`).
   */
  const [townSeat, setTownSeat] = useState<string | null>(() => (location.pathname === "/town" ? new URLSearchParams(location.search).get("at") : null));
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
  const [rejoining, setRejoining] = useState(!!rejoinCode || !!squadsRejoin || !!squadsTestStart);
  /** Squads: the lobby you're in, your party (its sheet), and a note when a lobby or party has gone. */
  const [squads, setSquads] = useState<SquadsClient | null>(null);
  const [party, setParty] = useState<PartyClient | null>(null);
  const [partyOpen, setPartyOpen] = useState(!!partyLinkCode);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [squadsNote, setSquadsNote] = useState<string | null>(() => (squadsLinkCode && !squadsRejoin ? "That match has ended." : null));
  /**
   * The lobby has closed: home (the address too, so reopening the app lands there) with a note, and your result if
   * you played (from the server, asked before this so the note shows whole, never growing a button a moment later).
   */
  const showEnded = (code: string, why: LobbyGone, result: LobbyResult | null, how: LeftHow | null = null) => {
    forgetSeat(code);
    if (currentMatch() === code) setCurrentMatch(null);
    setInvite(null);
    if (location.pathname !== "/") history.replaceState(null, "", "/");
    // (Home itself, where the note is: not the Boss raid screen a ?mode=raid link opened.)
    setRaidOpen(false);
    setEnded({ code, why, result, how });
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
    if (signinParam === "age") askAgeAgain();
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
    // You resigned: a loss (on your team's record, or against the boss), and you didn't see a boss battle through.
    const resigned = match.phase.left?.how === "resigned";
    void recordSoloResult({
      mode: raid ? "boss" : match.settings.mode,
      placement: match.phase.placement,
      players: match.totalPlayers,
      team: me?.team ?? null,
      teamWon: resigned
        ? me?.team || runner.boss
          ? false
          : null
        : bossResult
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
      ...(resigned && feats?.strikes !== null && feats?.strikes !== undefined ? { survived: false } : {}),
      evalBar: evalBarOn(),
    });
  });
  const [, rerender] = useReducer((n: number, _: unknown) => n + 1, 0);
  /** A computer (the front door's frame): the queue fills in place, with the lobby's chat beside it. */
  const computer = useMedia("(min-width: 1024px)");

  // The Hidden Boss's chatter, all through his fight, whatever screen shows it.
  useRecluseTalk(match);
  useEffect(() => {
    if (!match) return;
    const off = match.subscribe(() => rerender(undefined));
    return () => {
      off();
    };
  }, [match]);

  useEffect(() => squads?.subscribe(() => rerender(undefined)), [squads]);
  useEffect(() => party?.subscribe(() => rerender(undefined)), [party]);
  // A resign in Squads that recorded nothing (or got no answer): home.
  useEffect(() => {
    if (squads?.left && !squads.resigned && !squads.resigning && !squads.gone) leaveSquads();
  });
  // A Squads lobby that has ended or closed: home, with the note.
  useEffect(() => {
    if (!squads?.gone) return;
    const why = squads.gone;
    squads.dispose();
    setSquads(null);
    setSquadsNote(why === "Banned" ? null : why);
    if (location.pathname !== "/") history.replaceState(null, "", "/");
  });
  // Back into a Squads lobby you have a seat in (a reload, the app reopened): if it's still on.
  useEffect(() => {
    if (!squadsRejoin) return;
    void squadsStatus(squadsRejoin).then((st) => {
      if (st?.open !== false && st?.phase !== "results") joinSquads(squadsRejoin);
      else {
        forgetSquads(squadsRejoin);
        if (squadsLinkCode) setSquadsNote("That match has ended.");
        if (location.pathname !== "/") history.replaceState(null, "", "/");
      }
      setRejoining(false);
    });
  }, []);
  // An invite to a party you're already in (or the party you were in, from its link): straight back in.
  useEffect(() => {
    if (partyLinkCode && currentParty() === partyLinkCode) joinParty(partyLinkCode);
  }, []);
  // A test lobby's link (/squads/test/pairs, /squads/test): made once your account is known (admins only, or SQUADS_TEST).
  const testMade = useRef(false);
  useEffect(() => {
    if (!squadsTestStart || testMade.current || config === null || (config.accounts && !profile)) return;
    testMade.current = true;
    void squadsTestLobby(squadsTestStart, new URLSearchParams(location.search).get("clock"), new URLSearchParams(location.search)).then((r) => {
      setRejoining(false);
      if ("code" in r) joinSquads(r.code);
      else {
        history.replaceState(null, "", "/");
        setSquadsNote("error" in r ? r.error : "Couldn't make a test lobby.");
      }
    });
  }, [config, profile]);

  // Warm the engine up in the background so play starts instantly (not on Auto chess, whose fights use the HunChess engine:
  // Stockfish isn't loaded there; it warms when you leave it). Not in the town square either: nothing there plays chess yet.
  useEffect(() => {
    if (!showAutoChess && !showTown) void enginePool();
  }, [showAutoChess, showTown]);

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
      showEnded(m.code, m.gone!, result, m.leftHow);
    };
    if (m.goneResult !== undefined) go(m.goneResult);
    else void lobbyStatus(m.code, 3000).then((s) => go(s?.result ?? null));
  });

  // ---------------- Ranked 1 v 1 ----------------

  /** The 1 v 1 queue you're in (its search screen), and the game on screen (a person's, or the bot's). */
  const [duelQueue, setDuelQueue] = useState<DuelQueue | null>(null);
  const [duel, setDuel] = useState<DuelSession | null>(null);
  /**
   * Browsing while queued (docs/areas/ranked.md, "Browsing while queued"): you went Home from the search stage, and
   * the search goes on (the bar on every screen: DuelQueueBar.tsx). The ref is for the queue's own callbacks.
   */
  const [duelAway, setDuelAwayState] = useState(false);
  const duelAwayRef = useRef(false);
  const setDuelAway = (v: boolean) => {
    duelAwayRef.current = v;
    setDuelAwayState(v);
  };
  /** Into a ranked game (from the queue, or a link to it). Found while you browse: a sound and a buzz, then the stage. */
  const joinDuel = (code: string) => {
    if (duelAwayRef.current) {
      duelFoundAlert();
      nav.home();
    }
    setDuelAway(false);
    const d = new NetDuel(code.toUpperCase());
    setDuel((old) => {
      old?.dispose();
      return d;
    });
    setDuelQueue(null);
    history.replaceState(null, "", `/1v1/${d.code}${location.search}`);
    d.connect();
  };
  /** Out of the 1 v 1 queue or game: home. */
  const leaveDuel = () => {
    duelQueue?.cancel();
    setDuelQueue(null);
    setDuelAway(false);
    duel?.dispose();
    setDuel(null);
    if (location.pathname !== "/") history.replaceState(null, "", `/${location.search}`);
  };
  /** Out of the search while browsing (the bar's Cancel, or another mode): the page you're on stays. */
  const dropDuelSearch = () => {
    duelQueue?.cancel();
    setDuelQueue(null);
    setDuelAway(false);
  };
  /** Home (or another page) from the search stage, still searching. */
  const duelGoAway = () => {
    setDuelAway(true);
    if (location.pathname !== "/") history.replaceState(null, "", `/${location.search}`);
  };
  /** Back to the search stage from anywhere (the bar, or 1 v 1's PLAY while searching). */
  const duelBackToStage = () => {
    nav.home();
    setDuelAway(false);
    history.replaceState(null, "", `/1v1${location.search}`);
  };
  /**
   * Another mode while the search goes on: "Leave the 1 v 1 queue?" first (the only confirm), then the search ends and
   * that mode starts.
   */
  const leavingDuelFirst = (go: () => void) => {
    if (!duelQueue || duel || duelQueue.state.kind !== "searching") return go();
    confirmLeaveDuelQueue(() => {
      dropDuelSearch();
      go();
    });
  };
  /**
   * One tap into the 1 v 1 queue (startRanked1v1): online play needs an account where sign-in is set up (the sign-in
   * page instead, as every mode's PLAY), and nothing while the mode rests (its line, as the server would say).
   */
  const startDuel = (resume?: ReturnType<typeof savedDuelQueue>, away = false) => {
    unlockAudio();
    // Already searching (1 v 1's PLAY while you browse): back to the stage, the same search.
    if (duelQueue && !duel && duelQueue.state.kind === "searching") return duelBackToStage();
    if (mustSignInToPlayOnline()) return chooseGuest(false);
    if (isPaused("ranked1v1")) return setError(pausedLine("ranked1v1"));
    duel?.dispose();
    setDuel(null);
    setError(null);
    const q = new DuelQueue(resume);
    q.subscribe(() => {
      const s = q.state;
      if (s.kind === "found") joinDuel(s.code);
      else if (s.kind === "refused" && s.banned) {
        setDuelQueue(null);
        setDuelAway(false);
        if (location.pathname !== "/") history.replaceState(null, "", `/${location.search}`);
        showBanNotice();
      } else if (s.kind === "refused" && s.signIn) {
        setDuelQueue(null);
        setDuelAway(false);
        chooseGuest(false);
      } else if (s.kind === "refused" && duelAwayRef.current) {
        // (Refused while you browse, the mode resting: the stage says why.)
        duelBackToStage();
      }
    });
    setDuelQueue(q);
    setDuelAway(away);
    if (!away) history.replaceState(null, "", `/1v1${location.search}`);
    void q.start();
  };
  /** "Play a bot (unranked)": out of the queue, into a game on this device against a bot near your hidden rating. */
  const botDuel = () => {
    const rating = duelQueue?.botRating ?? account().profile?.rating ?? 1500;
    duelQueue?.cancel();
    setDuelQueue(null);
    setDuelAway(false);
    setDuel((old) => {
      old?.dispose();
      return new BotDuel(rating);
    });
    if (location.pathname !== "/") history.replaceState(null, "", `/${location.search}`);
  };
  setRanked1v1Starter(() => startDuel());

  // ---------------- A town bot's game (docs/areas/town-square.md, "Playing a bot") ----------------

  /** The game with a town bot on now: its seat to come back to (null: none). */
  const townGame = useRef<string | null>(null);
  /**
   * You and a bot sat down at a table in the town: the game, on this device (the bot game's, with Maia's loading step
   * first). Its address is a step of its own in the history, so the back button (or a reload) lands back at the table.
   */
  const playTownBot = (g: BotGameAsk) => {
    unlockAudio();
    townGame.current = g.seat;
    setDuel((old) => {
      old?.dispose();
      return new BotDuel(g.rating, { name: g.name, look: g.look, face: g.face });
    });
    const rest = searchWithoutSeat();
    history.pushState({ townGame: g.seat }, "", `/town${rest ? `${rest}&` : "?"}at=${g.seat}`);
  };
  /** Out of the game, back to the town at its table (its result's "Back to town", or the back button: `popped`). */
  const backToTown = (popped = false) => {
    const seat = townGame.current;
    if (!seat) return;
    townGame.current = null;
    setDuel((old) => {
      old?.dispose();
      return null;
    });
    setTownSeat(seat);
    if (!popped && (history.state as { townGame?: string } | null)?.townGame) history.back();
  };
  const backToTownRef = useRef(backToTown);
  backToTownRef.current = backToTown;
  useEffect(() => {
    const onPop = () => backToTownRef.current(true);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  // In the town, its address without the seat (it's been read).
  useEffect(() => {
    if (!showTown || duel || !new URLSearchParams(location.search).has("at")) return;
    history.replaceState(null, "", `/town${searchWithoutSeat()}`);
  }, [showTown, duel]);
  /**
   * A link: /1v1/CODE goes back into that game; /1v1 queues once your account has loaded (the queue needs it). A
   * reload during a search carries on with it (`savedDuelQueue`: its ticket and its wait): on the stage from /1v1, else
   * with the bar on whatever page you were on.
   */
  const duelLinkUsed = useRef(false);
  useEffect(() => {
    if (duelLinkUsed.current) return;
    if (duelLinkCode) {
      duelLinkUsed.current = true;
      joinDuel(duelLinkCode);
    } else if (profile) {
      duelLinkUsed.current = true;
      const saved = savedDuelQueue();
      if (duelQueueLink || saved) startDuel(saved, !duelQueueLink);
    }
  }, [!!profile]);
  // Another way into a match while the search goes on (an invite's lobby, a party's): the search ends, no ghost bar.
  useEffect(() => {
    if ((match || squads) && duelQueue && !duel) dropDuelSearch();
  }, [match, squads]);
  // The bar over every screen while you browse with a search going (DuelQueueBar reads this after every render).
  useLayoutEffect(() => setAwaySearch(duelQueue && duelAway && !duel && !match && !squads ? { queue: duelQueue, back: duelBackToStage, cancel: dropDuelSearch } : null));

  // ?debug (a test switch): the match, the Squads clients and the 1 v 1 game on `window`, for tests and the console. (Each render, so
  // they're there once your account says you may, and a match joined before that, from a link, is too.)
  const debug = testParams().has("debug");
  if (debug) Object.assign(window as unknown as Record<string, unknown>, { squads, party, duel, __measureSound: measureSound, ...(match ? { match } : {}) });

  // ---------------- Squads ----------------

  /** Into a Squads lobby (with your party's pass, to sit with your party). */
  const joinSquads = (code: string, pass?: string) => {
    unlockAudio();
    setSquadsNote(null);
    setPartyOpen(false);
    const c = new SquadsClient(code.toUpperCase(), { party: pass ?? null });
    setSquads((old) => {
      old?.dispose();
      return c;
    });
    history.replaceState(null, "", `/squads/${c.code}${location.search}`);
    c.connect();
  };
  /** Squads' PLAY: the solo queue (in line while the servers are busy). */
  const squadsPlay = async () => {
    unlockAudio();
    const run = ++lineRun.current;
    setLoading(true);
    setError(null);
    setSquadsNote(null);
    const r = await squadsQueue(
      (waitSeconds) => {
        setLoading(false);
        setInLine({ mode: "squads", waitSeconds });
      },
      () => run !== lineRun.current,
    );
    if (run !== lineRun.current || !r) return;
    setInLine(null);
    setLoading(false);
    if ("code" in r) joinSquads(r.code);
    else if ("banned" in r) showBanNotice();
    else if ("error" in r) setError(r.error);
  };
  const leaveSquads = () => {
    if (squads && !squads.left && !squads.gone) squads.leave();
    else squads?.dispose();
    setSquads(null);
    history.replaceState(null, "", `/${location.search}`);
  };
  /** A party: its sheet, and its socket (placed: everyone joins the lobby with the party's pass). */
  const partyPlaced = (lobby: string, pass: string) => {
    setParty(null);
    joinSquads(lobby, pass);
  };
  const joinParty = async (code: string) => {
    setPartyError(null);
    setPartyOpen(true);
    const open = await partyStatus(code);
    if (open === false) return setPartyError("That party has closed.");
    const p = new PartyClient(code.toUpperCase(), partyPlaced);
    setParty((old) => {
      old?.close();
      return p;
    });
    if (location.pathname !== "/") history.replaceState(null, "", `/${location.search}`);
    p.connect();
  };
  const openParty = () => {
    unlockAudio();
    setPartyOpen(true);
    const code = currentParty();
    if (code && !party) void joinParty(code);
  };
  const makeParty = async () => {
    setLoading(true);
    setPartyError(null);
    const r = await createParty();
    setLoading(false);
    if ("banned" in r) return showBanNotice();
    if ("error" in r) return setPartyError(r.error);
    void joinParty(r.code);
  };
  const closeParty = () => {
    party?.leave();
    setParty(null);
    setPartyOpen(false);
    setPartyError(null);
    if (location.pathname.startsWith("/squads/party")) history.replaceState(null, "", `/${location.search}`);
  };
  /** After a lobby: queue again alone, or back to your party (its leader queues you all again). */
  const squadsAgain = () => {
    const fromParty = !!squads?.party && !!currentParty();
    leaveSquads();
    if (fromParty) void joinParty(currentParty()!);
    else void squadsPlay();
  };
  const partySheet = partyOpen && (
    <PartySheet
      party={party}
      joinCode={partyLinkCode}
      loading={loading}
      error={partyError ?? party?.error ?? null}
      onlineLocked={mustSignInToPlayOnline()}
      admin={!!profile?.admin}
      onCreate={() => void makeParty()}
      onJoin={(code) => void joinParty(code)}
      onTest={(start) => {
        setPartyOpen(false);
        void squadsTestLobby(start).then((r) => ("code" in r ? joinSquads(r.code) : setPartyError("error" in r ? r.error : "Couldn't make a test lobby.")));
      }}
      onSignIn={() => {
        setPartyOpen(false);
        chooseGuest(false);
      }}
      onClose={closeParty}
    />
  );

  const use = (m: AnyMatch) => {
    match?.dispose();
    setEnded(null);
    // (An invite link is used up once you're in: back home, its join form doesn't open again.)
    setInvite(null);
    resetBoardsStrip();
    elimination.current = null;
    // (Asked for once: home after this match doesn't open the boss menu again.)
    setHomeIntent(null);
    setMatch(m);
    if (testParams().has("debug")) (window as unknown as { match: GameView }).match = m;
  };

  /**
   * Against bots in your browser, in the mode given or the one picked. Solo (`fill`): the queue screen fills with your
   * bots first, and a raid has 49 of them in the crowd with a boss matched to you. Boss alone: you against the boss
   * picked from the menu, at once.
   */
  const startSolo = async (mode?: ModeChoiceId, opts: { fill?: boolean } = {}) => {
    // (Solo and Boss alone resting, a kill switch: not even from a results screen's "again".)
    if (isPaused("solo")) {
      leave();
      return setError(pausedLine("solo"));
    }
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
      ? { ...DEFAULT_SETTINGS, ...(queue === "raid" ? RAID_SETTINGS : modeSettings("crowd", { augments: true })) }
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
      // (The test switches ride along for those allowed them; the server checks again: lobby-options.ts.)
      const params = testParams();
      params.delete("debug");
      const mode = modeId ?? chosenMode();
      params.set("mode", mode);
      if (mode === "raid") {
        // (The server sets up the raid: the boss picked, else one a step above the group.)
        if (chosenBoss()) params.set("boss", chosenBoss());
        else if (bossTierFromUrl()) params.set("boss", String(bossTierFromUrl()));
      }
      const res = await fetch(`/api/lobby?${params}`, { method: "POST" });
      const body = (await res.json()) as { code?: string; message?: string; banned?: boolean };
      if (body.banned) return showBanNotice();
      if (!body.code) throw new Error(body.message ?? "Couldn't create a lobby.");
      joinLobby(body.code, { mode });
      return body.code;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /** PLAY: the queue for a mode (the 50 v 50 lobby that's filling up, or a raid's). */
  const playNowTries = useRef(0);
  const playNowMode = useRef<{ mode: "crowd" | "raid"; type: Exclude<MatchmakingType, "solo"> }>({ mode: "crowd", type: "default" });
  const retriedFor = useRef<AnyMatch | null>(null);
  /** Servers busy: in line for a seat (the queue screen says so, with about how long). */
  const [inLine, setInLine] = useState<{ mode: "crowd" | "raid" | "squads"; waitSeconds: number } | null>(null);
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
      // (?pool=NAME: a queue of its own, a test switch.)
      const pool = testParams().get("pool");
      if (pool) q.set("pool", pool);
      // (Already in line: from "let bots fill" when the servers were busy.)
      if (ticket) q.set("ticket", ticket);
      for (;;) {
        const res = await fetch(`/api/play${q.size ? `?${q}` : ""}`, { method: "POST" });
        const body = (await res.json()) as { code?: string; message?: string; busy?: boolean; ticket?: string; waitSeconds?: number; retryMs?: number; banned?: boolean };
        if (run !== lineRun.current) return; // Canceled while asking.
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
    const pool = testParams().get("pool");
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

  /**
   * Resign or Leave, from any match screen's top line (MatchMenu, match-exit.ts). Solo: the results at once. Online: the
   * server's answer brings them (the screen stays meanwhile). Before move 1, and online once you're out: home.
   */
  useEffect(
    () =>
      onExitMatch(() => {
        const m = onScreen.current;
        if (!m?.exit) return;
        const home = m.exitHome;
        // (Gone on purpose: opening the app again doesn't bring you back.)
        setCurrentMatch(null);
        m.resign();
        if (home) leave();
      }),
    [match],
  );
  // Online, a resign that went home (before move 1, once out, or no answer from the server): home now.
  useEffect(() => {
    if (match instanceof NetMatch && match.exited) leave();
  });
  // Where the app is, for error reports and bug reports (problems.ts): the screen, mode, boss and lobby code.
  useEffect(() =>
    noteWhere({
      screen: screenOf(
        match,
        squads ? `squads ${squads.lobby?.phase ?? "joining"}` : inLine ? "queue" : showSettings ? "settings" : showFaq ? "faq" : showShop || legal || (profileOpen ? "profile" : "home"),
      ),
      mode: match ? `${match instanceof NetMatch ? "online" : "solo"} ${match.settings.raid ? "raid" : match.settings.mode}` : squads ? "online squads" : null,
      boss: match?.boss?.id ?? null,
      code: match instanceof NetMatch ? match.code : (squads?.code ?? party?.code ?? null),
    }),
  );

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

  /** Where the computer's side menu goes (front-door pages and, since Oct 29, the town square, outside a match). */
  const goHome = () => {
    // (The town square is in the frame on a computer: every menu item leaves it; Boss Arena sets it again.)
    setShowTown(false);
    setTownSeat(null);
    closeProfile();
    setShowSettings(false);
    setShowFaq(false);
    setShowShop(false);
    setShowFriends(false);
    if (location.pathname !== "/") history.replaceState(null, "", "/");
  };
  const nav: FrontNav = {
    home: () => {
      goHome();
      setHomeIntent(null);
      setRaidOpen(false);
    },
    bossArena: () => {
      goHome();
      setHomeIntent(null);
      setRaidOpen(false);
      // (The town square, as /town opens it: the page replaces the front door, as Auto chess's does.)
      setShowTown(true);
      history.replaceState(null, "", "/town");
    },
    soloBoss: () => {
      goHome();
      setHomeIntent(null);
      setRaidFull(false);
      setRaidOpen(true);
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
    friendsList: () => {
      goHome();
      setShowFriends(true);
      history.replaceState(null, "", "/friends");
    },
    signIn: () => chooseGuest(false),
  };
  // Friends (friends.ts): what an invite can point at (a private lobby still waiting, your party), making one at the
  // front door in the home screen's mode, and joining someone's. Set every render, so it sees this render's state.
  setInviteHost({
    target: () => {
      if (match instanceof NetMatch && !match.auto && match.phase.kind === "lobby" && !match.gone)
        return { kind: match.settings.raid ? "raid" : match.settings.mode === "crowd" ? "crowd" : "classic", code: match.code };
      return party ? { kind: "squads", code: party.code } : null;
    },
    canCreate: () => !match && !squads,
    create: async () => {
      // (The Boss raid screen: a raid. 1 v 1 has no lobbies: 50 v 50's.)
      const picked = chosenHomeMode() ?? "crowd";
      const mode = raidOpen ? "raid" : picked === "squads" ? "squads" : lobbyModeOf(picked);
      goHome();
      if (mode !== "squads") {
        const code = await createLobby(mode);
        return code ? { kind: mode, code } : null;
      }
      const r = await createParty();
      if ("banned" in r) {
        showBanNotice();
        return null;
      }
      if ("error" in r) throw new Error(r.error);
      void joinParty(r.code);
      return { kind: "squads", code: r.code };
    },
    join: (kind, code) => {
      goHome();
      if (kind === "squads") return void joinParty(code);
      // (An invite can outlive its lobby's start: ask first, so a stale one never costs you your party.)
      void lobbyStatus(code).then((s) => {
        // (No answer, offline: carry on as if it's open, as lobbyStatus's other callers do.)
        if (s && (!s.open || s.phase !== "waiting")) return setSquadsNote("That lobby has started or closed.");
        if (party) closeParty();
        joinLobby(code);
      });
    },
  });
  // In a match (not its lobby or results): the live line says so, for friends' lists.
  setLiveBusy((!!match && !["loading", "lobby", "results"].includes(match.phase.kind)) || (!!squads && !squadsWaiting(squads.lobby)) || (!!duel && !duel.snapshot().end));

  /**
   * The side menu while you're in the queue (it stays on a computer): Play is where you are, and your profile opens over
   * the queue (as a name tapped in it does). Anything else leaves the queue first, as leaving the page does on the
   * chess sites, then goes there.
   */
  const queueNav: FrontNav = {
    ...nav,
    // (The 1 v 1 search: Play is home, and every page browses with the search still going, the bar along.)
    home: () => {
      if (duelQueue && !duel) {
        duelGoAway();
        nav.home();
      }
    },
    profile: () => openProfile({ you: true, name: account().profile?.user.name ?? "" }),
    ...Object.fromEntries(
      (["bossArena", "soloBoss", "friends", "shop", "settings", "friendsList"] as const).map((k) => [
        k,
        () => {
          if (match) leave();
          else if (squads) leaveSquads();
          else if (duel) leaveDuel();
          else if (duelQueue) duelGoAway();
          else leaveLine();
          nav[k]();
        },
      ]),
    ),
  };

  // (Before any page below, the home screen's frame needs these.)
  // ?nolanding (a test switch): straight to home, without the landing page.
  const noLanding = testParams().has("nolanding");
  const inviteCode = invite === "open" ? linkCode : undefined;
  const notice = ended ? (ended.why === "idle" ? "That lobby has closed." : ended.why === "left" ? leftNote(ended.how) : "That match has ended.") : (squadsNote ?? undefined);
  // Ranked 1 v 1: the search and the versus moment (one stage, in the home screen's frame, as every queue), then the game.
  if ((duel || (duelQueue && !duelAway)) && !match && !squads) {
    const overlayD = profileOpen && (
      <div class="fd-overlay">
        <FrontFrame>
          <PlayerProfileScreen target={profileOpen} onBack={closeProfile} match={duel?.snapshot().code ?? undefined} />
        </FrontFrame>
      </div>
    );
    // (One component from the search to the result, so the stage stays mounted from the search to the versus moment.)
    return (
      <>
        <DuelFront
          queue={duelQueue}
          session={duel}
          frame={(stage) => homeFrame(stage, undefined, false)}
          onCancel={leaveDuel}
          onBot={botDuel}
          onAway={duelGoAway}
          onHome={townGame.current ? () => backToTown() : leaveDuel}
          onAgain={
            townGame.current
              ? () => backToTown()
              : () => {
                  leaveDuel();
                  startDuel();
                }
          }
        />
        {overlayD}
      </>
    );
  }
  // Squads: the lobby you're in (the waiting room is the home screen's queue, as for Crowd).
  if (squads && !match) {
    const overlayS = profileOpen && (
      <div class="fd-overlay">
        <FrontFrame>
          <PlayerProfileScreen target={profileOpen} onBack={closeProfile} />
        </FrontFrame>
      </div>
    );
    if (squads.error)
      return (
        <div class="screen center">
          <h1>Can't join</h1>
          <p class="muted">{squads.error}</p>
          <button type="button" class="btn btn-primary" onClick={leaveSquads}>
            Home
          </button>
        </div>
      );
    if (squadsWaiting(squads.lobby))
      return (
        <>
          {homeFrame(<SquadsQueue client={squads} onCancel={leaveSquads} />)}
          {overlayS}
        </>
      );
    return (
      <>
        <SquadsScreen client={squads} actions={{ onHome: leaveSquads, onResign: () => squads.resign(), onAgain: squadsAgain, party: !!squads.party }} />
        {overlayS}
      </>
    );
  }
  if (!match && showAutoChess) {
    return (
      <AutoChessScreen
        onBack={() => {
          setShowAutoChess(false);
          history.replaceState(null, "", "/");
        }}
      />
    );
  }
  if (!match && showTown) {
    // A player's profile from the town chat's menu: over the town, which stays as it was underneath (Back closes it).
    const overlayT = profileOpen && (
      <div class="fd-overlay">
        <FrontFrame>
          <PlayerProfileScreen target={profileOpen} onBack={closeProfile} />
        </FrontFrame>
      </div>
    );
    return (
      <>
        <TownPage
          nav={nav}
          seat={townSeat}
          onPlayBot={playTownBot}
          onBack={() => {
            setShowTown(false);
            setTownSeat(null);
            history.replaceState(null, "", "/");
          }}
          // A boss's "Challenge alone", confirmed: out of the town square to the Solo Boss Mode screen (the solo form, as the
          // side menu opens it; Eric, Oct 26), that boss's tile picked (the screen reads its pick from rememberBossPick as it
          // opens).
          onBossAlone={(id) => {
            rememberBossPick(id);
            setShowTown(false);
            setTownSeat(null);
            history.replaceState(null, "", "/");
            setHomeIntent(null);
            setRaidFull(false);
            setRaidOpen(true);
          }}
        />
        {overlayT}
      </>
    );
  }
  if (!match && legal) {
    return (
      <LegalScreen page={legal} onBack={() => leaveLegal(() => setLegal(null))} />
    );
  }
  if (!match && showFaq) {
    return (
      <FrontFrame page="settings" nav={nav}>
        <FaqScreen
          onBack={() => {
            setShowFaq(false);
            setShowSettings(true);
            history.replaceState(null, "", "/settings");
          }}
        />
      </FrontFrame>
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
          onFaq={(section) => {
            setShowFaq(true);
            history.replaceState(null, "", section ? `/faq#faq-${section}` : "/faq");
          }}
          onAutoChess={() => {
            setShowSettings(false);
            setShowAutoChess(true);
            history.replaceState(null, "", "/autochess");
          }}
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
          onFriends={() => {
            closeProfile();
            nav.friendsList();
          }}
        />
      </FrontFrame>
    );
  }
  if (!match && showFriends) {
    return (
      <FrontFrame page="friends" nav={nav}>
        <FriendsScreen
          onBack={() => {
            setShowFriends(false);
            if (location.pathname === "/friends") history.replaceState(null, "", "/");
          }}
          onSettings={() => {
            setShowFriends(false);
            setShowSettings(true);
            history.replaceState(null, "", "/settings");
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
  const home = (queue?: ComponentChildren, chat?: ComponentChildren, side = computer) => homeFrame(queue, chat, side);
  function homeFrame(queue?: ComponentChildren, chat?: ComponentChildren, side = computer) {
    return (
    // (A phone's queue is the whole screen: no hidden menu or panel to draw again with every arrival.)
    <FrontFrame page={queue ? "queue" : raidOpen ? "raid" : "home"} nav={!queue ? nav : computer ? queueNav : undefined}>
      <HomeScreen
        queue={queue}
        chat={chat}
        side={side}
        intent={homeIntent}
        raid={raidOpen}
        full={raidFull}
        onBossArena={nav.bossArena}
        onRaid={(open) => {
          setRaidOpen(open);
          setRaidFull(false);
          // (?mode=raid opened it: closed, the address is home's.)
          if (!open && raidInUrl()) {
            const q = new URLSearchParams(location.search);
            q.delete("mode");
            history.replaceState(null, "", `${location.pathname}${q.size ? `?${q}` : ""}`);
          }
        }}
        onRanked1v1={startRanked1v1}
        onAutoChess={() => {
          setShowAutoChess(true);
          history.replaceState(null, "", "/autochess");
        }}
        loading={loading}
        error={error}
        joinCode={mustSignInToPlayOnline() ? undefined : inviteCode}
        notice={
          !ended && notice
            ? { text: notice, onDismiss: () => setSquadsNote(null) }
            : ended && notice
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
        onPlay={(mode, type) => leavingDuelFirst(() => void playNow(mode, type))}
        onSolo={(mode, opts) => leavingDuelFirst(() => void startSolo(mode, opts))}
        onCreateLobby={(mode, made) => leavingDuelFirst(() => void createLobby(mode).then((code) => made?.(code ?? null)))}
        onJoinLobby={(code) => leavingDuelFirst(() => joinLobby(code, { typed: code !== inviteCode }))}
        onSquads={() => leavingDuelFirst(() => void squadsPlay())}
        onParty={openParty}
        onFriends={nav.friendsList}
        onSignIn={() => chooseGuest(false)}
        onProfile={() => openProfile({ you: true, name: account().profile?.user.name ?? "" })}
        onSettings={() => setShowSettings(true)}
        onShop={() => setShowShop("shop")}
      />
    </FrontFrame>
    );
  }
  // (Always a fragment with the frame first, in the queue or not, so the frame is kept from one to the other.)
  if (!match && inLine)
    return (
      <>
        {home(
          <QueueLine
            raid={inLine.mode === "raid"}
            waitSeconds={inLine.waitSeconds}
            onCancel={leaveLine}
            {...(inLine.mode === "squads" ? { title: "Squads · 8 squads of 4", seats: 32 } : {})}
          />,
        )}
      </>
    );
  if (!match)
    return (
      <>
        {home()}
        {partySheet}
      </>
    );

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
    // (Home from a match's results, or a lobby's Leave: home itself, not the Boss raid screen it may have started from.
    // Cancel in the queue goes back to where you were.)
    leave: () => {
      setRaidOpen(false);
      leave();
    },
    // (Solo again as it was: through the queue screen, or Boss alone straight in.)
    again: () => (match instanceof SoloMatch ? void startSolo(match.settings.raid ? "raid" : match.settings.mode, { fill: match.players.length > 0 }) : leave()),
  });
  // Computers get the leaderboard as a permanent sidebar during the knockout stages (and the pre-game votes, so the
  // board is in the same place when the game begins).
  const tower = ["vote", "play", "scoring", "reveal", "spectating", "final", "watching", "boss", "phaseChange", "simul"].includes(match.phase.kind) && match.standings().length > 0;
  // (Boss alone has no scoreboard at all, Eric, Oct 25: alone, there's nobody to rank; its moves are beside the board. Its
  // column stays, empty, so the board and the boss keep their places, and Babur's pump its room left of him.)
  const noTower = !!match.boss && bossAlone(match);
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
      {noTower ? (
        <div class="tower-space" aria-hidden="true" />
      ) : (
      <aside class="tower-side">
        {(() => {
          const v = towerView(match);
          return (
            <>
              {v.teamLabel && <div class="tower-team">{v.teamLabel}</div>}
              <RaceTower standings={v.standings} cutoff={v.cutoff} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} floats={match.chat?.floats()} bank={!(match as GameView).simul} dp={scoreDp(match.settings)} />
            </>
          );
        })()}
      </aside>
      )}
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
      return <OpeningGrid boards={p.boards} title="Today's openings" menu={<MatchMenu exit={exitFor(match)} crowd={isCrowd(match)} />} />;
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
      // (Keyed by the cut: once out, online, you stay on this screen, and each later cut is a judgment of its own.)
      if (isCrowd(match)) return <CrowdCut key={p.stage} match={match} {...p} />;
      return <StageBreakScreen match={match} {...p} />;
    case "simulating":
      return (
        <div class="screen center">
          <h1>Playing out the match…</h1>
          <p class="muted">
            Stage {p.stage + 1}, round {p.round + 1}
          </p>
          {/* You're out: your place stands. See it now rather than wait for the rest. */}
          {match.exit && (
            <button type="button" class="btn btn-secondary leave-match" onClick={exitMatch}>
              Skip to your result
            </button>
          )}
        </div>
      );
    case "final":
      return <FinalScreen match={match} final={p.final} />;
    case "vote":
      return <VoteScreen match={match} vote={p.vote} menu={<MatchMenu exit={exitFor(match)} crowd={isCrowd(match)} />} />;
    case "boss":
      // (The loading step, then the intro on a screen of its own: the intro's timeline starts as it mounts.)
      return <BossScreen key={p.loading ? "boss-loading" : "boss"} match={match} boss={p.boss} until={p.until} thinking={p.thinking} intro={p.intro} loading={p.loading} afterLoading={p.afterLoading} lights={p.lights} fall={p.fall} />;
    case "phaseChange":
      return <PhaseChangeScreen match={match} at={p.at} />;
    case "simul":
      return <SimulScreen match={match} />;
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
function ProfilePage({
  target,
  onLocker,
  onSettings,
  onShop,
  onFriends,
}: {
  target: ProfileTarget;
  onLocker: () => void;
  onSettings: () => void;
  onShop: () => void;
  onFriends: () => void;
}) {
  useEffect(() => {
    // (Yours is /profile; anyone's public profile, yours as others see it included, is /profile/ID.)
    const path = target.you && !target.public ? "/profile" : target.uid ? `/profile/${target.uid}` : null;
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
      onFriends={onFriends}
    />
  );
}
