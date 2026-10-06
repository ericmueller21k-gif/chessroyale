import { useEffect, useRef, useState } from "preact/hooks";
import { BOSS_TIERS, bossInfo, DEFAULT_SETTINGS as S, MAX_OPENING_MOVES, PRIOR_RATING, raidBossElo, type ModeChoiceId } from "@chessroyale/core";
import { useAccount } from "./Profile.tsx";
import { Coins, DressedPawn, FdButton, LiveLine, Logo, MyPawnButton, RankLine, myHat, wearingNames } from "../components/FrontDoor.tsx";
import { useLive } from "../live.ts";

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

const BOSS_KEY = "brc.boss";
/** The boss just picked from the menu (kept here too, for when there's no storage). */
let pickedBoss: number | null = null;
/** Remembers the boss picked from the menu (for this solo raid or lobby, and next time). */
export function chooseBoss(elo: number) {
  pickedBoss = elo;
  try {
    localStorage.setItem(BOSS_KEY, String(elo));
  } catch {
    // Not important.
  }
}

/** ?boss=N picks the boss, so the boss menu is skipped (handy for tests). */
export function bossInUrl(): boolean {
  return new URLSearchParams(location.search).has("boss");
}

/** Boss raid: the boss you picked (its strength), or 0 for one a step above you. ?boss=N, else this device's choice. */
export function chosenBoss(): number {
  const q = new URLSearchParams(location.search).get("boss");
  let v = q ?? (pickedBoss === null ? null : String(pickedBoss));
  if (v === null) {
    try {
      v = localStorage.getItem(BOSS_KEY);
    } catch {
      v = null;
    }
  }
  const n = Number(v);
  return BOSS_TIERS.includes(n) ? n : 0;
}

const LOW = BOSS_TIERS[0]!;
const HIGH = BOSS_TIERS[BOSS_TIERS.length - 1]!;
/** Where a strength sits on the menu's bars (the weakest boss still gets a sliver). */
const barPos = (elo: number) => 6 + (94 * (Math.max(LOW, Math.min(HIGH, elo)) - LOW)) / (HIGH - LOW);

/** A boss's strength against yours, in words and a colour. */
function versus(elo: number, you: number): { text: string; tone: "easy" | "even" | "hard" | "brutal" } {
  const d = Math.round((elo - you) / 10) * 10;
  if (Math.abs(d) < 100) return { text: "≈ your level", tone: "even" };
  if (d < 0) return { text: `−${-d} vs you`, tone: "easy" };
  return { text: `+${d} vs you`, tone: d >= 400 ? "brutal" : "hard" };
}

/**
 * Boss raid: the menu that opens when you start, one row per boss, weakest first, with its strength
 * against yours alongside. A tap picks it and starts. Creating a raid also offers "Match the group".
 */
