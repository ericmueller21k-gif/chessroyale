import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { WelcomeNotice } from "../components/WelcomeNotice.tsx";
import { CROWD_PARTY_MAX, BOSS_TIERS, FRONT_DOOR, adminPlayable, bossDef, bossIdFromLink, bossThreat, isPlayable, menuBosses, CROWD_SETTINGS, DEFAULT_SETTINGS as S, MATCHMAKING, MATCHMAKING_TYPES, PRIOR_RATING, RAID_SETTINGS, SQUADS, pausedLine, type BossDifficultyId, type MatchmakingType, type ModeChoiceId, type Pausable } from "@chessroyale/core";
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
import { BossInviteSheet } from "../components/BossParty.tsx";
import type { PartyClient } from "../squads.ts";
import { openProfile } from "../profile-nav.ts";
import { BossFace, bossAnims, portraitAnims } from "../components/BossCharacter.tsx";
import { prewarmAnims } from "../components/BossEffect.tsx";
import { UserIcon } from "../components/PixelIcon.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import { LiveWindow } from "../components/LiveWindow.tsx";
import { Walkthrough } from "../components/Walkthrough.tsx";
import { LIVE_WINDOW_MEDIA } from "../bot-replays.ts";
import { friendsBadge, useFriends } from "../friends.ts";
import { FriendsBadge } from "../components/Friends.tsx";
import { noteLinkCopied } from "./Lobby.tsx";
import { testParams, testSwitchesAllowed } from "../test-switches.ts";
import { QuestsBarIcon, QuestsIcon, QuestsOverlay } from "../components/QuestsOverlay.tsx";
import { BotLevelBox } from "../components/BotLevelBox.tsx";
import { FriendsOverlay } from "../components/FriendsOverlay.tsx";
import { questCountdowns, questsForYou, useQuests } from "../quests.ts";
import { account, mustSignInToPlayOnline } from "../account.ts";
import { isPaused, useServerStatus } from "../status.ts";
import { ChatNotice } from "../components/ChatNotice.tsx";
import { homeRankLine, leavesLine, ranked1v1Rank, rankedLockedUntil, yourLeaves } from "../ranked.ts";
import { RankEmblem } from "../components/RankEmblem.tsx";
import { SwordsIcon } from "../town/CardIcons.tsx";
import { Pic, Scene } from "../home-art/Pic.tsx";
import { ARENA_AUTO_CARD } from "../home-art/arena-auto-card.ts";
import { TOWN_PICTURE, TOWN_SCENE, TOWN_SKY } from "../home-art/town.ts";
import { setSearchOnHome, type AwaySearch } from "../search.ts";
import { clockShown } from "../clock-text.ts";

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
/**
 * How you're matched (home's 50 v 50 options, Nov 9: Solo queue "default", Bots "solo"; Party is greyed until it's built): this device's
 * choice. "botsoff" (people only) has no button on home since Nov 9; stored (a test's), it still queues people only under Solo queue.
 */
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
/**
 * Boss alone's Maia files fetched ahead, as Boss Battle's START does before the battle (only when the boss picked, or any of them
 * for a random pick, is likely to pick its moves with Maia at that difficulty). The town's challenge (Pokémon-gym style) too.
 */
export function prefetchBossAlone(pick: string, rating: number | null, difficulty: BossDifficultyId = chosenDifficulty()) {
  const bosses = menuBosses({ admin: isAdmin(), raid: false }).filter((b) => !isPaused(`boss:${b.id}`) && (pick === RANDOM || b.id === pick));
  if (maiaLikely(bosses.map((b) => bossAloneElo(rating, b, difficulty)))) prefetchMaia();
}

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
 * 50 v 50's options (Eric, Nov 9: "solo queue, party, and then … bots"), left to right, each a title and a short sub line as Squads'
 * (what each does in full is the line above PLAY). Solo queue is the public queue (it was Default), Bots a game in your browser at
 * the level you pick (it was Solo). Party (queueing together into the public matchmaking, up to CROWD_PARTY_MAX, ranked; Eric, Nov 9)
 * shows greyed, "Soon", until its matchmaker piece is built. Bots off is gone from home. docs/decisions/2026-11-09-home-modes-options.md.
 */
const types: { id: "default" | "party" | "solo"; label: string; sub: string; soon?: boolean }[] = [
  { id: "default", label: "Solo queue", sub: "join a lobby" },
  { id: "party", label: "Party", sub: "Soon", soon: true },
  { id: "solo", label: "Bots", sub: `${CROWD_SIZE - 1} bots, now` },
];

