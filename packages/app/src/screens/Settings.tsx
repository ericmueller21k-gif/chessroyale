import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { CROWD_SETTINGS as C, DEFAULT_SETTINGS as S, MAX_OPENING_MOVES, RAID_SETTINGS as R, BOSS_TIERS, VARIABLE_CLOCK, clockStepRanges, speedOption } from "@chessroyale/core";
import { InstallCard } from "../components/InstallCard.tsx";
import { SignIn } from "../components/SignIn.tsx";
import { BackButton } from "../components/FrontDoor.tsx";
import { signOut } from "../account.ts";
import { chatBubbles, chatOff, crowdAnimations, crowdTrail, setChatBubbles, setChatOff, setCrowdAnimations, setCrowdTrail } from "../prefs.ts";
import { isMuted, onMuteChange, setMuted, unlockAudio } from "../sound.ts";
import { OPENING_KEY, chosenMode, chosenOpeningMoves, saveMode } from "./Home.tsx";
import { useAccount } from "./Profile.tsx";

/** A setting you switch on or off: a title, what it does, and the switch. */
function Toggle({ title, checked, disabled, onChange, children }: { title: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void; children?: ComponentChildren }) {
  return (
    <label class={`fd-toggle${disabled ? " disabled" : ""}`}>
      <span class="fd-toggle-text">
        <strong>{title}</strong>
        {children && <span>{children}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
    </label>
  );
}

function stored(key: string, fallback: boolean, on = "1"): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === on;
  } catch {
    return fallback;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not important.
  }
}