export function BossMenu({
  forRaid,
  value,
  rating,
  onPick,
  onClose,
}: {
  forRaid: boolean;
  value: number;
  rating: number | null;
  onPick: (elo: number) => void;
  onClose: () => void;
}) {
  const you = rating ?? PRIOR_RATING;
  const match = raidBossElo([rating]);
  // Solo always fights a named boss: an old "Match me" choice shows as your match.
  const current = !forRaid && value === 0 ? match : value;
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
        <div class="boss-menu-list" style={{ "--you": `${barPos(you)}%` }}>
          {forRaid && (
            <button type="button" class={`boss-row match${current === 0 ? " on" : ""}`} ref={current === 0 ? picked : undefined} onClick={() => onPick(0)}>
              <span class="br-icon" aria-hidden="true">
                🎯
              </span>
              <span class="br-main">
                <strong>Match the group</strong>
                <span class="br-sub">the weakest boss stronger than your group's average</span>
              </span>
            </button>
          )}
          {BOSS_TIERS.map((elo) => {
            const b = bossInfo(elo);
            const vs = versus(elo, you);
            return (
              <button
                type="button"
                key={elo}
                class={`boss-row${current === elo ? " on" : ""}`}
                ref={current === elo ? picked : undefined}
                aria-label={`${b.name}, ${elo}, ${vs.text}`}
                onClick={() => onPick(elo)}
              >
                <span class="br-icon" aria-hidden="true">
                  {b.icon}
                </span>
                <span class="br-main">
                  <strong>
                    {b.name.replace(/^The /, "")}
                    {!forRaid && elo === match && <em class="br-tag">your match</em>}
                  </strong>
                  <span class="br-sub">
                    <span class="br-skulls">{"💀".repeat(b.threat)}</span>
                    <span class="br-bar" aria-hidden="true">
                      <i style={{ width: `${100 - barPos(elo)}%` }} />
                    </span>
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
  onSolo,
  onSignIn,
  onClose,
}: {
  mode: ModeChoiceId;
  code?: string;
  loading: boolean;
  onlineLocked?: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onSolo: () => void;
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
        {mode !== "raid" && (
          <>
            <div class="fd-or">
              <span>or practise alone</span>
            </div>
            <FdButton disabled={loading} onClick={onSolo}>
              {loading ? "Loading the engine…" : `Solo vs ${mode === "classic" ? S.lobbySize - 1 : 99} bots`}
            </FdButton>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Home (the approved mockup, docs/mockups/front-door/Main.dc.html): the top bar (logo, coins, your pawn), the live
 * line, your dressed pawn, the mode picker, PLAY and the line under it, and four smaller buttons.
 */
export function HomeScreen({
  intent,
  loading,
  error,
  joinCode,
  onlineLocked,
  onPlay,
  onSolo,
  onCreateLobby,
  onJoinLobby,
  onProfile,
  onShop,
  onSignIn,
}: {
  /** The computer's side menu asked for the boss menu or Play with friends. */
  intent?: { kind: "boss" | "friends"; n: number } | null;
  loading: boolean;
  error?: string | null;
  /** An invite link's code: the join form opens with it. */
  joinCode?: string;
  /** Online play needs signing in, and you're a guest: PLAY plays bots. */
  onlineLocked?: boolean;
  /** PLAY: the queue for a mode. */
  onPlay: (mode: "crowd" | "raid") => void;
  /** Solo against bots, or (raid) a boss on your own once one is picked. */
  onSolo: (mode: ModeChoiceId) => void;
  onCreateLobby: (mode: ModeChoiceId) => void;
  onJoinLobby: (code: string) => void;
  onProfile: () => void;
  onShop: () => void;
  onSignIn: () => void;
}) {
  const { profile } = useAccount();
  const live = useLive();
  const [mode, setModeState] = useState<ModeChoiceId>(() => chosenMode().mode);
  const pickMode = (m: ModeChoiceId) => {
    setModeState(m);
    saveMode({ ...chosenMode(), mode: m });
  };
  const [friends, setFriends] = useState(!!joinCode);
  // Boss raid: pick the boss first, for a raid alone or one you create (skipped with ?boss=N).
  const [bossMenu, setBossMenu] = useState<null | "solo" | "raid">(null);
  const bossAlone = () => (bossInUrl() ? onSolo("raid") : setBossMenu("solo"));
  const pickBoss = (elo: number) => {
    chooseBoss(elo);
    const forRaid = bossMenu === "raid";
    setBossMenu(null);
    if (forRaid) onCreateLobby("raid");
    else onSolo("raid");
  };
  useEffect(() => {
    if (intent?.kind === "boss") bossAlone();
    if (intent?.kind === "friends") setFriends(true);
  }, [intent?.n]);
  const play = () => {
    if (mode === "classic") return;
    if (!onlineLocked) return onPlay(mode);
    // Guests play bots: the whole game, offline from the queue.
    if (mode === "raid") bossAlone();
    else onSolo("crowd");
  };
  const fill = live?.fillSeconds ?? 60;
  const wait = mode === "raid" ? live?.waits.boss : live?.waits.crowd;
  const hint =
    mode === "classic" ? (
      "Classic is being reworked"
    ) : onlineLocked ? (
      <>
        {mode === "raid" ? "You against a boss" : "Solo vs 99 bots"} ·{" "}
        <button type="button" class="fd-link" onClick={onSignIn}>
          Sign in to play online
        </button>
      </>
    ) : mode === "raid" ? (
      "Join a raid; the boss matches the group"
    ) : wait ? (
      `Usually about ${wait} s to find a match`
    ) : (
      `Starts within ${fill} s; bots fill any empty seats`
    );
  const look = profile?.locker?.look;
  const name = profile?.user.name ?? "Player";
  const wearing = wearingNames(look, profile?.shop);
  return (
    <div class="fd-home">
      <header class="fd-top">
        <Logo />
        <div class="fd-top-right">
          <Coins coins={profile?.shop?.coins ?? null} />
          <MyPawnButton onClick={onProfile} />
        </div>
      </header>
      <LiveLine live={live} />
      <div class="fd-home-main">
        <section class="fd-hero" aria-label="You">
          <DressedPawn look={look} hat={myHat(profile)} size="hero" shadow />
          <div class="fd-hero-text">
            <div class="fd-hero-name">{name}</div>
            <div class="fd-hero-sub">
              <RankLine rating={profile?.rating ?? null} />
              {wearing && ` · ${wearing}`}
            </div>
          </div>
        </section>
        <div class="fd-play-col">
          <div class="fd-modes" role="radiogroup" aria-label="Mode">
            {MODES.map((m) => (
              <button type="button" role="radio" key={m.id} aria-checked={mode === m.id} class={mode === m.id ? "on" : ""} onClick={() => pickMode(m.id)}>
                {m.label}
                <br />
                <span>{m.sub}</span>
              </button>
            ))}
          </div>
          <button type="button" class="fd-play" disabled={loading || mode === "classic"} onClick={play}>
            PLAY
          </button>
          <div class="fd-hint" aria-live="polite">
            {loading ? "Loading the engine…" : hint}
          </div>
          {error && <p class="fd-error">{error}</p>}
          <div class="fd-actions">
            <FdButton onClick={() => setFriends(true)}>Play with friends</FdButton>
            <FdButton disabled={loading} onClick={bossAlone}>
              Boss alone
            </FdButton>
            <FdButton onClick={onShop}>Shop &amp; crates</FdButton>
            <FdButton onClick={onProfile}>Profile</FdButton>
          </div>
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
          onSolo={() => onSolo(mode === "raid" ? "crowd" : mode)}
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
