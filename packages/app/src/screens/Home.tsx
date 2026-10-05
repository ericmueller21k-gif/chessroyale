import { useEffect, useRef, useState } from "preact/hooks";
import { BOSS_TIERS, bossInfo, CROWD_SETTINGS as C, DEFAULT_SETTINGS as S, MAX_OPENING_MOVES, PRIOR_RATING, RAID_SETTINGS as R, raidBossElo, type ModeChoiceId } from "@chessroyale/core";
import { InstallCard } from "../components/InstallCard.tsx";
import { account, updateProfile } from "../account.ts";
import { useAccount } from "./Profile.tsx";
import { crowdAnimations, crowdTrail, setCrowdAnimations, setCrowdTrail } from "../prefs.ts";
import { MuteButton } from "../components/MuteButton.tsx";
import { UserIcon } from "../components/PixelIcon.tsx";

const OPENING_KEY = "brc.openingMoves";
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

function saveMode(c: ModeChoice) {
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

/** ?boss=N picks the boss, so the boss menu is skipped (handy for tests). */
function bossInUrl(): boolean {
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

function remember(name: string): string {
  const n = name.trim() || "Player";
  try {
    localStorage.setItem("brc.name", n);
  } catch {
    // Not important.
  }
  // Your profile takes the name you play under.
  const p = account().profile;
  if (p && p.user.name !== n) void updateProfile({ name: n }).catch(() => undefined);
  return n;
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
function BossMenu({
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

export function HomeScreen({
  onStart,
  onCreateLobby,
  onJoinLobby,
  loading,
  joinCode,
  error,
  onSoundLab,
  onProfile,
  onShop,
  onlineLocked,
  onSignIn,
  onPlayNow,
}: {
  onStart: (name: string, practice: boolean) => void;
  onCreateLobby: (name: string, practice: boolean) => void;
  onJoinLobby: (name: string, code: string, practice: boolean) => void;
  loading: boolean;
  joinCode?: string;
  error?: string | null;
  onSoundLab?: () => void;
  onProfile?: () => void;
  onShop?: () => void;
  /** Online play needs signing in, and you're a guest. */
  onlineLocked?: boolean;
  onSignIn?: () => void;
  /** "Play now": matchmaking into a 50 v 50 lobby. */
  onPlayNow?: (name: string) => void;
}) {
  const { profile } = useAccount();
  const [code, setCode] = useState(joinCode ?? "");
  const [practice, setPractice] = useState(() => {
    try {
      return localStorage.getItem("brc.practice") === "1";
    } catch {
      return false;
    }
  });
  const [relaxed, setRelaxed] = useState(() => {
    try {
      return localStorage.getItem("brc.pace") !== "quick";
    } catch {
      return true;
    }
  });
  const toggleRelaxed = (on: boolean) => {
    setRelaxed(on);
    try {
      localStorage.setItem("brc.pace", on ? "relaxed" : "quick");
    } catch {
      // Not important.
    }
  };
  const [modeChoice, setModeChoice] = useState(chosenMode);
  const changeMode = (patch: Partial<ModeChoice>) => {
    const next = { ...modeChoice, ...patch };
    setModeChoice(next);
    saveMode(next);
  };
  const crowd = modeChoice.mode === "crowd";
  const raid = modeChoice.mode === "raid";
  const [boss, setBoss] = useState(chosenBoss);
  const changeBoss = (elo: number) => {
    setBoss(elo);
    pickedBoss = elo;
    try {
      localStorage.setItem(BOSS_KEY, String(elo));
    } catch {
      // Not important.
    }
  };
  // Boss raid: the boss menu comes first, for a solo raid or one you create (skipped with ?boss=N).
  const [bossMenu, setBossMenu] = useState<null | "solo" | "raid">(null);
  const startSolo = () => (raid && !bossInUrl() ? setBossMenu("solo") : onStart(remember(name), practice));
  const createLobby = () => (raid && !bossInUrl() ? setBossMenu("raid") : onCreateLobby(remember(name), practice));
  const pickBoss = (elo: number) => {
    changeBoss(elo);
    const forRaid = bossMenu === "raid";
    setBossMenu(null);
    if (forRaid) onCreateLobby(remember(name), practice);
    else onStart(remember(name), practice);
  };
  const [anim, setAnim] = useState(crowdAnimations);
  const [trail, setTrail] = useState(crowdTrail);
  const [openingMoves, setOpeningMoves] = useState(chosenOpeningMoves);
  const changeOpeningMoves = (n: number) => {
    const v = Math.max(0, Math.min(MAX_OPENING_MOVES, n));
    setOpeningMoves(v);
    try {
      localStorage.setItem(OPENING_KEY, String(v));
    } catch {
      // Not important.
    }
  };
  const togglePractice = (on: boolean) => {
    setPractice(on);
    try {
      localStorage.setItem("brc.practice", on ? "1" : "0");
    } catch {
      // Not important.
    }
  };
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("brc.name") ?? "";
    } catch {
      return "";
    }
  });
  // A signed-in profile's name fills in the name box (e.g. on a new device).
  useEffect(() => {
    if (profile?.user.signedIn && !name) setName(profile.user.name);
  }, [profile?.user.name]);
  return (
    <div class="screen home">
      <h1 class="logo">
        <span class="logo-crown" aria-hidden="true">
          ♚
        </span>
        HunChess
        {profile && onShop && (
          <button type="button" class="home-shop-btn" onClick={onShop}>
            🛍️ Shop
          </button>
        )}
        <MuteButton />
      </h1>
      {profile && onProfile && (
        <button type="button" class="account-chip" onClick={onProfile} aria-label="Your profile">
          <span class="account-icon" aria-hidden="true">
            <UserIcon icon={profile.user.icon} />
          </span>
          <span class="account-name">{profile.user.name}</span>
          <span class="muted small">
            {profile.stats.all.matches ? `${profile.stats.all.matches} played · ${profile.stats.all.wins} won` : "No matches yet"}
          </span>
          <span class="account-cta">{profile.user.signedIn ? "Profile ›" : "Sign in ›"}</span>
        </button>
      )}
      {!joinCode && <InstallCard />}
      {!joinCode && (
        <div class="mode-pick three" role="radiogroup" aria-label="Game mode">
          <button type="button" role="radio" aria-checked={crowd} class={crowd ? "on" : ""} onClick={() => changeMode({ mode: "crowd" })}>
            <strong>Crowd</strong>
            <span>{C.lobbySize} players · 1 board</span>
          </button>
          <button type="button" role="radio" aria-checked={raid} class={raid ? "on" : ""} onClick={() => changeMode({ mode: "raid" })}>
            <strong>Boss raid</strong>
            <span>Up to {R.lobbySize} vs a boss</span>
          </button>
          <button type="button" role="radio" aria-checked={modeChoice.mode === "classic"} class={modeChoice.mode === "classic" ? "on" : ""} onClick={() => changeMode({ mode: "classic" })}>
            <strong>Classic</strong>
            <span>{S.lobbySize} players · 8 boards</span>
          </button>
        </div>
      )}
      {raid && !joinCode ? (
        <ol class="rules">
          <li>
            <strong>You and your friends against a boss.</strong> Up to {R.lobbySize} players pick the crowd's move together; the
            most popular pick is played. Create a raid and share the code, or take the boss on alone.
          </li>
          <li>
            <strong>A named opening, {R.openingMoves} moves in.</strong> The boss picks one from the classics and you play on from
            there.
          </li>
          <li>
            <strong>Pick your boss</strong> when you start: ten bosses from {LOW} to {HIGH} strength, each shown against your
            rating. A raid can also match the group: the weakest boss that's stronger than its average rating. Every{" "}
            {S.bossKillEvery} moves it strikes down whoever played worst, down to half the group.
          </li>
          <li>
            <strong>👑 The King</strong> fights for you {S.kingChargesMax} times: call him to play a move at full strength (instead of
            picking one), or to strike the boss there and then so its next move is a weaker one (the clock stops while he does, then
            you all pick as usual). More than half of you have to call.
          </li>
        </ol>
      ) : null}
      {raid && !joinCode ? null : crowd && !joinCode ? (
        <ol class="rules">
          <li>
            <strong>{C.lobbySize} players, one game, from the first move.</strong>{" "}
            {modeChoice.crowdTeams
              ? "Two teams of 50: you play White or Black all game. Your team picks a move together, the other team answers."
              : "Everyone picks a move for whichever side is to move, every turn."}
          </li>
          <li>
            <strong>The most popular move is played.</strong> Stockfish scores every pick, and you score by picking better than
            the others who picked with you.
          </li>
          <li>
            <strong>No cuts for the first {(C.firstStageRounds ?? 20) / 2} moves.</strong> Then after every move the lowest scorers
            go out ({modeChoice.crowdTeams ? "the same number from each team" : "by overall score"}).
          </li>
          <li>
            <strong>⚡ {C.powerUpsAtStart} power-ups</strong> show the engine's top 3 moves. That's all you get, so pick your moments.
          </li>
          {modeChoice.crowdTeams ? (
            <li>
              <strong>{modeChoice.augments ? "You vote on the ending." : "The team final."}</strong>{" "}
              {modeChoice.augments
                ? "Before the first move everyone pushes a pawn into a zone: a team final (top 8 play 4v4, 3v3, then 2v2 to the end), a boss battle (top 10 against a Stockfish boss) or a duel (the best of each side, 1v1). Then the speed: slow, standard or bullet."
                : "The top 8 play on, 4v4 with teammates taking turns, then 3v3, then 2v2 to the end of the game."}{" "}
              Winning the game goes on your record; your own move quality places you.
            </li>
          ) : (
            <li>
              <strong>The 2v2 final.</strong> The last 4 play on, teammates taking turns; the best average move quality wins.
            </li>
          )}
        </ol>
      ) : (
      <ol class="rules">
        <li>
          <strong>{S.lobbySize} players, 8 boards, one move at a time.</strong> Every round you're dropped onto one of the boards
          with {S.groupSize - 1} others. Make one move. You keep the same colour for a whole stage.
        </li>
        <li>
          <strong>Beat your group, not the board.</strong> Stockfish scores every move. You score by playing better than the others
          who got the same position.
        </li>
        <li>
          <strong>Watch your time bank.</strong> {S.timeBankSeconds / 60} minutes for the match, +{S.timeIncrementSeconds} s every
          move, {S.moveClockSeconds} s at most per move. Time never costs points: spend it on the hard positions.
        </li>
        <li>
          <strong>⚡ Power-ups</strong> show the engine's top 3 moves, free to use. You get {S.powerUpsAtStart}, plus{" "}
          {S.powerUpsPerStage} each stage you survive, and unused ones carry over (up to {S.powerUpsMax}). Pick your moment.
        </li>
        <li>
          <strong>The weakest go out.</strong> After the first {S.firstStageRounds} rounds, then every {S.roundsPerStage}, the bottom {S.knockoutsPerStage[0]} are knocked
          out and the most lopsided board is closed, until 4 are left on the last board.
        </li>
        <li>
          <strong>The 2v2 final.</strong> The last 4 play on the last board: seeds 1 & 4 against 2 & 3, teammates taking turns.
          The best average move quality wins the match.
        </li>
        <li>
          <strong>Engine rating.</strong> Every move also feeds a rating estimate on Stockfish's Elo scale, so you can see the
          scariest player in the lobby.
        </li>
      </ol>
      )}
      <label class="field">
        <span>Your name</span>
        <input value={name} maxLength={16} onInput={(e) => setName(e.currentTarget.value)} placeholder="You" />
      </label>
      <label class="check">
        <input type="checkbox" checked={practice} onChange={(e) => togglePractice(e.currentTarget.checked)} />
        <span>
          <strong>Practice mode:</strong> unlimited power-ups (the engine's top 3 moves, any time). You're marked 💡 on the
          leaderboard.
        </span>
      </label>
      <label class="check">
        <input type="checkbox" checked={relaxed} onChange={(e) => toggleRelaxed(e.currentTarget.checked)} />
        <span>
          <strong>Relaxed pace:</strong> a few seconds to settle on each new board and to watch the chosen move. Untick for
          quick games (also applies to lobbies you create).
        </span>
      </label>
      {crowd && !joinCode && (
        <>
          <div class="mode-pick small-pick" role="radiogroup" aria-label="Turns">
            <button type="button" role="radio" aria-checked={modeChoice.crowdTeams} class={modeChoice.crowdTeams ? "on" : ""} onClick={() => changeMode({ crowdTeams: true })}>
              <strong>50 v 50</strong>
              <span>You play one side</span>
            </button>
            <button type="button" role="radio" aria-checked={!modeChoice.crowdTeams} class={!modeChoice.crowdTeams ? "on" : ""} onClick={() => changeMode({ crowdTeams: false })}>
              <strong>Everyone moves</strong>
              <span>You pick every turn</span>
            </button>
          </div>
          <label class="check">
            <input
              type="checkbox"
              checked={anim}
              onChange={(e) => {
                setAnim(e.currentTarget.checked);
                setCrowdAnimations(e.currentTarget.checked);
              }}
            />
            <span>
              <strong>Animations:</strong> every pick shows on the board as a ghost piece on its square. Off: just the names over
              each picked square, and only the chosen piece moves.
            </span>
          </label>
          <label class={`check${anim ? "" : " disabled"}`}>
            <input
              type="checkbox"
              checked={anim && trail}
              disabled={!anim}
              onChange={(e) => {
                setTrail(e.currentTarget.checked);
                setCrowdTrail(e.currentTarget.checked);
              }}
            />
            <span>
              <strong>Motion trail:</strong> watch every pick fly from its piece to its square, as if everyone's moving their
              pieces. They all land on the same fixed spot.
            </span>
          </label>
          <label class="check">
            <input type="checkbox" checked={modeChoice.augments} onChange={(e) => changeMode({ augments: e.currentTarget.checked })} />
            <span>
              <strong>Pre-game votes:</strong> before the first move, everyone votes on how the match ends and how fast it is, by
              pushing a pawn into a zone. Off: a team final at the standard speed.
            </span>
          </label>
        </>
      )}
      {joinCode || crowd || raid ? null : (
        <div class="stepper-field">
          <span>
            <strong>Opening moves:</strong> how many moves each side has already played on every board when the match
            starts. Fewer is simpler; more gives sharper positions (also applies to lobbies you create).
          </span>
          <div class="stepper" role="group" aria-label="Opening moves per side">
            <button type="button" aria-label="Fewer opening moves" disabled={openingMoves <= 0} onClick={() => changeOpeningMoves(openingMoves - 1)}>
              −
            </button>
            <output aria-live="polite">{openingMoves}</output>
            <button type="button" aria-label="More opening moves" disabled={openingMoves >= MAX_OPENING_MOVES} onClick={() => changeOpeningMoves(openingMoves + 1)}>
              +
            </button>
          </div>
        </div>
      )}
      {joinCode || onlineLocked || !onPlayNow || raid ? null : (
        <button type="button" class="btn btn-primary btn-wide play-now" disabled={loading} onClick={() => onPlayNow(remember(name))}>
          <strong>Play now</strong>
          <span>50 v 50 online · unranked</span>
        </button>
      )}
      {joinCode ? null : (
        <button type="button" class={`btn ${onlineLocked || !onPlayNow ? "btn-primary" : "btn-secondary"} btn-wide`} disabled={loading} onClick={startSolo}>
          {loading ? "Loading the engine…" : raid ? "Take on the boss alone" : `Play solo vs ${(crowd ? C.lobbySize! : S.lobbySize) - 1} bots`}
        </button>
      )}
      {onlineLocked ? (
        <div class="signin online-locked">
          <h2>Play online</h2>
          <p class="muted small">Online matches are real people only, so they need an account. It takes a few seconds with Google or your email.</p>
          <button type="button" class="btn btn-primary" onClick={onSignIn}>
            Sign in to play online
          </button>
        </div>
      ) : (
      <div class="lobby-actions">
        {!joinCode && (
          <button type="button" class="btn btn-secondary" disabled={loading} onClick={createLobby}>
            {raid ? "Create a raid" : "Create a lobby"}
          </button>
        )}
        <div class="join-row">
          <input
            class="code-input"
            value={code}
            maxLength={5}
            placeholder="CODE"
            aria-label="Lobby code"
            onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
          />
          <button type="button" class={`btn ${joinCode ? "btn-primary" : "btn-secondary"}`} disabled={loading || code.trim().length !== 5} onClick={() => onJoinLobby(remember(name), code.trim(), practice)}>
            Join lobby
          </button>
        </div>
      </div>
      )}
      {error && <p class="out-msg">{error}</p>}
      {bossMenu && (
        <BossMenu forRaid={bossMenu === "raid"} value={boss} rating={profile?.rating ?? null} onPick={pickBoss} onClose={() => setBossMenu(null)} />
      )}
      {onSoundLab && (
        <button type="button" class="link-btn" onClick={onSoundLab}>
          🔊 Sound lab: choose the reveal's roulette sound
        </button>
      )}
      <p class="muted small">
        Engine: <a href="https://stockfishchess.org">Stockfish</a> (GPL-3.0,{" "}
        <a href="https://github.com/official-stockfish/Stockfish">source</a>), running in your browser.
      </p>
    </div>
  );
}