/** The Variable speed's clock, move by move: one row per step of VARIABLE_CLOCK. */
export function ClockBreakdown() {
  return (
    <table class="fd-clock-steps" aria-label="The Variable speed's clock">
      <thead>
        <tr>
          <th scope="col">Moves</th>
          <th scope="col">Time a move</th>
        </tr>
      </thead>
      <tbody>
        {clockStepRanges(VARIABLE_CLOCK).map((r) => (
          <tr key={r.from}>
            <td>{r.to === null ? `${r.from} on` : r.to === r.from ? `${r.from}` : `${r.from}–${r.to}`}</td>
            <td>{r.seconds} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** How each mode works, in plain words (moved here from the old home screen). */
export function HowToPlay() {
  const LOW = BOSS_TIERS[0]!;
  const HIGH = BOSS_TIERS[BOSS_TIERS.length - 1]!;
  const normal = speedOption("normal")!.patch.moveClockSeconds;
  const bullet = speedOption("bullet")!.patch.moveClockSeconds;
  return (
    <div class="fd-rules">
      <h3>Crowd · 50 v 50</h3>
      <ol>
        <li>
          <strong>{C.lobbySize} players, one game, from the first move.</strong> Two teams of 50: you play White or Black all game. Your team
          picks a move together, the other team answers.
        </li>
        <li>
          <strong>The most popular move is played.</strong> Stockfish scores every pick, and you score by picking better than the others who
          picked with you.
        </li>
        <li>
          <strong>No cuts for the first {(C.firstStageRounds ?? 20) / 2} moves.</strong> Then after every move the lowest scorers go out (the
          same number from each team).
        </li>
        <li>
          <strong>⚡ {C.powerUpsAtStart} power-ups</strong> show the engine's top 3 moves. That's all you get, so pick your moments.
        </li>
        <li>
          <strong>You vote on the ending.</strong> Before the first move everyone drags their own pawn into a zone (or taps a card): a team
          final (top 8 play 4v4, 3v3, then 2v2 to the end), a boss battle (top 10 against a Stockfish boss) or a duel (the best of each side,
          1v1). You have {S.voteSeconds} seconds; if you don't vote, you go with the crowd (the most popular choice). Winning the game goes on
          your record; your own move quality places you.
        </li>
        <li>
          <strong>Then the speed.</strong> Normal: {normal} s a move. Bullet: {bullet} s a move. Variable: the clock starts short and grows as
          the game goes on, so the quick opening moves are quick and the hard ones later get more time. A move is the number at the top of the
          screen (White's move and Black's reply are the same move):
          <ClockBreakdown />
          Nobody votes? Variable.
        </li>
      </ol>
      <h3>Boss raid</h3>
      <ol>
        <li>
          <strong>You and others against a boss.</strong> Up to {R.lobbySize} players pick the crowd's move together; the most popular pick is
          played. PLAY joins a raid; the boss is the weakest that's stronger than the group's average rating.
        </li>
        <li>
          <strong>A named opening, {R.openingMoves} moves in.</strong> The boss picks one from the classics and you play on from there.
        </li>
        <li>
          <strong>Ten bosses</strong> from {LOW} to {HIGH} strength. Alone, or in a raid you create, you pick yours. Every {S.bossKillEvery}{" "}
          moves it strikes down whoever played worst, down to half the group.
        </li>
        <li>
          <strong>👑 The God King</strong> fights for you {S.kingChargesMax} times: call him to play a move at full strength, or to strike the
          boss so its next move is a weaker one. More than half of you have to call.
        </li>
      </ol>
    </div>
  );
}

/** Settings: sound, how you play, Crowd's options, how to play, installing, and your sign-in. */
export function SettingsScreen({ onBack, onSoundLab }: { onBack: () => void; onSoundLab?: () => void }) {
  const { config, profile } = useAccount();
  const [, rerender] = useState(0);
  useEffect(() => onMuteChange(() => rerender((n) => n + 1)), []);
  const [practice, setPractice] = useState(() => stored("brc.practice", false));
  const [relaxed, setRelaxed] = useState(() => stored("brc.pace", true, "relaxed"));
  const [mode, setMode] = useState(chosenMode);
  const [anim, setAnim] = useState(crowdAnimations);
  const [trail, setTrail] = useState(crowdTrail);
  const [chatOn, setChatOn] = useState(() => !chatOff());
  const [bubbles, setBubbles] = useState(chatBubbles);
  const [openingMoves, setOpeningMoves] = useState(chosenOpeningMoves);
  const [busy, setBusy] = useState(false);
  const changeMode = (patch: Partial<typeof mode>) => {
    const next = { ...mode, ...patch };
    setMode(next);
    saveMode(next);
  };
  const u = profile?.user;
  return (
    <div class="fd-page fd-settings">
      <header class="fd-page-head">
        <BackButton onClick={onBack} />
        <h1>Settings</h1>
        <span class="fd-head-spacer" />
      </header>

      <section class="fd-section">
        <h2 class="fd-label">SOUND</h2>
        <Toggle
          title="Sound"
          checked={!isMuted()}
          onChange={(on) => {
            unlockAudio();
            setMuted(!on);
          }}
        >
          Piece sounds, ticks, the reveal, and the queue's pops.
        </Toggle>
        {onSoundLab && (
          <button type="button" class="fd-row-link" onClick={onSoundLab}>
            🔊 Sound lab: choose the reveal's roulette sound ›
          </button>
        )}
      </section>

      <section class="fd-section">
        <h2 class="fd-label">PLAYING</h2>
        <Toggle
          title="Practice mode"
          checked={practice}
          onChange={(on) => {
            setPractice(on);
            store("brc.practice", on ? "1" : "0");
          }}
        >
          Unlimited power-ups (the engine's top 3 moves, any time). You're marked 💡 on the leaderboard.
        </Toggle>
        <Toggle
          title="Relaxed pace"
          checked={relaxed}
          onChange={(on) => {
            setRelaxed(on);
            store("brc.pace", on ? "relaxed" : "quick");
          }}
        >
          A few seconds to settle on each new board and to watch the chosen move. Off: quick games (solo, and lobbies you create).
        </Toggle>
      </section>

      <section class="fd-section">
        <h2 class="fd-label">CROWD</h2>
        <div class="fd-seg" role="radiogroup" aria-label="Turns">
          <button type="button" role="radio" aria-checked={mode.crowdTeams} class={mode.crowdTeams ? "on" : ""} onClick={() => changeMode({ crowdTeams: true })}>
            50 v 50
            <span>You play one side</span>
          </button>
          <button type="button" role="radio" aria-checked={!mode.crowdTeams} class={!mode.crowdTeams ? "on" : ""} onClick={() => changeMode({ crowdTeams: false })}>
            Everyone moves
            <span>You pick every turn</span>
          </button>
        </div>
        <p class="fd-note">For solo games and lobbies you create. PLAY's queue is always 50 v 50.</p>
        <Toggle
          title="Animations"
          checked={anim}
          onChange={(on) => {
            setAnim(on);
            setCrowdAnimations(on);
          }}
        >
          Every pick shows on the board as a ghost piece on its square. Off: just the names over each picked square.
        </Toggle>
        <Toggle
          title="Motion trail"
          checked={anim && trail}
          disabled={!anim}
          onChange={(on) => {
            setTrail(on);
            setCrowdTrail(on);
          }}
        >
          Watch every pick fly from its piece to its square.
        </Toggle>
        <Toggle title="Pre-game votes" checked={mode.augments} onChange={(on) => changeMode({ augments: on })}>
          Before the first move, everyone votes on how the match ends and how fast it is. Off: a team final at Normal speed (20 s a move).
        </Toggle>
      </section>

      <section class="fd-section">
        <h2 class="fd-label">QUICK CHAT</h2>
        <Toggle
          title="Quick chat"
          checked={chatOn}
          onChange={(on) => {
            setChatOn(on);
            setChatOff(!on);
          }}
        >
          Preset lines and emoji in online matches (no typing): pick yours in your profile, under Quick chat and emoji. Off: no messages show, and you send none.
        </Toggle>
        <Toggle
          title="New-message bubble"
          checked={chatOn && bubbles}
          disabled={!chatOn}
          onChange={(on) => {
            setBubbles(on);
            setChatBubbles(on);
          }}
        >
          On a phone, while chat is hidden, the newest message shows for a moment under the top bar (never over the board).
        </Toggle>
      </section>

      <section class="fd-section">
        <h2 class="fd-label">CLASSIC</h2>
        <div class="fd-toggle">
          <span class="fd-toggle-text">
            <strong>Opening moves</strong>
            <span>Moves each side has already played on every board when a Classic match starts.</span>
          </span>
          <div class="fd-stepper" role="group" aria-label="Opening moves per side">
            <button
              type="button"
              aria-label="Fewer opening moves"
              disabled={openingMoves <= 0}
              onClick={() => {
                const v = Math.max(0, openingMoves - 1);
                setOpeningMoves(v);
                store(OPENING_KEY, String(v));
              }}
            >
              −
            </button>
            <output aria-live="polite">{openingMoves}</output>
            <button
              type="button"
              aria-label="More opening moves"
              disabled={openingMoves >= MAX_OPENING_MOVES}
              onClick={() => {
                const v = Math.min(MAX_OPENING_MOVES, openingMoves + 1);
                setOpeningMoves(v);
                store(OPENING_KEY, String(v));
              }}
            >
              +
            </button>
          </div>
        </div>
      </section>

      <section class="fd-section">
        <h2 class="fd-label">HOW TO PLAY</h2>
        <HowToPlay />
      </section>

      <InstallCard />

      {config?.accounts && u && (
        <section class="fd-section">
          <h2 class="fd-label">ACCOUNT</h2>
          {u.signedIn ? (
            <div class="fd-toggle">
              <span class="fd-toggle-text">
                <strong>Signed in</strong>
                <span>{u.google ? `Google${u.email ? ` · ${u.email}` : ""}` : u.email}</span>
              </span>
              <button
                type="button"
                class="fd-btn small"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void signOut().finally(() => setBusy(false));
                }}
              >
                Sign out
              </button>
            </div>
          ) : config.google || config.email ? (
            <div class="fd-panel">
              <p class="fd-sub">You're a guest. Sign in to keep your profile on any device and to play online.</p>
              <SignIn google={config.google} email={config.email} next="/settings" />
            </div>
          ) : (
            <p class="fd-note">You're a guest on this device.</p>
          )}
        </section>
      )}

      <p class="fd-note">
        Engine: <a href="https://stockfishchess.org">Stockfish</a> (GPL-3.0, <a href="https://github.com/official-stockfish/Stockfish">source</a>),
        running in your browser.
      </p>
    </div>
  );
}
