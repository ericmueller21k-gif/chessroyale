import { useEffect, useRef, useState } from "preact/hooks";
import { BOSS_TIERS, bossDef, bossStrength, bossThreat, isPlayable, playableBosses, CROWD_SETTINGS, DEFAULT_SETTINGS as S, MATCHMAKING, MATCHMAKING_TYPES, MAX_OPENING_MOVES, PRIOR_RATING, RAID_SETTINGS, raidBossElo, rankedMinHumans, type MatchmakingType, type ModeChoiceId } from "@chessroyale/core";
import { useAccount } from "./Profile.tsx";
import { chosenDifficulty, difficultyElo, rememberDifficulty } from "../boss-difficulty.ts";
import { BossDifficulty } from "../components/BossDifficulty.tsx";
import type { ComponentChildren } from "preact";
import { AccountBar, DressedPawn, FdButton, LiveLine, Logo, RankLine, myHat, wearingNames } from "../components/FrontDoor.tsx";
import { useLive } from "../live.ts";
import { BossFace } from "../components/BossCharacter.tsx";
import { UserIcon } from "../components/PixelIcon.tsx";
import { useMedia } from "../components/QuickChat.tsx";

export const OPENING_KEY = "brc.openingMoves";
const MODE_KEY = "brc.mode";
const TURNS_KEY = "brc.crowdTurns";
const AUGMENTS_KEY = "brc.augments";

export interface ModeChoice {
  /** Classic, Crowd (50 v 50) or the boss raid. */
  mode: ModeChoiceId;
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
  // Crowd (50 v 50) is the main mode: Classic or the boss raid only when chosen.
  const picked = q.get("mode") ?? get(MODE_KEY);
  const mode = picked === "classic" ? "classic" : picked === "raid" ? "raid" : "crowd";
  return {
    mode,
    crowdTeams: (q.get("turns") ?? get(TURNS_KEY)) !== "all",
    augments: (q.get("augments") ?? get(AUGMENTS_KEY)) !== "0",
  };
}

