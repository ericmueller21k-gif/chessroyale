import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { BOSS_TIERS, FRONT_DOOR, adminPlayable, bossDef, bossIdFromLink, bossThreat, isPlayable, menuBosses, CROWD_SETTINGS, DEFAULT_SETTINGS as S, MATCHMAKING, MATCHMAKING_TYPES, PRIOR_RATING, RAID_SETTINGS, SQUADS, pausedLine, type BossDifficultyId, type MatchmakingType, type ModeChoiceId, type Pausable } from "@chessroyale/core";
import { useAccount } from "./Profile.tsx";
import { bossAloneElo, chosenDifficulty, rememberDifficulty } from "../boss-difficulty.ts";
import { powersLine } from "../power-words.ts";
import { BossDifficulty } from "../components/BossDifficulty.tsx";
import { isAdmin, maiaAllowed, maiaLikely } from "../boss-brain.ts";
import { prefetchMaia } from "../maia.ts";
import type { ComponentChildren } from "preact";
import { AccountBar, BackButton, DressedPawn, FdButton, FriendsIcon, GearIcon, LevelRing, LiveLine, Logo, RankLine, ShopIcon } from "../components/FrontDoor.tsx";
import { useLive } from "../live.ts";
import { BossCardFace, BossSelect, RANDOM, selectBosses } from "../components/BossSelect.tsx";
import { BossFace } from "../components/BossCharacter.tsx";
import { UserIcon } from "../components/PixelIcon.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import { LiveWindow } from "../components/LiveWindow.tsx";
import { LIVE_WINDOW_MEDIA } from "../bot-replays.ts";
import { friendsBadge, useFriends } from "../friends.ts";
import { FriendsBadge } from "../components/Friends.tsx";
import { noteLinkCopied } from "./Lobby.tsx";
import { testParams, testSwitchesAllowed } from "../test-switches.ts";
import { isPaused, useServerStatus } from "../status.ts";
import { ChatNotice } from "../components/ChatNotice.tsx";
import { ranked1v1Label } from "../ranked.ts";
import { PIECE_SHAPES, type PieceShape } from "../autochess/pieceShapes.ts";

const MODE_KEY = "brc.mode";

/** The mode (Classic, Crowd 50 v 50 or the boss raid) for solo games and lobbies you create: ?mode=, else this device's choice. */
export function chosenMode(): ModeChoiceId {
  let picked = new URLSearchParams(location.search).get("mode");
  try {
    picked ??= localStorage.getItem(MODE_KEY);
  } catch {
    // No storage.
  }
  // Crowd (50 v 50) is the main mode: Classic or the boss raid only when chosen.
  return picked === "classic" ? "classic" : picked === "raid" ? "raid" : "crowd";
}

function saveMode(mode: ModeChoiceId) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Not important.
  }
}

const MATCHMAKING_KEY = "brc.matchmaking";
/** How you're matched (the home screen's Matchmaking: Default, Bots off or Solo): this device's choice. */
export function chosenMatchmaking(): MatchmakingType {
  try {
    const v = localStorage.getItem(MATCHMAKING_KEY);
    return MATCHMAKING_TYPES.includes(v as MatchmakingType) ? (v as MatchmakingType) : "default";
  } catch {
    return "default";
  }
}
function saveMatchmaking(t: MatchmakingType) {
  try {
    localStorage.setItem(MATCHMAKING_KEY, t);
  } catch {
    // Not important.
  }
}

const BOSS_KEY = "brc.bossId";
/** The boss just picked from the menu ("" for a random one; kept here too, for when there's no storage). */
let pickedBoss: string | null = null;
/** Remembers the boss picked from the menu (for this solo raid or lobby, and next time): an id, or "" for random. */
export function rememberBossPick(id: string) {
  pickedBoss = id;
  try {
    localStorage.setItem(BOSS_KEY, id);
  } catch {
    // Not important.
  }
}

/** ?boss=<id> or ?boss=<strength> picks the boss, so the boss menu is skipped (a test switch: test-switches.ts). */
export function bossInUrl(): boolean {
  return testParams().has("boss");
}

/**
 * Boss raid: the boss you picked (a playable one), or "" for a random one. ?boss=<id> (a test switch), else this
 * device's choice.
 * `hidden`: an admin's Boss alone, where the pick may be a boss hidden from players (the Hidden Boss); anywhere else such
 * a pick is "" (random), so a raid or a lobby never asks for him.
 */
export function chosenBoss(hidden = false): string {
  const q = bossIdFromLink(testParams().get("boss"));
  let v = q ?? pickedBoss;
  if (v === null) {
    try {
      v = localStorage.getItem(BOSS_KEY);
    } catch {
      v = null;
    }
  }
  return v && (isPlayable(bossDef(v)) || (hidden && adminPlayable(bossDef(v)))) ? v : "";
}

/** A test link's fixed strength (?boss=1600: one of the tiers, a test switch), else 0: the boss plays a step above you. */
export function bossTierFromUrl(): number {
  const n = Number(testParams().get("boss"));
  return BOSS_TIERS.includes(n) ? n : 0;
}

/** A boss's strength against yours, in words and a color. */
function versus(elo: number, you: number): { text: string; tone: "easy" | "even" | "hard" | "brutal" } {
  const d = Math.round((elo - you) / 10) * 10;
  if (Math.abs(d) < 100) return { text: "≈ your level", tone: "even" };
  if (d < 0) return { text: `−${-d} vs you`, tone: "easy" };
  return { text: `+${d} vs you`, tone: d >= 400 ? "brutal" : "hard" };
}