/**
 * Home's line above PLAY for 1 v 1 under ranked's leave rules (L1): a lockout's countdown, or the delayed queue's extra wait
 * (`otherwise`, 1 v 1's usual line, when neither applies). Its own small part, so only it is drawn each second while a lockout
 * counts down.
 */
function LeavesLine({ otherwise }: { otherwise: string }) {
  const l = yourLeaves();
  const counting = !!rankedLockedUntil(l, Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [counting]);
  return <span class="fd-leaves">{leavesLine(l, Math.max(now, Date.now())) ?? otherwise}</span>;
}

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
  search = null,
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
  onChessTown,
  onAutoChess,
  onProfile,
  onInventory,
  onSettings,
  onShop,
  onSignIn,
  bossParty,
}: {
  /** In the queue: the queue screen (or the line for a seat), shown in place of the play column. */
  queue?: ComponentChildren;
  /**
   * A search going on while you browse (search.ts; Eric, Nov 10): the modes row shows it and the row under it its three
   * actions; PLAY, Chess Town and the cards grey in place.
   */
  search?: AwaySearch | null;
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
  /**
   * PLAY with Bots, or a Solo raid: you and bots, in your browser (`fill`: the queue screen first; `botLevel`: the Bot level box's
   * pick). Boss alone: you against a boss you pick.
   */
  onSolo: (mode: ModeChoiceId, opts?: { fill?: boolean; botLevel?: number | "random" }) => void;
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
  /** Chess Town's button: the town square, as /town opens it. */
  onChessTown: () => void;
  /** Auto chess's card beside Boss Battle's, under Other modes: the screen, as /autochess opens it. */
  onAutoChess: () => void;
  onProfile: () => void;
  /** Your pawn on the card: your inventory (the shop's Locker tab). */
  onInventory: () => void;
  /** The phone's gear in the top bar: Settings, as Profile → Settings opens it. */
  onSettings: () => void;
  /** The phone's shop icon in the top bar. */
  onShop: () => void;
  onSignIn: () => void;
  /**
   * Boss Battle's party (docs/decisions/2026-10-30-boss-party.md): its client once there is one, a note, the invite
   * circles' action (the party made the first time), and leaving it.
   */
  bossParty?: { client: PartyClient | null; error: string | null; onInvite: () => Promise<boolean>; onLeave: () => void };
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
  // How you're matched (50 v 50: Solo queue or Bots; Party greyed). Guests (online needs signing in) can only play Bots; Classic online
  // is coming (Bots works). ("botsoff", a test's stored pick, shows as Solo queue and queues people only.)
  const [picked, setPicked] = useState(chosenMatchmaking);
  const soloOnly = !!onlineLocked;
  const type = soloOnly ? "solo" : picked;
  // (The option shown picked: Bots off has no button since Nov 9.)
  const option = type === "botsoff" ? "default" : type;
  // The Bot level box (PLAY with Bots).
  const [botBox, setBotBox] = useState(false);
  // (Nothing picked yet: the options show greyed, none selected and none tappable: Eric, Oct 25.)
  const pickType = (t: "default" | "party" | "solo") => {
    // (Party: greyed until it's built.)
    if (!mode || t === "party" || (soloOnly && t !== "solo")) return;
    setPicked(t);
    saveMatchmaking(t);
  };
  // Squads: Solo queue (false) or Party (true), the panel's pick; PLAY then queues alone or opens the party.
  const [party, setParty] = useState(false);
  const [friends, setFriends] = useState(!!joinCode);
  // (A phone's top-bar Friends: your friends in a centered box, Eric, Nov 9. The sheet above stays for a lobby code.)
  const [friendsList, setFriendsList] = useState(false);
  // Play with friends: a lobby in the row's pick (1 v 1 has none: 50 v 50's), or a raid from the Boss raid screen.
  const lobbyMode: ModeChoiceId = raid ? "raid" : lobbyModeOf(mode ?? "crowd");
  // The Boss raid screen's pick (its tiles): a boss you can meet, "" for a random one, or the Hidden Boss (dark and
  // locked: never stored, so nothing starts against him). Kept for Boss alone, a Solo raid and a raid you make
  // (rememberBossPick); the public queues are always a random boss. A resting boss reads as random.
  const [pick, setPick] = useState(() => {
    // (An admin's pick may be a boss in the game for admins first: Timber.)
    const id = chosenBoss(isAdmin());
    return selectBosses().bosses.some((b) => b.id === id) ? id : RANDOM;
  });
  const hiddenPicked = selectBosses().hidden.some((b) => b.id === pick);
  // Boss Battle's party: in one with someone else, the stage shows them and START becomes the party's.
  const bp = bossParty?.client && !bossParty.client.done ? bossParty.client : null;
  const [, partyDrawn] = useState(0);
  useEffect(() => bp?.subscribe(() => partyDrawn((n) => n + 1)), [bp]);
  const pv = bp?.party ?? null;
  const meId = bp?.memberId ?? null;
  const inParty = !!pv && !!meId && pv.members.some((m) => m.id === meId) && pv.members.length > 1;
  const leading = inParty && pv!.leaderId === meId;
  const [inviting, setInviting] = useState(false);
  const pickTile = (id: string) => {
    setPick(id);
    if (!selectBosses().hidden.some((b) => b.id === id)) rememberBossPick(id);
    if (leading && !selectBosses().hidden.some((b) => b.id === id)) bp!.choose(id, difficulty);
  };
  // Boss alone's menu ("solo": the difficulty for the tiles' pick) or the full picker (/bosses: "pick").
  const [bossMenu, setBossMenu] = useState<null | "solo" | "pick">(null);
  // Boss alone's difficulty (remembered on this device): its menu changes it, the stage's number follows it.
  const [difficulty, setDifficulty] = useState(chosenDifficulty);
  const pickDifficulty = (d: BossDifficultyId) => {
    rememberDifficulty(d);
    setDifficulty(d);
    if (leading) bp!.choose(pick, d);
  };
  // (A member sees the leader's boss and difficulty, and keeps them if promoted; leading, the party plays yours.)
  useEffect(() => {
    if (!inParty || !pv?.boss) return;
    if (!leading) {
      setPick(pv.boss.id);
      setDifficulty(pv.boss.difficulty);
    } else if (pv.boss.id !== pick || pv.boss.difficulty !== difficulty) bp!.choose(pick, difficulty);
  }, [inParty, leading, pv?.boss?.id, pv?.boss?.difficulty]);
  // The bosses' art is made the first time it's shown (sprite.ts lazyAnim): their tiles' and faces' made here in quiet slices,
  // a moment after home shows, so the Boss Battle screen opens without building them; and there, the picked boss's moves.
  useEffect(() => {
    let stop = () => {};
    const t = setTimeout(() => (stop = prewarmAnims(portraitAnims())), 1500);
    return () => (clearTimeout(t), stop());
  }, []);
  useEffect(() => (raid ? prewarmAnims(bossAnims(bossDef(pick)?.name)) : undefined), [raid, pick]);
  // (Not while Solo and Boss alone rest: the hidden /bosses lands here too, and the Boss raid screen says why.)
  const bossAlone = () => (rest("solo") ? undefined : bossInUrl() ? onSolo("raid") : setBossMenu("solo"));
  // Boss Battle's START: Maia's files fetched ahead as the old Boss alone menu did when it opened, then the battle.
  const start = () => {
    if (rest("solo")) return;
    prefetchBossAlone(pick, profile?.rating ?? null, difficulty);
    onSolo("raid");
  };
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
  // Ranked's leave rules (L1): a lockout greys 1 v 1's PLAY until it's over (the line above PLAY counts it down; the server
  // refuses the search anyway). Drawn again once, as it ends.
  const lockUntil = mode === "1v1" && !onlineLocked ? rankedLockedUntil(yourLeaves(), Date.now()) : null;
  const [, lockEnded] = useState(0);
  useEffect(() => {
    if (!lockUntil) return;
    const t = setTimeout(() => lockEnded((n) => n + 1), Math.max(0, lockUntil - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [lockUntil]);
  const play = () => {
    if (!mode || resting || lockUntil) return;
    if (mode === "squads") return onlineLocked ? onSignIn() : party ? onParty() : onSquads();
    if (mode === "1v1") return onlineLocked ? onSignIn() : onRanked1v1();
    // (Bots: the Bot level box first; its OK starts the game.)
    if (type === "solo") return setBotBox(true);
    if (mode === "crowd") onPlay("crowd", type);
  };
  const fill = live?.fillSeconds ?? 60;
  const wait = mode === "crowd" ? live?.waits.crowd : null;
  const bots = (mode === "classic" ? S.lobbySize : CROWD_SIZE) - 1;
  // The line above PLAY: what PLAY does, for this pick and way of being matched. Always one line, never empty (Eric, Nov 9: "let's make
  // that line always say something"; each fits 320 px: e2e/home-ranked.spec.ts).
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
    // (Nothing picked yet.)
    "Tap a game mode to get started"
  ) : resting ? (
    resting
  ) : mode === "squads" ? (
    onlineLocked ? (
      signIn("Squads")
    ) : party ? (
      `Queue with up to ${SQUADS.partyMax - 1} friends`
    ) : (
      `Solo queue: bots fill any empty seat after ${fill} s`
    )
  ) : mode === "1v1" ? (
    // (Your rank: in the panel. A lockout or the delayed queue says so here instead, L1.)
    onlineLocked ? signIn("1 v 1") : <LeavesLine otherwise="Ranked chess vs one player near your level" />
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
    `Start at once with ${bots} bots`
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
  // Searching while you browse (Eric, Nov 10: "the exact container ... that would be lit up, but everything else below it would be
  // gray"): home's rows show it, so the bar on other pages stands aside here.
  const searching = !!search && !queueing && !raid;
  useLayoutEffect(() => {
    if (!searching) return;
    setSearchOnHome(true);
    return () => setSearchOnHome(false);
  }, [searching]);
  const off = searching ? " fd-off" : "";
  // A screen that replaces home (a phone's queue, the Boss raid screen, and home again) starts at its top, wherever home
  // was scrolled to (its card and PLAY sit low on a small phone). Before its first paint.
  const view = raid ? "raid" : queueing && !side ? "queue" : "home";
  const firstView = useRef(true);
  useLayoutEffect(() => {
    if (firstView.current) firstView.current = false;
    else scrollTo(0, 0);
  }, [view]);
  // Your icon opens the icon picker (your profile's Edit sheet, straight to the icon). Your name and rank line open your
  // public profile, the page others see (Eric, Nov 7). A guest with no profile loaded yet gets your own page instead.
  const onIcon = () => openProfile({ you: true, name, section: "icon" });
  const onName = () => (profile ? openProfile({ uid: profile.user.id, name, you: true, public: true }) : openProfile({ you: true, name }));
  // The daily quests (Nov 9, phase 3; quests.ts, the server's server/quests.ts): the Quests entry for everyone (greyed, "Sign in for
  // quests", where a guest can't have them: nothing hidden), the overlay opened on the XP day's first visit (signed in) and from it.
  const questsOn = questsForYou();
  // (Never opening by itself over the queue or another notice: it waits for the next home visit. Review of #575, m3.)
  const quests = useQuests(questsOn === true, queueing);
  // (A computer (1024 px and up, the top bar hidden there) keeps the entry on your card's top right; a phone's entry is in the top bar.)
  const computer = useMedia("(min-width: 1024px)");
  const questsLabel = questsOn === false ? "Sign in for quests" : "Quests";
  const hero = (
    <section class={`fd-hero${!queueing && computer ? " fd-has-quests" : ""}`} aria-label="You">
      {/* (A phone sizes your pawn to the room the card has. Home shows your tag above the pawn's head, centered (styles.css, `order`); the
          pawn comes first here, as the queue's small card has it beside the pawn.) */}
      <div class="fd-hero-in">
      {/* (Your pawn opens your inventory (Eric, Nov 6); your icon opens the icon picker and your name, rank and public profile: Eric, Nov 7.) */}
      <DressedPawn look={look} size="hero" shadow ride own onTap={onInventory} tapLabel="Open your inventory" />
      {/* (Your icon to the left of your name and rating, as beside your name in chat; its height is the two lines'.) Only the
          icon and the name and rank line are taps; the rest of the card does nothing. */}
      <div class="fd-hero-id">
        <span class="fd-hero-icon">
          <button type="button" class="fd-hero-iconbtn" aria-label="Edit icon" onClick={onIcon}>
            <UserIcon icon={profile?.user.icon ?? "♟"} />
          </button>
          {/* (Your level, Nov 9: a ring round the icon and "LVL 7" above it, from your XP, wherever you can earn XP: signed in, or
              anyone where sign-in isn't set up.) */}
          {profile && account().config && !mustSignInToPlayOnline() && <LevelRing xp={profile.xp ?? 0} />}
        </span>
        <div class="fd-hero-text">
          <button type="button" class="fd-hero-namebtn" aria-label="View your profile" onClick={onName}>
            <span class="fd-hero-name">{name}</span>
            <span class="fd-hero-sub">
              <RankLine line={homeRankLine()} />
            </span>
          </button>
        </div>
      </div>
      </div>
      {/* (The Quests entry (Nov 9): always there (nothing hidden; greyed until quests are yours), in the card's top right corner, over
          nothing, so nothing on home moves. A computer only: a phone's is in the top bar.) */}
      {!queueing && computer && (
        <button type="button" class="fd-quests-btn" aria-label="Quests" title={questsLabel} disabled={questsOn !== true} onClick={quests.show}>
          <QuestsIcon />
          <span>Quests</span>
        </button>
      )}
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
      {botBox && (
        <BotLevelBox
          rating={profile?.rating ?? null}
          onClose={() => setBotBox(false)}
          onStart={(botLevel) => {
            setBotBox(false);
            if (mode && mode !== "squads" && mode !== "1v1") onSolo(mode, { fill: true, botLevel });
          }}
        />
      )}
      {friendsList && (
        <FriendsOverlay
          onClose={() => setFriendsList(false)}
          onAllFriends={() => {
            setFriendsList(false);
            onFriends();
          }}
          onLobbyCode={() => {
            setFriendsList(false);
            setFriends(true);
          }}
          onSignIn={() => {
            setFriendsList(false);
            onSignIn();
          }}
        />
      )}
      {bossMenu && (
        <BossMenu only={bossMenu === "solo" ? pick : undefined} value={bossMenu === "solo" ? pick : chosenBoss(isAdmin())} rating={profile?.rating ?? null} difficulty={difficulty} onDifficulty={pickDifficulty} onPick={pickBoss} onClose={() => setBossMenu(null)} />
      )}
      {/* (A moderator's warning or chat ban, once: chat moderation's.) */}
      <ChatNotice />
      {/* (The Welcome Crate earned, Nov 6: its one-time notice; WelcomeNotice.tsx.) */}
      <WelcomeNotice />
      {quests.open && quests.answer && !queueing && (
        <QuestsOverlay
          quests={quests.answer.quests}
          dailyResetIn={questCountdowns(quests.answer, quests.receivedAt).daily}
          weeklyResetIn={questCountdowns(quests.answer, quests.receivedAt).weekly}
          paused={!!quests.answer.paused}
          onReroll={quests.reroll}
          onClose={quests.close}
        />
      )}
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
  // Boss Battle's party on the stage: the others on the platforms behind you (by seat), the checks and crowns, the menu.
  const others = inParty ? pv!.members.filter((m) => m.id !== meId).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)) : [];
  const me = inParty ? pv!.members.find((m) => m.id === meId)! : null;
  const leaderName = inParty ? (pv!.members.find((m) => m.id === pv!.leaderId)?.name ?? "The leader") : "";
  const waiting = inParty ? pv!.members.filter((m) => m.id !== pv!.leaderId && m.connected && !m.ready) : [];
  const slot = (m: (typeof others)[number] | undefined) => (m ? { id: m.id, name: m.name, look: m.look, leader: m.id === pv!.leaderId, ready: !!m.ready, ...(m.uid ? { uid: m.uid } : {}), ...(m.bot ? { bot: true } : {}) } : null);
  const stage = inParty
    ? {
        back: [slot(others[0]), slot(others[1])] as const,
        me: { leader: leading, ready: !!me?.ready },
        locked: !leading,
        onProfile: (m: { uid?: string; name: string }) => m.uid && openProfile({ uid: m.uid, name: m.name }),
        ...(leading ? { onKick: (m: { id: string }) => bp!.kick(m.id), onPromote: (m: { id: string }) => bp!.promote(m.id) } : {}),
      }
    : undefined;
  const names = (xs: { name: string }[]) => (xs.length > 1 ? `${xs.slice(0, -1).map((x) => x.name).join(", ")} and ${xs.at(-1)!.name}` : (xs[0]?.name ?? ""));
  const partyLine = !inParty ? (bp?.error ?? bossParty?.error ?? "") : leading ? (waiting.length ? `Waiting for ${names(waiting)} to ready up` : "Everyone's ready.") : `${leaderName} picks the boss and the difficulty.`;
  const invite = () => {
    void bossParty?.onInvite().then((ok) => ok && setInviting(true));
  };
  if (raid) {
    // The Boss raid screen (?mode=raid, the test link): every way to play a raid, each through its flow from before (Eric,
    // Oct 16: "from there you can pick if you want to solo against bosses or play with bots or queue with other players").
    // Solo Boss Mode (Eric, Oct 26) is the same screen without the raid choices: the tiles, the stage, Boss alone. Raids
    // move to Chess Town's Colosseum, so they're left off this form (`full` tells the two apart).
    const raidResting = full ? rest("raid") : null;
    const online = (sub: string) => (onlineLocked ? "Online: sign in to play" : sub);
    // (The Hidden Boss picked: every way to play locked.)
    const locked = hiddenPicked;
    return (
      <div class="fd-page rd-page">
        <header class="fd-page-head">
          <BackButton onClick={() => onRaid(false)} />
          <h1>{full ? "Boss raid" : "Boss Battle"}</h1>
          <span class="fd-head-spacer" />
        </header>
        {/* (Why you're here: a match that closed while this screen was where you'd come back to, as on home.) */}
        {notice && <Notice notice={notice} />}
        {/* The character select (Eric, Oct 16): the tiles, the stage; the ways to play under it. */}
        <BossSelect value={pick} difficulty={difficulty} name={name} look={look} onPick={pickTile} onDifficulty={pickDifficulty} onInvite={full || !bossParty ? undefined : invite} party={stage} />
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
          {full ? (
            <RaidOption label="Boss alone" sub={pick === RANDOM ? "Just you vs a random boss" : "Just you vs this boss"} disabled={loading || !!soloResting} locked={locked} onClick={bossAlone} />
          ) : (
            // (Boss Battle's START: straight into the battle with the picked boss at the screen's difficulty; the old Boss alone menu is skipped.
            // In a party: the leader's START once everyone is ready, a member's READY; the line under it says why.)
            <>
              {inParty ? (
                <button type="button" class="bs-start" disabled={leading ? loading || locked || waiting.length > 0 : false} aria-pressed={leading ? undefined : !!me?.ready} onClick={() => (leading ? bp!.start() : bp!.ready(!me?.ready))}>
                  <SwordsIcon />
                  {leading ? "START" : me?.ready ? "READY ✓" : "READY"}
                </button>
              ) : (
                <button type="button" class="bs-start" disabled={loading || !!soloResting || locked} onClick={start}>
                  <SwordsIcon />
                  START
                </button>
              )}
              <p class="bs-line" role="status">
                {partyLine}
              </p>
            </>
          )}
          {full && <RaidOption label="Play with friends" sub="Make a raid and share its code, or join one" locked={locked} onClick={() => setFriends(true)} />}
        </div>
        {full && <p class="fd-sub rd-about">{`Up to ${RAID_SIZE} of you pick the crowd's moves together against a boss. The most popular pick is played.`}</p>}
        {raidResting && <p class="fd-rest">{raidResting}</p>}
        {soloResting && soloResting !== raidResting && <p class="fd-rest">{soloResting}</p>}
        {loading && <p class="fd-hint">Loading the engine…</p>}
        {error && <p class="fd-error">{error}</p>}
        {overlays}
        {inviting && bp && (
          <BossInviteSheet
            client={bp}
            test={testSwitchesAllowed() || isAdmin()}
            onClose={() => setInviting(false)}
            onLeave={() => {
              setInviting(false);
              bossParty?.onLeave();
            }}
          />
        )}
      </div>
    );
  }
  // The RANKED row: the three ranked modes, one picked (Eric, Oct 16).
  const ranked = (
    <div class="fd-ranked">
      <h2 class={`fd-label${off}`} id="fd-ranked-label">
        RANKED
      </h2>
      {searching ? (
        // (Searching: the same box, the same size, the search in it.)
        <SearchRow search={search!} />
      ) : (
        <div class="fd-modes" role="radiogroup" aria-labelledby="fd-ranked-label">
          {MODES.map((m) => (
            <button type="button" role="radio" key={m.id} data-tour={`mode-${m.id}`} aria-checked={mode === m.id} class={mode === m.id ? "on" : ""} onClick={() => pickMode(m.id)}>
              {m.label}
              <br />
              <span>{m.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
  // The panel under the row (Eric, Oct 18: "it should never change size, and it should be dedicated to whatever text we
  // need there to explain what that is, or if there needs to be options for it"): one box, the same size for every
  // mode, holding the pick's options or words. 50 v 50: Matchmaking (Default, Bots off, Solo). 1 v 1 (always
  // people, one tap to queue): your rank in it and what it is. Squads: Solo queue or Party. Nothing in it changes the
  // page's layout. Always there (Eric, Oct 25: "the menu buttons should never be like invisible"):
  // with no mode picked it shows 50 v 50's options greyed, none selected and none tappable; the first pick wakes them.
  const rank1v1 = mode === "1v1" ? ranked1v1Rank() : null;
  const panel = searching ? (
    // (Searching: the same box, its three actions: Cancel, Lobby, Start with bots.)
    <div class="fd-mode-panel">
      <SearchActions search={search!} />
    </div>
  ) : (
    <div class={`fd-mode-panel${mode ? "" : " idle"}`}>
      {mode === "squads" ? (
        <div class="fd-modes fd-types fd-squad-pick fd-three" role="radiogroup" aria-label="Squads">
          {(
            [
              { id: false, label: "Solo queue", sub: "join a squad" },
              { id: true, label: "Party", sub: `up to ${SQUADS.partyMax - 1} friends` },
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
          {/* (Squads with bots (Eric, Nov 9: "play a squad game with 31 bots"): shown greyed until its server part lands: nothing hidden.) */}
          <button type="button" role="radio" aria-checked={false} aria-disabled class="off" title="Coming soon">
            Bots
            <br />
            <span>Soon</span>
          </button>
        </div>
      ) : mode === "1v1" ? (
        <div class="fd-panel-words fd-rank-words">
          {/* (Your rank's emblem: its box is there before the profile loads, so nothing moves when it does.) */}
          <RankEmblem rank={rank1v1} class="fd-rank-emblem" />
          <span class="fd-rank-lines">
            {rank1v1 && <strong class="fd-rank1v1">Your rank: {rank1v1.label}</strong>}
            {/* (What 1 v 1 is: the line above PLAY since Nov 9, so the panel says only how ranks move.) */}
            <span>Win to climb, lose to drop</span>
          </span>
        </div>
      ) : (
        <div class="fd-modes fd-types fd-three" role="radiogroup" aria-label="Matchmaking">
          {types.map((t) => {
            const off = !!t.soon || (soloOnly && t.id !== "solo");
            const idle = !mode;
            return (
              <button
                type="button"
                role="radio"
                key={t.id}
                aria-checked={!idle && option === t.id}
                aria-disabled={idle || off || undefined}
                class={`${option === t.id && !idle ? "on" : ""}${off ? " off" : ""}`}
                title={t.soon ? `Queue with up to ${CROWD_PARTY_MAX - 1} friends (soon)` : off ? "Online: sign in to play" : undefined}
                onClick={() => pickType(t.id)}
              >
                {t.label}
                <br />
                <span>{t.sub}</span>
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
    <div class={`fd-go${off}`} inert={searching}>
      <div class="fd-hint" aria-live="polite">
        <span>{loading ? "Loading the engine…" : hint}</span>
      </div>
      {/* (Dimmed until a mode is picked: Eric, Oct 18.) */}
      <button type="button" class="fd-play" data-tour="play" disabled={searching || !mode || loading || !!resting || !!lockUntil || (mode === "classic" && type !== "solo")} onClick={play}>
        PLAY
      </button>
      {error && <p class="fd-error">{error}</p>}
    </div>
  );
  // Chess Town's button (Eric, Oct 31 and Nov 1; it was the Boss Arena card, Oct 26): PLAY's size, under it, the town square (/town)
  // as a little scene: one of two pictures, picked at random as the page loads, playing its idle, "Chess Town" over it, under the sky
  // of the device's time of day (day, dusk or night; picked as the page loads too, home-art/town.ts). Its own class, not PLAY's
  // (`fd-town`; styles.css gives both the same size at every width).
  const chessTownButton = (
    <button type="button" class={`fd-town${off}`} inert={searching} data-tour="chess-town" onClick={onChessTown} data-picture={TOWN_PICTURE.id} data-sky={TOWN_SKY}>
      <Scene ch={TOWN_SCENE} dropBottom={TOWN_PICTURE.dropBottom} groundRow={TOWN_PICTURE.groundRow} class="fd-town-scene" />
      <span class="fd-town-label">Chess Town</span>
    </button>
  );
  // Boss Battle's card (Eric, Oct 26 as Solo Boss Mode): the rotating boss faces (from the old Boss Arena card; Nov 1), its tap the
  // solo screen (Boss alone's form of the Boss raid screen). A half card, side by side with Auto chess under Other modes
  // (`rd-pair`, styles.css).
  const soloCard = (
    <button type="button" class="rd-card rd-half" data-tour="boss-battle" onClick={() => onRaid(true)}>
      <span class="rd-face" aria-hidden="true">
        <BossCardFace everyMs={cardEveryMs()} fadeMs={FRONT_DOOR.bossCardFadeMs} />
      </span>
      <span class="rd-card-text">
        <strong>Boss Battle</strong>
        <span>Any boss, up to 3</span>
      </span>
    </button>
  );
  // Auto chess's card (Eric, Oct 24: "build an army, watch it fight"): its picture the army drawn for it (Nov 1; it was the board's
  // white knight), its tap the screen /autochess opens.
  const autoCard = (
    <button type="button" class="rd-card rd-half fd-auto-card" onClick={onAutoChess}>
      <span class="rd-face" aria-hidden="true">
        <Pic ch={ARENA_AUTO_CARD} scale={1} />
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
      <Walkthrough onShop={onShop} />
      <header class="fd-top">
        <Logo />
        <div class="fd-top-end">
          <AccountBar onProfile={onProfile} tourId="profile" face={!computer} />
          {!computer && (
            // (The Quests entry (Nov 9): one more square button in a phone's top bar, the quests icon, as the shop's; greyed until quests
            // are yours.)
            <button type="button" class="fd-icon-btn fd-top-quests" aria-label="Quests" title={questsLabel} disabled={questsOn !== true} onClick={quests.show}>
              <QuestsBarIcon />
            </button>
          )}
          <button type="button" class="fd-icon-btn fd-top-shop" data-tour="shop" aria-label="Shop & crates" onClick={onShop}>
            <ShopIcon />
          </button>
          <button
            type="button"
            class="fd-icon-btn fd-top-friends" data-tour="play-with-friends"
            aria-label={friendsNews ? `Friends, ${friendsNews} new` : "Friends"}
            onClick={() => setFriendsList(true)}
          >
            <FriendsIcon />
            {friendsNews > 0 && (
              <span class="fd-news" aria-hidden="true">
                {friendsNews}
              </span>
            )}
          </button>
          <button type="button" class="fd-icon-btn fd-top-gear" data-tour="settings" aria-label="Settings" onClick={onSettings}>
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
           * The same order on a phone and a computer: the RANKED row, its panel, PLAY and its line, Chess Town's button (PLAY's size),
           * then the Other modes cards (Boss Battle and Auto chess, side by side) at the bottom (Eric, Oct 19: "chess focused at the heart"; until then the card was on top). A
           * computer has the live window above (from 1280 px). Every box keeps its size whatever is picked, so nothing
           * moves on a click.
           */}
          {wide && <LiveWindow />}
          {ranked}
          {panel}
          {go}
          {chessTownButton}
          <h2 class={`fd-label fd-other-label${off}`}>Other modes</h2>
          <div class={`rd-pair${off}`} inert={searching}>
            {soloCard}
            {autoCard}
          </div>
        </div>
      </div>
      {overlays}
    </div>
  );
}

/** Now, every second (a search's time). */
function useSecond(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * Searching (Eric, Nov 10; the approved mockup, notes/assets/search-rows2-*.png): the modes row's own box and size shows the
 * search: a green spinning ring, "Searching · 50 v 50", the queue type and the lobby's count, and the time searched in green
 * on the right.
 */
function SearchRow({ search }: { search: AwaySearch }) {
  const now = useSecond();
  return (
    <div class="fd-modes fd-search" role="group" aria-label={`Searching ${search.name}`}>
      <span class="fd-search-ring" aria-hidden="true" />
      <span class="fd-search-words">
        <strong class="fd-search-title">Searching · {search.name}</strong>
        <span class="fd-search-detail">{search.detail(now)}</span>
      </span>
      <span class="fd-search-time">{clockShown(Math.max(0, now - search.since))}</span>
    </div>
  );
}

/**
 * The row under it: the search's three actions (data: search.ts's `slots`), no lines between them, as home's rows are. One
 * that asks first (Cancel, Start with bots) asks in the same three slots (Eric: "you hit cancel and then you just hit yes or
 * no"): the question where the first slot was (not a button, so a double tap can't confirm), Yes, No. No, or
 * FRONT_DOOR.searchAskMs without a tap, puts the actions back. Nothing moves or opens.
 */
function SearchActions({ search }: { search: AwaySearch }) {
  const [asking, setAsking] = useState<number | null>(null);
  useEffect(() => {
    if (asking === null) return;
    const t = setTimeout(() => setAsking(null), FRONT_DOOR.searchAskMs);
    return () => clearTimeout(t);
  }, [asking]);
  const slot = asking === null ? null : search.slots[asking]!;
  if (slot?.ask) {
    const a = slot.ask;
    return (
      <div class="fd-modes fd-types fd-three fd-search-acts asking" role="group" aria-label={a.question}>
        <div class="fd-search-ask" role="status">
          {a.question}
          <br />
          <span>{a.note}</span>
        </div>
        <button
          type="button"
          class={`fd-search-yes ${a.red ? "red" : "go"}`}
          onClick={() => {
            setAsking(null);
            slot.run?.();
          }}
        >
          Yes
          <br />
          <span>{a.yes}</span>
        </button>
        <button type="button" class="fd-search-no" onClick={() => setAsking(null)}>
          No
          <br />
          <span>keep searching</span>
        </button>
      </div>
    );
  }
  return (
    <div class="fd-modes fd-types fd-three fd-search-acts" role="group" aria-label={`${search.name} search`}>
      {search.slots.map((s, i) => (
        <button
          type="button"
          key={i}
          aria-disabled={!s.run || undefined}
          class={`${s.red ? "red" : ""}${s.run ? "" : " off"}`}
          title={s.run ? undefined : "Coming soon"}
          onClick={() => (!s.run ? undefined : s.ask ? setAsking(i) : s.run())}
        >
          {s.label}
          <br />
          <span>{s.line}</span>
        </button>
      ))}
    </div>
  );
}