export function saveMode(c: ModeChoice) {
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

/** ?boss=<id> or ?boss=<strength> picks the boss, so the boss menu is skipped (handy for tests). */
export function bossInUrl(): boolean {
  return new URLSearchParams(location.search).has("boss");
}

/** Boss raid: the boss you picked (a playable one), or "" for a random one. ?boss=<id>, else this device's choice. */
export function chosenBoss(): string {
  const q = new URLSearchParams(location.search).get("boss");
  let v = q ?? pickedBoss;
  if (v === null) {
    try {
      v = localStorage.getItem(BOSS_KEY);
    } catch {
      v = null;
    }
  }
  return v && isPlayable(bossDef(v)) ? v : "";
}

/** A test link's fixed strength (?boss=1600: one of the tiers), else 0: the boss plays a step above you. */
export function bossTierFromUrl(): number {
  const n = Number(new URLSearchParams(location.search).get("boss"));
  return BOSS_TIERS.includes(n) ? n : 0;
}

/** A boss's strength against yours, in words and a colour. */
function versus(elo: number, you: number): { text: string; tone: "easy" | "even" | "hard" | "brutal" } {
  const d = Math.round((elo - you) / 10) * 10;
  if (Math.abs(d) < 100) return { text: "≈ your level", tone: "even" };
  if (d < 0) return { text: `−${-d} vs you`, tone: "easy" };
  return { text: `+${d} vs you`, tone: d >= 400 ? "brutal" : "hard" };
}

/** What each boss's powers do, in a few words (the menu's line under its name). */
const POWER_WORDS: Record<string, string> = { freeze: "freezes a piece", blizzard: "blizzard", pie: "pies a square", funhouse: "funhouse", sparkler: "sets squares alight", candle: "Roman candle" };

/**
 * Boss raid: the menu that opens when you start: a random boss (a different one from last time), or one of the
 * bosses you can meet (only the complete ones: a character and its powers), each at your strength plus its own
 * offset, with its threat and its strength against yours. A tap picks it and starts.
 */
export function BossMenu({
  forRaid,
  value,
  rating,
  onPick,
  onClose,
}: {
  forRaid: boolean;
  value: string;
  rating: number | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const you = rating ?? PRIOR_RATING;
  const base = raidBossElo([rating]);
  const bosses = playableBosses();
  // Solo: a difficulty on top of the boss's strength (online, the lobby's strength stands).
  const [difficulty, setDifficulty] = useState(chosenDifficulty);
  const extra = forRaid ? 0 : difficultyElo(difficulty);
  const picked = useRef<HTMLButtonElement>(null);
  useEffect(() => {
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
            <h2 id="boss-menu-title">Choose your boss</h2>
            <span class="muted small">
              {forRaid ? "For your raid · " : ""}Your rating: {Math.round(you)}
              {rating === null ? " (unrated)" : ""}
            </span>
          </div>
          <button type="button" class="tower-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {!forRaid && (
          <BossDifficulty
            value={difficulty}
            onChange={(d) => {
              rememberDifficulty(d);
              setDifficulty(d);
            }}
          />
        )}
        <div class="boss-menu-list">
          <button type="button" class={`boss-row match${value === "" ? " on" : ""}`} ref={value === "" ? picked : undefined} onClick={() => onPick("")}>
            <span class="br-icon" aria-hidden="true">
              🎲
            </span>
            <span class="br-main">
              <strong>Random boss</strong>
              <span class="br-sub">{forRaid ? "a different one from the one most of you met last" : "a different one from last time"}</span>
            </span>
          </button>
          {bosses.map((b) => {
            const elo = bossStrength(base, b, extra);
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
                    <span class="br-powers">{b.powers ? `${POWER_WORDS[b.powers.passive]} · ${POWER_WORDS[b.powers.ultimate]}` : ""}</span>
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

/** The mode picker's three choices, and the line under PLAY for each. */
const MODES: { id: ModeChoiceId; label: string; sub: string }[] = [
  { id: "crowd", label: "Crowd", sub: "50 v 50" },
  { id: "raid", label: "Boss raid", sub: "up to 50" },
  { id: "classic", label: "Classic", sub: "coming" },
];

/**
 * Play with friends: a lobby with a code (in the mode picked on the home screen), joining one, and practice
 * against bots on your own.
 */
function FriendsSheet({
  mode,
  code: initialCode,
  loading,
  onlineLocked,
  onCreate,
  onJoin,
  onSignIn,
  onClose,
}: {
  mode: ModeChoiceId;
  code?: string;
  loading: boolean;
  onlineLocked?: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(initialCode ?? "");
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const label = mode === "raid" ? "Create a raid" : mode === "classic" ? "Create a Classic lobby" : "Create a lobby";
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
                <p class="fd-sub">Make a lobby and share its code. Empty seats fill with bots when you start.</p>
                <FdButton primary disabled={loading} onClick={onCreate}>
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
        {/* (Practising against bots is Solo now, on the home screen.) */}
      </div>
    </div>
  );
}

/** The Matchmaking choices: a word or two under each (the ⓘ says more). */
const TYPES: { id: MatchmakingType; label: string; sub: string }[] = [
  { id: "default", label: "Default", sub: "bots at 60 s" },
  { id: "botsoff", label: "Bots off", sub: "people only" },
  { id: "solo", label: "Solo", sub: "you + bots" },
];

/** What each way of being matched does, for the ⓘ. */
function TypesInfo({ raid }: { raid: boolean }) {
  // (The real players a match needs to count: 30 of a 50 v 50's 100, 15 of a raid's 50.)
  const crowdMin = rankedMinHumans(CROWD_SETTINGS.lobbySize ?? 100);
  const raidMin = rankedMinHumans(RAID_SETTINGS.lobbySize ?? 50);
  return (
    <div class="fd-types-info" id="fd-types-info">
      <p>
        <strong>Default</strong> adds bots after 60 seconds to keep the wait short.
      </p>
      <p>
        <strong>Bots off</strong> plays real people only: it waits until the {raid ? `raid has 50 (or ${MATCHMAKING.raidBotsOffMinPlayers} after a minute)` : "lobby is full"}.
      </p>
      <p>
        <strong>Solo</strong> is you and bots, starting at once.
      </p>
      <p class="fd-types-rank">
        Your ranking changes only in a match with at least {crowdMin} real players ({raidMin} in a raid). Solo games never change it.
      </p>
    </div>
  );
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

/**
 * Home (the approved mockup, docs/mockups/front-door/Main.dc.html): the top bar (logo, coins, your pawn), the live
 * line, your dressed pawn with your icon, name and rating, the mode picker, PLAY and the line under it, and four smaller
 * buttons. A note goes under the live line when a lobby you opened has closed. Light or dark is in Settings.
 *
 * On a computer (1024 px and wider, the side menu's frame) the play column is Play with friends and Boss alone, then
 * the mode picker, then PLAY at the bottom (Eric, Oct 9): the shop and your profile are in the side menu, and the room
 * above is kept for a live game.
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
  loading,
  error,
  joinCode,
  notice,
  onlineLocked,
  onPlay,
  onSolo,
  onCreateLobby,
  onJoinLobby,
  onProfile,
  onShop,
  onSignIn,
}: {
  /** In the queue: the queue screen (or the line for a seat), shown in place of the play column. */
  queue?: ComponentChildren;
  /** In the queue on a computer: the lobby's chat, under your pawn. */
  chat?: ComponentChildren;
  /** In the queue: draw the computer's column (your card, the chat) beside it. A phone shows only the queue. */
  side?: boolean;
  /** The computer's side menu asked for the boss menu or Play with friends. */
  intent?: { kind: "boss" | "friends"; n: number } | null;
  loading: boolean;
  error?: string | null;
  /** An invite link's code: the join form opens with it. */
  joinCode?: string;
  /** A lobby you opened has closed: the note (and your result, if you played). */
  notice?: HomeNotice;
  /** Online play needs signing in, and you're a guest: PLAY plays bots. */
  onlineLocked?: boolean;
  /** PLAY, Default or Bots off: the queue for a mode. */
  onPlay: (mode: "crowd" | "raid", type: Exclude<MatchmakingType, "solo">) => void;
  /** PLAY, Solo: you and bots, in your browser (`fill`: the queue screen first). Boss alone: you against a boss you pick. */
  onSolo: (mode: ModeChoiceId, opts?: { fill?: boolean }) => void;
  onCreateLobby: (mode: ModeChoiceId) => void;
  onJoinLobby: (code: string) => void;
  onProfile: () => void;
  onShop: () => void;
  onSignIn: () => void;
}) {
  const { profile } = useAccount();
  const live = useLive();
  // (The same line as the stylesheet's frame: from 1024 px the side menu has the shop and your profile.)
  const computer = useMedia("(min-width: 1024px)");
  const [mode, setModeState] = useState<ModeChoiceId>(() => chosenMode().mode);
  const pickMode = (m: ModeChoiceId) => {
    setModeState(m);
    saveMode({ ...chosenMode(), mode: m });
  };
  // How you're matched. Guests (online needs signing in) can only play Solo; Classic online is coming (Solo works).
  const [picked, setPicked] = useState<MatchmakingType>(chosenMatchmaking);
  const soloOnly = !!onlineLocked;
  const type: MatchmakingType = soloOnly ? "solo" : picked;
  const pickType = (t: MatchmakingType) => {
    if (soloOnly && t !== "solo") return;
    setPicked(t);
    saveMatchmaking(t);
  };
  const [info, setInfo] = useState(false);
  const [friends, setFriends] = useState(!!joinCode);
  // Boss raid: pick the boss first, for a raid alone or one you create (skipped with ?boss=N).
  const [bossMenu, setBossMenu] = useState<null | "solo" | "raid">(null);
  const bossAlone = () => (bossInUrl() ? onSolo("raid") : setBossMenu("solo"));
  const pickBoss = (id: string) => {
    rememberBossPick(id);
    const forRaid = bossMenu === "raid";
    setBossMenu(null);
    if (forRaid) onCreateLobby("raid");
    else onSolo("raid");
  };
  useEffect(() => {
    if (intent?.kind === "boss") bossAlone();
    if (intent?.kind === "friends") setFriends(true);
  }, [intent?.n]);
  // (An invite's code can arrive once its lobby is known to be open.)
  useEffect(() => {
    if (joinCode) setFriends(true);
  }, [joinCode]);
  const play = () => {
    if (type === "solo") return onSolo(mode, { fill: true });
    if (mode !== "classic") onPlay(mode, type);
  };
  const fill = live?.fillSeconds ?? 60;
  const wait = mode === "raid" ? live?.waits.boss : live?.waits.crowd;
  const bots = mode === "raid" ? 49 : mode === "classic" ? S.lobbySize - 1 : 99;
  // The line under PLAY: what PLAY does, for this mode and way of being matched.
  const soloLine = mode === "raid" ? `You and ${bots} bots against a boss` : `Solo vs ${bots} bots`;
  const hint =
    mode === "classic" && type !== "solo" ? (
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
      mode === "raid" ? `People only: starts at 50, or ${MATCHMAKING.raidBotsOffMinPlayers} after a minute` : "People only: starts when 100 have joined"
    ) : mode === "raid" ? (
      `Join a raid; bots fill the crowd after ${fill} s`
    ) : wait ? (
      `Usually about ${wait} s to find a match`
    ) : (
      `Starts within ${fill} s; bots fill any empty seats`
    );
  const look = profile?.locker?.look;
  const name = profile?.user.name ?? "Player";
  const wearing = wearingNames(look, profile?.shop);
  const queueing = queue !== undefined && queue !== null;
  const hero = (
    <section class="fd-hero" aria-label="You">
      <DressedPawn look={look} hat={myHat(profile)} size="hero" shadow />
      {/* (Your icon to the left of your name and rating, as beside your name in chat.) */}
      <div class="fd-hero-id">
        <span class="fd-hero-icon">
          <UserIcon icon={profile?.user.icon ?? "♟"} />
        </span>
        <div class="fd-hero-text">
          <div class="fd-hero-name">{name}</div>
          <div class="fd-hero-sub">
            <RankLine rating={profile?.rating ?? null} />
            {wearing && ` · ${wearing}`}
          </div>
        </div>
      </div>
    </section>
  );
  // PLAY and the line under it (and an error, if any).
  const go = (
    <div class="fd-go">
      <button type="button" class="fd-play" disabled={loading || (mode === "classic" && type !== "solo")} onClick={play}>
        PLAY
      </button>
      <div class="fd-hint" aria-live="polite">
        {loading ? "Loading the engine…" : hint}
      </div>
      {error && <p class="fd-error">{error}</p>}
    </div>
  );
  // The smaller buttons. (A computer's side menu has the shop and your profile, so its home doesn't repeat them.)
  const actions = (
    <div class="fd-actions">
      <FdButton onClick={() => setFriends(true)}>Play with friends</FdButton>
      <FdButton disabled={loading} onClick={bossAlone}>
        Boss alone
      </FdButton>
      {!computer && (
        <>
          <FdButton onClick={onShop}>Shop &amp; crates</FdButton>
          <FdButton onClick={onProfile}>Profile</FdButton>
        </>
      )}
    </div>
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
  return (
    <div class="fd-home">
      {/* (A phone's top bar. A computer has the logo in its side menu, your coins and pawn top right.) */}
      <header class="fd-top">
        <Logo />
        <div class="fd-top-end">
          <AccountBar onProfile={onProfile} />
        </div>
      </header>
      <LiveLine live={live} />
      {notice && <Notice notice={notice} />}
      <div class="fd-home-main">
        {hero}
        <div class="fd-play-col">
          {/*
           * A computer (Eric, Oct 9): Play with friends and Boss alone, then the mode picker right above PLAY (it sets
           * up what PLAY does), PLAY at the bottom. A phone: the picker, PLAY, then all four buttons.
           */}
          {computer && actions}
          <div class="fd-modes" role="radiogroup" aria-label="Mode">
            {MODES.map((m) => (
              <button type="button" role="radio" key={m.id} aria-checked={mode === m.id} class={mode === m.id ? "on" : ""} onClick={() => pickMode(m.id)}>
                {m.label}
                <br />
                <span>{m.sub}</span>
              </button>
            ))}
          </div>
          <div class="fd-types-row">
            <div class="fd-modes fd-types" role="radiogroup" aria-label="Matchmaking">
              {TYPES.map((t) => {
                const off = soloOnly && t.id !== "solo";
                return (
                  <button
                    type="button"
                    role="radio"
                    key={t.id}
                    aria-checked={type === t.id}
                    aria-disabled={off || undefined}
                    class={`${type === t.id ? "on" : ""}${off ? " off" : ""}`}
                    title={off ? "Online: sign in to play" : undefined}
                    onClick={() => pickType(t.id)}
                  >
                    {t.label}
                    <br />
                    <span>{t.sub}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              class={`fd-info-btn${info ? " open" : ""}`}
              aria-label="About matchmaking"
              aria-expanded={info}
              aria-controls="fd-types-info"
              onClick={() => setInfo(!info)}
            >
              i
            </button>
          </div>
          {info && <TypesInfo raid={mode === "raid"} />}
          {type === "botsoff" && (
            <p class="fd-warn" role="note">
              <span aria-hidden="true">⚠</span> No bots can mean a much longer wait: the match starts only when {mode === "raid" ? "the raid has enough people" : "100 people have joined"}. You can switch to Default from the queue.
            </p>
          )}
          {go}
          {!computer && actions}
        </div>
      </div>
      {friends && (
        <FriendsSheet
          mode={mode}
          code={joinCode}
          loading={loading}
          onlineLocked={onlineLocked}
          onCreate={() => {
            if (mode === "raid" && !bossInUrl()) {
              setFriends(false);
              setBossMenu("raid");
            } else onCreateLobby(mode);
          }}
          onJoin={onJoinLobby}
          onSignIn={onSignIn}
          onClose={() => setFriends(false)}
        />
      )}
      {bossMenu && (
        <BossMenu forRaid={bossMenu === "raid"} value={chosenBoss()} rating={profile?.rating ?? null} onPick={pickBoss} onClose={() => setBossMenu(null)} />
      )}
    </div>
  );
}
