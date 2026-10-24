import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { InstallCard } from "../components/InstallCard.tsx";
import { FriendSettings } from "../components/Friends.tsx";
import { openReport } from "../components/Problems.tsx";
import { SignIn } from "../components/SignIn.tsx";
import { AccountData } from "../components/AccountData.tsx";
import { BackButton } from "../components/FrontDoor.tsx";
import { signOut, tooYoung } from "../account.ts";
import { BOARD_COLORS, boardColors, chatBubbles, chatOff, crowdAnimations, crowdTrail, evalBarOn, onPrefsChange, practiceOn, setBoardColors, setChatBubbles, setChatOff, setCrowdAnimations, setCrowdTrail, setEvalBarOn, setPracticeOn, type BoardColors } from "../prefs.ts";
import { REEL_VOICES, getReelVoice, isMuted, onMuteChange, previewPieceSound, previewReel, setMuted, setReelVoice, unlockAudio, type ReelVoice } from "../sound.ts";
import { PIECE_SOUNDS, pieceSound, setPieceSound } from "../piece-sounds.ts";
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

interface SoundOption {
  readonly id: string;
  readonly label: string;
  readonly note: string;
}

/** The reveal's roulette voices, as the picker shows them (the first, the steel pan, is the default). */
const REVEAL_SOUNDS: readonly SoundOption[] = (Object.keys(REEL_VOICES) as ReelVoice[]).map((id) => ({ id, label: REEL_VOICES[id].label, note: REEL_VOICES[id].blurb }));

/**
 * A sound picker (Move, Capture and Reveal sound; Eric, Oct 24: "make these lists collapsed by default ... do this for all
 * sound fx and future sound fx options"). Collapsed, it shows the title, the current pick's name and a chevron; a tap on
 * the title row opens the list: each option is a radio (picking it plays it and keeps the list open) with its own ▶ to
 * hear it without picking. Each picker opens on its own. The open state isn't stored, so Settings opens collapsed.
 * Kept on the device; the first option is the default.
 */