/**
 * Boss alone's menu: your difficulty and the boss to fight, each at your strength
 * plus its own offset and your difficulty (`bossAloneElo`, the number the menu shows), with its threat
 * and its strength against yours. A tap on a boss starts. The difficulty is the screen's (`difficulty`,
 * `onDifficulty`), so the stage follows it as it changes.
 * - From the Boss raid screen (`only`: the boss picked there, or "" for a random one): that boss alone, under the title
 *   "Boss alone" (the pick is made on the screen's tiles).
 * - The hidden /bosses (no `only`): every boss you can meet and a random one, "Choose your boss"; for an admin the
 *   bosses hidden from players too, after the rest (the Hidden Boss, for testing).
 */
export function BossMenu({
  only,
  value,
  rating,
  difficulty,
  onDifficulty,
  onPick,
  onClose,
}: {
  only?: string;
  value: string;
  rating: number | null;
  difficulty: BossDifficultyId;
  onDifficulty: (id: BossDifficultyId) => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const you = rating ?? PRIOR_RATING;
  // (Admins, Boss alone: the bosses hidden from players too, after the rest: the Hidden Boss, for testing.)
  // (Not the bosses resting: kill switches, status.ts.)
  useServerStatus();
  const bosses = menuBosses({ admin: isAdmin(), raid: false }).filter((b) => !isPaused(`boss:${b.id}`) && (only === undefined || b.id === only));
  // Maia's files are fetched ahead when it may play: Boss alone below Stockfish's strengths. (A raid you make fetches
  // them as you make it: Play with friends.)
  const picked = useRef<HTMLButtonElement>(null);
  const maiaAhead = () => maiaLikely(bosses.map((b) => bossAloneElo(rating, b, difficulty)));
  useEffect(() => {
    if (maiaAhead()) prefetchMaia();
    picked.current?.scrollIntoView({ block: "nearest" });
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  return (
    <div class="boss-menu-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="boss-menu" role="dialog" aria-modal="true" aria-labelledby="boss-menu-title">
        <div class="boss-menu-head">
          <div>
            <h2 id="boss-menu-title">{only === undefined ? "Choose your boss" : "Boss alone"}</h2>
            <span class="muted small">
              Your rating: {Math.round(you)}
              {rating === null ? " (unrated)" : ""}
            </span>
          </div>
          <button type="button" class="tower-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <BossDifficulty value={difficulty} onChange={onDifficulty} />
        <div class="boss-menu-list">
          {(only === undefined || only === "") && (
            <button type="button" class={`boss-row match${value === "" ? " on" : ""}`} ref={value === "" ? picked : undefined} onClick={() => onPick("")}>
              <span class="br-icon" aria-hidden="true">
                🎲
              </span>
              <span class="br-main">
                <strong>Random boss</strong>
                <span class="br-sub">a different one from last time</span>
              </span>
            </button>
          )}
          {bosses.map((b) => {
            const elo = bossAloneElo(rating, b, difficulty);
            const vs = versus(elo, you);
            return (
              <button
                type="button"
                key={b.id}
                class={`boss-row${value === b.id ? " on" : ""}`}
                ref={value === b.id ? picked : undefined}
                aria-label={`${b.name}, ${elo}, ${vs.text}`}
                onClick={() => onPick(b.id)}
              >
                <span class="br-icon" aria-hidden="true">
                  <BossFace boss={b} />
                </span>
                <span class="br-main">
                  <strong>{b.name.replace(/^The /, "")}</strong>
                  <span class="br-sub">
                    <span class="br-skulls">{"💀".repeat(bossThreat(elo))}</span>
                    <span class="br-powers">{powersLine(b)}</span>
                  </span>
                </span>
                <span class="br-elo">
                  <strong>{elo}</strong>
                  <span class={`br-vs ${vs.tone}`}>{vs.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The home screen's pick in the RANKED row (Eric, Oct 16): 50 v 50 (Crowd), 1 v 1 (ranked chess, its own queue) or
 * Squads (online only, its own queue and parties); Classic only with ?mode=classic. The boss raid has a screen of its
 * own (`BossRaidScreen`), opened from its card under the row.
 */
export type HomeMode = Exclude<ModeChoiceId, "raid"> | "1v1" | "squads";

/** The seats of a Crowd match and a boss raid, from their settings. */
const CROWD_SIZE = CROWD_SETTINGS.lobbySize ?? S.lobbySize;
const RAID_SIZE = RAID_SETTINGS.lobbySize ?? S.lobbySize;

/**
 * The RANKED row's three choices, left to right (Eric, Oct 16: "so that way it's clear that they're all ranked"). Classic
 * is still played with ?mode=classic while it's reworked; the boss raid is its own card and screen.
 */
const MODES: { id: HomeMode; label: string; sub: string }[] = [
  { id: "crowd", label: `${CROWD_SIZE / 2} v ${CROWD_SIZE / 2}`, sub: "Crowd chess" },
  { id: "1v1", label: "1 v 1", sub: "Classic chess" },
  { id: "squads", label: "Squads", sub: `${SQUADS.squadCount} squads of ${SQUADS.squadSize}` },
];

/** A stored or linked pick, as the RANKED row knows it (a raid or anything unknown: none). */
function homeModeOf(v: string | null): HomeMode | null {
  return v === "squads" || v === "1v1" || v === "classic" || v === "crowd" ? v : null;
}

/** The mode picked on home since the app opened (none when it opens: Eric, Oct 18, "the way you actually queue is by having to tap the mode"). */
let sessionPick: HomeMode | null = null;

/**
 * The pick the home screen shows: the address's ?mode=, else the pick made since the app opened, else none (PLAY waits
 * for one). (?mode=raid opens the Boss raid screen instead: `raidInUrl`.)
 */
export function chosenHomeMode(): HomeMode | null {
  return homeModeOf(new URLSearchParams(location.search).get("mode")) ?? sessionPick;
}

/** ?mode=raid (old links, tests): home opens on the Boss raid screen. */
export const raidInUrl = () => new URLSearchParams(location.search).get("mode") === "raid";

/** The mode a lobby made from home is in: the pick's, 1 v 1's being 50 v 50's (1 v 1 has no lobbies). */
export const lobbyModeOf = (m: HomeMode): ModeChoiceId => (m === "classic" ? "classic" : "crowd");

/**
 * Copies a new lobby's invite link (`code`: its code, once the server has made it). A phone's browser copies only during
 * the tap, so the copy starts now with the link to come (a ClipboardItem holding a promise); where that isn't supported,
 * it copies when the code arrives. The lobby screen then says it's copied (`noteLinkCopied`).
 */
function copyInviteLink(code: Promise<string>) {
  const link = code.then((c) => `${location.origin}/lobby/${c}`);
  const done = () => void code.then(noteLinkCopied);
  const later = () => link.then((l) => navigator.clipboard.writeText(l)).then(done, () => {});
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({ "text/plain": link.then((l) => new Blob([l], { type: "text/plain" })) });
      navigator.clipboard.write([item]).then(done, later);
      return;
    }
  } catch {
    // (A browser without promised clipboard items: copy when the code arrives.)
  }
  void later();
}

/**
 * Play with friends: a lobby with a code (in the mode picked on the home screen), joining one, and practice
 * against bots on your own.
 */
function FriendsSheet({
  mode,
  code: initialCode,
  loading,
  onlineLocked,
  resting,
  onCreate,
  onJoin,
  onSignIn,
  onFriends,
  onClose,
}: {
  mode: ModeChoiceId;
  code?: string;
  loading: boolean;
  onlineLocked?: boolean;
  /** This mode is resting (a kill switch): its line, and no new lobby (joining one still works). */
  resting?: string | null;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onSignIn: () => void;
  /** Your friends list (a phone's way there: Eric, Oct 18). */
  onFriends: () => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(initialCode ?? "");
  const { status } = useFriends();
  const news = friendsBadge();
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  // (A friend code: a lobby made for you and your friends, its link copied to share: Eric, Oct 18.)
  const label = mode === "raid" ? "Create a raid" : mode === "classic" ? "Get a Classic friend code" : "Get friend code";
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet" role="dialog" aria-modal="true" aria-labelledby="friends-title">
        <div class="fd-sheet-head">
          <h2 id="friends-title">{initialCode ? `Join lobby ${initialCode}` : "Play with friends"}</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {onlineLocked ? (
          <>
            <p class="fd-sub">Lobbies are online, so they need an account. It takes a few seconds with Google or your email.</p>
            <FdButton primary onClick={onSignIn}>
              Sign in to play online
            </FdButton>
          </>
        ) : (
          <>
            {!initialCode && (
              <>
                <p class="fd-sub">{resting ?? (mode === "raid" ? "Make a lobby and share its code. Empty seats fill with bots when you start." : "Makes a lobby and copies its link: send it to your friends. Empty seats fill with bots when you start.")}</p>
                <FdButton primary disabled={loading || !!resting} onClick={onCreate}>
                  {label}
                </FdButton>
              </>
            )}
            <div class="fd-join">
              <input
                class="fd-code"
                value={code}
                maxLength={5}
                placeholder="CODE"
                aria-label="Lobby code"
                autoFocus={!!initialCode}
                onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
              />
              <FdButton primary={!!initialCode} disabled={loading || code.trim().length !== 5} onClick={() => onJoin(code.trim())}>
                Join lobby
              </FdButton>
            </div>
          </>
        )}
        {/* (Your friends list: requests, who's online, inviting one. Not for guests who can't have friends.) */}
        {!initialCode && status !== "off" && status !== "signIn" && (
          <button type="button" class="fd-row-link fd-sheet-friends" onClick={onFriends}>
            Your friends <FriendsBadge n={news} /> ›
          </button>
        )}
        {/* (Practicing against bots is Solo now, on the home screen.) */}
      </div>
    </div>
  );
}

/**
 * The Matchmaking choices, each its title only (Eric, Oct 28: "3 times in this screen it says the same thing"): what each
 * does is the line above PLAY, and the ranking rule is in the FAQ ("Your rating").
 */
const types: { id: MatchmakingType; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "botsoff", label: "Bots off" },
  { id: "solo", label: "Solo" },
];

/** A short note at the top of the home screen ("That match has ended"), with "See your result" when there is one. */
export interface HomeNotice {
  text: string;
  /** Your result in it: opens your profile at that match. */
  onSeeResult?: () => void;
  onDismiss: () => void;
}

function Notice({ notice }: { notice: HomeNotice }) {
  return (
    <div class="fd-notice" role="status">
      <svg class="fd-notice-flag" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M5 21V4" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
        <path d="M5 4h13l-2.5 4.5L18 13H5z" fill="currentColor" />
      </svg>
      <span class="fd-notice-text">{notice.text}</span>
      {notice.onSeeResult && (
        <FdButton primary class="small fd-notice-go" onClick={notice.onSeeResult}>
          See your result
        </FdButton>
      )}
      <button type="button" class="fd-icon-btn fd-notice-x" aria-label="Dismiss" onClick={notice.onDismiss}>
        ✕
      </button>
    </div>
  );
}

/** The card's portrait moves on this often (a test link's `?cardMs=` for a quicker one: a test switch). */
const cardEveryMs = () => Number(testParams().get("cardMs")) || FRONT_DOOR.bossCardMs;

/**
 * One of the Boss raid screen's ways to play: a big button with its line. `locked`: the Hidden Boss is picked (grayed
 * out, a small lock).
 */
function RaidOption({ label, sub, disabled, locked, onClick }: { label: string; sub: string; disabled?: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button type="button" class={`rd-option${locked ? " rd-locked" : ""}`} disabled={disabled || locked} onClick={onClick}>
      <strong>
        {label}
        {locked && (
          <span class="rd-lock" aria-label="locked">
            🔒
          </span>
        )}
      </strong>
      <span>{sub}</span>
    </button>
  );
}

/**
 * Home (the approved mockup, docs/mockups/front-door/Main.dc.html; the RANKED row and the Boss raid card, Eric, Oct 16):
 * the top bar (logo, coins, your pawn), the live line, your dressed pawn with your icon, name and rating, the RANKED row
 * (50 v 50, 1 v 1, Squads), the panel under it for the pick (one size for every mode), PLAY and the line under it, the
 * Boss raid card, and the smaller buttons. A note goes under the live line when a lobby you opened has closed. Light or
 * dark is in Settings.
 *
 * On a computer (1024 px and wider, the side menu's frame) the play column has the phone's order (Eric, Oct 18): the
 * shop and your profile are in the side menu. From 1280 px the live window fills the room above (LiveWindow: a real
 * match, or a bot match played back).
 *
 * With `raid`, the Boss raid screen (a simple one for now; Eric, Oct 16): each way to play a raid, through the flows
 * that were on home before (a raid's queue, people only, a Solo raid, Boss alone's boss menu, a raid with friends).
 *
 * With `queue` (you pressed PLAY), the home becomes the queue: on a phone the queue screen takes the whole screen, as
 * before; on a computer it fills in place of the play column, and your pawn shrinks to a card at the top of its column
 * with the lobby's chat under it (`chat`, when there is one). The frame (side menu, live panel) stays.
 */
export function HomeScreen({
  queue,
  chat,
  side = true,
  intent,
  raid = false,
  full = false,
  loading,
  error,
  joinCode,
  notice,
  onlineLocked,
  onPlay,
  onSolo,
  onCreateLobby,
  onFriends,
  onJoinLobby,
  onRanked1v1,
  onSquads,
  onParty,
  onRaid,
  onBossArena,
  onAutoChess,
  onProfile,
  onSettings,
  onShop,
  onSignIn,
}: {
  /** In the queue: the queue screen (or the line for a seat), shown in place of the play column. */
  queue?: ComponentChildren;
  /** In the queue on a computer: the lobby's chat, under your pawn. */
  chat?: ComponentChildren;
  /** In the queue: draw the computer's column (your card, the chat) beside it. A phone shows only the queue. */
  side?: boolean;
  /** The computer's side menu (or /bosses) asked for the boss menu or Play with friends. */
  intent?: { kind: "boss" | "friends"; n: number } | null;
  /** The Boss raid screen is open (the Solo Boss Mode card, the side menu's Solo Boss Mode, ?mode=raid). */
  raid?: boolean;
  /** With `raid`: the full Boss raid screen (?mode=raid, the test link: every raid choice), not the Solo Boss Mode form. */
  full?: boolean;
  loading: boolean;
  error?: string | null;
  /** An invite link's code: the join form opens with it. */
  joinCode?: string;
  /** A lobby you opened has closed: the note (and your result, if you played). */
  notice?: HomeNotice;
  /** Online play needs signing in, and you're a guest: PLAY plays bots. */
  onlineLocked?: boolean;
  /** PLAY (50 v 50) or a raid's queue, Default or Bots off. */
  onPlay: (mode: "crowd" | "raid", type: Exclude<MatchmakingType, "solo">) => void;
  /** PLAY, Solo, or a Solo raid: you and bots, in your browser (`fill`: the queue screen first). Boss alone: you against a boss you pick. */
  onSolo: (mode: ModeChoiceId, opts?: { fill?: boolean }) => void;
  /** Make a lobby; `made` hears its code once it's open (null if it couldn't be made). */
  onCreateLobby: (mode: ModeChoiceId, made?: (code: string | null) => void) => void;
  /** Your friends list. */
  onFriends: () => void;
  onJoinLobby: (code: string) => void;
  /** 1 v 1's PLAY: its queue. */
  onRanked1v1: () => void;
  /** Squads' PLAY: the solo queue into a squad. */
  onSquads: () => void;
  /** Squads' party: make one, or join by code. */
  onParty: () => void;
  /** Open (true) or close the Solo Boss Mode screen. */
  onRaid: (open: boolean) => void;
  /** Boss Arena's card: the town square, as /town opens it. */
  onBossArena: () => void;
  /** Auto chess's card under the Boss Arena and Solo Boss Mode cards: the screen, as /autochess opens it. */
  onAutoChess: () => void;
  onProfile: () => void;
  /** The phone's gear in the top bar: Settings, as Profile → Settings opens it. */
  onSettings: () => void;
  /** The phone's shop icon in the top bar. */
  onShop: () => void;
  onSignIn: () => void;
}) {
  const { profile } = useAccount();
  const live = useLive();
  // A part resting (a kill switch, status.ts): its way in is disabled, with its line.
  useServerStatus();
  const rest = (what: Pausable) => (isPaused(what) ? pausedLine(what) : null);
  // (From 1280 px the play column sits beside your card, with room at its top for the live window: a computer's only,
  // never a phone's or a tablet's, LIVE_WINDOW_MEDIA.)
  const wide = useMedia(LIVE_WINDOW_MEDIA);
  useFriends();
  const friendsNews = friendsBadge();
  // The RANKED row's pick: none until you tap one, and PLAY waits for it (dimmed).
  const [mode, setModeState] = useState<HomeMode | null>(chosenHomeMode);
  const pickMode = (m: HomeMode) => {
    sessionPick = m;
    setModeState(m);
    if (m === "squads" || m === "1v1") {
      try {
        localStorage.setItem(MODE_KEY, m);
      } catch {
        // Not important.
      }
    } else saveMode(m);
  };
  // How you're matched (50 v 50). Guests (online needs signing in) can only play Solo; Classic online is coming (Solo works).
  const [picked, setPicked] = useState<MatchmakingType>(chosenMatchmaking);
  const soloOnly = !!onlineLocked;
  const type: MatchmakingType = soloOnly ? "solo" : picked;
  // (Nothing picked yet: the options show greyed, none selected and none tappable: Eric, Oct 25.)
  const pickType = (t: MatchmakingType) => {
    if (!mode || (soloOnly && t !== "solo")) return;
    setPicked(t);
    saveMatchmaking(t);
  };
  // Squads: Solo queue (false) or Party (true), the panel's pick; PLAY then queues alone or opens the party.
  const [party, setParty] = useState(false);
  const [friends, setFriends] = useState(!!joinCode);
  // Play with friends: a lobby in the row's pick (1 v 1 has none: 50 v 50's), or a raid from the Boss raid screen.
  const lobbyMode: ModeChoiceId = raid ? "raid" : lobbyModeOf(mode ?? "crowd");
  // The Boss raid screen's pick (its tiles): a boss you can meet, "" for a random one, or the Hidden Boss (dark and
  // locked: never stored, so nothing starts against him). Kept for Boss alone, a Solo raid and a raid you make
  // (rememberBossPick); the public queues are always a random boss. A resting boss reads as random.
  const [pick, setPick] = useState(() => {
    const id = chosenBoss();
    return selectBosses().bosses.some((b) => b.id === id) ? id : RANDOM;
  });
  const hiddenPicked = selectBosses().hidden.some((b) => b.id === pick);
  const pickTile = (id: string) => {
    setPick(id);
    if (!selectBosses().hidden.some((b) => b.id === id)) rememberBossPick(id);
  };
  // Boss alone's menu ("solo": the difficulty for the tiles' pick) or the full picker (/bosses: "pick").
  const [bossMenu, setBossMenu] = useState<null | "solo" | "pick">(null);
  // Boss alone's difficulty (remembered on this device): its menu changes it, the stage's number follows it.
  const [difficulty, setDifficulty] = useState(chosenDifficulty);
  const pickDifficulty = (d: BossDifficultyId) => {
    rememberDifficulty(d);
    setDifficulty(d);
  };
  // (Not while Solo and Boss alone rest: the hidden /bosses lands here too, and the Boss raid screen says why.)
  const bossAlone = () => (rest("solo") ? undefined : bossInUrl() ? onSolo("raid") : setBossMenu("solo"));
  const pickBoss = (id: string) => {
    rememberBossPick(id);
    setBossMenu(null);
    onSolo("raid");
  };
  useEffect(() => {
    if (intent?.kind === "boss" && !rest("solo")) setBossMenu("pick");
    if (intent?.kind === "friends") setFriends(true);
  }, [intent?.n]);
  // (An invite's code can arrive once its lobby is known to be open.)
  useEffect(() => {
    if (joinCode) setFriends(true);
  }, [joinCode]);
  // What PLAY would start, if it's resting: Squads, 1 v 1 (PAUSE_RANKED1V1), Solo (you and bots), or 50 v 50 online.
  const resting = !mode ? null : mode === "squads" ? rest("squads") : mode === "1v1" ? rest("ranked1v1") : type === "solo" ? rest("solo") : mode === "crowd" ? rest("crowd") : null;
  const soloResting = rest("solo");
  const play = () => {
    if (!mode || resting) return;
    if (mode === "squads") return onlineLocked ? onSignIn() : party ? onParty() : onSquads();
    if (mode === "1v1") return onlineLocked ? onSignIn() : onRanked1v1();
    if (type === "solo") return onSolo(mode, { fill: true });
    if (mode === "crowd") onPlay("crowd", type);
  };
  const fill = live?.fillSeconds ?? 60;
  const wait = mode === "crowd" ? live?.waits.crowd : null;
  const bots = (mode === "classic" ? S.lobbySize : CROWD_SIZE) - 1;
  // The line above PLAY: what PLAY does, for this pick and way of being matched.
  const soloLine = `Solo vs ${bots} bots`;
  const signIn = (what: string) => (
    <>
      {what} is online ·{" "}
      <button type="button" class="fd-link" onClick={onSignIn}>
        Sign in to play
      </button>
    </>
  );
  const hint = !mode ? (
    // (Nothing picked yet: the panel says to pick one.)
    ""
  ) : resting ? (
    resting
  ) : mode === "squads" ? (
    onlineLocked ? (
      signIn("Squads")
    ) : party ? (
      "Party: create one or join by code"
    ) : (
      `Solo queue: bots fill any empty seat after ${fill} s`
    )
  ) : mode === "1v1" ? (
    // (What 1 v 1 is: in the panel, with your rank.)
    onlineLocked ? signIn("1 v 1") : ""
  ) : mode === "classic" && type !== "solo" ? (
    "Classic is being reworked"
  ) : onlineLocked ? (
    <>
      {soloLine} ·{" "}
      <button type="button" class="fd-link" onClick={onSignIn}>
        Sign in to play online
      </button>
    </>
  ) : type === "solo" ? (
    `${soloLine} · starts at once${mode === "classic" ? " · online Classic is coming" : ""}`
  ) : type === "botsoff" ? (
    `People only: starts when ${CROWD_SIZE} have joined`
  ) : wait ? (
    `Usually about ${wait} s to find a match`
  ) : (
    `Starts within ${fill} s; bots fill any empty seats`
  );
  const look = profile?.locker?.look;
  const name = profile?.user.name ?? "Player";
  const queueing = queue !== undefined && queue !== null;
  // A screen that replaces home (a phone's queue, the Boss raid screen, and home again) starts at its top, wherever home
  // was scrolled to (its card and PLAY sit low on a small phone). Before its first paint.
  const view = raid ? "raid" : queueing && !side ? "queue" : "home";
  const firstView = useRef(true);
  useLayoutEffect(() => {
    if (firstView.current) firstView.current = false;
    else scrollTo(0, 0);
  }, [view]);
  const hero = (
    <section class="fd-hero" aria-label="You">
      {/* (A phone sizes your pawn to the room the card has. Home shows your tag above the pawn's head, centered (styles.css, `order`); the
          pawn comes first here, as the queue's small card has it beside the pawn.) */}
      <div class="fd-hero-in">
      <DressedPawn look={look} size="hero" shadow />
      {/* (Your icon to the left of your name and rating, as beside your name in chat; its height is the two lines'.) */}
      <div class="fd-hero-id">
        <span class="fd-hero-icon">
          <UserIcon icon={profile?.user.icon ?? "♟"} />
          {/* (An admin's test level: a ring round the icon and "LVL 38" above it. Placeholders: FrontDoor.tsx, TEST_LEVEL.) */}
          {testSwitchesAllowed() && <LevelRing />}
        </span>
        <div class="fd-hero-text">
          <div class="fd-hero-name">{name}</div>
          <div class="fd-hero-sub">
            <RankLine rating={profile?.rating ?? null} />
          </div>
        </div>
      </div>
      </div>
    </section>
  );
  // The sheets and menus either view can open (and chat moderation's notice).
  const overlays = (
    <>
      {friends && (
        <FriendsSheet
          mode={lobbyMode}
          code={joinCode}
          loading={loading}
          onlineLocked={onlineLocked}
          resting={rest(lobbyMode)}
          onCreate={() => {
            // (A raid: the Boss raid screen's pick, or a random boss. Maia's files fetched ahead where this device may
            // run the boss's brain: you're its host.)
            if (lobbyMode === "raid" && maiaAllowed()) prefetchMaia();
            if (lobbyMode === "raid") return onCreateLobby(lobbyMode);
            // (A friend code: its link copied as the lobby opens. Asked for in this tap, as a phone's browser wants.)
            copyInviteLink(new Promise((resolve, reject) => onCreateLobby(lobbyMode, (code) => (code ? resolve(code) : reject(new Error("no lobby"))))));
          }}
          onJoin={onJoinLobby}
          onSignIn={onSignIn}
          onFriends={() => {
            setFriends(false);
            onFriends();
          }}
          onClose={() => setFriends(false)}
        />
      )}
      {bossMenu && (
        <BossMenu only={bossMenu === "solo" ? pick : undefined} value={bossMenu === "solo" ? pick : chosenBoss(isAdmin())} rating={profile?.rating ?? null} difficulty={difficulty} onDifficulty={pickDifficulty} onPick={pickBoss} onClose={() => setBossMenu(null)} />
      )}
      {/* (A moderator's warning or chat ban, once: chat moderation's.) */}
      <ChatNotice />
    </>
  );
  if (queueing)
    return (
      <div class="fd-home queueing">
        <div class="fd-home-main">
          {/* (A computer's: your pawn, smaller, and the lobby's chat under it. A phone shows only the queue.) */}
          {side && (
            <div class="fd-wait-side">
              {hero}
              {chat && <div class="fd-wait-chat">{chat}</div>}
            </div>
          )}
          {queue}
        </div>
      </div>
    );
  if (raid) {
    // The Boss raid screen (?mode=raid, the test link): every way to play a raid, each through its flow from before (Eric,
    // Oct 16: "from there you can pick if you want to solo against bosses or play with bots or queue with other players").
    // Solo Boss Mode (Eric, Oct 26) is the same screen without the raid choices: the tiles, the stage, Boss alone. Raids
    // move to the Boss Arena's Colosseum, so they're left off this form (`full` tells the two apart).
    const raidResting = full ? rest("raid") : null;
    const online = (sub: string) => (onlineLocked ? "Online: sign in to play" : sub);
    // (The Hidden Boss picked: every way to play locked.)
    const locked = hiddenPicked;
    return (
      <div class="fd-page rd-page">
        <header class="fd-page-head">
          <BackButton onClick={() => onRaid(false)} />
          <h1>{full ? "Boss raid" : "Solo Boss Mode"}</h1>
          <span class="fd-head-spacer" />
        </header>
        {/* (Why you're here: a match that closed while this screen was where you'd come back to, as on home.) */}
        {notice && <Notice notice={notice} />}
        {/* The character select (Eric, Oct 16): the tiles, the stage; the ways to play under it. */}
        <BossSelect value={pick} difficulty={difficulty} onPick={pickTile} />
        <div class="rd-options">
          {/* (The public queues share their lobby: always a random boss.) */}
          {full && (
            <RaidOption
              label="Join a raid"
              sub={online(`Random boss · up to ${RAID_SIZE} players · bots after ${fill} s`)}
              disabled={loading || !!raidResting}
              locked={locked}
              onClick={() => (onlineLocked ? onSignIn() : onPlay("raid", "default"))}
            />
          )}
          {full && (
            <RaidOption
              label="People only"
              sub={online(`Random boss · no bots · starts at ${RAID_SIZE}, or ${MATCHMAKING.raidBotsOffMinPlayers} after ${fill} s`)}
              disabled={loading || !!raidResting}
              locked={locked}
              onClick={() => (onlineLocked ? onSignIn() : onPlay("raid", "botsoff"))}
            />
          )}
          {full && <RaidOption label="Raid with bots" sub={`You and ${RAID_SIZE - 1} bots · starts at once`} disabled={loading || !!soloResting} locked={locked} onClick={() => onSolo("raid", { fill: true })} />}
          <RaidOption label="Boss alone" sub={pick === RANDOM ? "Just you vs a random boss" : "Just you vs this boss"} disabled={loading || !!soloResting} locked={locked} onClick={bossAlone} />
          {full && <RaidOption label="Play with friends" sub="Make a raid and share its code, or join one" locked={locked} onClick={() => setFriends(true)} />}
        </div>
        {full && <p class="fd-sub rd-about">{`Up to ${RAID_SIZE} of you pick the crowd's moves together against a boss. The most popular pick is played.`}</p>}
        {raidResting && <p class="fd-rest">{raidResting}</p>}
        {soloResting && soloResting !== raidResting && <p class="fd-rest">{soloResting}</p>}
        {loading && <p class="fd-hint">Loading the engine…</p>}
        {error && <p class="fd-error">{error}</p>}
        {overlays}
      </div>
    );
  }
  // The RANKED row: the three ranked modes, one picked (Eric, Oct 16).
  const ranked = (
    <div class="fd-ranked">
      <h2 class="fd-label" id="fd-ranked-label">
        RANKED
      </h2>
      <div class="fd-modes" role="radiogroup" aria-labelledby="fd-ranked-label">
        {MODES.map((m) => (
          <button type="button" role="radio" key={m.id} aria-checked={mode === m.id} class={mode === m.id ? "on" : ""} onClick={() => pickMode(m.id)}>
            {m.label}
            <br />
            <span>{m.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
  // The panel under the row (Eric, Oct 18: "it should never change size, and it should be dedicated to whatever text we
  // need there to explain what that is, or if there needs to be options for it"): one box, the same size for every
  // mode, holding the pick's options or words. 50 v 50: Matchmaking (Default, Bots off, Solo). 1 v 1 (always
  // people, one tap to queue): your rank in it and what it is. Squads: Solo queue or Party. Nothing in it changes the
  // page's layout. Always there (Eric, Oct 25: "the menu buttons should never be like invisible"):
  // with no mode picked it shows 50 v 50's options greyed, none selected and none tappable; the first pick wakes them.
  const rank1v1 = mode === "1v1" ? ranked1v1Label() : null;
  const panel = (
    <div class={`fd-mode-panel${mode ? "" : " idle"}`}>
      {mode === "squads" ? (
        <div class="fd-modes fd-types fd-squad-pick" role="radiogroup" aria-label="Squads">
          {(
            [
              { id: false, label: "Solo queue", sub: "you join a squad" },
              { id: true, label: "Party", sub: `with up to ${SQUADS.partyMax - 1} friends` },
            ] as const
          ).map((c) => (
            <button
              type="button"
              role="radio"
              key={c.label}
              aria-checked={party === c.id}
              class={party === c.id ? "on" : ""}
              onClick={() => {
                setParty(c.id);
                // (Party opens its sheet at once, as its button did: make one or join by code.)
                if (c.id) onParty();
              }}
            >
              {c.label}
              <br />
              <span>{c.sub}</span>
            </button>
          ))}
        </div>
      ) : mode === "1v1" ? (
        <div class="fd-panel-words">
          {rank1v1 && <strong class="fd-rank1v1">Your rank: {rank1v1}</strong>}
          <span>Ranked chess vs one player near your level</span>
        </div>
      ) : (
        <div class="fd-modes fd-types" role="radiogroup" aria-label="Matchmaking">
          {types.map((t) => {
            const off = soloOnly && t.id !== "solo";
            const idle = !mode;
            return (
              <button
                type="button"
                role="radio"
                key={t.id}
                aria-checked={!idle && type === t.id}
                aria-disabled={idle || off || undefined}
                class={`${type === t.id && !idle ? "on" : ""}${off ? " off" : ""}`}
                title={off ? "Online: sign in to play" : undefined}
                onClick={() => pickType(t.id)}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
  // The line above PLAY (what PLAY does, for this pick) and PLAY (and an error, if any). Eric, Oct 28: the line moved from under
  // PLAY to just above it. It has one place and one height whatever is picked (styles.css, `fd-hint`).
  const go = (
    <div class="fd-go">
      <div class="fd-hint" aria-live="polite">
        <span>{loading ? "Loading the engine…" : hint}</span>
      </div>
      {/* (Dimmed until a mode is picked: Eric, Oct 18.) */}
      <button type="button" class="fd-play" disabled={!mode || loading || !!resting || (mode === "classic" && type !== "solo")} onClick={play}>
        PLAY
      </button>
      {error && <p class="fd-error">{error}</p>}
    </div>
  );
  // Boss Arena's card (Eric, Oct 26: Boss raid becomes Boss Arena, the town square): the rotating boss faces, its tap the
  // town square (/town). It replaces the Boss raid card (Eric, Oct 16: "I don't want it to just be brushed off to the side").
  const bossArenaCard = (
    <button type="button" class="rd-card" onClick={onBossArena}>
      <span class="rd-face" aria-hidden="true">
        <BossCardFace everyMs={cardEveryMs()} fadeMs={FRONT_DOOR.bossCardFadeMs} />
      </span>
      <span class="rd-card-text">
        <strong>Boss Arena</strong>
        <span>Party up and take on the bosses</span>
      </span>
      <span class="rd-card-go" aria-hidden="true">
        ›
      </span>
    </button>
  );
  // Solo Boss Mode's card (Eric, Oct 26): the crown from the side menu's Boss raid item, drawn large, its tap the solo
  // screen (Boss alone's form of the Boss raid screen). A placeholder picture until one is drawn. A half card, side by side
  // with Auto chess under Boss Arena (`rd-pair`, styles.css).
  const soloCard = (
    <button type="button" class="rd-card rd-half" onClick={() => onRaid(true)}>
      <span class="rd-face" aria-hidden="true">
        <CrownArt />
      </span>
      <span class="rd-card-text">
        <strong>Solo Boss Mode</strong>
        <span>Any boss, alone</span>
      </span>
    </button>
  );
  // Auto chess's card (Eric, Oct 24: "build an army, watch it fight"): the Boss raid card's look and size, its picture the
  // board's own white knight (KnightArt), its tap the screen /autochess opens.
  const autoCard = (
    <button type="button" class="rd-card rd-half fd-auto-card" onClick={onAutoChess}>
      <span class="rd-face" aria-hidden="true">
        <KnightArt />
      </span>
      <span class="rd-card-text">
        <strong>Auto chess</strong>
        <span>Build an army</span>
      </span>
    </button>
  );
  return (
    <div class="fd-home">
      {/*
       * (A phone's top bar (Eric, Oct 18): the logo, your pawn (your profile), the shop, Friends (play with friends: a
       * code to share, or join one; and your friends list) and a gear for Settings (Eric, Oct 17: one tap, not two
       * through Profile). No coins: the shop and your profile show them. A computer has the logo, the shop, Play with
       * friends and Settings in its side menu, your pawn top right, and friends in its live panel.)
       */}
      <header class="fd-top">
        <Logo />
        <div class="fd-top-end">
          <AccountBar onProfile={onProfile} />
          <button type="button" class="fd-icon-btn fd-top-shop" aria-label="Shop & crates" onClick={onShop}>
            <ShopIcon />
          </button>
          <button
            type="button"
            class="fd-icon-btn fd-top-friends"
            aria-label={friendsNews ? `Friends, ${friendsNews} new` : "Friends"}
            onClick={() => setFriends(true)}
          >
            <FriendsIcon />
            {friendsNews > 0 && (
              <span class="fd-news" aria-hidden="true">
                {friendsNews}
              </span>
            )}
          </button>
          <button type="button" class="fd-icon-btn fd-top-gear" aria-label="Settings" onClick={onSettings}>
            <GearIcon />
          </button>
        </div>
      </header>
      <LiveLine live={live} />
      {notice && <Notice notice={notice} />}
      <div class="fd-home-main">
        {hero}
        <div class="fd-play-col">
          {/*
           * The same order on a phone and a computer: the RANKED row, its panel, PLAY and its line, then the Other modes cards
           * (Boss Arena, Solo Boss Mode, Auto chess; full width) at the bottom (Eric, Oct 19: "chess focused at the heart"; until then the card was on top). A
           * computer has the live window above (from 1280 px). Every box keeps its size whatever is picked, so nothing
           * moves on a click.
           */}
          {wide && <LiveWindow />}
          {ranked}
          {panel}
          {go}
          <h2 class="fd-label fd-other-label">Other modes</h2>
          {bossArenaCard}
          <div class="rd-pair">
            {soloCard}
            {autoCard}
          </div>
        </div>
      </div>
      {overlays}
    </div>
  );
}

/**
 * Solo Boss Mode's card picture: the crown from the side menu's Boss raid item (FrontMenu.tsx), drawn large in the card's
 * gold (`.fd-crown`). A placeholder until Opus draws one (Eric, Oct 26).
 */
function CrownArt() {
  return (
    <svg class="fd-crown" viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 20h14M6 20l-1.5-11 4.5 3.5L12 5l3 7.5L19.5 9 18 20" />
    </svg>
  );
}

/**
 * A white knight, drawn from the board's own piece art (the cburnett set's shapes, autochess/pieceShapes.ts): Auto chess's
 * card picture. Nothing new is drawn.
 */
function KnightArt() {
  const shapes: PieceShape[] = PIECE_SHAPES.nw ?? [];
  return (
    <svg class="fd-knight" viewBox="0 0 45 45" width="56" height="56" aria-hidden="true" focusable="false">
      {shapes.map((s, i) =>
        s.d ? (
          <path key={i} d={s.d} transform={s.tf} fill={s.fill} stroke={s.stroke} stroke-width={s.sw} stroke-linecap={s.cap as "butt" | "round" | "square"} stroke-linejoin={s.join as "miter" | "round" | "bevel"} fill-rule={s.eo ? "evenodd" : undefined} />
        ) : (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} transform={s.tf} fill={s.fill} stroke={s.stroke} stroke-width={s.sw} />
        ),
      )}
    </svg>
  );
}
