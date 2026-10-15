import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { CROWD_SETTINGS as C, DEFAULT_SETTINGS as S, MAX_OPENING_MOVES, RAID_SETTINGS as R, BOSS_TIERS, PREGAME_VOTES, crowdFinalBoss, crowdFinalists } from "@chessroyale/core";
import { InstallCard } from "../components/InstallCard.tsx";
import { SignIn } from "../components/SignIn.tsx";
import { BackButton } from "../components/FrontDoor.tsx";
import { signOut } from "../account.ts";
import { chatBubbles, chatOff, crowdAnimations, crowdTrail, evalBarOn, setChatBubbles, setChatOff, setCrowdAnimations, setCrowdTrail, setEvalBarOn } from "../prefs.ts";
import { isMuted, onMuteChange, previewPieceSound, setMuted, unlockAudio } from "../sound.ts";
import { PIECE_SOUNDS, pieceSound, setPieceSound, type PieceSoundKind } from "../piece-sounds.ts";
import { OPENING_KEY, chosenMode, chosenOpeningMoves, saveMode } from "./Home.tsx";
import { useAccount } from "./Profile.tsx";
import { setThemePref, useTheme, type ThemePref } from "../theme.ts";

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

function stored(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
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

/** How each mode works, in plain words (moved here from the old home screen). */
export function HowToPlay() {
  const LOW = BOSS_TIERS[0]!;
  const HIGH = BOSS_TIERS[BOSS_TIERS.length - 1]!;
  // The clock vote's time controls, from the vote's own data.
  const speed = PREGAME_VOTES.find((v) => v.id === "speed")!;
  // The endings: how many play each (the knockouts), the boss final's boss by its roster name (the Hidden Boss).
  const teamSizes = S.teamFinalSizes.map((x) => `${x}v${x}`);
  const finalBoss = crowdFinalBoss()?.name ?? "a boss";
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
          final (top {crowdFinalists("team")} play {teamSizes.slice(0, -1).join(", ")}, then {teamSizes.at(-1)} to the end), a boss battle (top{" "}
          {crowdFinalists("boss")} against {finalBoss}) or a duel (the best of each side, 1v1). You have {S.voteSeconds} seconds; if you don't vote, you go with the crowd (the most popular choice). Winning the game goes on
          your record; your own move quality places you.
        </li>
        <li>
          <strong>Then the clock: a chess time control.</strong> {speed.options.map((o) => `${o.label} (${o.blurb})`).join(", ")}. Your
          minutes last the whole game and every move adds its seconds as it starts; what a quick move doesn't use stays in your bank, as on a
          chess clock. No move can go past its cap, because your whole team picks together. Nobody votes?{" "}
          {speed.options[speed.defaultOption]!.label}.
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

/**
 * A piece-sound picker (Move sound, Capture sound): each option is a radio (picking it plays it) with its own ▶ to hear
 * it without picking. Kept on the device; the first option is the default (the classic knock).
 */
function PieceSoundPicker({ kind, title, children }: { kind: PieceSoundKind; title: string; children: ComponentChildren }) {
  const [chosen, setChosen] = useState(() => pieceSound(kind).id);
  return (
    <div class="ps-picker">
      <span class="fd-toggle-text">
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
      <div class="ps-list" role="radiogroup" aria-label={title}>
        {PIECE_SOUNDS[kind].map((o) => (
          <div key={o.id} class={`ps-row${chosen === o.id ? " on" : ""}`}>
            <button
              type="button"
              role="radio"
              aria-checked={chosen === o.id}
              class="ps-choice"
              onClick={() => {
                setChosen(setPieceSound(kind, o.id).id);
                previewPieceSound(kind, o.id);
              }}
            >
              <strong>{o.label}</strong>
              <span>{o.note}</span>
            </button>
            <button type="button" class="ps-play" aria-label={`Play ${o.label}`} onClick={() => previewPieceSound(kind, o.id)}>
              {"\u25B6\uFE0E"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Light or dark: Match device (until someone picks), Light or Dark. The same pick as the sun button. */
const THEMES: { id: ThemePref; label: string }[] = [
  { id: "system", label: "Match device" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];
function ThemeChoice() {
  const { pref } = useTheme();
  return (
    <div class="fd-seg" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button type="button" role="radio" key={t.id} aria-checked={pref === t.id} class={pref === t.id ? "on" : ""} onClick={() => setThemePref(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Settings: the theme, sound, how you play, Crowd's options, how to play (and the FAQ), installing, your sign-in, privacy and terms. */
export function SettingsScreen({ onBack, onSoundLab, onFaq }: { onBack: () => void; onSoundLab?: () => void; onFaq?: () => void }) {
  const { config, profile } = useAccount();
  const [, rerender] = useState(0);
  useEffect(() => onMuteChange(() => rerender((n) => n + 1)), []);
  const [practice, setPractice] = useState(() => stored("brc.practice", false));
  const [evalBar, setEvalBar] = useState(evalBarOn);
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
        <h2 class="fd-label">THEME</h2>
        <ThemeChoice />
      </section>

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
        <PieceSoundPicker kind="move" title="Move sound">
          What a piece makes as it lands, in every mode. Tap {"\u25B6\uFE0E"} to hear one.
        </PieceSoundPicker>
        <PieceSoundPicker kind="capture" title="Capture sound">
          When a piece takes another. Pick any with any move sound.
        </PieceSoundPicker>
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
          title="Eval bar"
          checked={evalBar}
          onChange={(on) => {
            setEvalBar(on);
            setEvalBarOn(on);
          }}
        >
          The engine's winning chances in a bar beside the board, in every mode. Off: no bar, and the board takes its room.
        </Toggle>
      </section>

      <section class="fd-section">
        <h2 class="fd-label">CROWD</h2>
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
        {onFaq && (
          <button type="button" class="fd-row-link" onClick={onFaq}>
            📖 FAQ · How it works ›
          </button>
        )}
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

      <section class="fd-section">
        <h2 class="fd-label">PRIVACY AND TERMS</h2>
        <a class="fd-row-link" href="/privacy">
          Privacy policy: what we keep about you, and why ›
        </a>
        <a class="fd-row-link" href="/terms">
          Terms of service ›
        </a>
        <a class="fd-row-link" href="/copyright">
          Copyright: report a name or icon that copies your work ›
        </a>
      </section>

      <p class="fd-note maia-credit">
        Bosses and bots use <a href="https://stockfishchess.org">Stockfish</a> (GPL-3.0,{" "}
        <a href="https://github.com/official-stockfish/Stockfish">source</a>, <a href="https://github.com/nmrugg/stockfish.js">this build</a> and{" "}
        <a href="/engine/stockfish-source.tar.gz" download>its source</a>) and <a href="https://github.com/CSSLab/maia3">Maia-3</a> by
        CSSLab, University of Toronto (AGPL-3.0), each a separate program running in your browser. Our Maia box's{" "}
        <a href="/engine/maia/maia-box-source.tar.gz" download>source code</a> is free to download (<a href="/engine/maia/NOTICE.txt">notice</a>,{" "}
        <a href="/engine/maia/LICENSE.txt">license</a>).
      </p>
      <p class="fd-note pieces-credit">
        Chess pieces by Colin M.L. Burnett (<a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces">Wikimedia Commons</a>), used
        under the BSD license (<a href="/licenses/pieces.txt">license</a>).
      </p>
      <p class="fd-note sounds-credit">
        Classic piece sounds and their variations: <a href="https://github.com/pychess/pychess/tree/master/sounds">PyChess</a> (GPL-3.0). The
        variations are made from PyChess's sounds by our own script (<a href="/engine/COPYING.txt">license</a>,{" "}
        <a href="/sounds/SOURCES.md">how each was made</a>, <a href="/sounds/pychess-sounds-source.tar.gz" download>their source</a>).
      </p>
      <p class="fd-note licences-credit">
        Built with Preact (MIT) and chess.js (BSD), in the Archivo and Press Start 2P fonts (SIL Open Font License):{" "}
        <a href="/licenses/third-party.txt">licenses</a>.
      </p>
    </div>
  );
}