function SoundPicker(props: { title: string; options: readonly SoundOption[]; chosen: string; pick: (id: string) => string; hear: (id: string) => void; children: ComponentChildren }) {
  const { title, options, pick, hear, children } = props;
  const [chosen, setChosen] = useState(props.chosen);
  const [open, setOpen] = useState(false);
  return (
    <div class="ps-picker">
      <button type="button" class="ps-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <strong>{title}</strong>
        <span class="ps-now">{options.find((o) => o.id === chosen)?.label}</span>
        <span class="ps-chev" aria-hidden="true">{"▾"}</span>
      </button>
      <div class="ps-note">{children}</div>
      {open && (
        <div class="ps-list" role="radiogroup" aria-label={title}>
          {options.map((o) => (
            <div key={o.id} class={`ps-row${chosen === o.id ? " on" : ""}`}>
              <button
                type="button"
                role="radio"
                aria-checked={chosen === o.id}
                class="ps-choice"
                onClick={() => {
                  setChosen(pick(o.id));
                  hear(o.id);
                }}
              >
                <strong>{o.label}</strong>
                <span>{o.note}</span>
              </button>
              <button type="button" class="ps-play" aria-label={`Play ${o.label}`} onClick={() => hear(o.id)}>
                {"\u25B6\uFE0E"}
              </button>
            </div>
          ))}
        </div>
      )}
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

/** The board colors, as the choice names them (Eric, Oct 18): the dark squares; Classic is the board as it always was. */
const BOARD_COLOR_LABELS: Record<BoardColors, string> = { classic: "Classic", green: "Green", gold: "Gold" };

/** A square of a preview's four by four, by column and row from its top left. */
const at = (col: number, row: number) => ({ transform: `translate(${col * 100}%, ${row * 100}%)` });

/**
 * Board colors: three small boards side by side, each a few squares in its own colors (the stylesheet colors them from
 * `data-board-colors`, as it does the real boards) with the last move, a piece, a move dot and a capture ring on them,
 * so you see how it will look. Tap one and every board on this device changes at once. Only this device: other
 * players see their own.
 */
function BoardColorsChoice() {
  const [chosen, setChosen] = useState(boardColors);
  return (
    <div class="ps-picker">
      <span class="fd-toggle-text">
        <strong>Board colors</strong>
        <span>The dark squares, on every board you see. Only you see them: other players keep their own.</span>
      </span>
      <div class="bcol-list" role="radiogroup" aria-label="Board colors">
        {BOARD_COLORS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={chosen === id}
            aria-label={BOARD_COLOR_LABELS[id]}
            data-board-colors={id}
            class={`bcol-opt${chosen === id ? " on" : ""}`}
            onClick={() => {
              setChosen(id);
              setBoardColors(id);
            }}
          >
            <span class="bcol-preview hb-pieces" aria-hidden="true">
              <i class="bcol-sq bcol-last" style={at(2, 3)} />
              <i class="bcol-sq bcol-last" style={at(2, 2)} />
              <i class="bcol-sq bcol-sel" style={at(1, 2)} />
              <i class="bcol-sq bcol-dot" style={at(0, 0)} />
              <i class="bcol-sq bcol-dot" style={at(2, 0)} />
              <i class="bcol-sq bcol-dot" style={at(3, 1)} />
              <i class="bcol-sq bcol-ring" style={at(3, 3)} />
              <piece class="pawn black" style={at(3, 3)} />
              <piece class="pawn white" style={at(2, 2)} />
              <piece class="knight white" style={at(1, 2)} />
            </span>
            <strong>{BOARD_COLOR_LABELS[id]}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Settings (Eric, Oct 15: "smoothness, quickness, with some variety offered"): the theme, sound (the move, capture and
 * reveal sounds), the board (animations, motion trail), quick chat, friends, how to play (and the FAQ), help (the
 * feedback sheet: bugs, feedback, ideas), installing, your sign-in, privacy and terms; and for admins, testing
 * (practice mode, the eval bar, and the shelved Auto chess demo).
 */
export function SettingsScreen({ onBack, onFaq, onAutoChess }: { onBack: () => void; onFaq?: (section?: string) => void; onAutoChess?: () => void }) {
  const { config, profile } = useAccount();
  const [, rerender] = useState(0);
  useEffect(() => onMuteChange(() => rerender((n) => n + 1)), []);
  // (Testing's switches read as they are now: who's a tester is known once the account loads.)
  useEffect(() => onPrefsChange(() => rerender((n) => n + 1)), []);
  const [anim, setAnim] = useState(crowdAnimations);
  const [trail, setTrail] = useState(crowdTrail);
  const [chatOn, setChatOn] = useState(() => !chatOff());
  const [bubbles, setBubbles] = useState(chatBubbles);
  const [busy, setBusy] = useState(false);
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
        <SoundPicker title="Move sound" options={PIECE_SOUNDS.move} chosen={pieceSound("move").id} pick={(id) => setPieceSound("move", id).id} hear={(id) => previewPieceSound("move", id)}>
          What a piece makes as it lands, in every mode. Tap {"\u25B6\uFE0E"} to hear one.
        </SoundPicker>
        <SoundPicker title="Capture sound" options={PIECE_SOUNDS.capture} chosen={pieceSound("capture").id} pick={(id) => setPieceSound("capture", id).id} hear={(id) => previewPieceSound("capture", id)}>
          When a piece takes another. Pick any with any move sound.
        </SoundPicker>
        <SoundPicker
          title="Reveal sound"
          options={REVEAL_SOUNDS}
          chosen={getReelVoice()}
          pick={(id) => {
            setReelVoice(id as ReelVoice);
            return id;
          }}
          hear={(id) => previewReel(id as ReelVoice)}
        >
          The roulette while the crowd's move is chosen, then three tones as it lands.
        </SoundPicker>
      </section>

      <section class="fd-section">
        <h2 class="fd-label">BOARD</h2>
        <BoardColorsChoice />
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

      <FriendSettings />

      {/* (How each mode works lives in one place, the FAQ: these open it.) */}
      {onFaq && (
        <section class="fd-section">
          <h2 class="fd-label">HOW TO PLAY</h2>
          <button type="button" class="fd-row-link" onClick={() => onFaq("modes")}>
            📖 How each mode works ›
          </button>
          <button type="button" class="fd-row-link" onClick={() => onFaq()}>
            📖 FAQ · How it works ›
          </button>
        </section>
      )}

      <section class="fd-section">
        <h2 class="fd-label">HELP</h2>
        <button type="button" class="fd-row-link" onClick={() => openReport("feedback")}>
          💬 Feedback ›
        </button>
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
              <p class="fd-sub">{tooYoung() ? "You're a guest on this device." : "You're a guest. Sign in to keep your profile on any device and to play online."}</p>
              <SignIn google={config.google} email={config.email} next="/settings" />
            </div>
          ) : (
            <p class="fd-note">You're a guest on this device.</p>
          )}
          <AccountData />
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

      {profile?.admin && (
        <section class="fd-section">
          <h2 class="fd-label">TESTING</h2>
          <p class="fd-note">For testers (admins). Players never see these: for them practice mode and the eval bar are off.</p>
          <Toggle title="Practice mode" checked={practiceOn()} onChange={setPracticeOn}>
            Unlimited power-ups (the engine's top 3 moves, any time). You're marked 💡 on the leaderboard.
          </Toggle>
          <Toggle title="Eval bar" checked={evalBarOn()} onChange={setEvalBarOn}>
            The engine's winning chances in a bar beside the board, in every mode. Off: no bar, and the board takes its room.
          </Toggle>
          {/* (Auto chess, the demo, shelved: Eric, Oct 19. Testers only; its screen is /autochess.) */}
          {onAutoChess && (
            <button type="button" class="fd-row-link" onClick={onAutoChess}>
              Auto chess (shelved demo) ›
            </button>
          )}
        </section>
      )}

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
